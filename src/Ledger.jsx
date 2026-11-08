import React, { useState } from "react";
import { Field, Choice, fmt } from "./ui.jsx";
import { KINDS, validateEntry, sumByKind, newId, exportBackup, importBackup, mergeLedger, advanceSchedule } from "./engine/ledger.js";
import { loadHistory, saveHistory, keepData } from "./store.js";

const toBlobDownload = (text, name, type) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export function LedgerScreen({ ctx }) {
  const { L, rules, ledger, setLedger, today, go, fy: ctxFy, res, setHistoryTick } = ctx;
  const years = Object.keys(rules.years).sort().reverse();
  const [fy, setFy] = useState(ctxFy);
  const [kind, setKind] = useState("advance");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [bsr, setBsr] = useState("");
  const [challan, setChallan] = useState("");
  const [errs, setErrs] = useState([]);
  const [info, setInfo] = useState("");

  const mine = ledger.filter((e) => e.fy === fy).sort((a, b) => (a.date < b.date ? -1 : 1));
  const sums = sumByKind(ledger, fy);

  const add = () => {
    const e = { id: newId(), fy, date, kind, amount: Number(String(amount).replace(/,/g, "")), bsr: bsr.trim(), challan: challan.trim(), note: "" };
    const v = validateEntry(e, today);
    setErrs(v);
    if (v.length) return;
    setLedger([...ledger, e]);
    keepData();
    setAmount(""); setBsr(""); setChallan("");
    setInfo(L("খাতায় লেখা হয়েছে।", "Saved to the ledger."));
  };
  const del = (id) => { if (window.confirm(L("এই লাইনটা মুছবেন?", "Delete this line?"))) setLedger(ledger.filter((e) => e.id !== id)); };

  const backup = () => toBlobDownload(exportBackup(ledger, loadHistory()), `aykor-khata-backup-${today}.json`, "application/json");
  const restore = async (file) => {
    setInfo("");
    const r = importBackup(await file.text(), today);
    if (r.error) return setInfo(L(r.error.bn, r.error.en));
    setLedger(mergeLedger(ledger, r.ledger));
    const h = { ...r.history, ...loadHistory() };
    saveHistory(h);
    setHistoryTick?.((x) => x + 1);
    setInfo(L(`${r.ledger.length}টা লাইন ফেরত এসেছে${r.skipped ? `, ${r.skipped}টা ঠিক না থাকায় বাদ গেছে` : ""}।`, `Restored ${r.ledger.length} lines${r.skipped ? `, ${r.skipped} skipped as invalid` : ""}.`));
  };

  const schedule = fy === ctxFy && res ? advanceSchedule(rules, fy, Math.max(0, Math.round(res.chosen.totalTax - res.taxes.tds)), ledger, today) : null;

  return (
    <section className="page">
      <h1 className="t2">{L("কর জমার খাতা", "Tax payments ledger")}</h1>
      <p className="lead">{L("বছরের মধ্যে কর জমা দিলেই এখানে লিখে রাখুন। রিটার্নের সময় যোগফল নিজে বসে যাবে, আর পোর্টাল যে BSR কোড, তারিখ ও challan নম্বর চায় তা তৈরি পাবেন। এই খাতা শুধু আপনার ফোনেই থাকে।", "Note each tax payment here when you make it. At return time the totals fill in by themselves and you have the BSR code, date and challan number the portal asks for. The ledger stays on this phone only.")}</p>

      <div className="choices" role="radiogroup" aria-label={L("কোন বছর", "Which year")}>
        {years.map((y) => <button key={y} role="radio" aria-checked={fy === y} className={"choice" + (fy === y ? " on" : "")} onClick={() => setFy(y)}>{rules.years[y].label}</button>)}
      </div>

      <h2 className="t3">{L("নতুন লাইন", "New entry")}</h2>
      <Choice value={kind} onChange={setKind} options={Object.entries(KINDS).map(([k, [bn, en]]) => [k, L(bn, en)])} />
      <div className="grid2">
        <Field label={L("জমার তারিখ", "Payment date")} money={false} type="date" value={date} onChange={setDate} />
        <Field label={L("টাকা", "Amount")} value={amount} onChange={setAmount} />
        <Field label={L("BSR কোড (৭ সংখ্যা, ঐচ্ছিক)", "BSR code (7 digits, optional)")} money={false} inputMode="numeric" value={bsr} onChange={setBsr} />
        <Field label={L("Challan নম্বর (ঐচ্ছিক)", "Challan number (optional)")} money={false} inputMode="numeric" value={challan} onChange={setChallan} />
      </div>
      {errs.length > 0 && <div className="note red" role="alert"><ul className="errlist">{errs.map((e, i) => <li key={i}>{L(e.bn, e.en)}</li>)}</ul></div>}
      <button className="btn" onClick={add}>{L("খাতায় লিখুন", "Add to ledger")}</button>
      <div role="status" aria-live="polite">{info && <p className="msg ok">{info}</p>}</div>

      <h2 className="t3" style={{ marginTop: 22 }}>{rules.years[fy].label}</h2>
      {mine.length === 0 ? <p className="lead">{L("এই বছরে এখনো কিছু লেখা নেই।", "Nothing recorded for this year yet.")}</p> : (
        <table className="hist">
          <thead><tr><th>{L("তারিখ", "Date")}</th><th>{L("ধরন", "Type")}</th><th>{L("টাকা", "Amount")}</th><th><span className="sr">{L("মুছুন", "Delete")}</span></th></tr></thead>
          <tbody>
            {mine.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{L(...KINDS[e.kind])}{(e.bsr || e.challan) && <small style={{ display: "block", color: "var(--muted)" }}>BSR {e.bsr || "—"} · Challan {e.challan || "—"}</small>}</td>
                <td>{fmt(e.amount)}</td>
                <td><button className="linklike" onClick={() => del(e.id)} aria-label={`${L("মুছুন", "Delete")} ${e.date}`}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="ledger">
        <div className="line"><span className="lab">{L("অগ্রিম কর মোট", "Advance tax total")}</span><span className="dots" /><span className="amt">{fmt(sums.advance)}</span></div>
        <div className="line"><span className="lab">{L("Self Assessment কর মোট", "Self-assessment total")}</span><span className="dots" /><span className="amt">{fmt(sums.selfassess)}</span></div>
      </div>

      {schedule && res.chosen.totalTax - res.taxes.tds > 10000 && (
        <>
          <h2 className="t3" style={{ marginTop: 18 }}>{L("অগ্রিম করের কিস্তি", "Advance-tax instalments")}</h2>
          <table className="hist">
            <thead><tr><th>{L("তারিখ", "Due")}</th><th>{L("হওয়া চাই", "Needed")}</th><th>{L("দেওয়া", "Paid")}</th><th>{L("অবস্থা", "Status")}</th></tr></thead>
            <tbody>
              {schedule.map((s) => (
                <tr key={s.due}><td>{s.due}</td><td>{fmt(s.should)}</td><td>{fmt(s.paid)}</td>
                  <td>{s.status === "ok" ? "✓" : s.status === "short" ? `${L("কম", "short")} ${fmt(s.shortBy)}` : L("আসছে", "upcoming")}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="lead">{L("৬০-এর বেশি বয়সী, ব্যবসার আয় নেই: এই কিস্তি লাগে না।", "Aged 60+ with no business income: instalments are not required.")}</p>
        </>
      )}

      <h2 className="t3" style={{ marginTop: 22 }}>{L("খাতার কপি", "Backup")}</h2>
      <p className="lead">{L("ফোন বদলালে বা ব্রাউজারের তথ্য মুছলে খাতা চলে যেতে পারে। মাঝে মাঝে কপি নামিয়ে রাখুন।", "The ledger can be lost if you change phone or clear browser data. Save a copy now and then.")}</p>
      <div className="row-btns">
        <button className="btn ghost" onClick={backup}>{L("কপি নামান", "Download backup")}</button>
        <label className="btn ghost filebtn" style={{ marginTop: 12 }}>{L("কপি ফেরত আনুন", "Restore backup")}<input type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} /></label>
      </div>
      <div className="row-btns" style={{ marginTop: 10 }}>
        <button className="btn ghost small" onClick={() => go("home")}>{L("হোম", "Home")}</button>
        <button className="btn ghost small" onClick={() => go("history")}>{L("ফাইলিং ইতিহাস", "Filing history")}</button>
      </div>
    </section>
  );
}
