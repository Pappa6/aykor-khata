// Step-by-step filing guide for the income-tax portal, with the user's own numbers filled in.
// Order and cautions come from a real ITR-2 filing completed on the portal.
import { quarterly } from "./cg.js";

const B = (bn, en) => ({ bn, en });

export function buildGuide({ form, fy, res, inp, cg, rules, payments = [] }) {
  const Y = rules.years[fy];
  const ay = `${parseInt(fy.slice(0, 4), 10) + 1}-${String(parseInt(fy.slice(0, 4), 10) + 2).slice(2)}`;
  const reg = res.chosen.regime;
  const newReg = reg === "new";
  const sec = [];
  const S = (title, where, rows = [], tips = []) => sec.push({ title, where, rows, tips });
  const row = (bn, en, value, note) => ({ label: B(bn, en), value, note });

  S(
    B("শুরুর আগে", "Before you begin"),
    B("incometax.gov.in → Login (PAN) → e-File → Income Tax Returns → File Income Tax Return", "incometax.gov.in → Login (PAN) → e-File → Income Tax Returns → File Income Tax Return"),
    [
      row("Assessment year", "Assessment year", fy === "2025-26" ? ay : `${ay} (নতুন আইনে এটা "Tax Year ${fy}")`),
      row("ফর্ম", "Form", form),
      row("ফাইলিংয়ের ধরন", "Mode", "Online"),
    ],
    [
      B("AIS এবং Form 26AS/168 পাশে খুলে রাখুন। প্রতিটা ঘরের সংখ্যা ওগুলোর সঙ্গে মেলাবেন।", "Keep AIS and Form 26AS/168 open and match every figure against them."),
      ...(Y.act.includes("2025") ? [B("এই বছর নতুন আয়কর আইনে। পোর্টালের ফর্ম ও ধারার নাম আগের বছরের থেকে আলাদা হতে পারে, স্ক্রিনে যা দেখেন সেটাকেই প্রাধান্য দিন।", "This year falls under the new Income-tax Act. Portal labels may differ; trust what the screen shows.")] : []),
    ],
  );

  S(
    B("Part A: সাধারণ তথ্য", "Part A: General information"),
    B("পোর্টাল নিজেই ভরা থাকে, শুধু মিলিয়ে নিন", "Pre-filled by the portal, just verify"),
    [
      row("পুরোনো regime-এ যেতে চান? (115BAC(6))", "Opt out of the new regime? (115BAC(6))", newReg ? "No" : "Yes", B(newReg ? "নতুন regime-এই কম কর, তাই 'No'।" : "পুরোনো regime-এ কর কম, তাই 'Yes'।", newReg ? "New regime is cheaper, so 'No'." : "Old regime is cheaper, so 'Yes'.")),
    ],
  );

  const salary = Number(inp.salary) || 0;
  if (salary > 0) {
    S(
      B("Schedule Salary", "Schedule Salary"),
      B("Select Schedule-এ 'Schedule Salary' টিক দিন", "Tick 'Schedule Salary' in Select Schedule"),
      [
        row("মোট বেতন/পেনশন", "Gross salary / pension", salary, B("AIS-এর সঙ্গে মেলান", "Match with AIS")),
        row("স্ট্যান্ডার্ড ডিডাকশন", "Standard deduction", res.chosen.steps.find((s) => s.key === "std")?.value ? -res.chosen.steps.find((s) => s.key === "std").value : 0, B("পোর্টাল নিজেই বসায়", "Applied automatically")),
      ],
      [
        B("তিনটে dropdown ফাঁকা রাখলে Validation-এ error আসে: Nature of employer, Nature of perquisites 17(2), Profit in lieu of salary 17(3)। অঙ্ক ০ হলেও প্রতিটাতে একটা বিকল্প বেছে নিন।", "Three dropdowns cause Validation errors if left empty: Nature of employer, Nature of perquisites 17(2), Profit in lieu 17(3). Pick an option for each even when the amount is 0."),
        B("Nature of employer-এ SBI-র মতো রাষ্ট্রায়ত্ত ব্যাংকের জন্য তালিকায় 'Pensioners' না থাকলে 'Public Sector Undertaking' বা 'Others' বেছে নিন।", "For a public-sector bank, if 'Pensioners' is not listed choose 'Public Sector Undertaking' or 'Others'."),
      ],
    );
  }

  S(
    B("Schedule House Property", "Schedule House Property"),
    B("নিজের থাকার বাড়ি হলে 'Self Occupied'", "'Self Occupied' for your own home"),
    [
      row("ধরন", "Type", inp.hp?.type === "letout" ? "Let Out" : "Self Occupied"),
      row("ঋণের সুদ", "Interest on borrowed capital", newReg ? 0 : Math.min(Number(inp.hp?.interest) || 0, 200000), B(newReg ? "নতুন regime-এ নিজের বাড়ির সুদ বাদ যায় না।" : "পুরোনো regime-এ ₹2 লাখ পর্যন্ত।", newReg ? "Not deductible for a self-occupied home in the new regime." : "Up to ₹2 lakh in the old regime.")),
    ],
  );

  const os = (Number(inp.interestSavings) || 0) + (Number(inp.interestDeposit) || 0) + (Number(inp.dividend) || 0) + (Number(inp.otherIncome) || 0);
  if (os > 0) {
    S(
      B("Schedule Other Sources", "Schedule Other Sources"),
      B("বেশিরভাগটাই AIS থেকে আগে ভরা থাকে", "Mostly pre-filled from AIS"),
      [
        row("ডিভিডেন্ড", "Dividend", Number(inp.dividend) || 0),
        row("সেভিংস ব্যাংকের সুদ", "Interest from savings bank", Number(inp.interestSavings) || 0),
        row("FD/ডিপোজিটের সুদ", "Interest from deposits", Number(inp.interestDeposit) || 0),
      ],
    );
  }

  const hasCG = res.cgNet.s1 + res.cgNet.l1 + res.cgNet.lo + res.cgNet.so > 0 || res.carry.ltcl > 0 || res.carry.stcl > 0 || (cg && cg.items && cg.items.length);
  if (hasCG && form !== "ITR-1") {
    const s1Items = (cg?.items || []).filter((i) => i.bucket === "s1");
    const cons = s1Items.reduce((a, i) => a + i.consideration, 0);
    const cost = s1Items.reduce((a, i) => a + i.cost, 0);
    if (s1Items.length) {
      S(
        B("Schedule Capital Gains: 111A (স্বল্পমেয়াদি)", "Schedule Capital Gains: 111A (short term)"),
        B("A(I) → 2: 'From sale of equity share or equity oriented MF (STT paid)'। Section: 111A", "A(I) → 2: 'From sale of equity share or equity oriented MF (STT paid)'. Section: 111A"),
        [
          row("Full value of consideration (2a)", "Full value of consideration (2a)", Math.round(cons), B("সব বিক্রি যোগ করে একটাই এন্ট্রি চলে", "One combined entry is accepted")),
          row("Cost of acquisition (bi)", "Cost of acquisition (bi)", Math.round(cost)),
          row("ফল: স্বল্পমেয়াদি লাভ (2e)", "Result: short-term gain (2e)", Math.round(cons - cost), B("পোর্টাল যা দেখায়, তার সঙ্গে ₹1 পার্থক্য হতে পারে", "May differ by ₹1 from the portal")),
        ],
        [B("'Add Another' চাপার পর Section ঘর 111A-তে ফিরে না গেলে আবার 111A বেছে নিন।", "If the Section box jumps back after 'Add Another', select 111A again.")],
      );
    }
    const l1Items = (cg?.items || []).filter((i) => i.bucket === "l1");
    if (l1Items.length) {
      S(
        B("Schedule 112A (দীর্ঘমেয়াদি, শেয়ার/ইকুইটি ফান্ড)", "Schedule 112A (long term, equity)"),
        B("Select Schedule পাতায় আলাদা করে 'Schedule 112A' টিক দিতে হয়, CG পাতায় হয় না", "Tick 'Schedule 112A' separately in Select Schedule; it is not on the CG page"),
        [row("মোট দীর্ঘমেয়াদি লাভ/(ক্ষতি)", "Net long-term gain / (loss)", Math.round(l1Items.reduce((a, i) => a + i.gain, 0)))],
        [
          B("৩১-জানু-২০১৮-র আগে কেনা প্রতিটা স্ক্রিপ আলাদা সারিতে 'BE' দিয়ে দিন, সঙ্গে ওই তারিখের FMV।", "Enter each scrip bought before 31-Jan-2018 as its own row with 'BE' and its 31-Jan-2018 FMV."),
          B("বাকি সব 'AE' সারিতে একসাথে: ISIN-এ INNOTREQUIRD, নামে CONSOLIDATED, সংখ্যা ও দাম ফাঁকা, কিন্তু Full Value of Consideration অবশ্যই ভরবেন।", "Put the rest in one 'AE' row: ISIN INNOTREQUIRD, name CONSOLIDATED, quantity and price blank, but Full Value of Consideration must be filled."),
          B("CSV-তে , / - _ ( ) & @ ' \" ; : চিহ্ন চলে না। CSV বারবার না নিলে পোর্টালের নিজের টেমপ্লেটে হাতে টাইপ করাই নিরাপদ।", "No special characters in the CSV. If upload keeps failing, typing into the portal's own template is safest."),
        ],
      );
    }
    // Quarter-wise table F
    const tableRows = [];
    const addTable = (bucket, bn, en) => {
      const items = (cg?.items || []).filter((i) => i.bucket === bucket);
      if (!items.length) return;
      const q = quarterly(items, bucket, fy);
      const labels = ["Up to 15/6", "16/6 – 15/9", "16/9 – 15/12", "16/12 – 15/3", "16/3 – 31/3"];
      labels.forEach((l, i) => tableRows.push(row(`${bn} ${l}`, `${en} ${l}`, q.periods[i])));
    };
    addTable("s1", "111A:", "111A:");
    addTable("l1", "112A:", "112A:");
    if (tableRows.length) {
      S(
        B("Schedule CG: নিচের Table F (কোয়ার্টার অনুযায়ী ভাগ)", "Schedule CG: Table F (quarter-wise split)"),
        B("Schedule CG-র একদম নিচে। 'Enter value from item 3iii of schedule BFLA'", "At the bottom of Schedule CG"),
        tableRows,
        [
          B("পাঁচটা ঘরের যোগফল BFLA-র সংখ্যার সঙ্গে হুবহু না মিললে Validation আটকায়।", "Validation fails unless the five boxes add up exactly to the BFLA figure."),
          B("পোর্টাল ঋণাত্মক সংখ্যা নেয় না, তাই ক্ষতির কোয়ার্টারটা পাশের লাভের কোয়ার্টারের সঙ্গে মিলিয়ে দেওয়া হয়েছে।", "The portal rejects negatives, so a loss quarter has been netted into the nearest gain quarter."),
        ],
      );
    }
  }

  S(
    B("CYLA, BFLA, CFL, SI: শুধু মিলিয়ে Confirm", "CYLA, BFLA, CFL, SI: verify and confirm"),
    B("এগুলো পোর্টাল নিজে হিসাব করে", "Calculated by the portal"),
    [
      row("বিশেষ হারে আয় (111A)", "Special-rate income (111A)", Math.round(res.cgNet.s1)),
      row("বিশেষ হারে কর", "Tax at special rates", Math.round(res.chosen.specialTax), B("111A-তে ২০% হার", "20% on 111A")),
      row("পরের বছরে জের টানা দীর্ঘমেয়াদি ক্ষতি (CFL)", "Long-term loss carried forward (CFL)", Math.round(res.carry.ltcl)),
      row("পরের বছরে জের টানা স্বল্পমেয়াদি ক্ষতি", "Short-term loss carried forward", Math.round(res.carry.stcl)),
    ],
    [B("Schedule SI-তে 111A-র হার ২০% দেখাচ্ছে কিনা দেখে নিন।", "Check Schedule SI shows 20% for 111A.")],
  );

  S(
    B("Schedule VI-A (ছাড়)", "Schedule VI-A (deductions)"),
    B("নতুন regime-এ প্রায় সব ঘর ০", "Almost all boxes are 0 in the new regime"),
    newReg
      ? [row("মোট ছাড়", "Total deductions", Math.round(res.chosen.deductions), B("শুধু 80CCD(2) থাকতে পারে", "Only 80CCD(2) can apply"))]
      : [row("মোট ছাড়", "Total deductions", Math.round(res.chosen.deductions), B("যে ছাড়ের কাগজ আছে শুধু সেগুলোই দিন", "Claim only what you can document"))],
  );

  S(
    B("Part B-TI: আয়ের হিসাব মেলান", "Part B-TI: check the computation"),
    B("Schedule-গুলো Confirm হলে", "After the schedules are confirmed"),
    [
      row("মোট আয় (Gross Total Income)", "Gross total income", Math.round(res.chosen.gti)),
      row("করযোগ্য আয় (Total Income)", "Total income", res.chosen.totalIncome),
    ],
    [B("এখানকার সংখ্যা এই টুলের সংখ্যার সঙ্গে ₹10-এর বেশি না মিললে আগে কোন ঘর আলাদা, সেটা খুঁজুন।", "If these differ from the tool by more than ₹10, find the differing box before going on.")],
  );

  const tds = Number(inp.tds) || 0;
  const payRows = payments.map((e) => row(`${e.date} · ${e.kind === "advance" ? "অগ্রিম কর" : "Self Assessment"}`, `${e.date} · ${e.kind === "advance" ? "Advance tax" : "Self-assessment"}`, e.amount, B(`BSR ${e.bsr || "—"} · Challan ${e.challan || "—"}`, `BSR ${e.bsr || "—"} · Challan ${e.challan || "—"}`)));
  S(
    B("Tax Paid: TDS, তারপর নিজে দেওয়া কর", "Tax Paid: TDS, then tax you paid"),
    B("TDS 1/2/3 আগে ভরা থাকে। 'Advance Tax and Self Assessment Tax'-এ 'Add Another'", "TDS 1/2/3 are pre-filled. 'Add Another' under Advance Tax and Self Assessment Tax"),
    [
      row("TDS (26AS/168 অনুযায়ী)", "TDS (per 26AS/168)", tds),
      ...payRows,
      row("এখন যে কর জমা দেবেন", "Tax you need to pay now", res.payable, B("ফেরত হলে ০", "0 if you get a refund")),
    ],
    [
      B("কর জমা দেওয়ার পর challan থেকে BSR কোড, তারিখ আর challan নম্বর টাইপ করতে হয়, আপনা-আপনি আসে না। সঙ্গে ঘরে টিক দিয়ে Confirm করুন।", "After paying, type the BSR code, date and challan number from the challan; it does not fill by itself. Tick the box and Confirm."),
    ],
  );

  if (res.payable > 0) {
    S(
      B("কর জমা: e-Pay Tax", "Pay tax: e-Pay Tax"),
      B("e-File → e-Pay Tax → New Payment", "e-File → e-Pay Tax → New Payment"),
      [
        row("Tax type", "Tax type", "Self Assessment Tax (300)"),
        row("Assessment year", "Assessment year", ay),
        row("পরিমাণ", "Amount", res.payable),
      ],
      [B("Challan ডাউনলোড করে রাখুন। তারপর ফিরে এসে 'Tax Paid' ভরুন।", "Download the challan, then go back and fill 'Tax Paid'.")],
    );
  }

  S(
    B("Preview, Validation, Submit", "Preview, validation, submit"),
    B("সব schedule সবুজ হলে 'Proceed To Verification'", "When all schedules are green, 'Proceed To Verification'"),
    [row("Place", "Place", inp.place || "আপনার শহর", B("পিতার নাম আগে থেকে ভরা থাকে", "Father's name is pre-filled"))],
    [
      B("'Tax Return Preparer' অংশ ফাঁকা রাখুন।", "Leave the Tax Return Preparer section empty."),
      B("Validation-এ error এলে পাতায় যে ঘরের নাম আছে সেখানে ফিরে ঠিক করে আবার চালান।", "If Validation shows errors, go back to the named box, fix it and run again."),
    ],
  );

  S(
    B("e-Verify: শেষ ধাপ", "e-Verify: the last step"),
    B("Submit করার পর অবিলম্বে", "Right after submitting"),
    [row("সময়সীমা", "Time limit", `${rules.common.eVerifyDays} দিন`, B("এর মধ্যে না করলে রিটার্ন দেরিতে ফাইল ধরা হতে পারে।", "After that the return can be treated as filed late."))],
    [B("Aadhaar OTP সবচেয়ে সহজ। শেষে Acknowledgement ডাউনলোড করে রাখুন, ব্যাংকের কাজে লাগবে।", "Aadhaar OTP is easiest. Download the acknowledgement; banks ask for it.")],
  );

  if (form === "ITR-3" || form === "ITR-4") {
    sec.unshift({
      title: B("ব্যবসা/পেশার ফর্ম", "Business / profession form"),
      where: B("সাবধান", "Be careful"),
      rows: [],
      tips: [B(`${form}-এ ব্যবসার schedule (BP, বা 44AD/44ADA অংশ, ব্যালান্স শিট) আলাদা। এই গাইড শুধু সাধারণ ধাপগুলো দেখায়। একজন CA-র সঙ্গে মিলিয়ে নিন।`, `${form} has extra business schedules (BP or the 44AD/44ADA part, balance sheet). This guide covers the common steps only. Check with a CA.`)],
    });
  }
  return sec;
}
