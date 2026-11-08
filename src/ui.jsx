import React, { createContext, useContext } from "react";

export const LangCtx = createContext({ lang: "bn", L: (b) => b });
export const useL = () => useContext(LangCtx);

export const fmt = (v) => {
  const x = Math.round(Number(v) || 0);
  const s = Math.abs(x).toLocaleString("en-IN");
  return (x < 0 ? "−" : "") + "₹" + s;
};
export const fmtPlain = (v) => Math.round(Number(v) || 0).toLocaleString("en-IN");

export function Field({ label, hint, value, onChange, money = true, type = "text", placeholder, inputMode, error }) {
  const uid = React.useId();
  return (
    <label className={"field" + (error ? " invalid" : "")}>
      <span>{label}</span>
      <div className={money ? "money-wrap" : ""}>
        <input
          className="input"
          type={type}
          inputMode={inputMode || (money ? "decimal" : undefined)}
          value={value ?? ""}
          placeholder={placeholder ?? (money ? "0" : "")}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? uid + "-e" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <small id={uid + "-e"} role="alert" className="errtxt">{error}</small>}
      {hint && !error && <small>{hint}</small>}
    </label>
  );
}

const GLOSSARY = {
  gti: ["মোট আয়: সব উৎসের আয় (বেতন, সুদ, ভাড়া, লাভ) যোগ করলে যা হয়, ছাড় বাদ দেওয়ার আগে।", "Gross total income: all income added up, before deductions."],
  ti: ["করযোগ্য আয়: মোট আয় থেকে ছাড় বাদ দিলে যা থাকে। এর ওপরই কর হিসাব হয়।", "Taxable income: what is left after deductions. Tax is worked out on this."],
  tds: ["TDS: ব্যাংক বা নিয়োগকর্তা আপনার হয়ে আগেই কেটে সরকারকে দেওয়া কর। এটা আপনার দেওয়া করের অংশ ধরা হয়।", "TDS: tax a bank or employer already cut and paid for you. It counts as tax you have paid."],
  regime: ["Regime: কর হিসাবের দুটো পদ্ধতি। নতুনে হার কম কিন্তু বিমা-PPF-র ছাড় প্রায় নেই। পুরোনোতে ছাড় আছে কিন্তু হার বেশি। টুল দুটোই হিসাব করে কমটা দেখায়।", "Regime: two ways to compute tax. The new one has lower rates but almost no deductions; the old has deductions but higher rates. The tool computes both."],
  s111A: ["111A: এক বছরের মধ্যে বেচা শেয়ার বা ইকুইটি ফান্ডের লাভ। ২০% হারে কর।", "111A: gain on shares or equity funds sold within a year. Taxed at 20%."],
  s112A: ["112A: এক বছরের বেশি রাখা শেয়ার বা ইকুইটি ফান্ডের লাভ। প্রথম ₹1.25 লাখে কর নেই, তার ওপর ১২.৫%।", "112A: gain on shares or equity funds held over a year. First ₹1.25 lakh is not taxed, the rest at 12.5%."],
  advance: ["অগ্রিম কর: বছরের মধ্যে কিস্তিতে আগাম দেওয়া কর। ৬০-এর বেশি বয়সীর ব্যবসার আয় না থাকলে লাগে না।", "Advance tax: tax paid in instalments during the year. Not needed for a resident aged 60+ with no business income."],
  rebate: ["87A রিবেট: কম আয়ে কর মকুব। নতুন regime-এ করযোগ্য আয় ₹12 লাখ পর্যন্ত হলে কর শূন্য।", "87A rebate: tax waived on lower incomes. In the new regime, tax is nil up to ₹12 lakh taxable income."],
  d80ttb: ["80TTB: ৬০-এর বেশি বয়সীর ব্যাংক/FD সুদে ₹50,000 পর্যন্ত ছাড় (পুরোনো regime)।", "80TTB: seniors can deduct up to ₹50,000 of bank/FD interest (old regime)."],
  cess: ["সেস: কর আর সারচার্জের ওপর ৪% অতিরিক্ত।", "Cess: an extra 4% on tax and surcharge."],
  fmv: ["FMV: ৩১-জানুয়ারি-২০১৮-র বাজারদর। তার আগে কেনা শেয়ারের লাভ হিসাবে এটা কাজে লাগে।", "FMV: the market price on 31 January 2018, used for holdings bought before that."],
  sa: ["Self Assessment কর: রিটার্ন ফাইলের আগে যে বাকি কর নিজে জমা দেন।", "Self-assessment tax: the balance tax you pay yourself before filing."],
  ais: ["AIS/TIS: আয়কর বিভাগের কাছে আপনার আয়ের যে তথ্য জমা আছে, তার সারসংক্ষেপ।", "AIS/TIS: the department's record of your income."],
};
export function Help({ t }) {
  const { lang } = useL();
  const g = GLOSSARY[t];
  if (!g) return null;
  return (
    <details className="help">
      <summary aria-label={lang === "bn" ? "মানে দেখুন" : "What does this mean"}>?</summary>
      <span className="helptext">{lang === "bn" ? g[0] : g[1]}</span>
    </details>
  );
}

export function Choice({ options, value, onChange }) {
  return (
    <div className="choices" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={"choice" + (value === v ? " on" : "")} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, children }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Stamp({ ok, big, small }) {
  return (
    <div className={"stamp " + (ok ? "ok" : "bad")} role="img" aria-label={big}>
      <b>{big}</b>
      {small && <small>{small}</small>}
    </div>
  );
}

export function Line({ label, value, kind, neg }) {
  return (
    <div className={"line" + (kind ? " " + kind : "")}>
      <span className="lab">{label}</span>
      <span className="dots" />
      <span className={"amt" + (neg ? " neg" : "")}>{value}</span>
    </div>
  );
}

export function Progress({ step, total }) {
  return (
    <div className="progress" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i <= step ? "on" : ""} />
      ))}
    </div>
  );
}
