# FinanceFlow — Standalone Automated Accounting System

This is a **brand new, standalone** accounting website — NOT connected to StudyMate.

## Features (Full GAAP Cycle)

- **Company Setup** — closable, never traps you. Edit name, currency ($ ₱ € £), period.
- **Chart of Accounts** — 29 default accounts, searchable, add/edit/delete, click to view ledger
- **Journal Entries** — double-entry, debits=credits validation, persists to localStorage (never disappears)
- **General Ledger** — click any account on left to preview its transactions & running balance
- **Trial Balance** — unadjusted + adjusted, balanced check
- **Adjusting Entries** — quick templates for depreciation, accrued salaries, prepaid, unearned
- **Financial Statements**:
  - Income Statement
  - Retained Earnings
  - Balance Sheet (Assets = Liab + Equity check)
  - Cash Flow (Indirect)

## Copy All Journals

- **Sidebar** → Copy Journals
- **Top bar** → Copy All Journals
- **Journal page** → Copy All + CSV Export
- Copies formatted text + TSV for Excel

## How to Run

Just open `index.html` in browser — 100% offline, no install.

Or:
```
python3 -m http.server 8000
# open http://localhost:8000
```

All data is stored locally in browser localStorage (key: ledgerflow_v2). Export JSON to backup.

## Files

- `index.html` — full UI (Tailwind CDN)
- `app.js` — complete accounting logic (2000+ lines)
- `manifest.json` — PWA manifest

Built to fix: accounts not showing, entries disappearing, company setup trapping, copy functionality.
