// Second suite. Every expected figure below was worked out by hand from the slab tables,
// not copied from the engine's output.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeAll, ageBandOf, n } from "../src/engine/tax.js";
import { selectForm } from "../src/engine/forms.js";
import { validateInputs, selfCheck } from "../src/engine/validate.js";
import { classifyTransactions, templateCSV, looksLikeHeader } from "../src/engine/cg.js";
import { xlsxToRows } from "../src/engine/parse.js";

const rules = JSON.parse(fs.readFileSync(new URL("../src/rules/rules.json", import.meta.url), "utf8"));
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`);
const young = { dob: "1990-01-01" };
const FY = "2025-26";

// ---------------- new regime slabs ----------------
test("new regime, income 30 lakh: 4,80,000 + 4% cess", () => {
  const r = computeAll(rules, FY, { ...young, salary: 3075000 });
  assert.equal(r.new.totalIncome, 3000000);
  near(r.new.totalTax, 480000 * 1.04);
});
test("new regime, 6 lakh: tax 10,000 fully rebated", () => {
  const r = computeAll(rules, FY, { ...young, salary: 675000 });
  assert.equal(r.new.totalTax, 0);
});
test("new regime, 13 lakh: marginal relief caps tax at income above 12 lakh", () => {
  const r = computeAll(rules, FY, { ...young, salary: 1375000 }); // TI 13,00,000
  // slab tax = 20,000 + 40,000 + 15% of 1 lakh = 75,000 ; relief caps it at 1,00,000? no, 75,000 < 1,00,000
  near(r.new.totalTax, 75000 * 1.04);
});

// ---------------- old regime ----------------
test("old regime, 10 lakh salary with 1.5 lakh 80C", () => {
  const r = computeAll(rules, FY, { ...young, salary: 1000000, d80C: 150000 });
  assert.equal(r.old.totalIncome, 800000);
  near(r.old.totalTax, 72500 * 1.04);
});
test("old regime rebate: 5 lakh taxable pays nothing", () => {
  const r = computeAll(rules, FY, { ...young, salary: 550000 });
  assert.equal(r.old.totalIncome, 500000);
  assert.equal(r.old.totalTax, 0);
});
test("old regime, age 80+: 5 lakh exempt then 20%", () => {
  const r = computeAll(rules, FY, { dob: "1940-01-01", salary: 600000 });
  assert.equal(r.ageBand, "80+");
  near(r.old.totalTax, 10000 * 1.04);
});
test("80C above the 1.5 lakh cap is cut", () => {
  const a = computeAll(rules, FY, { ...young, salary: 1000000, d80C: 150000 });
  const b = computeAll(rules, FY, { ...young, salary: 1000000, d80C: 400000 });
  assert.equal(a.old.totalIncome, b.old.totalIncome);
});
test("80TTB caps at 50,000 for a senior; 80TTA caps at 10,000 on savings interest only", () => {
  const s = computeAll(rules, FY, { dob: "1960-01-01", salary: 600000, interestDeposit: 70000 });
  assert.equal(s.old.totalIncome, 570000);
  const y = computeAll(rules, FY, { ...young, salary: 500000, interestSavings: 15000 });
  assert.equal(y.old.totalIncome, 455000);
  const fd = computeAll(rules, FY, { ...young, salary: 500000, interestDeposit: 15000 });
  assert.equal(fd.old.totalIncome, 465000); // no 80TTA on FD interest
});

// ---------------- house property ----------------
const step = (r, key) => r.steps.find((s) => s.key === key)?.value;
test("let-out house: rent less municipal tax, 30% standard deduction, interest", () => {
  const r = computeAll(rules, FY, { ...young, hp: { type: "letout", rent: 300000, municipalTax: 20000, interest: 100000 } });
  assert.equal(step(r.new, "hp"), 96000);
  assert.equal(step(r.old, "hp"), 96000);
});
test("self-occupied loan interest: 2 lakh in the old regime, nothing in the new", () => {
  const r = computeAll(rules, FY, { ...young, salary: 1000000, hp: { type: "self", interest: 300000 } });
  assert.equal(r.old.totalIncome, 750000);
  near(r.old.totalTax, 62500 * 1.04);
  const n = computeAll(rules, FY, { ...young, salary: 1075000, hp: { type: "self", interest: 300000 } });
  assert.equal(n.new.totalIncome, 1000000);
});
test("let-out loss: not set off in the new regime, capped at 2 lakh in the old", () => {
  const r = computeAll(rules, FY, { ...young, salary: 1575000, hp: { type: "letout", rent: 120000, municipalTax: 0, interest: 400000 } });
  assert.equal(r.new.hpCarry, 316000);
  assert.equal(r.old.hpCarry, 116000);
});

// ---------------- business ----------------
test("44ADA: half of receipts", () => {
  const r = computeAll(rules, FY, { ...young, business: { type: "44ADA", turnover: 2000000 } });
  assert.equal(step(r.new, "biz"), 1000000);
  assert.equal(r.new.totalTax, 0); // 10 lakh is under the rebate limit
});
test("44AD: 6% digital, 8% otherwise", () => {
  const r = computeAll(rules, FY, { ...young, business: { type: "44AD", turnover: 5000000, digitalPct: 50 } });
  assert.equal(step(r.new, "biz"), 350000);
});

// ---------------- surcharge, special rates, set-off ----------------
test("surcharge of 10% above 50 lakh with no marginal relief needed far above the line", () => {
  const r = computeAll(rules, FY, { ...young, salary: 6075000 });
  near(r.new.totalTax, (1380000 + 138000) * 1.04);
});
test("slab income plus 112A gain: 12.5% above the 1.25 lakh exemption", () => {
  const r = computeAll(rules, FY, { ...young, salary: 2075000, ltcg112A: 300000 });
  near(r.new.totalTax, (200000 + 21875) * 1.04);
});
test("brought-forward long-term loss reduces 112A gain before the exemption", () => {
  const r = computeAll(rules, FY, { ...young, salary: 2075000, ltcg112A: 200000, bfLtcl: 50000 });
  near(r.new.specialTax, 3125);
  assert.equal(r.carry.ltcl, 0);
});
test("brought-forward loss larger than gains carries the rest forward", () => {
  const r = computeAll(rules, FY, { ...young, ltcg112A: 40000, bfLtcl: 100000 });
  assert.equal(r.carry.ltcl, 60000);
});
test("unused basic exemption absorbs part of a 111A gain", () => {
  const r = computeAll(rules, FY, { ...young, salary: 425000, stcg111A: 100000 });
  assert.equal(r.new.totalIncome, 450000);
  near(r.new.totalTax, 10000 * 1.04);
});

// ---------------- interest and fees ----------------
test("late filing, income up to 5 lakh: fee is 1,000", () => {
  const r = computeAll(rules, FY, { ...young, salary: 575000, filingDate: "2026-08-15" });
  assert.equal(r.interest.fee234F, 1000);
});
test("senior citizen filing a month late: 1% a month under 234A, fee 5,000, no 234B/C", () => {
  const r = computeAll(rules, FY, { dob: "1960-01-01", salary: 2075000, filingDate: "2026-08-31" });
  near(r.interest.i234A, 2080);
  assert.equal(r.interest.fee234F, 5000);
  assert.equal(r.interest.i234B + r.interest.i234C, 0);
});
test("non-senior with no advance tax: 234B for 4 months and 234C by instalment", () => {
  const r = computeAll(rules, FY, { ...young, salary: 2075000, filingDate: "2026-07-31" });
  near(r.interest.i234B, 8320);
  near(r.interest.i234C, 10504);
  assert.equal(r.payable, 226820);
});
test("on-time filing has no 234A and no fee", () => {
  const r = computeAll(rules, FY, { ...young, salary: 2075000, filingDate: "2026-07-31" });
  assert.equal(r.interest.i234A, 0);
  assert.equal(r.interest.fee234F, 0);
});
test("tax paid in excess gives a refund, never both", () => {
  const r = computeAll(rules, FY, { dob: "1960-01-01", salary: 700000, tds: 30000 });
  assert.equal(r.payable, 0);
  assert.ok(r.refund > 0);
});

// ---------------- ages ----------------
test("age edge cases on 31 March", () => {
  assert.equal(ageBandOf("1946-03-31", FY), "80+");
  assert.equal(ageBandOf("1946-04-01", FY), "60-80");
  assert.equal(ageBandOf("1966-03-31", FY), "60-80");
  assert.equal(ageBandOf("1966-04-01", FY), "below60");
});

// ---------------- form choice ----------------
const base = { resident: true, totalIncome: 800000, business: "none", hpCount: 0 };
test("more form cases", () => {
  assert.equal(selectForm({ ...base, agriOver5000: true }).form, "ITR-2");
  assert.equal(selectForm({ ...base, section194N: true }).form, "ITR-2");
  assert.equal(selectForm({ ...base, business: "presumptive", turnover: 25000000 }).form, "ITR-3");
  assert.equal(selectForm({ ...base, business: "presumptive", turnover: 1000000, stcg: true }).form, "ITR-3");
  const f = selectForm({ ...base, business: "presumptive", turnover: 1000000, foreignAsset: true });
  assert.equal(f.form, "ITR-3");
  assert.ok(f.ca.length > 0);
  assert.ok(selectForm({ ...base, resident: false }).ca.length > 0);
  assert.equal(selectForm({ ...base, unlisted: true }).form, "ITR-2");
  assert.equal(selectForm({ ...base, bfLoss: true }).form, "ITR-2");
});

// ---------------- validation ----------------
const okRes = computeAll(rules, FY, { dob: "1990-01-01", salary: 500000, tds: 1000 });
const check = (v, extra = {}) => validateInputs({ v, q: { business: "none", hp: "none" }, profile: { dob: "1990-01-01", ...extra }, res: okRes, today: "2026-11-07" });
test("validation: clean input has no errors", () => assert.equal(check({ salary: "5,00,000", tds: "1000" }).errors.length, 0));
test("validation: text in a money box is an error", () => assert.equal(check({ salary: "abc" }).errors.length, 1));
test("validation: negative salary or TDS is an error, negative gain is allowed", () => {
  assert.equal(check({ salary: "-5" }).errors.length, 1);
  assert.equal(check({ tds: "-5" }).errors.length, 1);
  assert.equal(check({ ltcg112A: "-4279" }).errors.length, 0);
});
test("validation: absurdly large number is an error", () => assert.equal(check({ salary: "99999999999999" }).errors.length, 1));
test("validation: digital share above 100 is an error for presumptive", () => {
  const r = validateInputs({ v: { digitalPct: "150" }, q: { business: "presumptive", hp: "none" }, profile: {}, res: okRes, today: "2026-11-07" });
  assert.equal(r.errors.length, 1);
});
test("validation: bad PAN is a warning, future birth date is an error", () => {
  assert.equal(check({}, { pan: "ABC" }).warnings.length >= 1, true);
  assert.equal(check({}, { dob: "2030-01-01" }).errors.length, 1);
});
test("validation: TDS with no income warns", () => {
  const empty = computeAll(rules, FY, { dob: "1990-01-01", tds: 5000 });
  const r = validateInputs({ v: { tds: "5000" }, q: { business: "none", hp: "none" }, profile: {}, res: empty, today: "2026-11-07" });
  assert.ok(r.warnings.some((w) => w.field === "tds"));
});
test("self-check passes a normal result and flags a broken one", () => {
  assert.deepEqual(selfCheck(okRes), []);
  const broken = { ...okRes, new: { ...okRes.new, totalTax: NaN } };
  assert.ok(selfCheck(broken).length > 0);
});

// ---------------- reading files ----------------
test("spreadsheet with title rows above the table is read", async () => {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    ["Capital gains report"],
    [],
    ["Scrip", "Asset Type", "Buy Date", "Sell Date", "Cost of Acquisition", "Sale Value"],
    ["Alpha", "Equity-STT", new Date(Date.UTC(2025, 0, 10)), new Date(Date.UTC(2025, 5, 10)), 1000, 1500],
    ["Beta", "Equity-STT", new Date(Date.UTC(2023, 0, 10)), new Date(Date.UTC(2025, 5, 10)), 2000, 1800],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const rows = await xlsxToRows({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  assert.equal(rows.length, 2);
  const c = classifyTransactions(rows, FY);
  assert.equal(c.s1, 500); // held 5 months
  assert.equal(c.l1, -200); // held 29 months
});
test("the downloadable CSV template reads back correctly", () => {
  const lines = templateCSV().trim().split("\n");
  const head = lines[0].split(",");
  assert.ok(looksLikeHeader(head));
  const rows = lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((x, i) => [head[i], x])));
  const c = classifyTransactions(rows, FY);
  // row 1: bought 15-Mar-2023 sold 20-Jun-2025, long term, gain 6,500
  // row 2: bought 2016, FMV 65,000 lies between cost 50,000 and sale 90,000, so cost becomes 65,000, gain 25,000
  assert.equal(Math.round(c.l1), 31500);
});

// ---------------- properties ----------------
test("tax never falls when income rises (both regimes, 0 to 80 lakh)", () => {
  let prevNew = -1;
  let prevOld = -1;
  for (let sal = 0; sal <= 8000000; sal += 25000) {
    const r = computeAll(rules, FY, { ...young, salary: sal });
    assert.ok(r.new.totalTax >= prevNew - 1, `new regime dropped at salary ${sal}`);
    assert.ok(r.old.totalTax >= prevOld - 1, `old regime dropped at salary ${sal}`);
    prevNew = r.new.totalTax;
    prevOld = r.old.totalTax;
  }
});
test("1,000 random cases produce finite, sane results", () => {
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 1000; i++) {
    const inp = {
      dob: rnd() < 0.5 ? "1960-05-05" : "1985-05-05",
      salary: Math.round(rnd() * 5e6),
      interestSavings: Math.round(rnd() * 5e4),
      interestDeposit: Math.round(rnd() * 8e5),
      dividend: Math.round(rnd() * 5e4),
      stcg111A: Math.round((rnd() - 0.3) * 4e5),
      ltcg112A: Math.round((rnd() - 0.4) * 6e5),
      stcgOther: Math.round((rnd() - 0.5) * 1e5),
      d80C: Math.round(rnd() * 2e5),
      tds: Math.round(rnd() * 1e5),
      hp: { type: ["none", "self", "letout"][Math.floor(rnd() * 3)], rent: Math.round(rnd() * 4e5), municipalTax: 0, interest: Math.round(rnd() * 4e5) },
    };
    const r = computeAll(rules, FY, inp);
    assert.deepEqual(selfCheck(r), [], JSON.stringify(inp));
  }
});

test("Bengali digits, commas and the rupee sign are understood", () => {
  assert.equal(n("১,২৫,০০০"), 125000);
  assert.equal(n("₹ 5,00,000"), 500000);
  assert.equal(n("abc"), 0);
});
