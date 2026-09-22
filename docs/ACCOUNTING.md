# Accounting Worksheet — journal in, financial statements out

Paste (or drop) a **journal table** and StudyMate builds every other record from it:

| Output | Notes |
| --- | --- |
| General journal | Re-grouped into entries, each checked for debits = credits |
| General ledger | One T-account per account with a running balance; adjustments shown in amber |
| Unadjusted + adjusted trial balance | Both totals must agree |
| 10-column worksheet | Unadjusted → Adjustments → Adjusted TB → Income Statement → Balance Sheet, with net income carried across |
| Income statement | Adds a gross profit section automatically when cost-of-sales accounts exist |
| Statement of changes in owner's equity / retained earnings | Sole proprietorship or corporation format, auto-detected |
| Classified balance sheet | Current vs non-current assets and liabilities, PPE shown net of accumulated depreciation |
| Statement of cash flows | **Both** the indirect and the direct method, switchable (or side by side) |
| Checks | Every cross-check the tool can run, with the reason when something does not tie |

## Two ways to run it

1. **Inside StudyMate** — the *Accounting Worksheet* tool in the sidebar (Docs & Data section).
2. **Standalone single file** — `standalone/index.html`. One ~115 KB HTML file with the engine and UI
   inlined: no build step, no server, no CDN. Copy it to a USB stick or your desktop and open it.
   It is generated from `accounting.js` + `standalone/src/{style.css,app.js}`:

   ```
   npm run build     # regenerate standalone/index.html
   npm test          # fails if standalone/index.html is stale
   ```

## Accepted input formats

1. **Copy straight out of Excel or Google Sheets** — tab separated, header row optional:

   ```
   Date	Account Titles and Explanation	Debit	Credit	Memo
   2025-01-02	Cash	150000		Owner invested cash
   2025-01-02	Owner's Capital		150000	Owner invested cash
   ```

2. **CSV / TXT file** — same columns, comma separated.

3. **.xlsx workbook** — the first worksheet is read, shared strings and inline strings both work,
   Excel serial dates are converted for you.

4. **Classic indented journal** — credits indented, leader dots allowed:

   ```
   Jan 2    Cash ................................. 150,000
                Owner's Capital .............................. 150,000
   ```

Column headers are recognised by name (`Date`, `Account` / `Particulars` / `Description`,
`Debit` / `Dr`, `Credit` / `Cr`, `Memo` / `Remarks`), so extra columns such as `PR` are ignored.
Amounts may carry `₱`, `$`, thousands separators, parentheses for negatives, or a trailing `Dr`/`Cr`.
A negative debit is read as a credit.

**Optional extras**

- *Adjusting entries* — a second table in the same format. They are posted on top of the journal to
  produce the adjusted trial balance and the statements.
- *Opening balances* — `Account<tab>Amount`, one per line, for journals that only cover part of a year.

## Conventions used

- Accounts are classified by title (asset / liability / equity / revenue / expense, plus contra and
  sub-groups). Anything unrecognised is listed as **UNCLASSIFIED** and still shown on the balance
  sheet, so a missing type never hides an imbalance. Every classification can be edited in the
  *Account Types* table and the statements recalculate immediately.
- Normal balances: assets and expenses are debits; liabilities, equity and revenues are credits.
  Contra accounts are flipped.
- Net income is never posted to a closing entry, so the capital account's movement is treated as
  additional investment and drawings are kept separate.
- Cash flows, **indirect method**: net income, add back depreciation and amortisation, reverse gains
  and add back losses, then the change in every current asset and current liability. Investing uses
  the change in long-term assets (purchases are grossed up by the cost of anything sold, and the
  proceeds are read from the cash line of the same journal entry). Financing uses capital,
  drawings/dividends and long-term borrowings. The result is checked against the actual change in
  cash and reported if it does not tie.
- Cash flows, **direct method**: every cash line is traced back to the *other side of its own journal
  entry*, and the amount is attributed to whichever account funded or received it — so a collection
  lands under *Customers*, a payment of trade payables under *Suppliers and merchandise*, payroll
  under *Employees*, prepaid and other bills under *Operating expenses*, and so on. Compound entries
  are split proportionally (an invoice paid partly in cash is divided correctly). Receipts and
  payments are totalled, and the net figure must equal the indirect method's; anything that cannot be
  traced to a single cash line is shown explicitly as *Other operating activities* rather than hidden.
  Investing and financing sections are shared by both statements so they can never disagree.

## Exports

Print / PDF (opens a formatted statement set, both cash flow methods included), copy the whole report
as text, download every statement as CSV in one ZIP (`journal`, `ledger`, `trial-balance`,
`worksheet`, `income-statement`, `equity-statement`, `balance-sheet`, `cash-flow`,
`cash-flow-direct`), or save the worksheet as `.json` and drop it back in later. Everything runs in
the browser — no upload.

## Tests

```
npm test          # 57 tests: engine units + StudyMate UI + the standalone page
```

- `tests/accounting.test.js` — 36 engine tests. `accounting.js` has no dependencies and runs in Node,
  so the figures are asserted directly: parsing (TSV/CSV/indented/xlsx XML), classification, trial
  balances, all four statements, both cash flow methods, disposals, opening balances, corporation vs
  sole proprietorship, and the error paths.
- `tests/ui.test.js` — 11 tests that load the real `index.html` in jsdom, click through the tool,
  switch cash flow methods, reclassify accounts, and drop a real generated `.xlsx` workbook.
- `tests/standalone.test.js` — 10 tests that boot the generated `standalone/index.html` (with no
  network at all), run the same flows, and fail if the bundle is out of date with its sources.
