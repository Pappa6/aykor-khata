// Chooses the return form. When in doubt it picks the form that is always valid for the case.
// a: { resident, totalIncome, business: 'none'|'presumptive'|'regular', turnover, hpCount,
//      stcg, ltcgOther, ltcg112A (net, may be negative), foreignAsset, director, unlisted,
//      esop, agriOver5000, bfLoss, speculative, partner, section194N }

export function selectForm(a) {
  const reasons = [];
  const ca = [];
  const say = (bn, en) => reasons.push({ bn, en });
  const needCA = (bn, en) => ca.push({ bn, en });

  if (a.resident === false) {
    needCA("অনিবাসী বা RNOR হলে নিয়ম আলাদা। এই টুল শুধু ভারতের বাসিন্দাদের জন্য।", "Non-resident / RNOR rules differ. This tool is for residents only.");
  }
  if (a.foreignAsset) needCA("বিদেশি সম্পদ বা বিদেশি আয় (Schedule FA/FSI) আছে।", "Foreign assets or income (Schedule FA/FSI).");
  if (a.esop) needCA("স্টার্টআপ ESOP-এর কর স্থগিত আছে।", "Deferred ESOP tax from a start-up.");
  if (a.unlisted) needCA("আনলিস্টেড কোম্পানির শেয়ার আছে।", "Holds unlisted equity shares.");
  if (a.director) needCA("কোনো কোম্পানির ডিরেক্টর।", "Director in a company.");
  if (a.speculative) needCA("F&O বা intraday ট্রেডিং আছে (speculative আয়/ক্ষতি)।", "Futures & options or intraday trading (speculative income/loss).");
  if (a.partner) needCA("ফার্মের অংশীদার।", "Partner in a firm.");

  const l112 = a.ltcg112A || 0;
  const onlySmall112A =
    !a.stcg && !a.ltcgOther && l112 >= 0 && l112 <= 125000;
  const hasCapitalGains = !!(a.stcg || a.ltcgOther || l112 !== 0);

  // Schedule AL (assets and liabilities) is required above Rs 1 crore of total income.
  const needsAL = (a.totalIncome || 0) > 10000000;
  if (needsAL) say("মোট আয় ₹1 কোটির বেশি, তাই Schedule AL (সম্পদ ও দায়ের তালিকা) ভরতে হবে।", "Total income is above ₹1 crore, so Schedule AL (assets and liabilities) must be filled.");
  // Tax audit warning for books-based turnover
  if (a.booksTurnover && a.booksTurnover > 10000000) {
    needCA("খাতা-রাখা ব্যবসার টার্নওভার ₹1 কোটির বেশি। ক্যাশ লেনদেন ৫%-এর মধ্যে থাকলে সীমা ₹10 কোটি, নইলে হিসাব অডিট (ধারা 44AB) লাগবে।", "Books-based turnover is above ₹1 crore. The audit limit is ₹10 crore only if cash stays within 5%; otherwise a tax audit (section 44AB) is needed.");
  }
  if (a.proReceipts && a.proReceipts > 5000000 && a.business === "regular") {
    needCA("পেশার প্রাপ্তি ₹50 লাখের বেশি, খাতা রাখলে হিসাব অডিট (ধারা 44AB) লাগে।", "Professional receipts above ₹50 lakh with books need a tax audit (section 44AB).");
  }

  // Business income
  if (a.business && a.business !== "none") {
    const lim44AD = a.digital95 ? 30000000 : 20000000;
    const lim44ADA = a.digital95 ? 7500000 : 5000000;
    const tOk = a.business === "presumptive" && (a.turnover || 0) <= lim44AD && (a.proReceipts || 0) <= lim44ADA;
    const easy =
      tOk && !a.foreignAsset && !a.director && !a.unlisted && !a.bfLoss && !a.esop &&
      (a.totalIncome || 0) <= 5000000 && (!hasCapitalGains || onlySmall112A) && (a.hpCount || 0) <= 1;
    if (easy) {
      say("ছোট ব্যবসা/পেশায় অনুমিত (presumptive) আয় ধরলে সহজ ফর্ম ITR-4 চলে।", "Presumptive income from a small business or profession can use the simpler ITR-4.");
      return { form: "ITR-4", reasons, ca, alt: "ITR-3" };
    }
    if (a.business === "regular" && a.alsoPresumptive) say("খাতা-রাখা আর অনুমিত, দুই ধরনের ব্যবসা/পেশাই আছে, তাই ITR-3 (একটা ফর্মেই দুটো ধরা যায়)।", "You have both books-based and presumptive income; ITR-3 covers both.");
    else say("ব্যবসা বা পেশার আয় আছে, এবং ITR-4-এর শর্ত মেলে না।", "Business or professional income that does not qualify for ITR-4.");
    return { form: "ITR-3", reasons, ca, alt: null };
  }
  if (a.speculative) {
    say("F&O বা intraday-র আয়/ক্ষতি ব্যবসার আয় হিসেবে ধরা হয়, তাই ITR-3।", "F&O / intraday results are business income, so ITR-3.");
    return { form: "ITR-3", reasons, ca, alt: null };
  }

  // No business: ITR-1 only if everything fits, otherwise ITR-2
  const blockers = [];
  if ((a.totalIncome || 0) > 5000000) blockers.push(["মোট আয় ₹50 লাখের বেশি", "Total income above ₹50 lakh"]);
  if ((a.hpCount || 0) > 1) blockers.push(["একাধিক বাড়ি", "More than one house property"]);
  if (hasCapitalGains && !onlySmall112A) blockers.push(["শেয়ার/ফান্ড বা অন্য সম্পদ বিক্রির লাভ-ক্ষতি আছে", "Capital gains or losses beyond a small 112A gain"]);
  if (a.foreignAsset) blockers.push(["বিদেশি সম্পদ", "Foreign assets"]);
  if (a.director) blockers.push(["কোম্পানির ডিরেক্টর", "Company director"]);
  if (a.unlisted) blockers.push(["আনলিস্টেড শেয়ার", "Unlisted shares"]);
  if (a.esop) blockers.push(["ESOP-এর কর স্থগিত", "Deferred ESOP tax"]);
  if (a.agriOver5000) blockers.push(["কৃষি আয় ₹5,000-এর বেশি", "Agricultural income above ₹5,000"]);
  if (a.bfLoss) blockers.push(["আগের বছরের লোকসান জের টানা আছে", "Brought-forward losses"]);
  if (a.section194N) blockers.push(["ধারা 194N-এ TDS কাটা হয়েছে", "TDS under section 194N"]);

  if (blockers.length === 0) {
    say("বেতন/পেনশন, সুদ, ডিভিডেন্ড ও একটি বাড়ির মধ্যেই আয় সীমাবদ্ধ, তাই সহজ ফর্ম ITR-1।", "Income is limited to salary or pension, interest, dividend and one house, so the simple ITR-1 works.");
    return { form: "ITR-1", reasons, ca, alt: "ITR-2" };
  }
  blockers.forEach(([bn, en]) => say(bn, en));
  return { form: "ITR-2", reasons, ca, alt: null };
}
