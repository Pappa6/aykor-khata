// The tax-payment ledger: payments a person records during the year, kept on their own device.
// Pure functions only; saving to the device happens in the app.

export const KINDS = { advance: ["অগ্রিম কর", "Advance tax"], selfassess: ["Self Assessment কর", "Self-assessment tax"] };

export function fyBounds(fy) {
  const y = parseInt(fy.slice(0, 4), 10);
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

export function validateEntry(e, today) {
  const errors = [];
  const bn = (b, en) => errors.push({ bn: b, en });
  if (!e.fy) bn("বছর বেছে নিন।", "Choose the year.");
  if (!KINDS[e.kind]) bn("কর জমার ধরন বেছে নিন।", "Choose the type of payment.");
  const amt = Number(String(e.amount ?? "").replace(/,/g, ""));
  if (!Number.isFinite(amt) || amt <= 0) bn("টাকার অঙ্ক শূন্যের বেশি একটা সংখ্যা হতে হবে।", "The amount must be a number above zero.");
  if (amt > 1e9) bn("টাকার অঙ্ক অস্বাভাবিক বড়।", "The amount looks too large.");
  const d = new Date(e.date);
  if (!e.date || isNaN(d)) bn("জমার তারিখ দিন।", "Enter the payment date.");
  else {
    if (e.date > today) bn("জমার তারিখ ভবিষ্যতের হতে পারে না।", "The payment date cannot be in the future.");
    if (e.fy) {
      const { start } = fyBounds(e.fy);
      const y = parseInt(e.fy.slice(0, 4), 10);
      const latest = `${y + 2}-03-31`; // self-assessment may be paid until the return is filed
      if (e.date < start) bn(`এই তারিখ ${e.fy} বছরের আগের। অগ্রিম/Self Assessment কর বছরের এপ্রিল থেকে দেওয়া হয়।`, `This date is before FY ${e.fy} began.`);
      if (e.date > latest) bn("তারিখটা এই বছরের জন্য অনেক পরের।", "The date is too late for this year.");
      if (e.kind === "advance" && e.date > `${y + 1}-03-31`) bn("অগ্রিম কর বছর শেষের (31 মার্চ) মধ্যে দিতে হয়। পরে দিলে সেটা Self Assessment কর।", "Advance tax is paid by 31 March; later payments are self-assessment tax.");
    }
  }
  if (e.bsr && !/^\d{7}$/.test(String(e.bsr).trim())) bn("BSR কোড ৭টা সংখ্যার হয়।", "A BSR code has 7 digits.");
  if (e.challan && !/^\d{1,5}$/.test(String(e.challan).trim())) bn("Challan নম্বর ১ থেকে ৫ সংখ্যার হয়।", "A challan number has 1 to 5 digits.");
  return errors;
}

export function sumByKind(entries, fy) {
  const out = { advance: 0, selfassess: 0 };
  for (const e of entries) if (e.fy === fy && out[e.kind] !== undefined) out[e.kind] += Number(e.amount) || 0;
  return out;
}

// Advance-tax instalments: what should have been paid by each date, and what was.
export function advanceSchedule(rules, fy, taxAfterTds, entries, today) {
  const dates = rules.years[fy].advanceDates;
  const cum = [0.15, 0.45, 0.75, 1];
  return dates.map((due, i) => {
    const should = Math.round(taxAfterTds * cum[i]);
    const paid = entries.filter((e) => e.fy === fy && e.kind === "advance" && e.date <= due).reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const status = today <= due ? "upcoming" : paid + 0.5 >= should ? "ok" : "short";
    return { due, should, paid, shortBy: Math.max(0, should - paid), status };
  });
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---- backup file ----
export function exportBackup(ledger, history) {
  return JSON.stringify({ app: "aykor-khata", version: 1, exportedAt: new Date().toISOString(), ledger, history }, null, 2);
}

export function importBackup(text, today) {
  let data;
  try { data = JSON.parse(text); } catch { return { error: { bn: "ফাইলটা ঠিকমতো পড়া গেল না। এটা কি 'আয়কর খাতা'-র কপি?", en: "The file could not be read. Is it an Aykor Khata backup?" } }; }
  if (!data || data.app !== "aykor-khata" || !Array.isArray(data.ledger)) return { error: { bn: "এটা আয়কর খাতার কপি নয়।", en: "This is not an Aykor Khata backup." } };
  const ledger = [];
  let skipped = 0;
  for (const e of data.ledger) {
    const clean = { id: String(e.id || newId()), fy: e.fy, date: e.date, kind: e.kind, amount: Number(e.amount), bsr: e.bsr ? String(e.bsr) : "", challan: e.challan ? String(e.challan) : "", note: e.note ? String(e.note).slice(0, 200) : "" };
    if (validateEntry(clean, today).length) skipped += 1;
    else ledger.push(clean);
  }
  const history = data.history && typeof data.history === "object" && !Array.isArray(data.history) ? data.history : {};
  return { ledger, history, skipped };
}

export function mergeLedger(current, incoming) {
  const seen = new Set(current.map((e) => e.id));
  return [...current, ...incoming.filter((e) => !seen.has(e.id))].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Amounts paid in each of the four instalment windows (the form the interest calculation uses).
export function advanceByPeriod(rules, fy, entries) {
  const d = rules.years[fy].advanceDates;
  const out = [0, 0, 0, 0];
  for (const e of entries) {
    if (e.fy !== fy || e.kind !== "advance") continue;
    const i = e.date <= d[0] ? 0 : e.date <= d[1] ? 1 : e.date <= d[2] ? 2 : 3;
    out[i] += Number(e.amount) || 0;
  }
  return out;
}
