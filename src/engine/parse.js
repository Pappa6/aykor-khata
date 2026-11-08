// Reading uploaded papers. Everything here runs in the browser; nothing is sent anywhere.

import { looksLikeHeader } from "./cg.js";

const NUM_RE = /-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;
const toNum = (s) => parseFloat(String(s).replace(/,/g, ""));
const lastNumber = (line) => {
  const m = line.match(NUM_RE);
  return m && m.length ? toNum(m[m.length - 1]) : null;
};

// Rows from an HTML table (broker reports are often saved as HTML)
export function htmlToRows(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table")).sort((a, b) => b.rows.length - a.rows.length);
  if (!tables.length) return [];
  const rows = Array.from(tables[0].rows).map((tr) => Array.from(tr.cells).map((td) => td.textContent.trim()));
  if (rows.length < 2) return [];
  const head = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// The department's TIS/AIS text. TIS has category totals; AIS has one row per source.
// Returns only what it is reasonably sure about, so the user can confirm each number.
export function parseAisText(lines) {
  const found = {};
  const sums = { dividend: 0, savings: 0, deposit: 0, salary: 0 };
  let sawDividendRows = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const l = line.toLowerCase();
    // TIS summary rows: "<n> <category> <processed> <accepted>"
    const tis = line.match(/^\d+\s+(Salary|Dividend|Interest from savings bank|Interest from deposit)\s+([\d,\.]+)\s+([\d,\.]+)\s*$/i);
    if (tis) {
      const key = { salary: "salary", dividend: "dividend", "interest from savings bank": "interestSavings", "interest from deposit": "interestDeposit" }[tis[1].toLowerCase()];
      found[key] = toNum(tis[3]);
      continue;
    }
    // AIS detail rows
    if (/salary received \(section 192\)/.test(l)) sums.salary += lastNumber(line) ?? 0;
    if (/dividend income \(sft-015\)/.test(l)) { sums.dividend += lastNumber(line) ?? 0; sawDividendRows = true; }
    if (/interest income \(sft-016\)\s*[–-]\s*savings/.test(l)) sums.savings += lastNumber(line) ?? 0;
    if (/interest income \(sft-016\)\s*[–-]\s*term deposit/.test(l)) sums.deposit += lastNumber(line) ?? 0;
    if (/sale of listed equity share|sale of unit of equity oriented mutual fund|sale of other unit/.test(l)) {
      found.saleConsideration = (found.saleConsideration || 0) + (lastNumber(line) ?? 0);
    }
    if (/^purchase of (securities|mutual funds)|purchase of securities \(sft|purchase of mutual funds \(sft/.test(l)) {
      found.purchaseTotal = (found.purchaseTotal || 0) + (lastNumber(line) ?? 0);
    }
  }
  if (found.salary === undefined && sums.salary) found.salary = sums.salary;
  if (found.dividend === undefined && sawDividendRows) found.dividend = sums.dividend;
  if (found.interestSavings === undefined && sums.savings) found.interestSavings = sums.savings;
  if (found.interestDeposit === undefined && sums.deposit) found.interestDeposit = sums.deposit;
  return found;
}

// Form 26AS / 168 style TDS rows are not parsed here on purpose: the user types the TDS total
// from the statement, and the tool shows it next to the AIS figure.

// Acknowledgement (ITR-V) details for the filing history
export function parseAcknowledgement(lines) {
  const text = lines.join(" ");
  const ack = text.match(/\b(\d{15})\b/);
  const dated = text.match(/(\d{1,2}[-\/ ](?:[A-Za-z]{3,9}|\d{1,2})[-\/ ,]+\d{4})/);
  const ay = text.match(/(?:Assessment Year|AY)\D{0,6}(20\d{2}-\d{2})/i);
  const form = text.match(/ITR[-\s]?([1-4])/i);
  return {
    ack: ack ? ack[1] : "",
    dateText: dated ? dated[1] : "",
    ay: ay ? ay[1] : "",
    form: form ? `ITR-${form[1]}` : "",
  };
}

// Transaction-looking lines from a broker or mutual-fund PDF (two dates and two amounts).
export function pdfLinesToRows(lines) {
  const DATE = /(\d{1,2}[-\/][A-Za-z]{3,9}[-\/]\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/g;
  const rows = [];
  for (const line of lines) {
    const dates = line.match(DATE);
    const nums = (line.match(NUM_RE) || []).map(toNum).filter((x) => Math.abs(x) >= 1);
    if (dates && dates.length >= 2 && nums.length >= 2) {
      const at = line.indexOf(dates[0]);
      rows.push({
        Scrip: (at > 0 ? line.slice(0, at) : "Row").trim() || "Row",
        "Asset Type": "Equity-STT",
        "Buy Date": dates[0],
        "Sell Date": dates[1],
        "Cost of Acquisition": nums[0],
        "Sale Value": nums[nums.length - 1],
      });
    }
  }
  return rows;
}

// The statement's own printed totals, used to check what we extracted.
export function statementGainTotals(lines) {
  let stcg = null;
  let ltcg = null;
  for (const line of lines) {
    const l = line.toLowerCase();
    if (stcg === null && /short[\s-]*term.*(gain|loss)/.test(l)) stcg = lastNumber(line);
    if (ltcg === null && /long[\s-]*term.*(gain|loss)/.test(l)) ltcg = lastNumber(line);
  }
  return { stcg, ltcg };
}

// Excel files (xlsx/xls). Takes the first sheet and finds the header row itself.
export async function xlsxToRows(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const at = grid.slice(0, 40).findIndex((r) => looksLikeHeader(r));
  if (at < 0) return [];
  const head = grid[at].map((h) => String(h).trim());
  return grid.slice(at + 1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
