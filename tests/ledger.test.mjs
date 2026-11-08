import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateEntry, sumByKind, advanceSchedule, exportBackup, importBackup, mergeLedger, advanceByPeriod } from "../src/engine/ledger.js";

const rules = JSON.parse(fs.readFileSync(new URL("../src/rules/rules.json", import.meta.url), "utf8"));
const TODAY = "2026-11-07";
const good = { id: "a", fy: "2026-27", date: "2026-09-15", kind: "advance", amount: 30000, bsr: "0002271", challan: "46952" };

test("a complete entry is valid", () => assert.deepEqual(validateEntry(good, TODAY), []));
test("amount must be positive", () => {
  assert.ok(validateEntry({ ...good, amount: 0 }, TODAY).length > 0);
  assert.ok(validateEntry({ ...good, amount: "abc" }, TODAY).length > 0);
  assert.ok(validateEntry({ ...good, amount: -5 }, TODAY).length > 0);
});
test("date cannot be in the future or before the year began", () => {
  assert.ok(validateEntry({ ...good, date: "2026-12-01" }, TODAY).length > 0);
  assert.ok(validateEntry({ ...good, date: "2026-03-31" }, TODAY).length > 0);
});
test("advance tax paid after 31 March is flagged; self-assessment after is fine", () => {
  const late = { ...good, fy: "2025-26", date: "2026-07-20" };
  assert.ok(validateEntry({ ...late, kind: "advance" }, TODAY).length > 0);
  assert.deepEqual(validateEntry({ ...late, kind: "selfassess" }, TODAY), []);
});
test("BSR and challan formats", () => {
  assert.ok(validateEntry({ ...good, bsr: "123" }, TODAY).length > 0);
  assert.ok(validateEntry({ ...good, challan: "123456" }, TODAY).length > 0);
  assert.deepEqual(validateEntry({ ...good, bsr: "", challan: "" }, TODAY), []);
});
test("sums by kind and year", () => {
  const l = [good, { ...good, id: "b", amount: 20000 }, { ...good, id: "c", kind: "selfassess", amount: 5000 }, { ...good, id: "d", fy: "2025-26", amount: 999 }];
  assert.deepEqual(sumByKind(l, "2026-27"), { advance: 50000, selfassess: 5000 });
});
test("advance-tax schedule reports shortfalls by instalment", () => {
  const l = [{ ...good, date: "2026-06-10", amount: 15000 }, { ...good, id: "b", date: "2026-09-10", amount: 20000 }];
  const s = advanceSchedule(rules, "2026-27", 100000, l, "2026-11-07");
  assert.equal(s[0].should, 15000);
  assert.equal(s[0].status, "ok");
  assert.equal(s[1].should, 45000);
  assert.equal(s[1].paid, 35000);
  assert.equal(s[1].status, "short");
  assert.equal(s[1].shortBy, 10000);
  assert.equal(s[2].status, "upcoming");
});
test("backup round-trips and skips bad entries", () => {
  const text = exportBackup([good, { ...good, id: "bad", amount: -1 }], { "2025-26": { filed: true } });
  const r = importBackup(text, TODAY);
  assert.equal(r.ledger.length, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.history["2025-26"].filed, true);
});
test("backup import rejects other files", () => {
  assert.ok(importBackup("not json", TODAY).error);
  assert.ok(importBackup('{"hello":1}', TODAY).error);
});
test("merge keeps existing and adds only new entries", () => {
  const m = mergeLedger([good], [good, { ...good, id: "z", date: "2026-06-10" }]);
  assert.equal(m.length, 2);
  assert.equal(m[0].id, "z");
});

test("payments fall into the right instalment window", () => {
  const l = [
    { ...good, id: "1", date: "2026-06-10", amount: 100 },
    { ...good, id: "2", date: "2026-08-01", amount: 200 },
    { ...good, id: "3", date: "2026-12-15", amount: 300 },
    { ...good, id: "4", date: "2027-03-20", amount: 400 },
  ];
  assert.deepEqual(advanceByPeriod(rules, "2026-27", l), [100, 200, 300, 400]);
});
