// Catches impossible or suspicious input before it becomes a wrong tax figure.
// errors block the result page; warnings are shown but never block.
import { n, normNum } from "./tax.js";

const MONEY = {
  salary: ["বেতন/পেনশন", "Salary / pension"],
  exemptSalary: ["ছাড় পাওয়া ভাতা", "Exempt allowances"],
  interestSavings: ["সেভিংসের সুদ", "Savings interest"],
  interestDeposit: ["FD-র সুদ", "FD interest"],
  dividend: ["ডিভিডেন্ড", "Dividend"],
  otherIncome: ["অন্য আয়", "Other income"],
  stcg111A: ["স্বল্পমেয়াদি লাভ (111A)", "Short-term gain (111A)"],
  stcgOther: ["অন্য স্বল্পমেয়াদি লাভ", "Other short-term gain"],
  ltcg112A: ["দীর্ঘমেয়াদি লাভ (112A)", "Long-term gain (112A)"],
  ltcgOther: ["অন্য দীর্ঘমেয়াদি লাভ", "Other long-term gain"],
  bfStcl: ["জের টানা স্বল্পমেয়াদি ক্ষতি", "Brought-forward short-term loss"],
  bfLtcl: ["জের টানা দীর্ঘমেয়াদি ক্ষতি", "Brought-forward long-term loss"],
  tds: ["TDS", "TDS"],
  advanceTaxPaid: ["অগ্রিম কর", "Advance tax"],
  selfAssessmentPaid: ["Self Assessment কর", "Self-assessment tax"],
  turnover: ["বিক্রি/প্রাপ্তি", "Turnover"],
  profit: ["নিট লাভ", "Net profit"],
  receiptsPro: ["পেশার মোট প্রাপ্তি", "Professional receipts"],
  booksTurnover: ["খাতা-রাখা ব্যবসার টার্নওভার", "Books-based turnover"],
  hpRent: ["ভাড়া", "Rent"],
  hpMuni: ["পৌরকর", "Municipal tax"],
  hpInterest: ["বাড়ির ঋণের সুদ", "Home-loan interest"],
  d80C: ["80C", "80C"],
  d80D: ["80D", "80D"],
  d80CCD1B: ["80CCD(1B)", "80CCD(1B)"],
  d80CCD2: ["80CCD(2)", "80CCD(2)"],
  d80G: ["80G", "80G"],
};
// Only these can honestly be negative (a loss)
const MAY_BE_NEGATIVE = new Set(["stcg111A", "stcgOther", "ltcg112A", "ltcgOther", "profit"]);
const MAX_SANE = 1e10; // ₹1,000 crore

const FORMAT = /^-?[\d,]*\.?\d*$/;

export function validateInputs({ v, q, profile, res, today }) {
  const errors = [];
  const warnings = [];
  const E = (field, bn, en) => errors.push({ field, bn, en });
  const W = (field, bn, en) => warnings.push({ field, bn, en });

  for (const [k, [bn, en]] of Object.entries(MONEY)) {
    const raw = normNum(v[k]).trim();
    if (raw === "") continue;
    if (!FORMAT.test(raw) || raw === "-" || raw === ".") {
      E(k, `${bn}: এখানে শুধু সংখ্যা লিখুন (যেমন 125000)। অক্ষর বা চিহ্ন চলবে না।`, `${en}: type numbers only (for example 125000).`);
      continue;
    }
    const x = n(raw);
    if (x < 0 && !MAY_BE_NEGATIVE.has(k)) E(k, `${bn}: মাইনাস হতে পারে না। ক্ষতি থাকলে শুধু শেয়ার/ফান্ড বা ব্যবসার ঘরে মাইনাস দিন।`, `${en}: cannot be negative. Only gains and profit boxes may hold a loss.`);
    if (Math.abs(x) > MAX_SANE) E(k, `${bn}: সংখ্যাটা অস্বাভাবিক বড়। কমা বা শূন্য বেশি পড়েছে কিনা দেখুন।`, `${en}: the number looks too large. Check for extra zeros.`);
  }
  const dp = String(v.digitalPct ?? "").trim();
  if ((q.bizPres || q.bizPro || q.business === "presumptive") && dp !== "" && (!/^\d+(\.\d+)?$/.test(dp) || n(dp) > 100)) {
    E("digitalPct", "ডিজিটালে পাওয়া অংশ ০ থেকে ১০০-র মধ্যে হতে হবে।", "Digital share must be between 0 and 100.");
  }

  if (q.bizPres && n(v.turnover) > (n(v.digitalPct) >= 95 ? 30000000 : 20000000)) W("turnover", "অনুমিত ব্যবসার (44AD) সীমা ₹2 কোটি, ৯৫%-এর বেশি ডিজিটাল হলে ₹3 কোটি। এর বেশি হলে খাতা রাখতে হবে।", "The 44AD limit is ₹2 crore (₹3 crore if 95%+ is digital). Above that you must keep books.");
  if (q.bizPro && n(v.receiptsPro) > (n(v.digitalPct) >= 95 ? 7500000 : 5000000)) W("receiptsPro", "অনুমিত পেশার (44ADA) সীমা ₹50 লাখ, ৯৫%-এর বেশি ডিজিটাল হলে ₹75 লাখ। এর বেশি হলে খাতা রাখতে হবে।", "The 44ADA limit is ₹50 lakh (₹75 lakh if 95%+ is digital). Above that you must keep books.");
  if (q.bizBooks && n(v.booksTurnover) > 10000000) W("booksTurnover", "টার্নওভার ₹1 কোটির বেশি। ক্যাশ লেনদেন ৫%-এর মধ্যে হলে সীমা ₹10 কোটি, নইলে হিসাব অডিট (44AB) লাগবে। CA-কে দেখান।", "Turnover is above ₹1 crore. The audit limit is ₹10 crore only if cash stays within 5%; otherwise a 44AB audit is needed. Ask a CA.");

  // identity
  if (profile.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(profile.pan)) {
    W("pan", "PAN-এর গঠন ঠিক নয়। ৫টা অক্ষর, ৪টা সংখ্যা, ১টা অক্ষর (যেমন ABCDE1234F)। PDF খোলার জন্য এটা ঠিক থাকা দরকার।", "PAN format looks wrong: 5 letters, 4 digits, 1 letter. It must be right to open locked PDFs.");
  }
  if (profile.dob) {
    const d = new Date(profile.dob);
    const t = new Date(today);
    const age = (t - d) / 31557600000;
    if (isNaN(d)) E("dob", "জন্মতারিখ বোঝা যায়নি।", "Date of birth not understood.");
    else if (d > t) E("dob", "জন্মতারিখ ভবিষ্যতের হতে পারে না।", "Date of birth cannot be in the future.");
    else if (age > 110) W("dob", "জন্মতারিখে বয়স ১১০ বছরের বেশি হচ্ছে। সাল ঠিক আছে কিনা দেখুন।", "Age comes to over 110. Check the year.");
  }

  // consistency
  if (res) {
    const c = res.chosen;
    const tds = res.taxes.tds;
    if (tds > 0 && c.gti <= 0) W("tds", "আয় নেই অথচ TDS দিয়েছেন। আয়ের ঘরগুলো ভরা হয়েছে কিনা দেখুন।", "TDS entered but no income. Check the income boxes.");
    if (tds > 0 && c.gti > 0 && tds > c.gti * 0.4) W("tds", "TDS আয়ের ৪০%-এর বেশি। সংখ্যাটা Form 26AS/168-এর সঙ্গে মিলিয়ে নিন।", "TDS is over 40% of income. Match it with Form 26AS/168.");
    if (res.taxes.advance + res.taxes.selfAssess + tds > c.totalTax * 1.5 + 1000 && c.totalTax > 0) W("advance", "যত কর লাগে তার চেয়ে অনেক বেশি জমা দেখাচ্ছে। ফেরত আসবে, কিন্তু সংখ্যাগুলো আবার দেখে নিন।", "Tax paid is far more than the tax due. A refund follows, but re-check the numbers.");
    if (res.ageBand !== "below60" && q.business !== "none") W("business", "ব্যবসা বা পেশার আয় থাকলে ৬০-এর বেশি বয়সেও অগ্রিম কর ও তার সুদ (234B/234C) লাগে।", "With business income, advance tax and its interest (234B/234C) apply even above 60.");
    if (n(v.d80C) > 150000) W("d80C", "80C-তে সর্বোচ্চ ₹1,50,000 ধরা হয়, বাকিটা বাদ।", "80C is capped at ₹1,50,000.");
    if (n(v.d80D) > 100000) W("d80D", "80D-তে সর্বোচ্চ ₹1,00,000 ধরা হয়।", "80D is capped at ₹1,00,000.");
    if (n(v.d80CCD1B) > 50000) W("d80CCD1B", "80CCD(1B)-তে সর্বোচ্চ ₹50,000 ধরা হয়।", "80CCD(1B) is capped at ₹50,000.");
    if (n(v.hpInterest) > 0 && q.hp === "none") W("hpInterest", "বাড়ির সুদ দিয়েছেন কিন্তু বাড়ির ধরন 'নেই'। বাড়ির ধরন বেছে নিন।", "Interest entered but house type is 'none'.");
    if (c.totalIncome > 5e7) W("income", "আয় ₹5 কোটির বেশি। এই কেসে CA-র সাহায্য নিন।", "Income above ₹5 crore. Please use a CA.");
  }
  return { errors, warnings };
}

// Sanity checks on our own output. A failure means "do not trust this", never a crash.
export function selfCheck(res) {
  const problems = [];
  const finite = (x) => Number.isFinite(x);
  for (const key of ["new", "old"]) {
    const r = res[key];
    if (!r) { problems.push(`missing ${key}`); continue; }
    for (const f of ["gti", "totalIncome", "normalTax", "specialTax", "totalTax", "cess"]) {
      if (!finite(r[f])) problems.push(`${key}.${f} is not a number`);
    }
    if (r.totalTax < -0.5) problems.push(`${key} tax is negative`);
    if (r.gti > 0 && r.totalTax > r.gti * 0.45) problems.push(`${key} tax is above 45% of income`);
    if (r.totalIncome > r.gti + 10) problems.push(`${key} total income is above gross income`);
  }
  if (res.payable > 0 && res.refund > 0) problems.push("both payable and refund");
  if (!finite(res.payable) || !finite(res.refund)) problems.push("payable or refund is not a number");
  return problems;
}
