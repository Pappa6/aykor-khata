// In-browser PDF unlock and text extraction. The PDF engine is bundled with the app,
// so no file, PAN or date of birth ever leaves the device.

let libPromise;
function lib() {
  if (!libPromise) {
    libPromise = Promise.all([
      import("pdfjs-dist/build/pdf"),
      import("pdfjs-dist/build/pdf.worker.min.js?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return libPromise;
}

// Statements from the department and from depositories/AMCs use the holder's PAN and/or date of birth.
export function passwordCandidates(pan, dobDDMMYYYY, extra) {
  const out = [""];
  if (extra && extra.trim()) out.push(extra.trim());
  const pans = [];
  if (pan && pan.trim()) {
    const p = pan.trim();
    pans.push(p.toUpperCase(), p.toLowerCase());
  }
  const d = (dobDDMMYYYY || "").replace(/\D/g, "");
  const dobs = d.length === 8 ? [d, d.slice(0, 4) + d.slice(6), d.slice(4) + d.slice(2, 4) + d.slice(0, 2)] : [];
  out.push(...pans, ...dobs);
  for (const p of pans) for (const x of dobs) out.push(p + x, x + p, p.slice(0, 4) + x);
  return [...new Set(out)];
}

export async function openPdf(file, pan, dob, extra) {
  const pdfjs = await lib();
  const data = new Uint8Array(await file.arrayBuffer());
  for (const pw of passwordCandidates(pan, dob, extra)) {
    try {
      const pdf = await pdfjs.getDocument({ data: data.slice(), password: pw }).promise;
      return { pdf, usedPassword: pw };
    } catch (e) {
      if (e && (e.name === "PasswordException" || /password/i.test(e.message || ""))) continue;
      throw e;
    }
  }
  return null;
}

export async function pdfLines(pdf) {
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map();
    for (const it of content.items) {
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(it);
    }
    [...rows.keys()].sort((a, b) => b - a).forEach((y) => {
      const text = rows.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map((i) => i.str).join(" ").trim();
      if (text) lines.push(text);
    });
  }
  return lines;
}
