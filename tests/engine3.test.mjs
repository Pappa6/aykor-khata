// Business parts: books-based profit, 44AD and 44ADA together, plus form and warning rules.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeAll } from "../src/engine/tax.js";
import { selectForm } from "../src/engine/forms.js";
import { validateInputs } from "../src/engine/validate.js";

const rules = JSON.parse(fs.readFileSync(new URL("../src/rules/rules.json", import.meta.url), "utf8"));
const FY = "2025-26";
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`);
const base = { dob: "1964-07-01" };

test("books profit 3,00,000 + 44ADA receipts 10,00,000 add to 8,00,000 business income", () => {
  const r = computeAll(rules, FY, { ...base, businesses: [{ type: "regular", profit: 300000 }, { type: "44ADA", turnover: 1000000 }] });
  assert.equal(r.new.gti, 800000);
});
test("44AD turnover 10 lakh, fully digital, gives 6% = 60,000", () => {
  const r = computeAll(rules, FY, { ...base, businesses: [{ type: "44AD", turnover: 1000000, digitalPct: 100 }] });
  assert.equal(r.new.gti, 60000);
});
test("44AD part cash: 10 lakh, 50% digital = 50% * 6% + 50% * 8% = 70,000", () => {
  const r = computeAll(rules, FY, { ...base, businesses: [{ type: "44AD", turnover: 1000000, digitalPct: 50 }] });
  assert.equal(r.new.gti, 70000);
});
test("pension 2 lakh plus 44ADA 8 lakh gives GTI 5,25,000", () => {
  const r = computeAll(rules, FY, { ...base, salary: 200000, businesses: [{ type: "44ADA", turnover: 800000 }] });
  assert.equal(r.new.gti, 200000 - 75000 + 400000); // salary less the 75,000 standard deduction, plus 50% of 8 lakh
});
test("old single `business` field still works", () => {
  const r = computeAll(rules, FY, { ...base, business: { type: "regular", profit: 250000 } });
  assert.equal(r.new.gti, 250000);
});
test("business income removes the senior advance-tax exemption", () => {
  const r = computeAll(rules, FY, { ...base, businesses: [{ type: "regular", profit: 900000 }] });
  assert.ok(!r.interest.notes.some((x) => /প্রযোজ্য নয়/.test(x.bn)));
});

test("books plus presumptive picks ITR-3 and says why", () => {
  const f = selectForm({ resident: true, totalIncome: 900000, business: "regular", alsoPresumptive: true, hpCount: 0 });
  assert.equal(f.form, "ITR-3");
  assert.ok(f.reasons.some((x) => /দুই ধরনের/.test(x.bn)));
});
test("44ADA receipts of 40 lakh can use ITR-4; 60 lakh cannot unless 95% digital", () => {
  assert.equal(selectForm({ resident: true, totalIncome: 2000000, business: "presumptive", proReceipts: 4000000, hpCount: 0 }).form, "ITR-4");
  assert.equal(selectForm({ resident: true, totalIncome: 2000000, business: "presumptive", proReceipts: 6000000, hpCount: 0 }).form, "ITR-3");
  assert.equal(selectForm({ resident: true, totalIncome: 2000000, business: "presumptive", proReceipts: 6000000, digital95: true, hpCount: 0 }).form, "ITR-4");
});
test("44AD turnover 2.5 crore needs 95% digital for ITR-4", () => {
  assert.equal(selectForm({ resident: true, totalIncome: 2000000, business: "presumptive", turnover: 25000000, hpCount: 0 }).form, "ITR-3");
  assert.equal(selectForm({ resident: true, totalIncome: 2000000, business: "presumptive", turnover: 25000000, digital95: true, hpCount: 0 }).form, "ITR-4");
});
test("total income above 1 crore adds a Schedule AL reason; 80 lakh does not", () => {
  const hi = selectForm({ resident: true, totalIncome: 12000000, business: "none", hpCount: 0 });
  assert.equal(hi.form, "ITR-2");
  assert.ok(hi.reasons.some((x) => /Schedule AL/.test(x.bn)));
  const mid = selectForm({ resident: true, totalIncome: 8000000, business: "none", hpCount: 0 });
  assert.ok(!mid.reasons.some((x) => /Schedule AL/.test(x.bn)));
});
test("books turnover above 1 crore sends the user to a CA about audit", () => {
  const f = selectForm({ resident: true, totalIncome: 3000000, business: "regular", booksTurnover: 20000000, hpCount: 0 });
  assert.ok(f.ca.some((x) => /44AB/.test(x.bn)));
  const g = selectForm({ resident: true, totalIncome: 3000000, business: "regular", booksTurnover: 5000000, hpCount: 0 });
  assert.ok(!g.ca.some((x) => /44AB/.test(x.bn)));
});
test("validation warns over the 44AD, 44ADA and audit limits", () => {
  const w = (v, q) => validateInputs({ v, q, profile: {}, res: null, today: "2026-11-08" }).warnings.map((x) => x.field);
  assert.ok(w({ turnover: "25000000", digitalPct: "50" }, { bizPres: true, business: "presumptive" }).includes("turnover"));
  assert.ok(!w({ turnover: "25000000", digitalPct: "96" }, { bizPres: true, business: "presumptive" }).includes("turnover"));
  assert.ok(w({ receiptsPro: "6000000", digitalPct: "50" }, { bizPro: true, business: "presumptive" }).includes("receiptsPro"));
  assert.ok(w({ booksTurnover: "20000000" }, { bizBooks: true, business: "regular" }).includes("booksTurnover"));
});
