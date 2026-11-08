import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeAll, capitalGainsNet, ageBandOf, round10 } from "../src/engine/tax.js";
import { selectForm } from "../src/engine/forms.js";

const rules = JSON.parse(fs.readFileSync(new URL("../src/rules/rules.json", import.meta.url), "utf8"));
const near = (a, b, tol = 2) => assert.ok(Math.abs(a - b) <= tol, `expected ${b}, got ${a}`);

// The real filed return that the portal accepted (FY 2025-26, ITR-2, new regime).
const real = {
  dob: "1964-07-01",
  salary: 893208,
  interestSavings: 13593,
  interestDeposit: 699837,
  dividend: 15310,
  stcg111A: 56481,
  ltcg112A: -4279,
  tds: 3088,
};

test("age band is tested on 31 March of the year", () => {
  assert.equal(ageBandOf("1964-07-01", "2025-26"), "60-80"); // 61 on 31 Mar 2026
  assert.equal(ageBandOf("1966-04-10", "2025-26"), "below60");
  assert.equal(ageBandOf("1966-03-31", "2025-26"), "60-80");
});

test("real filed return reproduces the portal figures", () => {
  const r = computeAll(rules, "2025-26", real);
  assert.equal(r.ageBand, "60-80");
  assert.equal(r.best, "new");
  near(r.new.gti, 1603429, 1);
  assert.equal(r.new.totalIncome, 1603430); // portal total income
  near(r.new.specialTax, 11296.2, 0.5); // Schedule SI
  near(r.new.totalTax, 128272, 2); // portal gross tax liability
  assert.equal(r.payable, 125180); // challan actually paid
  assert.equal(r.carry.ltcl, 4279); // Schedule CFL
});

test("pension only below the rebate limit pays nothing under the new regime", () => {
  const r = computeAll(rules, "2025-26", { dob: "1964-07-01", salary: 893208 });
  assert.equal(r.new.totalTax, 0);
});

test("exactly 12 lakh income is fully rebated, 12.5 lakh gets marginal relief", () => {
  const a = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 1275000 }); // 12 lakh after 75k
  assert.equal(a.new.totalIncome, 1200000);
  assert.equal(a.new.totalTax, 0);
  const b = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 1325000 }); // 12.5 lakh
  assert.equal(b.new.totalIncome, 1250000);
  near(b.new.totalTax, 50000 * 1.04, 1); // tax capped at income above 12 lakh
});

test("20 lakh salaried, new regime", () => {
  const r = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 2075000 });
  assert.equal(r.new.totalIncome, 2000000);
  near(r.new.totalTax, 200000 * 1.04, 1);
});

test("old regime senior citizen, 7 lakh pension", () => {
  const r = computeAll(rules, "2025-26", { dob: "1960-01-01", salary: 700000 });
  assert.equal(r.old.totalIncome, 650000);
  near(r.old.totalTax, 40000 * 1.04, 1); // 5% on 2L above 3L slab, 20% above 5L
});

test("old regime deduction auto-applies 80TTB for seniors", () => {
  const r = computeAll(rules, "2025-26", { dob: "1960-01-01", salary: 600000, interestDeposit: 80000 });
  // 600000-50000+80000 = 630000, less 80TTB 50000 = 580000
  assert.equal(r.old.totalIncome, 580000);
});

test("long-term loss cannot reduce short-term gain; it carries forward", () => {
  const c = capitalGainsNet({ stcg111A: 100000, ltcg112A: -30000 }, rules.common);
  assert.equal(c.s1, 100000);
  assert.equal(c.carryLtcl, 30000);
});

test("short-term loss reduces long-term gain; 1.25 lakh of LTCG is not taxed", () => {
  const r = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 2075000, stcg111A: -20000, ltcg112A: 200000 });
  assert.equal(r.cgNet.l1, 180000);
  near(r.new.specialTax, (180000 - 125000) * 0.125, 0.5);
});

test("unused basic exemption absorbs special-rate income", () => {
  const r = computeAll(rules, "2025-26", { dob: "1990-01-01", stcg111A: 300000 });
  assert.equal(r.new.totalTax, 0); // 4 lakh nil slab covers a 3 lakh gain
});

test("advance tax interest does not apply to a senior with no business income", () => {
  const r = computeAll(rules, "2026-27", { dob: "1964-07-01", salary: 893208, interestDeposit: 699837 });
  assert.equal(r.interest.i234B + r.interest.i234C, 0);
});

test("late filing adds 234A interest and the 234F fee", () => {
  const r = computeAll(rules, "2025-26", { ...real, filingDate: "2026-11-07" });
  assert.equal(r.interest.fee234F, 5000);
  assert.ok(r.interest.i234A > 0);
});

test("surcharge marginal relief never makes tax jump more than the extra income", () => {
  const just = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 5075000 }); // 50 lakh
  const over = computeAll(rules, "2025-26", { dob: "1990-01-01", salary: 5085000 }); // 50.10 lakh
  assert.ok(over.new.totalTax - just.new.totalTax <= 10000 * 1.04 + 1); // extra income plus 4% cess
});

test("rounding helper", () => assert.equal(round10(125184), 125180));

// ---- form selection ----
const base = { resident: true, totalIncome: 900000, business: "none", hpCount: 0 };
test("ITR-1 for plain salary and interest", () => assert.equal(selectForm(base).form, "ITR-1"));
test("capital gains push to ITR-2", () => assert.equal(selectForm({ ...base, stcg: true }).form, "ITR-2"));
test("112A gain up to 1.25 lakh without loss stays ITR-1", () =>
  assert.equal(selectForm({ ...base, ltcg112A: 100000 }).form, "ITR-1"));
test("112A loss pushes to ITR-2", () => assert.equal(selectForm({ ...base, ltcg112A: -4279 }).form, "ITR-2"));
test("income over 50 lakh needs ITR-2", () => assert.equal(selectForm({ ...base, totalIncome: 6000000 }).form, "ITR-2"));
test("two house properties need ITR-2", () => assert.equal(selectForm({ ...base, hpCount: 2 }).form, "ITR-2"));
test("presumptive business gives ITR-4", () =>
  assert.equal(selectForm({ ...base, business: "presumptive", turnover: 1500000 }).form, "ITR-4"));
test("regular books give ITR-3", () => assert.equal(selectForm({ ...base, business: "regular" }).form, "ITR-3"));
test("futures and options trading gives ITR-3 and asks for a CA", () => {
  const f = selectForm({ ...base, speculative: true });
  assert.equal(f.form, "ITR-3");
  assert.ok(f.ca.length > 0);
});
test("foreign assets flag a CA", () => assert.ok(selectForm({ ...base, foreignAsset: true }).ca.length > 0));

// ---- capital gains and paper parsing ----
import { classifyTransactions, quarterly, parseFlexDate } from "../src/engine/cg.js";
import { parseAisText, parseAcknowledgement } from "../src/engine/parse.js";

test("dates in broker formats and excel serials are read", () => {
  assert.equal(parseFlexDate("04-Sep-24").toISOString().slice(0, 10), "2024-09-04");
  assert.equal(parseFlexDate("2025-04-24").toISOString().slice(0, 10), "2025-04-24");
  assert.equal(parseFlexDate("15/03/2023").toISOString().slice(0, 10), "2023-03-15");
  assert.equal(parseFlexDate("45444").toISOString().slice(0, 10), "2024-06-01");
});

test("classification: holding period and grandfathered cost", () => {
  const rows = [
    { Scrip: "A", "Asset Type": "Equity-STT", "Buy Date": "04-Sep-24", "Sell Date": "05-Jun-25", "Cost of Acquisition": "58547.44", "Sale Value": "71353.03" },
    { Scrip: "B", "Asset Type": "Equity-STT", "Buy Date": "01-Jan-2017", "Sell Date": "01-Feb-2026", "Cost of Acquisition": "128470.83", "Sale Value": "144215", "FMV 31-Jan-2018": "38175" },
    { Scrip: "C", "Asset Type": "Other", "Buy Date": "01-Jan-2025", "Sell Date": "01-Mar-2026", "Cost of Acquisition": "1000", "Sale Value": "1500" },
  ];
  const c = classifyTransactions(rows, "2025-26");
  assert.equal(Math.round(c.s1), 12806);
  assert.equal(Math.round(c.l1), 15744); // cost kept at original because FMV is lower than cost
  assert.equal(c.so, 500); // other asset held under 2 years is short term
});

test("quarter table adds up exactly and has no negative box", () => {
  const items = [
    { bucket: "s1", sell: Date.UTC(2025, 4, 10), gain: 24863.4 },
    { bucket: "s1", sell: Date.UTC(2025, 10, 10), gain: -369.63 },
    { bucket: "s1", sell: Date.UTC(2026, 1, 10), gain: 18082.31 },
    { bucket: "s1", sell: Date.UTC(2026, 2, 20), gain: 13904.59 },
  ];
  const q = quarterly(items, "s1", "2025-26");
  assert.equal(q.periods.reduce((a, b) => a + b, 0), q.total);
  assert.ok(q.periods.every((v) => v >= 0));
  assert.equal(q.total, 56481);
});

test("TIS summary rows are read", () => {
  const f = parseAisText([
    "3 Interest from savings bank 13,593 13,593",
    "4 Interest from deposit 6,99,837 6,99,837",
    "2 Dividend 15,310 15,310",
    "1 Salary 8,93,208 8,93,208",
  ]);
  assert.equal(f.interestSavings, 13593);
  assert.equal(f.interestDeposit, 699837);
  assert.equal(f.dividend, 15310);
  assert.equal(f.salary, 893208);
});

test("AIS detail rows are added up when there is no summary", () => {
  const f = parseAisText([
    "Dividend Dividend income (SFT-015) VEDANTA LIMITED 1 Total Dividend amount 2,850",
    "Dividend Dividend income (SFT-015) HDFC BANK LIMITED 1 Total Dividend amount 2,592",
  ]);
  assert.equal(f.dividend, 5442);
});

test("acknowledgement number and date are picked out", () => {
  const a = parseAcknowledgement(["Acknowledgement Number 123456789012345", "e-Filed on 31-Jul-2026", "Assessment Year 2026-27", "ITR-2"]);
  assert.equal(a.ack, "123456789012345");
  assert.equal(a.form, "ITR-2");
});
