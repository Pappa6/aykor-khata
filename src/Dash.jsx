import React from "react";
import { fmt } from "./ui.jsx";
import { advanceTaxExempt, n } from "./engine/tax.js";
import { advanceSchedule } from "./engine/ledger.js";

const COLORS = ["#5aa9e6", "#f2b04a", "#7bd389", "#e58bb5", "#a78bfa", "#9db4ce"];

function incomeParts(ctx) {
  const { res, inp, L } = ctx;
  const c = res.chosen;
  const step = (k) => c.steps.find((s) => s.key === k)?.value || 0;
  const g = res.cgNet;
  const parts = [
    [L("বেতন/পেনশন", "Salary / pension"), n(inp.salary)],
    [L("সুদ", "Interest"), n(inp.interestSavings) + n(inp.interestDeposit)],
    [L("ডিভিডেন্ড", "Dividend"), n(inp.dividend)],
    [L("শেয়ার/ফান্ডের লাভ", "Capital gains"), g.s1 + g.so + g.l1 + g.lo],
    [L("ব্যবসা/পেশা", "Business"), Math.max(0, step("biz"))],
    [L("বাড়ি ও অন্য", "House & other"), Math.max(0, step("hp")) + n(inp.otherIncome)],
  ];
  return parts.filter(([, v]) => v > 0);
}

function taxParts(ctx) {
  const { res, L } = ctx;
  const c = res.chosen;
  const slab = Math.max(0, c.normalTax - c.rebate);
  const interest = res.interest.i234A + res.interest.i234B + res.interest.i234C + res.interest.fee234F;
  return [
    [L("স্ল্যাব হারে কর", "Slab tax"), slab],
    [L("শেয়ার/ফান্ডের কর", "Capital-gains tax"), c.specialTax],
    [L("সারচার্জ", "Surcharge"), c.surcharge],
    [L("সেস", "Cess"), c.cess],
    [L("সুদ ও ফি", "Interest & fee"), interest],
  ].filter(([, v]) => v > 0.5);
}

function advice(ctx, schedule) {
  const { L, res, inp, Y, fy, today } = ctx;
  const tips = [];
  const T = (tone, bn, en) => tips.push({ tone, bn, en });
  const c = res.chosen;
  if (res.saving > 0) T("good", `${res.best === "new" ? "নতুন" : "পুরোনো"} regime-এ ${fmt(res.saving)} কম কর দিতে হচ্ছে।`, `The ${res.best === "new" ? "new" : "old"} regime costs ${fmt(res.saving)} less.`);
  if (res.refund > 0) T("good", `${fmt(res.refund)} ফেরত পাবেন। দ্রুত পেতে পোর্টালে ব্যাংক অ্যাকাউন্ট pre-validate করা আছে কিনা দেখুন।`, `A refund of ${fmt(res.refund)} is due. Make sure your bank account is pre-validated on the portal.`);
  const exempt = advanceTaxExempt(res.ageBand, inp);
  if (exempt) T("info", "আপনার অগ্রিম কর লাগে না। বছর শেষে বাকি কর একবারে দিলেই চলবে।", "You do not need to pay advance tax. Paying the balance once at year end is fine.");
  else if (c.totalTax > 10000 && schedule) {
    const next = schedule.find((s) => s.status === "short") || schedule.find((s) => s.status === "upcoming");
    if (next) T(next.status === "short" ? "warn" : "info", next.status === "short" ? `${next.due}-এর কিস্তিতে ${fmt(next.shortBy)} কম জমা পড়েছে। দেরির সুদ লাগতে পারে।` : `পরের অগ্রিম কর ${next.due}-এর মধ্যে, মোট ${fmt(next.should)} হওয়া চাই (এখন ${fmt(next.paid)})।`, next.status === "short" ? `${fmt(next.shortBy)} short for the ${next.due} instalment. Interest may apply.` : `Next advance-tax date ${next.due}: cumulative ${fmt(next.should)} needed (paid ${fmt(next.paid)}).`);
  }
  if (res.ageBand !== "below60" && c.totalTax > 0 && n(inp.interestDeposit) >= 100000) T("warn", "ব্যাংকে Form 15H দিয়ে থাকলে মনে রাখবেন, মোট কর শূন্য না হলে 15H দেওয়া ঠিক নয়। এ বছর আপনার কর আসছে।", "If you gave your bank Form 15H, remember it is only right when total tax is nil. Tax is due this year.");
  if (res.carry.ltcl > 0) T("info", `${fmt(res.carry.ltcl)} দীর্ঘমেয়াদি ক্ষতি আগামী ৮ বছর লাভের সঙ্গে মেলানো যাবে।`, `${fmt(res.carry.ltcl)} long-term loss can be set off for 8 years.`);
  if (c.regime === "new" && c.totalIncome > 1200000 && c.totalIncome <= 1300000 && c.rebate > 0) T("info", `করযোগ্য আয় ₹12 লাখ ছাড়িয়ে গেছে ${fmt(c.totalIncome - 1200000)}। মার্জিনাল রিলিফে কর সীমিত।`, `Income is ${fmt(c.totalIncome - 1200000)} above ₹12 lakh; marginal relief limits the tax.`);
  // deadline
  if (fy === "2025-26") {
    if (inp.filingDate && inp.filingDate <= Y.dueDate) T("info", `ফাইলের তারিখ ${inp.filingDate} শেষ তারিখের (${Y.dueDate}) মধ্যে, তাই দেরির সুদ-ফি ধরা হয়নি।`, `Filing date ${inp.filingDate} is within the due date (${Y.dueDate}); no late interest or fee applied.`);
    else if (today <= Y.dueDate) T("warn", `রিটার্নের শেষ তারিখ ${Y.dueDate}।`, `Return due by ${Y.dueDate}.`);
    else if (today <= Y.belatedLastDate) T("warn", `শেষ তারিখ পেরিয়েছে। দেরিতে ফাইল করা যায় ${Y.belatedLastDate} পর্যন্ত, সুদ ও ফি সহ।`, `The due date has passed. A belated return can be filed until ${Y.belatedLastDate}, with interest and fee.`);
    else T("warn", "দেরিতে ফাইলের সময়ও পেরিয়েছে। CA-র পরামর্শ নিন।", "Even the belated window has passed. Please consult a CA.");
  } else {
    T("info", `এই বছরের রিটার্ন ${Y.dueDate}-এর মধ্যে।`, `This year's return is due by ${Y.dueDate}.`);
  }
  T("info", `ফাইল করার পর ${ctx.rules.common.eVerifyDays} দিনের মধ্যে e-Verify করতে হবে।`, `E-verify within ${ctx.rules.common.eVerifyDays} days of filing.`);
  return tips;
}

export function Dashboard({ ctx }) {
  const { L, res, form, Y, ledger, fy, today } = ctx;
  const c = res.chosen;
  const parts = incomeParts(ctx);
  const total = parts.reduce((a, [, v]) => a + v, 0) || 1;
  const tax = taxParts(ctx);
  const taxTotal = tax.reduce((a, [, v]) => a + v, 0) || 1;
  const maxReg = Math.max(res.new.totalTax, res.old.totalTax, 1);
  const schedule = advanceSchedule(ctx.rules, fy, Math.max(0, Math.round(c.totalTax - res.taxes.tds)), ledger, today);
  const tips = advice(ctx, schedule);
  const R = 40;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <section className="dash noprint" aria-label={L("আপনার ড্যাশবোর্ড", "Your dashboard")}>
      <div className="dash-head">
        <div>
          <div className="dash-kicker">{Y.label}</div>
          <h1 className="dash-title">{L("আপনার করের ছবি", "Your tax at a glance")}</h1>
        </div>
        <span className="dash-chip">{form.form}</span>
      </div>

      <div className="tiles">
        <div className="tile"><small>{L("মোট আয়", "Gross income")}</small><b>{fmt(c.gti)}</b></div>
        <div className="tile"><small>{L("করযোগ্য আয়", "Taxable income")}</small><b>{fmt(c.totalIncome)}</b></div>
        <div className="tile"><small>{L("মোট কর", "Total tax")}</small><b>{fmt(c.totalTax)}</b></div>
        <div className={"tile " + (res.refund > 0 ? "good" : "due")}>
          <small>{res.refund > 0 ? L("ফেরত পাবেন", "Refund due") : L("এখন দিতে হবে", "Payable now")}</small>
          <b>{fmt(res.refund > 0 ? res.refund : res.payable)}</b>
        </div>
      </div>

      {parts.length > 0 && (
        <div className="dcard">
          <h2 className="dh">{L("আয় কোথা থেকে", "Where income comes from")}</h2>
          <div className="stack" role="img" aria-label={parts.map(([l, v]) => `${l} ${fmt(v)}`).join(", ")}>
            {parts.map(([l, v], i) => <i key={l} style={{ width: `${(v / total) * 100}%`, background: COLORS[i % COLORS.length] }} />)}
          </div>
          <ul className="legend">
            {parts.map(([l, v], i) => (
              <li key={l}><span className="dot" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />{l}<b>{fmt(v)}</b><em>{Math.round((v / total) * 100)}%</em></li>
            ))}
          </ul>
        </div>
      )}

      <div className="dgrid">
        <div className="dcard">
          <h2 className="dh">{L("নতুন বনাম পুরোনো regime", "New vs old regime")}</h2>
          <div className="cols" role="img" aria-label={`${L("নতুন", "New")} ${fmt(res.new.totalTax)}, ${L("পুরোনো", "Old")} ${fmt(res.old.totalTax)}`}>
            {[["new", L("নতুন", "New"), res.new], ["old", L("পুরোনো", "Old"), res.old]].map(([k, name, r]) => (
              <div key={k} className={"col" + (res.best === k ? " best" : "")}>
                <span className="colv">{fmt(r.totalTax)}</span>
                <i style={{ height: `${Math.max(4, (r.totalTax / maxReg) * 100)}px` }} />
                <span className="coll">{name}{res.best === k ? " ✓" : ""}</span>
              </div>
            ))}
          </div>
        </div>
        {tax.length > 0 && (
          <div className="dcard">
            <h2 className="dh">{L("করের ভাঙন", "Tax breakdown")}</h2>
            <div className="donutwrap">
              <svg viewBox="0 0 100 100" className="donut" role="img" aria-label={tax.map(([l, v]) => `${l} ${fmt(v)}`).join(", ")}>
                <circle cx="50" cy="50" r={R} fill="none" stroke="#1c3558" strokeWidth="16" />
                {tax.map(([l, v], i) => {
                  const len = (v / taxTotal) * C;
                  const el = <circle key={l} cx="50" cy="50" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
                  acc += len;
                  return el;
                })}
              </svg>
              <ul className="legend tight">
                {tax.map(([l, v], i) => <li key={l}><span className="dot" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />{l}<b>{fmt(v)}</b></li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="dcard">
        <h2 className="dh">{L("পরামর্শ", "Guidance")}</h2>
        <ul className="advice">
          {tips.map((t, i) => <li key={i} className={"tip " + t.tone}>{L(t.bn, t.en)}</li>)}
        </ul>
        <p className="dnote">{L("এগুলো তথ্যভিত্তিক ইঙ্গিত, কর-পরামর্শ নয়।", "These are informational pointers, not tax advice.")}</p>
      </div>
    </section>
  );
}
