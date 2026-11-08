// Pure tax engine. No DOM, no network. All rates and limits come from the rules object.

const BN = "০১২৩৪৫৬৭৮৯";
export const normNum = (v) => String(v ?? "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).replace(/[₹\s]/g, "");
export const n = (v) => {
  const x = typeof v === "string" ? parseFloat(normNum(v).replace(/,/g, "")) : v;
  return Number.isFinite(x) ? x : 0;
};
export const round10 = (x) => Math.round(x / 10) * 10;

export function ageBandOf(dobISO, fy) {
  // Age is tested on the last day of the financial year (31 March).
  if (!dobISO) return "below60";
  const [y, m, d] = dobISO.split("-").map(Number);
  const endYear = parseInt(fy.slice(0, 4), 10) + 1;
  let age = endYear - y;
  if (m > 3 || (m === 3 && d > 31)) age -= 1;
  if (age >= 80) return "80+";
  if (age >= 60) return "60-80";
  return "below60";
}

function slabTax(income, bands) {
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of bands) {
    const top = limit === null ? Infinity : limit;
    if (income > prev) tax += (Math.min(income, top) - prev) * rate;
    prev = top;
  }
  return tax;
}

// ---------- Capital gains: set-off between buckets ----------
// Short-term losses may be set off against any gain. Long-term losses only against long-term gains.
export function capitalGainsNet(inp, common) {
  const b = { s1: n(inp.stcg111A), so: n(inp.stcgOther), l1: n(inp.ltcg112A), lo: n(inp.ltcgOther) };
  const order = {
    short: ["so", "s1", "lo", "l1"],
    long: ["lo", "l1"],
  };
  const applyLoss = (key, kind) => {
    if (b[key] >= 0) return;
    for (const t of order[kind]) {
      if (t === key || b[t] <= 0) continue;
      const use = Math.min(-b[key], b[t]);
      b[t] -= use;
      b[key] += use;
      if (b[key] >= 0) break;
    }
  };
  applyLoss("so", "short");
  applyLoss("s1", "short");
  applyLoss("lo", "long");
  applyLoss("l1", "long");

  // Brought-forward losses
  const bfShort = n(inp.bfStcl);
  const bfLong = n(inp.bfLtcl);
  let bfShortLeft = bfShort;
  for (const t of order.short) {
    if (bfShortLeft <= 0) break;
    if (b[t] > 0) {
      const use = Math.min(bfShortLeft, b[t]);
      b[t] -= use;
      bfShortLeft -= use;
    }
  }
  let bfLongLeft = bfLong;
  for (const t of order.long) {
    if (bfLongLeft <= 0) break;
    if (b[t] > 0) {
      const use = Math.min(bfLongLeft, b[t]);
      b[t] -= use;
      bfLongLeft -= use;
    }
  }

  const carryStcl = Math.max(0, -b.s1) + Math.max(0, -b.so) + bfShortLeft;
  const carryLtcl = Math.max(0, -b.l1) + Math.max(0, -b.lo) + bfLongLeft;
  const pos = (x) => Math.max(0, x);
  return {
    s1: pos(b.s1), so: pos(b.so), l1: pos(b.l1), lo: pos(b.lo),
    carryStcl, carryLtcl,
    exempt112A: Math.min(pos(b.l1), common.capitalGains.exempt112A),
  };
}

// ---------- core tax on a given composition (before surcharge/cess) ----------
function coreTax(R, bands, normal, sp, cg) {
  const normalTax = slabTax(normal, bands);
  const specialTax = sp.s1 * cg.rate111A + sp.l1 * cg.rate112A + sp.lo * cg.rateLtcgOther;
  return { normalTax, specialTax };
}

function applyBasicExemptionShortfall(bands, normalTaxable, s1, l1Taxable, lo) {
  // A resident individual's unused basic exemption can absorb special-rate income.
  const basic = bands.find(([, r]) => r > 0);
  const basicLimit = basic ? bands[bands.indexOf(basic) - 1]?.[0] ?? 0 : 0;
  let shortfall = Math.max(0, basicLimit - normalTaxable);
  const take = (v) => {
    const u = Math.min(v, shortfall);
    shortfall -= u;
    return v - u;
  };
  const s1n = take(s1);
  const l1n = take(l1Taxable);
  const lon = take(lo);
  return { s1: s1n, l1: l1n, lo: lon };
}

export function computeRegime(rules, fy, inp, regime, cgNet) {
  const common = rules.common;
  const Y = rules.years[fy];
  const R = regime === "new" ? Y.newRegime : Y.oldRegime;
  const ageBand = inp.ageBand || "below60";
  const bands = regime === "new" ? R.slabs : R.slabsByAge[ageBand];
  const lim = common.deductionLimits;
  const steps = [];
  const add = (key, bn, en, value) => steps.push({ key, bn, en, value });

  // Salary / pension
  const salary = n(inp.salary);
  const exemptSalary = regime === "old" ? n(inp.exemptSalary) : 0;
  const std = salary > 0 ? Math.min(R.stdDeduction, Math.max(0, salary - exemptSalary)) : 0;
  const salaryIncome = Math.max(0, salary - exemptSalary - std);
  add("salary", "বেতন/পেনশন (মোট)", "Salary / pension (gross)", salary);
  if (std) add("std", "(−) স্ট্যান্ডার্ড ডিডাকশন", "(−) Standard deduction", -std);

  // House property
  const hp = inp.hp || { type: "none" };
  let hpIncome = 0;
  let hpCarry = 0;
  if (hp.type === "self") {
    hpIncome = regime === "old" ? -Math.min(n(hp.interest), lim.hpSelfInterestOld) : 0;
  } else if (hp.type === "letout") {
    const nav = Math.max(0, n(hp.rent) - n(hp.municipalTax));
    hpIncome = nav - nav * 0.3 - n(hp.interest);
  }
  let hpUsable = hpIncome;
  if (hpIncome < 0) {
    hpUsable = regime === "old" ? Math.max(hpIncome, -lim.hpLossSetoffOld) : 0;
    hpCarry = -(hpIncome - hpUsable);
  }
  if (hpUsable !== 0) add("hp", "বাড়ি থেকে আয়/(ক্ষতি)", "House property income / (loss)", hpUsable);

  // Business or profession
  // One or more business/profession parts: books-based profit, 44AD (business), 44ADA (profession).
  const parts = Array.isArray(inp.businesses) ? inp.businesses : inp.business ? [inp.business] : [];
  let bizIncome = 0;
  const pr = common.presumptive;
  for (const biz of parts) {
    if (biz.type === "44AD") {
      const d = Math.min(100, Math.max(0, n(biz.digitalPct))) / 100;
      bizIncome += Math.round(n(biz.turnover) * (d * pr.rate44ADDigital + (1 - d) * pr.rate44ADOther));
    } else if (biz.type === "44ADA") bizIncome += Math.round(n(biz.turnover) * pr.rate44ADA);
    else if (biz.type === "regular") bizIncome += n(biz.profit);
  }
  if (bizIncome) add("biz", "ব্যবসা/পেশার আয়", "Business / profession income", bizIncome);

  // Other sources
  const interestSavings = n(inp.interestSavings);
  const interestDeposit = n(inp.interestDeposit);
  const otherSources = interestSavings + interestDeposit + n(inp.dividend) + n(inp.otherIncome);
  if (otherSources) add("os", "অন্যান্য উৎস (সুদ, ডিভিডেন্ড)", "Other sources (interest, dividend)", otherSources);
  if (cgNet.so) add("so", "স্বল্পমেয়াদি লাভ (স্ল্যাব হারে)", "Short-term gains (slab rate)", cgNet.so);

  const normalGross = salaryIncome + hpUsable + bizIncome + otherSources + cgNet.so;

  // Chapter VI-A deductions
  const ded = {};
  ded.ccd2 = n(inp.d80CCD2);
  if (regime === "old") {
    ded.c80C = Math.min(n(inp.d80C), lim.d80C);
    ded.ccd1b = Math.min(n(inp.d80CCD1B), lim.d80CCD1B);
    ded.d80D = Math.min(n(inp.d80D), lim.d80D);
    const senior = ageBand !== "below60";
    ded.interest = senior
      ? Math.min(interestSavings + interestDeposit, lim.d80TTB)
      : Math.min(interestSavings, lim.d80TTA);
    ded.d80G = n(inp.d80G);
    ded.d80E = n(inp.d80E);
    ded.other = n(inp.dOther);
  }
  const dedSum = Object.values(ded).reduce((a, b) => a + b, 0);
  const dedTotal = Math.min(dedSum, Math.max(0, normalGross));
  if (dedTotal) add("ded", "(−) অধ্যায় VI-A ছাড়", "(−) Chapter VI-A deductions", -dedTotal);

  const specialGross = cgNet.s1 + cgNet.l1 + cgNet.lo;
  const gti = normalGross + specialGross;
  const normalTaxableRaw = Math.max(0, normalGross - dedTotal);
  const totalIncome = round10(normalTaxableRaw + specialGross); // section 288A
  const normalTaxable = Math.max(0, totalIncome - specialGross);

  // Special-rate taxable amounts
  const l1Taxable0 = Math.max(0, cgNet.l1 - common.capitalGains.exempt112A);
  const adj = applyBasicExemptionShortfall(bands, normalTaxable, cgNet.s1, l1Taxable0, cgNet.lo);
  const cgr = common.capitalGains;

  let { normalTax, specialTax } = coreTax(R, bands, normalTaxable, adj, cgr);

  // Rebate under 87A (not against special-rate tax)
  let rebate = 0;
  if (totalIncome <= R.rebate.limit) {
    rebate = Math.min(R.rebate.max, normalTax);
  } else if (R.rebate.marginalRelief) {
    const excess = totalIncome - R.rebate.limit;
    if (normalTax > excess) rebate = normalTax - excess; // marginal relief
  }
  const taxAfterRebate = normalTax + specialTax - rebate;

  // Surcharge with marginal relief at the threshold just crossed
  const sBands = R.surcharge;
  const k = sBands.findIndex(([limit]) => limit === null || totalIncome <= limit);
  const rate = k >= 0 ? sBands[k][1] : 0;
  let surcharge = 0;
  if (rate > 0) {
    const normalPart = Math.max(0, normalTax - rebate);
    surcharge = rate * normalPart + Math.min(rate, common.surchargeCapSpecial) * specialTax;
    if (k > 0) {
      const threshold = sBands[k - 1][0];
      const belowRate = sBands[k - 1][1];
      const d = totalIncome - threshold;
      const nT = Math.max(0, normalTaxable - d);
      let remaining = Math.max(0, d - (normalTaxable - nT));
      const spT = { s1: adj.s1, l1: adj.l1, lo: adj.lo };
      for (const key of ["lo", "l1", "s1"]) {
        const u = Math.min(spT[key], remaining);
        spT[key] -= u;
        remaining -= u;
      }
      const at = coreTax(R, bands, nT, spT, cgr);
      const taxAtThreshold = at.normalTax + at.specialTax;
      const maxTotal = taxAtThreshold * (1 + belowRate) + d;
      surcharge = Math.min(surcharge, Math.max(0, maxTotal - taxAfterRebate));
    }
  }
  const cess = (taxAfterRebate + surcharge) * common.cess;
  const totalTax = taxAfterRebate + surcharge + cess;

  add("gti", "মোট আয় (Gross Total Income)", "Gross total income", gti);
  add("ti", "করযোগ্য আয় (Total Income)", "Taxable income (total income)", totalIncome);
  add("normalTax", "স্ল্যাব হারে কর", "Tax on slab income", normalTax);
  if (specialTax) add("specialTax", "বিশেষ হারে কর (শেয়ার/ফান্ডের লাভ)", "Tax at special rates", specialTax);
  if (rebate) add("rebate", "(−) ধারা 87A রিবেট / মার্জিনাল রিলিফ", "(−) Rebate 87A / marginal relief", -rebate);
  if (surcharge) add("surcharge", "সারচার্জ", "Surcharge", surcharge);
  add("cess", "স্বাস্থ্য ও শিক্ষা সেস (৪%)", "Health & education cess (4%)", cess);

  return {
    regime, gti, totalIncome, normalTaxable, specialGross,
    normalTax, specialTax, rebate, surcharge, cess, totalTax,
    deductions: dedTotal, hpCarry, steps,
  };
}

// ---------- interest and fees ----------
function monthsBetween(from, to) {
  // UTC getters so the result does not depend on the device's time zone.
  if (to <= from) return 0;
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() > from.getUTCDate()) m += 1; // part of a month counts as a month
  return Math.max(0, m);
}

export function advanceTaxExempt(ageBand, inp) {
  const bparts = Array.isArray(inp.businesses) ? inp.businesses : inp.business ? [inp.business] : [];
  const noBusiness = bparts.every((b) => !b || b.type === "none");
  return ageBand !== "below60" && noBusiness;
}

export function computeInterest(rules, fy, inp, totalTaxRounded, tds, advancePaidByDue, today) {
  const Y = rules.years[fy];
  const out = { i234A: 0, i234B: 0, i234C: 0, fee234F: 0, notes: [] };
  const taxAfterTds = Math.max(0, totalTaxRounded - tds);
  const exempt = advanceTaxExempt(inp.ageBand, inp);
  const dueDate = new Date(Y.dueDate);
  const filing = inp.filingDate ? new Date(inp.filingDate) : null;

  if (exempt) {
    out.notes.push({ bn: "আপনি ৬০ বছরের বেশি বয়সী বাসিন্দা এবং ব্যবসা/পেশার আয় নেই, তাই অগ্রিম কর ও তার সুদ (234B/234C) প্রযোজ্য নয়।", en: "As a resident aged 60+ with no business income, advance tax and its interest (234B/234C) do not apply." });
  } else if (taxAfterTds < 10000) {
    out.notes.push({ bn: "TDS বাদ দিয়ে কর ₹10,000-এর কম, তাই অগ্রিম কর লাগে না।", en: "Tax after TDS is under ₹10,000, so advance tax is not required." });
  } else {
    const paid = advancePaidByDue || [0, 0, 0, 0];
    const cum = [0.15, 0.45, 0.75, 1];
    const asOf = today || new Date();
    // 234B: shortfall below 90% of tax, 1% a month from 1 April to the date of payment / filing
    const totalPaid = paid.reduce((a, b) => a + b, 0);
    if (totalPaid < 0.9 * taxAfterTds && filing) {
      const start = new Date(Date.UTC(parseInt(fy.slice(0, 4), 10) + 1, 3, 1));
      out.i234B = Math.max(0, taxAfterTds - totalPaid) * 0.01 * monthsBetween(start, filing);
    }
    // 234C: per instalment
    let run = 0;
    cum.forEach((c, i) => {
      run += paid[i] || 0;
      const due = new Date(Y.advanceDates[i]);
      if (asOf > due || filing) {
        const need = taxAfterTds * c;
        const tolerance = i === 0 ? taxAfterTds * 0.12 : i === 1 ? taxAfterTds * 0.36 : need;
        if (run < tolerance) {
          const months = i === 3 ? 1 : 3;
          out.i234C += Math.max(0, need - run) * 0.01 * months;
        }
      }
    });
    out.notes.push({ bn: "234B/234C-এর হিসাব আনুমানিক। চূড়ান্ত অঙ্ক পোর্টাল দেখাবে।", en: "234B/234C figures are estimates. The portal shows the final amount." });
  }
  // 234A and 234F only when filing after the due date
  if (filing && filing > dueDate) {
    const m = monthsBetween(dueDate, filing);
    out.i234A = taxAfterTds * 0.01 * m;
    const reduced = (inp._totalIncome ?? 0) <= rules.common.fee234F.reducedIfIncomeUpTo;
    out.fee234F = reduced ? rules.common.fee234F.reducedAmount : rules.common.fee234F.amount;
  }
  return out;
}

// ---------- top level ----------
export function computeAll(rules, fy, inp) {
  const common = rules.common;
  const ageBand = inp.ageBand || ageBandOf(inp.dob, fy);
  const withAge = { ...inp, ageBand };
  const cgNet = capitalGainsNet(withAge, common);
  const newR = computeRegime(rules, fy, withAge, "new", cgNet);
  const oldR = computeRegime(rules, fy, withAge, "old", cgNet);
  const best = newR.totalTax <= oldR.totalTax ? newR : oldR;
  const chosenKey = withAge.regimeChoice === "old" || withAge.regimeChoice === "new" ? withAge.regimeChoice : best.regime;
  const chosen = chosenKey === "old" ? oldR : newR;

  const tds = n(inp.tds);
  const advance = n(inp.advanceTaxPaid);
  const selfAssess = n(inp.selfAssessmentPaid);
  const tcs = n(inp.tcs);
  const totalPaid = tds + advance + selfAssess + tcs;

  const interest = computeInterest(
    rules, fy, { ...withAge, _totalIncome: chosen.totalIncome },
    round10(chosen.totalTax), tds + tcs, inp.advanceByDue, inp.today ? new Date(inp.today) : undefined,
  );
  const interestTotal = interest.i234A + interest.i234B + interest.i234C + interest.fee234F;
  const net = round10(chosen.totalTax + interestTotal - totalPaid); // section 288B: rounded on the net amount, as the portal does
  return {
    fy, ageBand, cgNet,
    new: newR, old: oldR,
    best: best.regime,
    chosen,
    saving: Math.abs(newR.totalTax - oldR.totalTax),
    taxes: { tds, advance, selfAssess, tcs, totalPaid },
    interest,
    payable: net > 0 ? net : 0,
    refund: net < 0 ? -net : 0,
    carry: { stcl: cgNet.carryStcl, ltcl: cgNet.carryLtcl, hp: chosen.hpCarry },
  };
}
