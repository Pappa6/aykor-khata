import React, { useState } from "react";
import { Check, Field } from "./ui.jsx";
import { parseAcknowledgement } from "./engine/parse.js";
import { loadHistory, saveHistory } from "./store.js";
import { sumByKind } from "./engine/ledger.js";
import { PinSettings } from "./Lock.jsx";
import { fmt as money } from "./ui.jsx";

const load = loadHistory;
const save = saveHistory;

const lastYears = (count) => {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // FY starts 1 April
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String(y + 1).slice(2)}`;
  });
};
const ayOf = (fy) => `${parseInt(fy.slice(0, 4), 10) + 1}-${String(parseInt(fy.slice(0, 4), 10) + 2).slice(2)}`;
const MONTH = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
const toISO = (t) => {
  const m = String(t || "").match(/(\d{1,2})[-\/ ]([A-Za-z]{3,9}|\d{1,2})[-\/ ,]+(\d{4})/);
  if (!m) return "";
  const mon = /\d/.test(m[2]) ? m[2].padStart(2, "0") : MONTH[m[2].slice(0, 3).toLowerCase()];
  return mon ? `${m[3]}-${mon}-${m[1].padStart(2, "0")}` : "";
};

export function History({ ctx }) {
  const { L, rules, go, profile, ledger } = ctx;
  const [h, setH] = useState(load);
  const [msg, setMsg] = useState("");
  const years = lastYears(5);
  const upd = (fy, patch) => { const next = { ...h, [fy]: { ...(h[fy] || {}), ...patch } }; setH(next); save(next); };
  const due = (fy) => rules.years[fy]?.dueDate || `${parseInt(fy.slice(0, 4), 10) + 1}-07-31`;
  const today = new Date().toISOString().slice(0, 10);

  const readAck = async (file) => {
    setMsg("");
    try {
      const { openPdf, pdfLines } = await import("./engine/pdf.js");
      const dob = profile.dob ? profile.dob.split("-").reverse().join("") : "";
      const o = await openPdf(file, profile.pan, dob);
      if (!o) return setMsg(L("PDF খুলতে পারিনি। হোমে ফিরে পরিচয় পাতায় PAN ও জন্মতারিখ দিয়ে আবার চেষ্টা করুন।", "Could not open the PDF. Enter PAN and date of birth on the identity page and retry."));
      const a = parseAcknowledgement(await pdfLines(o.pdf));
      const fy = a.ay ? `${parseInt(a.ay.slice(0, 4), 10) - 1}-${a.ay.slice(2, 4)}` : "";
      if (!fy || !years.includes(fy)) return setMsg(L("বছর বোঝা গেল না। হাতে ভরুন।", "Could not tell the year. Fill it by hand."));
      upd(fy, { filed: true, ack: a.ack, form: a.form, filedDate: toISO(a.dateText) });
      setMsg(L(`${fy}-এর ঘরে বসেছে। একবার মিলিয়ে নিন।`, `Filled into ${fy}. Please check it.`));
    } catch { setMsg(L("পড়তে সমস্যা হয়েছে।", "Could not read the file.")); }
  };

  return (
    <section className="page">
      <h1 className="t2">{L("ফাইলিং ইতিহাস", "Filing history")}</h1>
      <p className="lead">{L("শেষ ৫ বছরের কোনটা ফাইল হয়েছে, কবে। এটা শুধু এই ফোনে থাকে। পোর্টালে e-File → Income Tax Returns → View Filed Returns-এ আসল তালিকা দেখা যায়।", "Which of the last 5 years are filed, and when. Kept on this phone only. The real list is on the portal under e-File → Income Tax Returns → View Filed Returns.")}</p>
      <div className="paper">
        <h2 className="t3">{L("Acknowledgement (ITR-V) PDF থেকে নিজে ভরুন", "Fill from an acknowledgement (ITR-V) PDF")}</h2>
        <label className="btn ghost small filebtn">{L("PDF বেছে নিন", "Choose PDF")}<input type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) readAck(f); e.target.value = ""; }} /></label>
        {msg && <p className="msg">{msg}</p>}
      </div>
      {years.map((fy) => {
        const e = h[fy] || {};
        const overdue = !e.filed && today > due(fy);
        return (
          <div className="paper" key={fy} style={{ borderColor: e.filed ? "var(--green)" : overdue ? "var(--red)" : undefined, borderStyle: "solid" }}>
            <h2 className="t3">FY {fy} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 15 }}>(AY {ayOf(fy)})</span></h2>
            <p className="hint">{L("শেষ তারিখ", "Due")} {due(fy)} {e.filed ? "" : overdue ? `· ${L("তারিখ পেরিয়েছে, বাকি", "overdue, not filed")}` : `· ${L("বাকি", "pending")}`}</p>
            {(() => { const t = sumByKind(ledger, fy); return (t.advance + t.selfassess > 0) ? <p className="msg">{L("খাতায় কর জমা:", "Paid per ledger:")} {money(t.advance + t.selfassess)}</p> : null; })()}
            <Check checked={e.filed} onChange={(x) => upd(fy, { filed: x })}>{L("রিটার্ন ফাইল হয়েছে", "Return filed")}</Check>
            {e.filed && (
              <>
                <div className="grid2">
                  <Field label={L("ফাইলের তারিখ", "Filed on")} money={false} type="date" value={e.filedDate} onChange={(x) => upd(fy, { filedDate: x })} />
                  <Field label={L("ফর্ম", "Form")} money={false} value={e.form} onChange={(x) => upd(fy, { form: x })} placeholder="ITR-2" />
                </div>
                <Field label="Acknowledgement No." money={false} inputMode="numeric" value={e.ack} onChange={(x) => upd(fy, { ack: x })} />
                <Check checked={e.verified} onChange={(x) => upd(fy, { verified: x })}>{L("e-Verify হয়েছে", "e-Verified")}</Check>
                <Check checked={e.processed} onChange={(x) => upd(fy, { processed: x })}>{L("প্রসেস হয়েছে (143(1) নোটিশ এসেছে)", "Processed (143(1) intimation received)")}</Check>
              </>
            )}
          </div>
        );
      })}
      <div className="row-btns">
        <button className="btn ghost" onClick={() => go("home")}>{L("হোম", "Home")}</button>
        <button className="btn ghost" onClick={() => go("ledger")}>{L("কর জমার খাতা", "Tax payments ledger")}</button>
        <button className="btn ghost danger" style={{ color: "#fff" }} onClick={() => { if (window.confirm(L("ইতিহাস মুছবেন?", "Delete the history?"))) { setH({}); save({}); } }}>{L("ইতিহাস মুছুন", "Delete history")}</button>
      </div>
    </section>
  );
}

export function About({ ctx }) {
  const { L, rules, go, resetAll } = ctx;
  return (
    <section className="page">
      <h1 className="t2">{L("নিয়ম ও গোপনীয়তা", "Rules & privacy")}</h1>
      <h2 className="t3">{L("গোপনীয়তা", "Privacy")}</h2>
      <p>{L("আপনার ফাইল, PAN আর জন্মতারিখ এই ফোনের ভেতরেই পড়া হয়। কোনো সার্ভারে যায় না, কোনো লগইন নেই। PDF পড়ার ইঞ্জিন অ্যাপের ভেতরেই আছে, তাই বাইরের কোনো সাইটে অনুরোধও যায় না। শুধু নিয়ম হালনাগাদ আছে কিনা দেখতে অ্যাপ নিজের সাইট থেকে একটা ছোট নিয়ম-ফাইল আনে, তাতে আপনার কোনো তথ্য থাকে না।", "Your files, PAN and date of birth are read inside this phone. Nothing goes to a server and there is no login. The PDF reader is bundled in the app, so no outside site is contacted either. The app only fetches a small rules file from its own site to see if rules changed; it carries none of your data.")}</p>
      <p>{L("ফাইলিং ইতিহাস ছাড়া আর কিছু সংরক্ষণ হয় না। ট্যাব বন্ধ করলে বাকি সব মুছে যায়।", "Apart from the filing history nothing is stored. Closing the tab clears the rest.")}</p>
      <h2 className="t3">{L("কর-নিয়ম", "Tax rules")}</h2>
      <p>{L("সংস্করণ", "Version")}: {rules.version} · {L("হালনাগাদ", "updated")} {rules.updated}</p>
      <div className="note">{rules.status}</div>
      <p className="lead">{L("বাজেটের পর নিয়ম বদলাতে পারে। একজন মানুষ যাচাই করে নতুন নিয়ম-ফাইল প্রকাশ করলে অ্যাপ খোলামাত্র জানিয়ে দেবে।", "Rules can change after a Budget. When a person verifies and publishes a new rules file, the app tells you on opening.")}</p>
      <h2 className="t3">{L("সীমা", "Limits")}</h2>
      <ul>
        <li>{L("সারচার্জ, 87A-র মার্জিনাল রিলিফ আর 234B/C আনুমানিক। চূড়ান্ত অঙ্ক পোর্টাল দেখাবে।", "Surcharge, 87A marginal relief and 234B/C are estimates. The portal shows the final figure.")}</li>
        <li>{L("সোনা-রুপা-ডেট ফান্ড (ধারা 50AA), বিদেশি সম্পদ, ESOP, F&O আলাদা বিশেষ নিয়মে চলে। এ সব ক্ষেত্রে CA লাগবে।", "Gold, silver and debt funds (section 50AA), foreign assets, ESOP and F&O follow special rules. Use a CA for these.")}</li>
        <li>{L("PDF থেকে সারি পড়া অনুমানভিত্তিক। স্টেটমেন্টের নিজের মোটের সঙ্গে মেলানো না গেলে টুল 'যাচাই বাকি' লেখে।", "Reading rows from PDFs is heuristic. When it cannot match the statement's own total it says 'to verify'.")}</li>
      </ul>
      <PinSettings ctx={ctx} />
      <div className="row-btns" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={() => go("home")}>{L("হোম", "Home")}</button>
        <button className="btn danger" onClick={() => { if (window.confirm(L("সব তথ্য মুছে নতুন শুরু করবেন?", "Clear everything and start fresh?"))) resetAll(); }}>{L("মুছে নতুন শুরু", "Clear and start fresh")}</button>
      </div>
    </section>
  );
}
