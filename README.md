# আয়কর খাতা (Aykor Khata)

Income-tax helper for India: reads your papers on the phone, works out gross and taxable income and tax under both regimes, picks the ITR form (1/2/3/4), and walks you through the portal with your own numbers filled in. Everything runs in the browser. No server, no login.

## Run
    npm install
    npm test          # 68 tests, including a real filed return
    npm run dev
    npm run build     # output in dist/

## Put it online (free)
Upload the contents of `dist/` to Netlify (drag and drop) or GitHub Pages. Open the link in Chrome on Android, then "Install app".

## Updating tax rules after a Budget
Only `src/rules/rules.json` changes (slabs, limits, dates). Edit it, raise `version` and `updated`, run `npm run build`, upload again. Open apps show "rules updated" on their next visit. A person must verify the new rules first; the app never rewrites its own rules.

## Layout
- `src/engine/tax.js` tax engine (pure functions)
- `src/engine/forms.js` which ITR form
- `src/engine/cg.js` capital gains sorting and the quarter-wise table
- `src/engine/parse.js`, `pdf.js` reading TIS/AIS, statements, acknowledgements, locked PDFs
- `src/engine/guide.js` portal steps
- `tests/engine.test.mjs`

## Known gaps (also shown in the app)
Section 50AA funds, foreign assets, ESOP, F&O, surcharge-on-dividend cap, and the exact 234B/C figures are not fully modelled. FY 2026-27 rules follow the Income-tax Act 2025 and are marked "to verify". PDF row reading is heuristic and is checked against the statement's own totals when the statement prints them. The AIS JSON from the portal is encrypted and is not read; use the TIS/AIS PDF. Not yet reviewed by a CA.
