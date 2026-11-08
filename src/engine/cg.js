// Capital-gains classification from raw transaction rows, plus the quarter-wise table the portal asks for.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseFlexDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const str = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(str) && Number(str) > 20000 && Number(str) < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + Number(str) * 86400000);
  }
  let m = str.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,})[-\/ ,]*(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mon === undefined) return null;
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, mon, +m[1]));
  }
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  }
  return null;
}

const ALIASES = {
  scrip: ["scrip", "name", "security name", "fund name", "stock", "symbol", "scheme name", "scheme"],
  assetType: ["asset type (equity-stt / other)", "asset type", "type", "category"],
  buyDate: ["buy date", "purchase date", "date of purchase", "acquisition date", "buy dt", "date of acquisition"],
  sellDate: ["sell date", "sale date", "date of sale", "redemption date", "sell dt", "date of transfer"],
  cost: ["cost of acquisition", "purchase value", "buy value", "cost", "purchase amount", "cost value", "buy amount"],
  saleValue: ["sale value", "sale amount", "sell value", "redemption value", "sale proceeds", "consideration", "sell amount"],
  fmv: ["fmv 31-jan-2018", "fmv", "fair market value", "fmv 31-jan-2018 (equity ltcg only, if bought before that date)"],
};

export function pick(row, kind) {
  const keys = Object.keys(row);
  for (const alias of ALIASES[kind]) {
    const key = keys.find((k) => k.trim().toLowerCase() === alias);
    if (key !== undefined) return row[key];
  }
  return undefined;
}

const num = (v) => {
  const x = parseFloat(String(v ?? "").replace(/[,₹\s]/g, ""));
  return Number.isFinite(x) ? x : 0;
};

const JAN2018 = Date.UTC(2018, 0, 31);
const DAY = 86400000;

export function classifyTransactions(rows, fy) {
  const out = { s1: 0, so: 0, l1: 0, lo: 0, items: [], warnings: [], skipped: 0 };
  rows.forEach((row, i) => {
    const scrip = String(pick(row, "scrip") || `Row ${i + 1}`).trim();
    const t = String(pick(row, "assetType") || "").toLowerCase();
    const isEquity = t.includes("equity") || t.includes("stt");
    const buy = parseFlexDate(pick(row, "buyDate"));
    const sell = parseFlexDate(pick(row, "sellDate"));
    const cost = num(pick(row, "cost"));
    const sale = num(pick(row, "saleValue"));
    const fmvRaw = pick(row, "fmv");
    const fmv = fmvRaw === undefined || fmvRaw === "" ? null : num(fmvRaw);
    if (!buy || !sell) {
      out.skipped += 1;
      out.warnings.push({ bn: `${scrip}: তারিখ পড়া যায়নি, বাদ দেওয়া হয়েছে। আপনার ফাইলের কলাম: ${Object.keys(row).join(", ")}`, en: `${scrip}: dates unreadable, skipped. Columns found: ${Object.keys(row).join(", ")}` });
      return;
    }
    const days = (sell - buy) / DAY;
    const isLong = days > (isEquity ? 365 : 730);
    let adj = cost;
    if (isEquity && isLong && buy.getTime() < JAN2018) {
      if (fmv !== null) adj = Math.max(cost, Math.min(fmv, sale));
      else out.warnings.push({ bn: `${scrip}: ৩১-জানু-২০১৮-র আগে কেনা, কিন্তু সেই তারিখের বাজারদর (FMV) দেওয়া নেই। আসল দাম ধরা হয়েছে, কর বেশি আসতে পারে।`, en: `${scrip}: bought before 31-Jan-2018 but no FMV given. Raw cost used, so tax may be overstated.` });
    }
    if (cost === 0 && sale > 0) {
      out.warnings.push({ bn: `${scrip}: কেনার দাম ০। বোনাস শেয়ার হলে হোল্ডিংয়ের সময় ধরা হয় বোনাস পাওয়ার তারিখ থেকে, তাই কেনার তারিখে সেই তারিখ দিন। না হলে স্বল্প/দীর্ঘমেয়াদি ভুল হতে পারে।`, en: `${scrip}: cost is 0. For bonus shares the holding period starts on the allotment date, so use that as the buy date. Otherwise short/long term can be wrong.` });
    }
    const gain = sale - adj;
    const bucket = isEquity ? (isLong ? "l1" : "s1") : isLong ? "lo" : "so";
    out[bucket] += gain;
    out.items.push({ scrip, bucket, gain, sell: sell.getTime(), days: Math.round(days), consideration: sale, cost: adj });
  });
  out.fy = fy;
  return out;
}

// Quarter-wise table (for the portal's Table F). The five periods of the financial year.
export function quarterly(items, bucket, fy) {
  const y = parseInt(fy.slice(0, 4), 10);
  const ends = [Date.UTC(y, 5, 15), Date.UTC(y, 8, 15), Date.UTC(y, 11, 15), Date.UTC(y + 1, 2, 15), Date.UTC(y + 1, 2, 31)];
  const q = [0, 0, 0, 0, 0];
  items.filter((it) => it.bucket === bucket).forEach((it) => {
    const idx = ends.findIndex((e) => it.sell <= e);
    q[idx < 0 ? 4 : idx] += it.gain;
  });
  // The portal does not accept a negative quarter: net it into the nearest earlier positive quarter
  // (or the nearest later one) so the total stays equal.
  for (let i = 0; i < 5; i++) {
    if (q[i] < 0) {
      const order = [];
      for (let j = i - 1; j >= 0; j--) order.push(j);
      for (let j = i + 1; j < 5; j++) order.push(j);
      for (const j of order) {
        if (q[j] > 0) {
          const use = Math.min(q[j], -q[i]);
          q[j] -= use;
          q[i] += use;
          if (q[i] >= 0) break;
        }
      }
    }
  }
  const rounded = q.map((v) => Math.round(v));
  const total = Math.round(q.reduce((a, b) => a + b, 0));
  const diff = total - rounded.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let big = 0;
    rounded.forEach((v, i) => { if (v > rounded[big]) big = i; });
    rounded[big] += diff; // make the five boxes add up exactly to the rounded total
  }
  return { periods: rounded, total };
}

export const QUARTER_LABELS = (fy) => {
  const y = parseInt(fy.slice(0, 4), 10);
  return [`Up to 15/6/${y}`, `16/6/${y} – 15/9/${y}`, `16/9/${y} – 15/12/${y}`, `16/12/${y} – 15/3/${y + 1}`, `16/3/${y + 1} – 31/3/${y + 1}`];
};

// Reconciliation of what we extracted against what the statement itself says
export function reconcile(label, ours, theirs, tolerance = 5) {
  if (theirs === null || theirs === undefined || Number.isNaN(theirs)) return null;
  const diff = ours - theirs;
  return { label, ours, theirs, diff, ok: Math.abs(diff) <= tolerance };
}

// For spreadsheets with title rows above the table: does this row look like the header?
export function looksLikeHeader(cells) {
  const lower = cells.map((c) => String(c ?? "").trim().toLowerCase());
  const hit = (kind) => ALIASES[kind].some((a) => lower.includes(a));
  return ["buyDate", "sellDate", "cost", "saleValue"].filter(hit).length >= 3;
}

export const TEMPLATE_HEADERS = ["Scrip", "Asset Type", "Buy Date", "Sell Date", "Cost of Acquisition", "Sale Value", "FMV 31-Jan-2018"];
export function templateCSV() {
  return (
    TEMPLATE_HEADERS.join(",") + "\n" +
    "Example Ltd,Equity-STT,15-Mar-2023,20-Jun-2025,22000,28500,\n" +
    "Old Holding Ltd,Equity-STT,10-Jan-2016,12-Feb-2026,50000,90000,65000\n"
  );
}
