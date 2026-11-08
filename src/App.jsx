import React, { useEffect, useMemo, useState } from "react";
import bundledRules from "./rules/rules.json";
import { computeAll, ageBandOf, n } from "./engine/tax.js";
import { selectForm } from "./engine/forms.js";
import { buildGuide } from "./engine/guide.js";
import { validateInputs, selfCheck } from "./engine/validate.js";
import { LangCtx } from "./ui.jsx";
import { Who, Papers, Questions, Income } from "./Screens.jsx";
import { Result, Guide } from "./Result.jsx";
import { History, About } from "./History.jsx";
import { LedgerScreen } from "./Ledger.jsx";
import { Lock } from "./Lock.jsx";
import { loadLedger, saveLedger, loadPin } from "./store.js";
import { sumByKind, advanceByPeriod } from "./engine/ledger.js";

const EMPTY_V = {
  salary: "", exemptSalary: "", interestSavings: "", interestDeposit: "", dividend: "", otherIncome: "",
  stcg111A: "", stcgOther: "", ltcg112A: "", ltcgOther: "", bfStcl: "", bfLtcl: "",
  tds: "", advanceTaxPaid: "", selfAssessmentPaid: "",
  turnover: "", digitalPct: "100", profit: "",
  hpRent: "", hpMuni: "", hpInterest: "",
  d80C: "", d80D: "", d80CCD1B: "", d80CCD2: "", d80G: "",
};
const EMPTY_Q = { business: "none", speculative: false, foreign: false, esop: false, unlisted: false, director: false, hp: "none", hpMore: false, bf: false, oldDed: false };
const EMPTY_P = { name: "", pan: "", dob: "", ageBand: "below60" };

const todayISO = () => new Date().toISOString().slice(0, 10);

// A crash must never leave a blank screen. It shows a calm message and a way out.
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const bn = this.props.lang === "bn";
    return (
      <section className="page fallback" role="alert">
        <h1 className="t2">{bn ? "একটা সমস্যা হয়েছে" : "Something went wrong"}</h1>
        <p className="lead">{bn ? "আপনার ভুল নয়। নিচের বোতামে সব মুছে নতুন করে শুরু করুন। সমস্যা বারবার হলে কোন পাতায় হলো সেটা নোট করে রাখুন।" : "It is not your fault. Use the button below to clear everything and start again."}</p>
        <button className="btn" onClick={this.props.onReset}>{bn ? "মুছে নতুন শুরু" : "Clear and start fresh"}</button>
      </section>
    );
  }
}

export default function App() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("ak_lang") || "bn"; } catch { return "bn"; } });
  const [rules, setRules] = useState(bundledRules);
  const [rulesBanner, setRulesBanner] = useState(null);
  const [swUpdate, setSwUpdate] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const [fy, setFy] = useState("2026-27");
  const [step, setStep] = useState("home");
  const [profile, setProfile] = useState(EMPTY_P);
  const [v, setV] = useState(EMPTY_V);
  const [q, setQ] = useState(EMPTY_Q);
  const [papers, setPapers] = useState({});
  const [regimeChoice, setRegimeChoice] = useState("auto");
  const [fileOn, setFileOn] = useState("");
  const [scale, setScale] = useState(() => { try { return parseFloat(localStorage.getItem("ak_scale")) || 1; } catch { return 1; } });
  const [boundaryKey, setBoundaryKey] = useState(0);
  const [ledger, setLedgerRaw] = useState(loadLedger);
  const setLedger = (l) => { setLedgerRaw(l); saveLedger(l); };
  const [pinSet, setPinSet] = useState(() => !!loadPin());
  const [locked, setLocked] = useState(() => !!loadPin());
  const [historyTick, setHistoryTick] = useState(0);

  const L = (bn, en) => (lang === "bn" ? bn : en);
  useEffect(() => { document.documentElement.style.setProperty("--scale", String(scale)); try { localStorage.setItem("ak_scale", String(scale)); } catch { /* ignore */ } }, [scale]);
  useEffect(() => { try { localStorage.setItem("ak_lang", lang); } catch { /* ignore */ } document.documentElement.lang = lang === "bn" ? "bn" : "en"; }, [lang]);

  // Rules check on open: a newer rules file replaces the bundled one without a new app build.
  useEffect(() => {
    fetch("./rules/rules.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((remote) => {
        if (remote && remote.version && remote.version > bundledRules.version) {
          setRules(remote);
          setRulesBanner(remote.version);
        }
      })
      .catch(() => {});
    const onUpd = () => setSwUpdate(true);
    window.addEventListener("ak-sw-update", onUpd);
    const onInstall = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => { window.removeEventListener("ak-sw-update", onUpd); window.removeEventListener("beforeinstallprompt", onInstall); };
  }, []);

  const Y = rules.years[fy];
  const ageBand = profile.dob ? ageBandOf(profile.dob, fy) : profile.ageBand;
  const today = todayISO();
  const late = today > Y.dueDate;

  const fromLedger = useMemo(() => sumByKind(ledger, fy), [ledger, fy]);
  const inp = useMemo(() => ({
    dob: profile.dob, ageBand, regimeChoice: regimeChoice === "auto" ? undefined : regimeChoice,
    salary: n(v.salary), exemptSalary: n(v.exemptSalary),
    interestSavings: n(v.interestSavings), interestDeposit: n(v.interestDeposit), dividend: n(v.dividend), otherIncome: n(v.otherIncome),
    stcg111A: n(v.stcg111A), stcgOther: n(v.stcgOther), ltcg112A: n(v.ltcg112A), ltcgOther: n(v.ltcgOther),
    bfStcl: n(v.bfStcl), bfLtcl: n(v.bfLtcl),
    tds: n(v.tds),
    advanceTaxPaid: fromLedger.advance > 0 ? fromLedger.advance : n(v.advanceTaxPaid),
    selfAssessmentPaid: fromLedger.selfassess > 0 ? fromLedger.selfassess : n(v.selfAssessmentPaid),
    advanceByDue: fromLedger.advance > 0 ? advanceByPeriod(rules, fy, ledger) : n(v.advanceTaxPaid) > 0 ? [0, 0, 0, n(v.advanceTaxPaid)] : undefined,
    hp: { type: q.hp, rent: n(v.hpRent), municipalTax: n(v.hpMuni), interest: n(v.hpInterest) },
    business: { type: q.business === "none" ? "none" : q.business === "regular" ? "regular" : v.profit ? "regular" : "44AD", turnover: n(v.turnover), digitalPct: n(v.digitalPct), profit: n(v.profit) },
    d80C: n(v.d80C), d80D: n(v.d80D), d80CCD1B: n(v.d80CCD1B), d80CCD2: n(v.d80CCD2), d80G: n(v.d80G),
    filingDate: late ? (fileOn || today) : undefined,
    place: "",
  }), [profile, ageBand, v, q, regimeChoice, late, fileOn, today, fromLedger, ledger, rules, fy]);

  const res = useMemo(() => computeAll(rules, fy, inp), [rules, fy, inp]);
  const val = useMemo(() => validateInputs({ v, q, profile, res, today }), [v, q, profile, res, today]);
  const problems = useMemo(() => selfCheck(res), [res]);

  const form = useMemo(() => {
    const hpCount = q.hp === "none" ? 0 : q.hpMore ? 2 : 1;
    return selectForm({
      resident: true,
      totalIncome: res.chosen.totalIncome,
      business: q.business === "none" ? "none" : q.business,
      turnover: n(v.turnover),
      hpCount,
      stcg: n(v.stcg111A) !== 0 || n(v.stcgOther) !== 0,
      ltcgOther: n(v.ltcgOther) !== 0,
      ltcg112A: n(v.ltcg112A),
      foreignAsset: q.foreign, director: q.director, unlisted: q.unlisted, esop: q.esop,
      speculative: q.speculative,
      bfLoss: q.bf || n(v.bfStcl) > 0 || n(v.bfLtcl) > 0,
    });
  }, [res, q, v]);

  const guide = useMemo(
    () => buildGuide({ form: form.form, fy, res, inp, cg: papers.cg?.c, rules, payments: ledger.filter((e) => e.fy === fy) }),
    [form, fy, res, inp, papers.cg, rules, ledger],
  );

  const dirty = useMemo(
    () => Object.entries(v).some(([k, x]) => k !== "digitalPct" && x !== "") || !!profile.pan || !!profile.dob || Object.keys(papers).length > 0,
    [v, profile, papers],
  );
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Move focus to the page heading on every step, so screen readers announce where you are.
  useEffect(() => {
    const h = document.querySelector(".page h1, .page h2");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }, [step]);

  // Lock again after 5 idle minutes or after the app was away for 5 minutes.
  useEffect(() => {
    if (!pinSet) return undefined;
    let last = Date.now();
    let timer;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => setLocked(true), 5 * 60 * 1000); };
    const touch = () => { last = Date.now(); arm(); };
    const vis = () => { if (document.visibilityState === "visible" && Date.now() - last > 5 * 60 * 1000) setLocked(true); else touch(); };
    ["pointerdown", "keydown", "touchstart", "scroll"].forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", vis);
    arm();
    return () => { clearTimeout(timer); ["pointerdown", "keydown", "touchstart", "scroll"].forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener("visibilitychange", vis); };
  }, [pinSet]);

  const resetAll = () => {
    setProfile(EMPTY_P); setV(EMPTY_V); setQ(EMPTY_Q); setPapers({}); setRegimeChoice("auto"); setFileOn(""); setStep("home"); setBoundaryKey((k) => k + 1);
  };

  const ctx = { lang, L, rules, fy, setFy, Y, profile, setProfile, v, setV, q, setQ, papers, setPapers, step, go: setStep, res, inp, form, guide, ageBand, regimeChoice, setRegimeChoice, resetAll, installEvt, today, late, fileOn, setFileOn, val, problems, ledger, setLedger, fromLedger, pinSet, setPinSet, setHistoryTick, historyTick };

  const applyUpdate = () => {
    navigator.serviceWorker?.getRegistration().then((r) => r?.waiting?.postMessage("SKIP_WAITING"));
    setTimeout(() => window.location.reload(), 400);
  };

  const screens = { who: Who, papers: Papers, questions: Questions, income: Income, result: Result, guide: Guide, history: History, about: About, ledger: LedgerScreen };
  const Screen = screens[step];

  if (locked && pinSet) return <LangCtx.Provider value={{ lang, L }}><Lock onUnlock={() => setLocked(false)} /></LangCtx.Provider>;

  return (
    <LangCtx.Provider value={{ lang, L }}>
      <div className="app">
        <a className="skip" href="#main">{L("মূল অংশে যান", "Skip to content")}</a>
        <header className="top noprint">
          <button className="brand" onClick={() => setStep("home")}>
            <span className="mark" aria-hidden="true">₹</span>
            <span><b>{L("আয়কর খাতা", "Aykor Khata")}</b><small>{L("আপনার ফোনেই, আপনার তথ্য", "On your phone, your data")}</small></span>
          </button>
          <div className="chips">
            <button className="chip" onClick={() => setScale((x) => Math.max(0.85, +(x - 0.1).toFixed(2)))} aria-label={"A− " + L("অক্ষর ছোট করুন", "Smaller text")}>A−</button>
            <button className="chip" onClick={() => setScale((x) => Math.min(1.4, +(x + 0.1).toFixed(2)))} aria-label={"A+ " + L("অক্ষর বড় করুন", "Larger text")}>A+</button>
            {pinSet && <button className="chip" onClick={() => setLocked(true)}>{L("লক", "Lock")}</button>}
            <button className={"chip" + (lang === "bn" ? " on" : "")} onClick={() => setLang("bn")}>বাং</button>
            <button className={"chip" + (lang === "en" ? " on" : "")} onClick={() => setLang("en")}>EN</button>
          </div>
        </header>

        {swUpdate && (
          <div className="banner noprint" role="status">
            <span>{L("অ্যাপের নতুন সংস্করণ এসেছে।", "A new version of the app is ready.")}</span>
            <button onClick={applyUpdate}>{L("চালু করুন", "Update")}</button>
          </div>
        )}
        {rulesBanner && (
          <div className="banner soft noprint" role="status">
            {L(`কর-নিয়ম হালনাগাদ হয়েছে (${rulesBanner})।`, `Tax rules updated (${rulesBanner}).`)}
          </div>
        )}

        <main id="main">
          <Boundary key={boundaryKey + step} lang={lang} onReset={resetAll}>
            {step === "home" ? <Home ctx={ctx} /> : <Screen ctx={ctx} />}
          </Boundary>
        </main>

        <footer className="foot noprint">
          <p>{L("এটা হিসাবের সহায়ক, কর-পরামর্শ বা ফাইলিং নয়। ফাইল করার আগে CA-র সঙ্গে মিলিয়ে নিন।", "A calculation aid, not tax advice or a filing. Check with a CA before filing.")}</p>
          <button className="linklike" onClick={() => setStep("about")}>{L("নিয়ম, গোপনীয়তা ও PIN", "Rules, privacy & PIN")}</button>
          <p className="credit">Prepared by তন্ময় মুখার্জী</p>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}

function Home({ ctx }) {
  const { L, rules, fy, setFy, go, installEvt, resetAll } = ctx;
  const years = Object.keys(rules.years).sort().reverse();
  return (
    <>
      <section className="page">
        <div className="step-tag">{L("শুরু", "Start")}</div>
        <h1>{L("আপনার কর কত, এক জায়গায় দেখুন", "See your tax in one place")}</h1>
        <p className="lead">{L("কাগজ দিন, কয়েকটা প্রশ্নের উত্তর দিন। হিসাব, ফর্ম বাছাই আর পোর্টালে ভরার ধাপ আমি সাজিয়ে দেব।", "Give your papers and answer a few questions. Calculation, form choice and portal steps are arranged for you.")}</p>
        <div className="choices" role="radiogroup" aria-label={L("কোন বছর", "Which year")}>
          {years.map((y) => (
            <button key={y} role="radio" aria-checked={fy === y} className={"choice" + (fy === y ? " on" : "")} onClick={() => setFy(y)}>
              {rules.years[y].label}
              <small style={{ display: "block", color: "var(--muted)", fontWeight: 400 }}>
                {y === "2026-27" ? L("চলতি বছর: এখন পর্যন্ত আর বাকি মাসের আন্দাজ", "Current year: so far plus an estimate for the rest") : L("আগের বছর: রিটার্ন ফাইলের হিসাব", "Last year: for the return")}
              </small>
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => go("who")}>{L("শুরু করুন", "Start")}</button>
        <button className="btn ghost" onClick={() => go("ledger")}>{L("কর জমার খাতা", "Tax payments ledger")}</button>
        <button className="btn ghost" onClick={() => go("history")}>{L("ফাইলিং ইতিহাস", "Filing history")}</button>
        {installEvt && (
          <button className="btn ghost" onClick={() => installEvt.prompt()}>{L("ফোনে অ্যাপ হিসেবে বসান", "Install on this phone")}</button>
        )}
      </section>
      <section className="page flat">
        <h2 className="t3">{L("আপনার তথ্য কোথাও যায় না", "Your data goes nowhere")}</h2>
        <p className="lead">{L("সব ফাইল আপনার ফোনের ভেতরেই পড়া হয়। কোনো সার্ভার নেই, লগইন নেই। ট্যাব বন্ধ করলে সব মুছে যায়।", "Every file is read inside your phone. No server, no login. Closing the tab clears everything.")}</p>
        <button className="linklike" onClick={resetAll}>{L("মুছে নতুন শুরু", "Clear everything and start fresh")}</button>
      </section>
    </>
  );
}
