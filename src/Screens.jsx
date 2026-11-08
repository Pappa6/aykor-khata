import React, { useState } from "react";
import { Field, Choice, Check, Progress, Stamp, Help, fmt } from "./ui.jsx";
import { classifyTransactions, reconcile, templateCSV } from "./engine/cg.js";
import { htmlToRows, parseAisText, pdfLinesToRows, statementGainTotals, xlsxToRows } from "./engine/parse.js";
import { n } from "./engine/tax.js";

const dobDigits = (iso) => (iso ? iso.split("-").reverse().join("") : "");
const STEPS = ["who", "papers", "questions", "income", "result"];

function Nav({ ctx, back, next, nextLabel, disabled }) {
  const { L, go } = ctx;
  return (
    <div className="row-btns noprint">
      <button className="btn ghost" onClick={() => go(back)}>{L("পিছনে", "Back")}</button>
      <button className="btn" disabled={disabled} onClick={() => go(next)}>{nextLabel || L("এগিয়ে চলুন", "Continue")}</button>
    </div>
  );
}

// ---------------------------------------------------------------- 1. who
export function Who({ ctx }) {
  const { L, profile, setProfile, rules, fy, val } = ctx;
  const set = (k) => (x) => setProfile({ ...profile, [k]: x });
  const msg = (f) => { const e = val.errors.find((x) => x.field === f) || val.warnings.find((x) => x.field === f); return e ? L(e.bn, e.en) : undefined; };
  const blocked = val.errors.some((e) => e.field === "dob");
  return (
    <section className="page">
      <Progress step={0} total={5} />
      <div className="step-tag">{L("ধাপ ১ / ৫", "Step 1 of 5")}</div>
      <h1 className="t2">{L("আপনার পরিচয়", "About you")}</h1>
      <p className="lead">{L(`${rules.years[fy].label}-এর হিসাব। বয়স দিয়ে ছাড় ঠিক হয়, আর PAN ও জন্মতারিখ দিয়ে পাসওয়ার্ড দেওয়া PDF খোলা হয়। এগুলো এই ফোনের বাইরে যায় না।`, `Figures for ${rules.years[fy].label}. Age decides the exemption, and PAN and date of birth unlock protected PDFs. None of it leaves this phone.`)}</p>
      <Field label={L("নাম (ঐচ্ছিক)", "Name (optional)")} money={false} value={profile.name} onChange={set("name")} />
      <Field label="PAN" money={false} value={profile.pan} onChange={(x) => set("pan")(x.toUpperCase().replace(/\s/g, ""))} placeholder="ABCDE1234F" error={msg("pan")} />
      <Field label={L("জন্মতারিখ", "Date of birth")} money={false} type="date" value={profile.dob} onChange={set("dob")} error={msg("dob")} />
      {!profile.dob && (
        <label className="field">
          <span>{L("জন্মতারিখ না দিলে বয়স বেছে নিন", "Or pick an age band")}</span>
          <select className="input" value={profile.ageBand} onChange={(e) => set("ageBand")(e.target.value)}>
            <option value="below60">{L("৬০ বছরের কম", "Below 60")}</option>
            <option value="60-80">{L("৬০ থেকে ৮০", "60 to 80")}</option>
            <option value="80+">{L("৮০-র বেশি", "Above 80")}</option>
          </select>
        </label>
      )}
      <Nav ctx={ctx} back="home" next="papers" disabled={blocked} />
    </section>
  );
}

// ---------------------------------------------------------------- 2. papers
function PaperCard({ title, hint, accept, status, onFile, doneText, L }) {
  const [busy, setBusy] = useState(false);
  const ok = status?.ok;
  return (
    <div className={"paper" + (ok ? " done" : "")}>
      <h2 className="t3">{ok ? "✓ " : ""}{title}</h2>
      <p className="hint">{hint}</p>
      <label className="btn ghost small filebtn">
        {busy ? L("পড়ছি…", "Reading…") : ok ? L("অন্য ফাইল", "Another file") : L("ফাইল বেছে নিন", "Choose file")}
        <input type="file" accept={accept} onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { await onFile(f); } finally { setBusy(false); e.target.value = ""; }
        }} />
      </label>
      <div role="status" aria-live="polite">{status && <p className={"msg " + (status.ok ? "ok" : "err")}>{status.msg}</p>}</div>
      {ok && doneText}
    </div>
  );
}

async function readLines(file, profile, extra) {
  if (/\.pdf$/i.test(file.name)) {
    const { openPdf, pdfLines } = await import("./engine/pdf.js");
    const opened = await openPdf(file, profile.pan, dobDigits(profile.dob), extra);
    if (!opened) return { error: "locked" };
    return { lines: await pdfLines(opened.pdf) };
  }
  return { lines: (await file.text()).split(/\r?\n/) };
}

const MAX_MB = 30;
const KNOWN = /\.(pdf|csv|xlsx|xls|html?|txt)$/i;

function downloadTemplate() {
  const blob = new Blob([templateCSV()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function Papers({ ctx }) {
  const { L, profile, papers, setPapers, setV, fy } = ctx;
  const [extraPw, setExtraPw] = useState("");
  const [needPw, setNeedPw] = useState(false);
  const fail = (key, msg) => setPapers((p) => ({ ...p, [key]: { ok: false, msg } }));
  const precheck = (key, file) => {
    if (file.size === 0) { fail(key, L("ফাইলটা ফাঁকা। অন্য ফাইল বেছে নিন।", "The file is empty. Choose another file.")); return false; }
    if (file.size > MAX_MB * 1048576) { fail(key, L(`ফাইল ${MAX_MB} MB-র বেশি বড়। শুধু প্রয়োজনীয় পাতাগুলো আলাদা করে দিন।`, `The file is over ${MAX_MB} MB. Send only the pages you need.`)); return false; }
    if (!KNOWN.test(file.name)) { fail(key, L("এই ধরনের ফাইল পড়তে পারি না। PDF, CSV, Excel বা HTML দিন।", "This file type cannot be read. Use PDF, CSV, Excel or HTML.")); return false; }
    return true;
  };
  const lockedMsg = L("PDF খুলল না। করণীয়: (১) আগের পাতায় PAN ও জন্মতারিখ ঠিক আছে কিনা দেখুন। (২) ফাইলের পাসওয়ার্ড অন্য কিছু হলে নিচের 'অন্য পাসওয়ার্ড' ঘরে লিখে আবার ফাইল বেছে নিন। (৩) না হলে এই ধাপ এড়িয়ে পরের পাতায় হাতে দিন।", "Could not open the PDF. What to do: (1) check PAN and date of birth on the previous page; (2) if the file uses another password, type it below and choose the file again; (3) otherwise skip and enter figures by hand.");

  const onAis = async (file) => {
    if (!precheck("ais", file)) return;
    try {
      const r = await readLines(file, profile, extraPw);
      if (r.error) { setNeedPw(true); return fail("ais", lockedMsg); }
      const found = parseAisText(r.lines);
      const keys = Object.keys(found);
      if (!keys.length) return fail("ais", L("এই ফাইল থেকে আয়ের সংখ্যা পড়া গেল না। করণীয়: TIS PDF (সারসংক্ষেপ) চেষ্টা করুন, অথবা পরের পাতায় হাতে দিন।", "No income figures could be read. Try the TIS PDF (the summary), or enter figures by hand."));
      setV((v) => ({
        ...v,
        salary: found.salary !== undefined ? String(found.salary) : v.salary,
        interestSavings: found.interestSavings !== undefined ? String(found.interestSavings) : v.interestSavings,
        interestDeposit: found.interestDeposit !== undefined ? String(found.interestDeposit) : v.interestDeposit,
        dividend: found.dividend !== undefined ? String(found.dividend) : v.dividend,
      }));
      setPapers((p) => ({ ...p, ais: { ok: true, found, msg: L(`পড়া হয়েছে: ${keys.length}টা সংখ্যা। পরের পাতায় মিলিয়ে নেবেন।`, `Read ${keys.length} figures. You will confirm them on a later page.`) } }));
    } catch (e) {
      fail("ais", L("ফাইল পড়তে গিয়ে সমস্যা হয়েছে। করণীয়: ফাইলটা অক্ষত আছে কিনা দেখুন, নইলে পোর্টাল থেকে আবার নামিয়ে নিন।", "Something went wrong reading the file. Check it is not damaged, or download it again from the portal."));
    }
  };

  const onCG = async (file) => {
    if (!precheck("cg", file)) return;
    try {
      let rows = [];
      let totals = { stcg: null, ltcg: null };
      if (/\.csv$/i.test(file.name)) {
        const Papa = (await import("papaparse")).default;
        rows = await new Promise((res, rej) => Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => res(r.data), error: rej }));
      } else if (/\.xlsx?$/i.test(file.name)) {
        rows = await xlsxToRows(file);
      } else if (/\.html?$/i.test(file.name)) {
        rows = htmlToRows(await file.text());
      } else {
        const r = await readLines(file, profile, extraPw);
        if (r.error) { setNeedPw(true); return fail("cg", lockedMsg); }
        rows = pdfLinesToRows(r.lines);
        totals = statementGainTotals(r.lines);
      }
      if (!rows.length) return fail("cg", L("লেনদেনের সারি পাওয়া গেল না। করণীয়: নিচের 'CSV টেমপ্লেট নামান'-এ আপনার লেনদেন বসিয়ে দিন, অথবা পরের পাতায় মোট অঙ্ক হাতে দিন।", "No transaction rows found. Download the CSV template below and fill your trades in, or enter totals by hand later."));
      const c = classifyTransactions(rows, fy);
      if (c.items.length === 0) return fail("cg", L("সারিগুলোর তারিখ বা দাম পড়া যায়নি। করণীয়: কলামের নাম 'Buy Date', 'Sell Date', 'Cost of Acquisition', 'Sale Value' করে দিন, বা টেমপ্লেট ব্যবহার করুন।", "Dates or amounts could not be read. Name the columns 'Buy Date', 'Sell Date', 'Cost of Acquisition', 'Sale Value', or use the template."));
      const recon = [reconcile("STCG", c.s1 + c.so, totals.stcg), reconcile("LTCG", c.l1 + c.lo, totals.ltcg)].filter(Boolean);
      setV((v) => ({ ...v, stcg111A: String(Math.round(c.s1)), stcgOther: String(Math.round(c.so)), ltcg112A: String(Math.round(c.l1)), ltcgOther: String(Math.round(c.lo)) }));
      const bad = recon.some((r) => !r.ok);
      setPapers((p) => ({ ...p, cg: { ok: true, c, recon, msg: bad ? L("পড়া হয়েছে, কিন্তু স্টেটমেন্টের নিজের মোটের সঙ্গে মেলেনি। সারিগুলো দেখে নিন।", "Read, but it does not match the statement's own total. Check the rows.") : L(`${c.items.length}টা লেনদেন পড়া হয়েছে।${c.skipped ? ` ${c.skipped}টা বাদ গেছে।` : ""}`, `Read ${c.items.length} transactions.${c.skipped ? ` ${c.skipped} skipped.` : ""}`) } }));
    } catch (e) {
      fail("cg", L("ফাইল পড়তে গিয়ে সমস্যা হয়েছে। করণীয়: CSV টেমপ্লেটে লেনদেন বসিয়ে আবার দিন।", "Something went wrong reading the file. Put the trades into the CSV template and try again."));
    }
  };

  const cg = papers.cg;
  return (
    <section className="page">
      <Progress step={1} total={5} />
      <div className="step-tag">{L("ধাপ ২ / ৫", "Step 2 of 5")}</div>
      <h1 className="t2">{L("কাগজ দিন", "Your papers")}</h1>
      <p className="lead">{L("যে কাগজ আছে শুধু সেটাই দিন। না থাকলে এড়িয়ে যান, পরের পাতায় হাতে ভরা যায়। পাসওয়ার্ড দেওয়া PDF-ও চলবে।", "Give only what you have. Skip the rest and fill by hand later. Password-protected PDFs work too.")}</p>

      <PaperCard L={L} title={<>{L("TIS বা AIS (আয়কর পোর্টাল থেকে)", "TIS or AIS (from the income tax portal)")}<Help t="ais" /></>}
        hint={L("Services → Annual Information Statement থেকে নামানো PDF। TIS-এ মোট অঙ্ক থাকে, সেটাই সবচেয়ে সহজে পড়া যায়।", "The PDF from Services → Annual Information Statement. TIS has category totals and reads best.")}
        accept=".pdf,.txt,.html,.htm" status={papers.ais} onFile={onAis} />

      <PaperCard L={L} title={L("শেয়ার বা মিউচুয়াল ফান্ডের লাভ-ক্ষতির স্টেটমেন্ট", "Share / mutual fund gains statement")}
        hint={L("CSV, Excel, HTML বা PDF। কলাম: নাম, কেনার তারিখ, বিক্রির তারিখ, কেনার দাম, বিক্রির দাম।", "CSV, Excel, HTML or PDF. Columns: name, buy date, sell date, cost, sale value.")}
        accept=".csv,.xlsx,.xls,.html,.htm,.pdf" status={cg} onFile={onCG}
        doneText={cg?.c && (
          <div>
            <p>{L("বিভাগ করা লাভ", "Sorted gains")}: STCG 111A {fmt(cg.c.s1)} · LTCG 112A {fmt(cg.c.l1)}{cg.c.so ? ` · ${L("অন্য STCG", "Other STCG")} ${fmt(cg.c.so)}` : ""}{cg.c.lo ? ` · ${L("অন্য LTCG", "Other LTCG")} ${fmt(cg.c.lo)}` : ""}</p>
            {cg.recon?.length > 0 && (
              <div className="stamp-row"><Stamp ok={cg.recon.every((r) => r.ok)} big={cg.recon.every((r) => r.ok) ? L("মিলেছে", "Matched") : L("মেলেনি", "No match")} small={L("স্টেটমেন্টের মোট", "statement total")} /></div>
            )}
            {cg.c.warnings.slice(0, 4).map((w, i) => <p key={i} className="msg err">{L(w.bn, w.en)}</p>)}
            {cg.c.warnings.length > 4 && <p className="msg err">{L(`আরও ${cg.c.warnings.length - 4}টা সতর্কতা আছে।`, `${cg.c.warnings.length - 4} more warnings.`)}</p>}
          </div>
        )} />
      <button className="linklike" onClick={downloadTemplate}>{L("CSV টেমপ্লেট নামান", "Download the CSV template")}</button>

      {(needPw || extraPw) && (
        <Field label={L("অন্য পাসওয়ার্ড (PDF-এর পাসওয়ার্ড PAN/জন্মতারিখ না হলে)", "Another password (if the PDF does not use PAN / date of birth)")} money={false} value={extraPw} onChange={setExtraPw} />
      )}
      <div className="note blue">{L("৩১-জানু-২০১৮-র বাজারদর (FMV) কোনো স্টেটমেন্টে থাকে না। ওই তারিখের আগে কেনা শেয়ারের জন্য 'FMV 31-Jan-2018' নামে আলাদা কলামে দিন। না দিলে আসল দাম ধরে কর কিছুটা বেশি আসতে পারে, টুল সেটা জানিয়ে দেবে।", "The 31-Jan-2018 price (FMV) is on no statement. For holdings bought before that date add it in a column named 'FMV 31-Jan-2018'. Without it the original cost is used and tax may be higher; the tool will say so.")}</div>
      <Nav ctx={ctx} back="who" next="questions" nextLabel={L("এগিয়ে চলুন (কাগজ না থাকলেও চলবে)", "Continue (fine even without papers)")} />
    </section>
  );
}

// ---------------------------------------------------------------- 3. questions
export function Questions({ ctx }) {
  const { L, q, setQ, v, setV } = ctx;
  const set = (k) => (val) => setQ({ ...q, [k]: val });
  const setBiz = (k) => (val) => {
    const nx = { ...q, [k]: val };
    nx.business = nx.bizBooks ? "regular" : nx.bizPres || nx.bizPro ? "presumptive" : "none";
    setQ(nx);
  };
  const sv = (k) => (val) => setV({ ...v, [k]: val });
  return (
    <section className="page">
      <Progress step={2} total={5} />
      <div className="step-tag">{L("ধাপ ৩ / ৫", "Step 3 of 5")}</div>
      <h1 className="t2">{L("কয়েকটা সহজ প্রশ্ন", "A few simple questions")}</h1>

      <h2 className="t3">{L("ব্যবসা বা পেশা থেকে আয় আছে?", "Any income from business or profession?")}</h2>
      <p className="hint">{L("না থাকলে কিছুই টিক দেবেন না। একাধিক থাকলে সব টিক দিন।", "If none, tick nothing. If you have more than one kind, tick all of them.")}</p>
      <Check checked={q.bizBooks} onChange={setBiz("bizBooks")}>{L("হিসাবের খাতা রাখি, ব্যবসা বা পেশা (নিট লাভ জানি)", "I keep books of accounts (I know my net profit)")}</Check>
      <Check checked={q.bizPres} onChange={setBiz("bizPres")}>{L("ছোট ব্যবসা, অনুমিত আয় (44AD): দোকান, ট্রেডিং, সার্ভিস", "Small business, presumptive (44AD): shop, trading, services")}</Check>
      <Check checked={q.bizPro} onChange={setBiz("bizPro")}>{L("ছোট পেশা, অনুমিত আয় (44ADA): ডাক্তার, শিক্ষক, পরামর্শদাতা, আর্কিটেক্ট ইত্যাদি", "Small profession, presumptive (44ADA): doctor, tutor, consultant, architect")}</Check>

      <h2 className="t3">{L("নিচের কোনোটা আছে?", "Any of these apply?")}</h2>
      <Check checked={q.speculative} onChange={set("speculative")}>{L("F&O বা intraday ট্রেডিং", "F&O or intraday trading")}</Check>
      <Check checked={q.foreign} onChange={set("foreign")}>{L("বিদেশে সম্পদ বা বিদেশি আয়", "Assets or income abroad")}</Check>
      <Check checked={q.unlisted} onChange={set("unlisted")}>{L("আনলিস্টেড কোম্পানির শেয়ার", "Unlisted company shares")}</Check>
      <Check checked={q.director} onChange={set("director")}>{L("কোনো কোম্পানির ডিরেক্টর", "Director of a company")}</Check>
      <Check checked={q.esop} onChange={set("esop")}>{L("স্টার্টআপ ESOP-এর কর স্থগিত", "Deferred start-up ESOP tax")}</Check>

      <h2 className="t3">{L("বাড়ি", "House property")}</h2>
      <Choice value={q.hp} onChange={set("hp")} options={[
        ["none", L("কোনো বাড়ির আয় বা সুদের ছাড় নেই", "No house income or interest claim")],
        ["self", L("নিজে থাকি (ঋণের সুদ থাকতে পারে)", "Self-occupied (may have loan interest)")],
        ["letout", L("ভাড়া দিয়েছি", "Let out")],
      ]} />
      {q.hp !== "none" && <Check checked={q.hpMore} onChange={set("hpMore")}>{L("একটার বেশি বাড়ি", "More than one house")}</Check>}
      {q.hp === "letout" && (
        <div className="grid2">
          <Field label={L("বছরে ভাড়া", "Annual rent")} value={v.hpRent} onChange={sv("hpRent")} />
          <Field label={L("পৌরকর", "Municipal tax")} value={v.hpMuni} onChange={sv("hpMuni")} />
        </div>
      )}
      {q.hp !== "none" && <Field label={L("বাড়ির ঋণের সুদ (বছরে)", "Home-loan interest (a year)")} value={v.hpInterest} onChange={sv("hpInterest")} hint={L("পুরোনো regime-এ নিজের বাড়িতে ₹2 লাখ পর্যন্ত।", "Up to ₹2 lakh for a self-occupied home in the old regime.")} />}

      <h2 className="t3">{L("আগের বছরের লোকসান জের টানা আছে?", "Any losses carried forward from earlier years?")}</h2>
      <Choice value={q.bf ? "y" : "n"} onChange={(x) => set("bf")(x === "y")} options={[["n", L("না", "No")], ["y", L("হ্যাঁ", "Yes")]]} />
      {q.bf && (
        <div className="grid2">
          <Field label={L("স্বল্পমেয়াদি ক্ষতি", "Short-term loss")} value={v.bfStcl} onChange={sv("bfStcl")} />
          <Field label={L("দীর্ঘমেয়াদি ক্ষতি", "Long-term loss")} value={v.bfLtcl} onChange={sv("bfLtcl")} />
        </div>
      )}

      <h2 className="t3">{L("বিমা, PPF, দান: ছাড় নিতে চান?", "Insurance, PPF, donations: claim deductions?")}</h2>
      <p className="lead">{L("এগুলো শুধু পুরোনো regime-এ কাজে লাগে। টুল দুই regime-ই হিসাব করে কমটা দেখায়।", "These only help in the old regime. The tool computes both and shows the cheaper one.")}</p>
      <Choice value={q.oldDed ? "y" : "n"} onChange={(x) => set("oldDed")(x === "y")} options={[["n", L("না", "No")], ["y", L("হ্যাঁ", "Yes")]]} />
      {q.oldDed && (
        <>
          <div className="grid2">
            <Field label={L("80C (বিমা, PPF, ELSS)", "80C (insurance, PPF, ELSS)")} value={v.d80C} onChange={sv("d80C")} hint={L("সীমা ₹1.5 লাখ", "Limit ₹1.5 lakh")} />
            <Field label={L("80D (স্বাস্থ্যবিমা)", "80D (health insurance)")} value={v.d80D} onChange={sv("d80D")} />
            <Field label={L("80CCD(1B) (NPS)", "80CCD(1B) (NPS)")} value={v.d80CCD1B} onChange={sv("d80CCD1B")} />
            <Field label={L("80G (দান)", "80G (donations)")} value={v.d80G} onChange={sv("d80G")} />
          </div>
          <Field label={L("80CCD(2) (নিয়োগকর্তার NPS), দুই regime-এই চলে", "80CCD(2) (employer NPS), works in both regimes")} value={v.d80CCD2} onChange={sv("d80CCD2")} />
          <p className="msg">{L("সেভিংস ও FD-র সুদের ছাড় (80TTA/80TTB) টুল নিজেই হিসাব করে নেয়।", "The savings and FD interest deduction (80TTA/80TTB) is worked out for you.")}</p>
        </>
      )}
      <Nav ctx={ctx} back="papers" next="income" />
    </section>
  );
}

// ---------------------------------------------------------------- 4. income
export function Income({ ctx }) {
  const { L, v, setV, q, papers, fy, res, late, fileOn, setFileOn, today, Y, val, fromLedger, go } = ctx;
  const sv = (k) => (x) => setV({ ...v, [k]: x });
  const er = (k) => { const e = val.errors.find((x) => x.field === k); return e ? L(e.bn, e.en) : undefined; };
  const F = (k, label, extra = {}) => <Field label={label} value={v[k]} onChange={sv(k)} error={er(k)} {...extra} />;
  const running = fy === "2026-27";
  const found = papers.ais?.found || {};
  const rows = [
    ["salary", L("বেতন/পেনশন", "Salary / pension"), found.salary],
    ["interestSavings", L("সেভিংস ব্যাংকের সুদ", "Savings bank interest"), found.interestSavings],
    ["interestDeposit", L("FD/ডিপোজিটের সুদ", "FD / deposit interest"), found.interestDeposit],
    ["dividend", L("ডিভিডেন্ড", "Dividend"), found.dividend],
  ];
  const checks = rows.filter((r) => r[2] !== undefined).map((r) => ({ label: r[1], ok: Math.abs(n(v[r[0]]) - r[2]) <= 5, ours: n(v[r[0]]), theirs: r[2] }));
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  return (
    <section className="page">
      <Progress step={3} total={5} />
      <div className="step-tag">{L("ধাপ ৪ / ৫", "Step 4 of 5")}</div>
      <h1 className="t2">{L("আয় মিলিয়ে নিন", "Check your income")}</h1>
      <p className="lead">{running
        ? L("চলতি বছর: এখন পর্যন্ত যা পেয়েছেন, সঙ্গে বছর শেষ পর্যন্ত যা পাবেন বলে আন্দাজ করেন। পুরো বছরের মোট অঙ্ক দিন।", "Current year: what you have received plus your estimate for the rest. Enter the full-year total.")
        : L("কাগজ থেকে যা এসেছে সেটা নিচে বসেছে। ভুল থাকলে ঠিক করুন, ফাঁকা থাকলে ভরুন। বাংলা সংখ্যাও (১২৫০০০) চলবে।", "Whatever was read from your papers is filled in. Correct or complete it. Bengali digits work too.")}</p>

      {val.errors.length > 0 && (
        <div className="note red" role="alert">
          <b>{L("এগোনোর আগে ঠিক করুন:", "Fix before continuing:")}</b>
          <ul className="errlist">{val.errors.map((e, i) => <li key={i}>{L(e.bn, e.en)}</li>)}</ul>
        </div>
      )}

      {rows.map(([k, label]) => <React.Fragment key={k}>{F(k, label)}</React.Fragment>)}
      {F("otherIncome", L("অন্য আয় (ভাড়া ছাড়া)", "Other income"))}
      {q.business !== "none" && (
        <>
          <h2 className="t3">{L("ব্যবসা/পেশা", "Business / profession")}</h2>
          {q.bizBooks && (
            <>
              {F("profit", L("খাতা-রাখা ব্যবসা/পেশার নিট লাভ", "Net profit from books-based business / profession"), { hint: L("ক্ষতি হলে মাইনাস দিন", "Use a minus for a loss") })}
              {F("booksTurnover", L("এর মোট টার্নওভার (জানা থাকলে, অডিট লাগবে কিনা দেখার জন্য)", "Its turnover (if known, to check whether an audit is needed)"))}
            </>
          )}
          {q.bizPres && F("turnover", L("অনুমিত ব্যবসার মোট বিক্রি/প্রাপ্তি (44AD)", "Turnover of presumptive business (44AD)"))}
          {q.bizPro && F("receiptsPro", L("অনুমিত পেশার মোট প্রাপ্তি (44ADA)", "Gross receipts of presumptive profession (44ADA)"))}
          {(q.bizPres || q.bizPro) && (
            <Field label={L("ব্যাংক/ডিজিটালে পাওয়া অংশ (%)", "Received digitally (%)")} money={false} inputMode="numeric" value={v.digitalPct} onChange={sv("digitalPct")} error={er("digitalPct")} />
          )}
        </>
      )}

      <h2 className="t3">{L("শেয়ার/ফান্ড বিক্রির লাভ-ক্ষতি", "Gains and losses from shares / funds")}</h2>
      <div className="grid2">
        {F("stcg111A", <>{L("স্বল্পমেয়াদি, ইকুইটি (111A)", "Short term, equity (111A)")}<Help t="s111A" /></>, { hint: L("ক্ষতি হলে মাইনাস দিন", "Use a minus for a loss") })}
        {F("ltcg112A", <>{L("দীর্ঘমেয়াদি, ইকুইটি (112A)", "Long term, equity (112A)")}<Help t="s112A" /></>)}
        {F("stcgOther", L("অন্য স্বল্পমেয়াদি", "Other short term"))}
        {F("ltcgOther", L("অন্য দীর্ঘমেয়াদি", "Other long term"))}
      </div>

      <h2 className="t3">{L("কর কাটা ও জমা", "Tax deducted and paid")}</h2>
      {F("tds", <>{L("TDS (Form 26AS/168 অনুযায়ী মোট)", "TDS (total per Form 26AS/168)")}<Help t="tds" /></>, { hint: L("পোর্টালে Services → View Form 26AS (বা 168)", "Portal: Services → View Form 26AS (or 168)") })}
      {(fromLedger.advance > 0 || fromLedger.selfassess > 0) && (
        <div className="note blue">
          {L("কর জমার খাতা থেকে নেওয়া:", "Taken from the tax payments ledger:")} {fromLedger.advance > 0 && `${L("অগ্রিম", "advance")} ${fmt(fromLedger.advance)} `}{fromLedger.selfassess > 0 && `Self Assessment ${fmt(fromLedger.selfassess)}`}
          <button className="linklike" style={{ marginLeft: 8 }} onClick={() => go("ledger")}>{L("খাতা খুলুন", "Open ledger")}</button>
        </div>
      )}
      <div className="grid2">
        {fromLedger.advance > 0 ? null : F("advanceTaxPaid", <>{L("অগ্রিম কর দেওয়া", "Advance tax paid")}<Help t="advance" /></>)}
        {fromLedger.selfassess > 0 ? null : F("selfAssessmentPaid", <>{L("Self Assessment কর দেওয়া", "Self-assessment tax paid")}<Help t="sa" /></>)}
      </div>
      {fromLedger.advance === 0 && fromLedger.selfassess === 0 && <button className="linklike" onClick={() => go("ledger")}>{L("বছরের মধ্যে কর জমা দিলে 'কর জমার খাতা'-য় লিখে রাখুন", "Record payments in the 'Tax payments ledger' as you make them")}</button>}
      {late && (
        <Field label={L("রিটার্ন কবে ফাইল করেছেন বা করবেন", "When you filed or will file the return")} money={false} type="date" value={fileOn || today} onChange={setFileOn}
          hint={L(`শেষ তারিখ ${Y.dueDate}-এর পরে হলে দেরির সুদ (234A) ও ফি (234F) ধরা হয়।`, `After the due date ${Y.dueDate}, late interest (234A) and fee (234F) are added.`)} />
      )}

      {checks.length > 0 && (
        <div className="paper">
          <div className="stamp-row">
            <Stamp ok={allOk} big={allOk ? L("মিলেছে", "Matched") : L("মেলেনি", "No match")} small={L("AIS/TIS-এর সঙ্গে", "with AIS / TIS")} />
            <div>
              {checks.map((c, i) => (
                <p key={i} className={"msg " + (c.ok ? "ok" : "err")}>{c.ok ? "✓" : "✗"} {c.label}: {fmt(c.ours)} {c.ok ? "" : `(AIS ${fmt(c.theirs)})`}</p>
              ))}
            </div>
          </div>
        </div>
      )}
      {val.warnings.filter((w) => !["pan", "dob"].includes(w.field)).map((w, i) => <div key={i} className="note">{L(w.bn, w.en)}</div>)}
      {res.chosen.totalIncome === 0 && val.errors.length === 0 && <div className="note">{L("এখনো কোনো আয় বসেনি। আয় না থাকলে কর ০ আসবে।", "No income entered yet; tax will show as 0.")}</div>}
      <Nav ctx={ctx} back="questions" next="result" nextLabel={L("ফল দেখুন", "See the result")} disabled={val.errors.length > 0} />
    </section>
  );
}
