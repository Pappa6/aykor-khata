import React, { useState } from "react";
import { Line, Stamp, Check, Help, fmt } from "./ui.jsx";
import { Dashboard } from "./Dash.jsx";

const maskPan = (p) => (p && p.length >= 10 ? `${p.slice(0, 3)}XXXXX${p.slice(-2)}` : p || "");

export function Result({ ctx }) {
  const { L, res, form, fy, rules, Y, go, regimeChoice, setRegimeChoice, profile, today, papers, inp, problems } = ctx;
  const [showAnyway, setShowAnyway] = useState(false);
  const c = res.chosen;
  const hasCA = form.ca.length > 0;
  const bad = problems.length > 0;
  const gated = (hasCA || bad) && !showAnyway;
  const label = (o) => L(o.bn, o.en);
  const chosenKey = c.regime;

  const recOk = (() => {
    const r = [...(papers.cg?.recon || [])];
    return r.length ? r.every((x) => x.ok) : null;
  })();

  return (
    <>
    {!gated && <Dashboard ctx={ctx} />}
    <section className="page">
      <div className="step-tag">{L("ধাপ ৫ / ৫", "Step 5 of 5")} · {Y.label}</div>
      <h1 className="t2">{L("আপনার ফল", "Your result")}</h1>

      <div className="note blue">
        <b>{L("আপনার ফর্ম:", "Your form:")} {form.form}</b>
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {form.reasons.map((r, i) => <li key={i}>{label(r)}</li>)}
        </ul>
      </div>

      {hasCA && (
        <div className="note red">
          <b>{L("এই কেসে CA-র সাহায্য নিন", "Get a CA's help for this case")}</b>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{form.ca.map((r, i) => <li key={i}>{label(r)}</li>)}</ul>
          <p style={{ marginTop: 8 }}>{L("এই টুল এসব ক্ষেত্রের পুরো হিসাব করে না, তাই নিচের অঙ্ক অসম্পূর্ণ হতে পারে।", "The tool does not fully handle these, so the figures below may be incomplete.")}</p>
          {gated && hasCA && <button className="btn ghost small" onClick={() => setShowAnyway(true)}>{L("তবুও আন্দাজ দেখুন", "Show the estimate anyway")}</button>}
        </div>
      )}

      {bad && (
        <div className="note red" role="alert">
          <b>{L("হিসাবে অসঙ্গতি ধরা পড়েছে", "The calculation looks inconsistent")}</b>
          <p style={{ marginTop: 6 }}>{L("টুল নিজের হিসাব যাচাই করে কিছু অস্বাভাবিক পেয়েছে। এই সংখ্যার ওপর ভরসা করবেন না। আয়ের ঘরগুলো আবার দেখুন, না মিললে CA-র সঙ্গে কথা বলুন।", "The tool's own check found something unusual. Do not rely on these numbers. Re-check the income boxes, and speak to a CA if it persists.")}</p>
          {gated && !hasCA && <button className="btn ghost small" onClick={() => setShowAnyway(true)}>{L("তবুও আন্দাজ দেখুন", "Show the estimate anyway")}</button>}
        </div>
      )}

      {!gated && (
        <>
          <div className="ledger">
            <Line kind="big" label={<>{L("মোট আয়", "Gross total income")}<Help t="gti" /></>} value={fmt(c.gti)} />
            <Line kind="big" label={<>{L("করযোগ্য আয়", "Taxable income")}<Help t="ti" /></>} value={fmt(c.totalIncome)} />
            <Line label={<>{L("কর (সেস সহ)", "Tax (with cess)")}<Help t="cess" /></>} value={fmt(c.totalTax)} />
            {res.interest.i234A + res.interest.i234B + res.interest.i234C > 0 && <Line label={L("সুদ (234A/B/C)", "Interest (234A/B/C)")} value={fmt(res.interest.i234A + res.interest.i234B + res.interest.i234C)} />}
            {res.interest.fee234F > 0 && <Line label={L("দেরিতে ফাইলের ফি (234F)", "Late filing fee (234F)")} value={fmt(res.interest.fee234F)} />}
            {res.taxes.tds > 0 && <Line label={<>{L("(−) TDS", "(−) TDS")}<Help t="tds" /></>} value={fmt(res.taxes.tds)} neg />}
            {res.taxes.advance + res.taxes.selfAssess > 0 && <Line label={L("(−) আগে দেওয়া কর", "(−) Tax already paid")} value={fmt(res.taxes.advance + res.taxes.selfAssess)} neg />}
            {res.refund > 0 ? (
              <Line kind="total" label={L("ফেরত পাবেন", "Refund due")} value={fmt(res.refund)} neg />
            ) : (
              <Line kind="total" label={L("এখন দিতে হবে", "Payable now")} value={fmt(res.payable)} />
            )}
          </div>

          <h2 className="t3" style={{ marginTop: 18 }}>{L("কোন regime কম কর দেয়", "Which regime costs less")}<Help t="regime" /></h2>
          <div className="regime">
            {[["new", L("নতুন regime", "New regime"), res.new], ["old", L("পুরোনো regime", "Old regime"), res.old]].map(([k, name, r]) => (
              <button key={k} className={"r" + (res.best === k ? " best" : "") + (chosenKey === k ? " sel" : "")} onClick={() => setRegimeChoice(k)} aria-pressed={chosenKey === k}>
                <small>{name}{res.best === k ? ` · ${L("কম", "lower")}` : ""}</small>
                <span className="v">{fmt(r.totalTax)}</span>
              </button>
            ))}
          </div>
          <p className="lead">
            {res.saving > 0
              ? L(`${res.best === "new" ? "নতুন" : "পুরোনো"} regime-এ ${fmt(res.saving)} কম।`, `${res.best === "new" ? "New" : "Old"} regime saves ${fmt(res.saving)}.`)
              : L("দুই regime-এ কর সমান।", "Both regimes cost the same.")}
            {regimeChoice !== "auto" && <button className="linklike" style={{ marginLeft: 8 }} onClick={() => setRegimeChoice("auto")}>{L("স্বয়ংক্রিয়", "Auto")}</button>}
          </p>

          {res.interest.notes.map((nn, i) => <div key={i} className="note blue">{label(nn)}</div>)}
          {res.carry.ltcl > 0 && <div className="note blue">{L(`দীর্ঘমেয়াদি ক্ষতি ${fmt(res.carry.ltcl)} পরের ৮ বছর দীর্ঘমেয়াদি লাভের সঙ্গে মেলানো যাবে। রিটার্নে এটা দেখাতে হয়।`, `Long-term loss of ${fmt(res.carry.ltcl)} can be set off against long-term gains for 8 years. Show it in the return.`)}</div>}
          {res.carry.stcl > 0 && <div className="note blue">{L(`স্বল্পমেয়াদি ক্ষতি ${fmt(res.carry.stcl)} জের টানা যাবে।`, `Short-term loss of ${fmt(res.carry.stcl)} can be carried forward.`)}</div>}
          {res.cgNet.exempt112A > 0 && <div className="note blue">{L(`দীর্ঘমেয়াদি লাভের প্রথম ${fmt(res.cgNet.exempt112A)}-এ কর নেই (সীমা ₹1.25 লাখ)।`, `The first ${fmt(res.cgNet.exempt112A)} of long-term gain is not taxed (limit ₹1.25 lakh).`)}</div>}
          {inp.filingDate && inp.filingDate > Y.dueDate && (
            <div className="note">{L(`রিটার্ন শেষ তারিখ ${Y.dueDate}-এর পরে ফাইল ধরা হয়েছে। দেরিতে ফাইল করা যায় ${Y.belatedLastDate} পর্যন্ত। সুদ ও ফি ওপরে ধরা আছে।`, `The return is treated as filed after the due date ${Y.dueDate}. A belated return can be filed until ${Y.belatedLastDate}. Interest and fee are included above.`)}</div>
          )}
          {fy === "2026-27" && <div className="note">{L("চলতি বছরের এই অঙ্ক আপনার দেওয়া আন্দাজের ওপর নির্ভর করছে। আয় বদলালে ফিরে গিয়ে ঠিক করুন।", "This current-year figure rests on your estimates. Go back and update it as income changes.")}</div>}
          {Y.needsVerification?.length > 0 && <div className="note">{L("এই বছরের কিছু নিয়ম এখনো যাচাই বাকি:", "Some rules for this year are still being verified:")} {Y.needsVerification.map((x, i) => <span key={i} style={{ display: "block", fontSize: 15 }}>• {x}</span>)}</div>}

          {recOk !== null && (
            <div className="stamp-row" style={{ marginTop: 12 }}>
              <Stamp ok={recOk} big={recOk ? L("মিলেছে", "Matched") : L("যাচাই বাকি", "To verify")} small={L("স্টেটমেন্টের সঙ্গে", "with statement")} />
              <p className="lead" style={{ margin: 0 }}>{recOk ? L("শেয়ার-ফান্ডের লাভের অঙ্ক স্টেটমেন্টের নিজের মোটের সঙ্গে মিলেছে।", "Gains match the statement's own total.") : L("শেয়ার-ফান্ডের লাভ স্টেটমেন্টের মোটের সঙ্গে মেলেনি। ফাইল করার আগে মেলান।", "Gains do not match the statement total. Resolve before filing.")}</p>
            </div>
          )}

          <details className="gstep">
            <summary>{L("হিসাব কীভাবে হলো", "How this was worked out")}</summary>
            <div style={{ marginTop: 8 }}>
              <div className="ledger">
                {c.steps.map((s, i) => <Line key={i} label={L(s.bn, s.en)} value={fmt(s.value)} />)}
              </div>
            </div>
          </details>

          <div className="row-btns noprint">
            <button className="btn" onClick={() => go("guide")}>{L("পোর্টালে ফাইল করার গাইড", "Portal filing guide")}</button>
            <button className="btn ghost" onClick={() => window.print()}>{L("আয়ের হিসাব PDF হিসেবে রাখুন", "Save computation as PDF")}</button>
          </div>
          <p className="lead noprint" style={{ marginTop: 10 }}>{L("ব্যাংকে ঋণের জন্য সাধারণত জমা-দেওয়া ITR-এর acknowledgement আর Form 26AS/AIS লাগে। এই হিসাব শুধু আপনার নিজের মিলিয়ে দেখার জন্য।", "Banks usually ask for the filed ITR acknowledgement and Form 26AS/AIS. This computation is for your own cross-check.")}</p>
        </>
      )}
      <div className="row-btns noprint" style={{ marginTop: 8 }}>
        <button className="btn ghost small" onClick={() => go("income")}>{L("আয় বদলান", "Edit income")}</button>
        <button className="btn ghost small" onClick={() => go("ledger")}>{L("কর জমার খাতা", "Tax payments ledger")}</button>
        <button className="btn ghost small" onClick={() => go("history")}>{L("ফাইলিং ইতিহাস", "Filing history")}</button>
      </div>

      {/* printable computation of income */}
      <div className="report">
        <h1 className="t2">{L("আয়ের হিসাব", "Computation of income")} · {Y.label}</h1>
        <p>{profile.name} {profile.pan ? `· PAN ${maskPan(profile.pan)}` : ""} · {L("ফর্ম", "Form")} {form.form} · {chosenKey === "new" ? L("নতুন regime", "New regime") : L("পুরোনো regime", "Old regime")}</p>
        <div className="ledger">
          {c.steps.map((s, i) => <Line key={i} label={L(s.bn, s.en)} value={fmt(s.value)} />)}
          <Line label={L("কর (সেস সহ)", "Tax with cess")} value={fmt(c.totalTax)} />
          {res.taxes.totalPaid > 0 && <Line label={L("(−) জমা/TDS", "(−) Paid / TDS")} value={fmt(res.taxes.totalPaid)} />}
          <Line kind="total" label={res.refund > 0 ? L("ফেরত", "Refund") : L("দিতে হবে", "Payable")} value={fmt(res.refund > 0 ? res.refund : res.payable)} />
        </div>
        <p style={{ fontSize: 12 }}>{L("এটা হিসাবের সহায়ক। চূড়ান্ত অঙ্ক আয়কর পোর্টালে দেখুন। তৈরির তারিখ", "A calculation aid; confirm final figures on the income tax portal. Prepared on")} {today}.</p>
      </div>
    </section>
    </>
  );
}

export function Guide({ ctx }) {
  const { L, guide, go, form, Y } = ctx;
  const [done, setDone] = useState({});
  const val = (x) => (typeof x === "number" ? fmt(x) : x);
  const doneCount = Object.values(done).filter(Boolean).length;
  return (
    <section className="page">
      <div className="step-tag">{form.form} · {Y.label}</div>
      <h1 className="t2">{L("পোর্টালে ফাইল করার গাইড", "Portal filing guide")}</h1>
      <p className="lead">{L("পোর্টাল খুলে ধাপ ধরে ধরে যান। প্রতিটা ধাপে আপনার নিজের সংখ্যা দেওয়া আছে। শেষ হলে টিক দিন। ID-পাসওয়ার্ড শুধু পোর্টালেই দেবেন, এখানে কোথাও নয়।", "Open the portal and go step by step. Each step shows your own numbers. Tick when done. Enter your ID and password on the portal only, never here.")}</p>
      <p className="msg ok">{L(`${doneCount} / ${guide.length} ধাপ হয়েছে`, `${doneCount} of ${guide.length} steps done`)}</p>
      {guide.map((s, i) => (
        <details className="gstep" key={i} open={i === 0}>
          <summary>
            <span>{i + 1}. {L(s.title.bn, s.title.en)}</span>
            <span className="done-tick">{done[i] ? "✓" : ""}</span>
          </summary>
          <div className="where">{L(s.where.bn, s.where.en)}</div>
          {s.rows.map((r, j) => (
            <div className="grow" key={j}>
              <span>{L(r.label.bn, r.label.en)}{r.note && <span className="gnote" style={{ display: "block" }}>{L(r.note.bn, r.note.en)}</span>}</span>
              <span className="v">{val(r.value)}</span>
            </div>
          ))}
          {s.tips.length > 0 && <ul>{s.tips.map((t, j) => <li key={j}>{L(t.bn, t.en)}</li>)}</ul>}
          <div style={{ paddingLeft: 22 }}><Check checked={done[i]} onChange={(x) => setDone({ ...done, [i]: x })}>{L("এই ধাপ হয়েছে", "Step done")}</Check></div>
        </details>
      ))}
      <div className="row-btns noprint">
        <button className="btn ghost" onClick={() => go("result")}>{L("ফলে ফিরুন", "Back to result")}</button>
        <button className="btn" onClick={() => go("history")}>{L("ফাইল হলে ইতিহাসে লিখুন", "Record it in history")}</button>
      </div>
    </section>
  );
}
