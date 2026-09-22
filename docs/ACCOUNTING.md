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
| Statement of cash flows | Indirect method |
| Checks | Every cross-check the tool can run, with the reason when something does not tie |

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
- Cash flows (indirect): net income, add back depreciation and amortisation, reverse gains and add
  back losses, then the change in every current asset and current liability. Investing uses the change
  in long-term assets (purchases are grossed up by the cost of anything sold, and the proceeds are
  read from the cash line of the same journal entry). Financing uses capital, drawings/dividends and
  long-term borrowings. The result is checked against the actual change in cash and reported if it
  does not tie.

## Exports

Print / PDF (opens a formatted statement set), copy the whole report as text, download every
statement as CSV in one ZIP, or save the worksheet as `.json` and drop it back in later. Everything
runs in the browser — no upload.

## Tests

```
npm test          # 39 tests: 30 engine + 9 jsdom browser tests
```

The engine (`accounting.js`) has no dependencies and runs in Node, so the numbers are unit tested
directly. The browser tests load the real `index.html`, click through the tool, drop a real `.xlsx`
workbook and assert the figures that get drawn on screen.
