---
title: "Aykor Khata: rules and formulas for CA review"
---

**Purpose.** This sheet lists every tax rule, limit and formula the app uses, where it lives in the code, how it is tested, and what is approximated. Please mark each row *correct*, *wrong (with the right rule)* or *needs a note*. The app's status line says the rules are cross-checked against published summaries and one real filed return, and **not yet reviewed by a CA**. Your review changes that.

**Scope.** Resident individuals, FY 2025-26 (AY 2026-27, Income-tax Act 1961) and FY 2026-27 (Tax Year 2026-27, Income-tax Act 2025). Rules file: `src/rules/rules.json`. Engine: `src/engine/tax.js`.

## 1. Rates and limits (both years unless marked)

| # | Item | Value used | Your verdict |
|---|------|-----------|--------------|
| 1 | New regime slabs | 0 to 4L nil; 4-8L 5%; 8-12L 10%; 12-16L 15%; 16-20L 20%; 20-24L 25%; above 24L 30% | |
| 2 | New regime standard deduction | ₹75,000 (salary and pension) | |
| 3 | New regime rebate (87A; s.156 in the 2025 Act) | Total income up to ₹12,00,000: rebate up to ₹60,000, limited to tax on normal income | |
| 4 | Marginal relief above ₹12L | Tax on normal income capped at total income minus ₹12L | |
| 5 | Old regime slabs, below 60 | 0 to 2.5L nil; 5% to 5L; 20% to 10L; 30% above | |
| 6 | Old regime, 60 to 80 / 80+ | Exemption 3L / 5L; same bands above | |
| 7 | Old regime standard deduction and rebate | ₹50,000; rebate ₹12,500 if total income up to ₹5L | |
| 8 | Surcharge, new regime | 10% above 50L, 15% above 1Cr, 25% above 2Cr (cap 25%) | |
| 9 | Surcharge, old regime | 10% / 15% / 25% / 37% above 50L / 1Cr / 2Cr / 5Cr | |
| 10 | Surcharge cap on special-rate and dividend income | 15% (cap applied to special-rate tax; dividend is **not** separately capped) | |
| 11 | Surcharge marginal relief | Tax plus surcharge capped at tax at threshold plus income above it | |
| 12 | Cess | 4% on tax plus surcharge | |
| 13 | STCG 111A | 20% | |
| 14 | LTCG 112A | First ₹1,25,000 not taxed; balance 12.5% | |
| 15 | Other LTCG | 12.5%, no indexation (assumes transfers after 23 July 2024) | |
| 16 | Holding period | Equity (STT paid) over 12 months; other assets over 24 months | |
| 17 | 80C / 80CCD(1B) / 80D caps | ₹1.5L / ₹50,000 / ₹1,00,000 (self plus parents, as an overall cap) | |
| 18 | 80TTA / 80TTB | ₹10,000 on savings interest (below 60) / ₹50,000 on savings and deposit interest (60+), old regime only | |
| 19 | Self-occupied home interest | Old regime ₹2L; new regime nil | |
| 20 | House property loss | Old regime set-off capped at ₹2L, excess carried forward; new regime not set off against other heads | |
| 21 | Let-out house | Net annual value after municipal tax, 30% standard deduction, full interest | |
| 22 | Presumptive | 44AD 6% digital / 8% other; 44ADA 50% | |
| 23 | Capital loss set-off | Short-term loss against any gain; long-term loss only against long-term gain; brought-forward losses applied the same way | |
| 24 | Unused basic exemption | Adjusted against 111A first, then 112A, then other LTCG | |
| 25 | Rounding | Total income to nearest ₹10 (288A); net payable to nearest ₹10 (288B), applied on the net amount as the portal does | |

## 2. Interest and fees

| # | Item | Rule used | Your verdict |
|---|------|-----------|--------------|
| 26 | Advance tax exemption | Resident aged 60+ with no business income: none; also none if tax after TDS under ₹10,000 | |
| 27 | 234A | 1% a month or part, on tax after TDS, from the due date | |
| 28 | 234B | 1% a month or part from 1 April when advance tax paid is under 90% | |
| 29 | 234C | By instalment 15/45/75/100%; no interest if 12% and 36% met for the first two; 3 months on the first three, 1 month on the last | |
| 30 | 234F | ₹5,000; ₹1,000 if total income up to ₹5L | |
| 31 | e-verify window | 30 days | |
| 32 | Due dates | 31 July (ITR-1/2); 31 August for non-audit business (ITR-3 to 7) from AY 2026-27; belated by 31 December | |

## 3. Choosing the form

ITR-1: resident, total income up to ₹50L, salary or pension, one house, other sources, 112A gain up to ₹1.25L without loss, agricultural income up to ₹5,000, no foreign assets, directorship, unlisted shares, ESOP deferral or brought-forward loss. ITR-2: any of those exceeded but no business income. ITR-4: presumptive business within limits and the same ITR-1 conditions. ITR-3: all other business or professional income, and F&O/intraday. When in doubt the app picks the form that is always valid (ITR-2 or ITR-3). **Please confirm the house-property count for ITR-1 (the app uses one).**

## 4. Known approximations and gaps (please advise)

1. Marginal relief at ₹12L is computed on normal income only; unclear treatment when special-rate income is also present.
2. 112A gain is included in total income in full, with the ₹1.25L not taxed rather than excluded. Does this affect the ₹12L rebate test?
3. Gold, silver and debt funds (section 50AA), foreign assets, ESOP and F&O are not computed; the app asks for a CA.
4. Surcharge on dividend income above the 15% cap is not separated.
5. HRA, LTA and other exempt allowances are a single manual "exempt allowances" figure, old regime only.
6. 80CCD(2) is accepted as entered, without the 10% / 14% of salary cap.
7. 2026-27: section numbers and the interest sections (reported as 424 and 425) are marked "to verify" in the app.
8. Bonus shares: holding period depends on allotment date; the app warns when cost is zero but cannot know the date.

## 5. Test evidence

68 automated tests (`npm test`). One is a real filed return (FY 2025-26, ITR-2, new regime, senior citizen): gross total income ₹16,03,429, total income ₹16,03,430, tax with cess ₹1,28,272, payable ₹1,25,180, long-term loss carried forward ₹4,279, all equal to what the portal accepted. Others are hand-worked cases for each rule above, a check that tax never falls when income rises (₹0 to ₹80 lakh, both regimes), and 1,000 random cases that must all pass the app's own sanity check.
