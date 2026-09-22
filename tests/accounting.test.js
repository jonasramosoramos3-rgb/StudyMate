/*
 * Unit tests for the StudyMate accounting engine.
 * Run with:  npm test   (or:  node --test tests/)
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../accounting.js");

const JOURNAL_TSV = [
  "Date\tAccount Titles and Explanation\tDebit\tCredit\tMemo",
  "2025-01-02\tCash\t150000\t\tOwner invested cash",
  "2025-01-02\tOwner's Capital\t\t150000\tOwner invested cash",
  "2025-01-03\tOffice Equipment\t48000\t\tBought equipment for cash",
  "2025-01-03\tCash\t\t48000\tBought equipment for cash",
  "2025-01-05\tSupplies\t6500\t\tPurchased supplies on account",
  "2025-01-05\tAccounts Payable\t\t6500\tPurchased supplies on account",
  "2025-01-08\tPrepaid Insurance\t12000\t\tOne-year policy",
  "2025-01-08\tCash\t\t12000\tOne-year policy",
  "2025-01-12\tAccounts Receivable\t28000\t\tServices rendered on account",
  "2025-01-12\tService Revenue\t\t28000\tServices rendered on account",
  "2025-01-15\tCash\t18500\t\tCash services rendered",
  "2025-01-15\tService Revenue\t\t18500\tCash services rendered",
  "2025-01-18\tSalaries Expense\t14000\t\tPaid salaries",
  "2025-01-18\tCash\t\t14000\tPaid salaries",
  "2025-01-20\tUtilities Expense\t3200\t\tPaid utilities",
  "2025-01-20\tCash\t\t3200\tPaid utilities",
  "2025-01-24\tCash\t15000\t\tCollected from customers",
  "2025-01-24\tAccounts Receivable\t\t15000\tCollected from customers",
  "2025-01-26\tRent Expense\t9000\t\tPaid office rent",
  "2025-01-26\tCash\t\t9000\tPaid office rent",
  "2025-01-28\tOwner's Drawings\t5000\t\tOwner withdrew cash",
  "2025-01-28\tCash\t\t5000\tOwner withdrew cash",
  "2025-01-30\tCash\t9000\t\tCollected from customers",
  "2025-01-30\tAccounts Receivable\t\t9000\tCollected from customers",
  "2025-01-31\tAdvertising Expense\t2500\t\tPaid advertising",
  "2025-01-31\tCash\t\t2500\tPaid advertising"
].join("\n");

const ADJUSTMENTS_TSV = [
  "Date\tAccount Titles and Explanation\tDebit\tCredit\tMemo",
  "2025-01-31\tInsurance Expense\t1000\t\tOne month expired",
  "2025-01-31\tPrepaid Insurance\t\t1000\tOne month expired",
  "2025-01-31\tDepreciation Expense\t800\t\tMonthly depreciation",
  "2025-01-31\tAccumulated Depreciation - Office Equipment\t\t800\tMonthly depreciation",
  "2025-01-31\tSupplies Expense\t2900\t\tSupplies used",
  "2025-01-31\tSupplies\t\t2900\tSupplies used",
  "2025-01-31\tSalaries Expense\t2000\t\tUnpaid salaries",
  "2025-01-31\tSalaries Payable\t\t2000\tUnpaid salaries",
  "2025-01-31\tAccounts Receivable\t3000\t\tAccrued revenue",
  "2025-01-31\tService Revenue\t\t3000\tAccrued revenue"
].join("\n");

/** Build the model for the sample service business (with or without adjustments). */
function sampleModel(withAdjustments) {
  const j = A.parseJournalText(JOURNAL_TSV);
  const adj = withAdjustments ? A.parseJournalText(ADJUSTMENTS_TSV) : { lines: [] };
  return A.buildModel({
    lines: j.lines, entries: j.entries,
    adjustments: adj.lines || [],
    currency: "PHP"
  });
}

/* ------------------------------------------------------------------ */

test("parseAmount handles the formats people actually paste", () => {
  assert.equal(A.parseAmount("150000"), 150000);
  assert.equal(A.parseAmount("1,234.50"), 1234.5);
  assert.equal(A.parseAmount("₱1,000,000.00"), 1000000);
  assert.equal(A.parseAmount("$2,500"), 2500);
  assert.equal(A.parseAmount("(4,500)"), -4500);
  assert.equal(A.parseAmount("-750.25"), -750.25);
  assert.equal(A.parseAmount("900 Cr"), 900);
  assert.equal(A.parseAmount(""), 0);
  assert.equal(A.parseAmount("   "), 0);
  assert.equal(A.parseAmount("n/a"), 0);
  assert.equal(A.parseAmount(1234.567), 1234.57);
});

test("classifyAccount puts common titles in the right place", () => {
  const cases = [
    ["Cash", "asset", "cash", "debit"],
    ["Petty Cash Fund", "asset", "cash", "debit"],
    ["Accounts Receivable", "asset", "current-asset", "debit"],
    ["Merchandise Inventory", "asset", "current-asset", "debit"],
    ["Office Supplies", "asset", "current-asset", "debit"],
    ["Prepaid Insurance", "asset", "current-asset", "debit"],
    ["Office Equipment", "asset", "noncurrent-asset", "debit"],
    ["Land", "asset", "noncurrent-asset", "debit"],
    ["Accumulated Depreciation - Office Equipment", "asset", "contra-asset", "credit"],
    ["Allowance for Doubtful Accounts", "asset", "contra-asset", "credit"],
    ["Goodwill", "asset", "noncurrent-asset", "debit"],
    ["Accounts Payable", "liability", "current-liability", "credit"],
    ["Unearned Service Revenue", "liability", "current-liability", "credit"],
    ["SSS Payable", "liability", "current-liability", "credit"],
    ["Bonds Payable", "liability", "noncurrent-liability", "credit"],
    ["Mortgage Payable", "liability", "noncurrent-liability", "credit"],
    ["Owner's Capital", "equity", "owner-capital", "credit"],
    ["J. Ramos, Capital", "equity", "owner-capital", "credit"],
    ["Owner's Drawings", "equity", "drawings", "debit"],
    ["Common Stock", "equity", "contributed-capital", "credit"],
    ["Additional Paid-in Capital", "equity", "contributed-capital", "credit"],
    ["Retained Earnings", "equity", "retained-earnings", "credit"],
    ["Cash Dividends", "equity", "drawings", "debit"],
    ["Treasury Shares", "equity", "treasury", "debit"],
    ["Service Revenue", "revenue", "operating-revenue", "credit"],
    ["Sales", "revenue", "operating-revenue", "credit"],
    ["Sales Returns and Allowances", "revenue", "contra-revenue", "debit"],
    ["Interest Revenue", "revenue", "other-revenue", "credit"],
    ["Gain on Sale of Equipment", "revenue", "other-revenue", "credit"],
    ["Cost of Goods Sold", "expense", "cogs", "debit"],
    ["Freight-In", "expense", "cogs", "debit"],
    ["Purchases", "expense", "cogs", "debit"],
    ["Depreciation Expense", "expense", "operating-expense", "debit"],
    ["Supplies Expense", "expense", "operating-expense", "debit"],
    ["Insurance Expense", "expense", "operating-expense", "debit"],
    ["Interest Expense", "expense", "other-expense", "debit"],
    ["Loss on Sale of Equipment", "expense", "other-expense", "debit"],
    ["Income Tax Expense", "expense", "income-tax-expense", "debit"]
  ];
  for (const [name, type, subtype, normal] of cases) {
    const c = A.classifyAccount(name);
    assert.equal(c.type, type, `${name} -> type (got ${c.type})`);
    assert.equal(c.subtype, subtype, `${name} -> subtype (got ${c.subtype})`);
    assert.equal(c.normal, normal, `${name} -> normal side (got ${c.normal})`);
  }
  assert.equal(A.classifyAccount("Depreciation Expense").noncash, true);
  assert.equal(A.classifyAccount("Mystery Account XYZ").type, "unknown");
});

test("classifyAccount honours a manual override", () => {
  const c = A.classifyAccount("Store Cash Box", { "Store Cash Box": "asset:noncurrent-asset" });
  assert.equal(c.subtype, "noncurrent-asset");
  assert.equal(c.source, "manual");
});

test("parses a spreadsheet (tab separated) journal with a header row", () => {
  const p = A.parseJournalText(JOURNAL_TSV);
  assert.equal(p.lines.length, 26);
  assert.equal(p.entries.length, 13);
  assert.equal(p.meta.totalDebit, 320700);
  assert.equal(p.meta.totalCredit, 320700);
  assert.deepEqual(p.warnings, []);
  assert.equal(p.entries[0].date, "2025-01-02");
  assert.equal(p.entries[0].lines[0].account, "Cash");
  assert.equal(p.entries[0].lines[0].debit, 150000);
  assert.equal(p.entries[0].lines[1].account, "Owner's Capital");
  assert.equal(p.entries[0].lines[1].credit, 150000);
  assert.equal(p.entries[0].memo, "Owner invested cash");
  assert.ok(p.entries.every(e => e.balanced));
});

test("parses CSV journals, including negative credits", () => {
  const csv = [
    "date,account,debit,credit",
    "2025-02-01,Cash,10000,0",
    "2025-02-01,Owner's Capital,-10000,0",
    "2025-02-05,Rent Expense,1500,",
    "2025-02-05,Cash,,1500"
  ].join("\n");
  const p = A.parseJournalText(csv);
  assert.equal(p.lines.length, 4);
  assert.equal(p.entries.length, 2);
  assert.equal(p.lines[1].credit, 10000, "negative debit is normalised into the credit column");
  assert.equal(p.lines[1].debit, 0);
  assert.equal(p.meta.totalDebit, 11500);
  assert.equal(p.meta.totalCredit, 11500);
});

test("parses a classic indented (textbook) journal", () => {
  const text = [
    "Jan 2    Cash ................................ 150,000",
    "             Owner's Capital ............................... 150,000",
    "Jan 5    Supplies ............................. 6,500",
    "             Accounts Payable .............................. 6,500"
  ].join("\n");
  const p = A.parseJournalText(text);
  assert.equal(p.lines.length, 4);
  assert.equal(p.entries.length, 2);
  assert.equal(p.lines[0].account, "Cash");
  assert.equal(p.lines[0].debit, 150000);
  assert.equal(p.lines[0].date, "Jan 2");
  assert.equal(p.lines[1].account, "Owner's Capital");
  assert.equal(p.lines[1].credit, 150000);
  assert.equal(p.lines[2].account, "Supplies");
  assert.equal(p.lines[3].account, "Accounts Payable");
  assert.equal(p.meta.totalDebit, 156500);
  assert.ok(p.entries.every(e => e.balanced));
});

test("parses a journal with no header row", () => {
  const csv = [
    "2025-03-01,Cash,20000,0",
    "2025-03-01,Common Stock,0,20000"
  ].join("\n");
  const p = A.parseJournalText(csv);
  assert.equal(p.lines.length, 2);
  assert.equal(p.lines[0].account, "Cash");
  assert.equal(p.lines[0].debit, 20000);
  assert.equal(p.lines[1].credit, 20000);
});

test("flags an unbalanced journal entry", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100\t",
    "2025-01-01\tOwner's Capital\t\t90"
  ].join("\n"));
  assert.equal(p.entries.length, 1);
  assert.equal(p.entries[0].balanced, false);
  assert.equal(p.entries[0].difference, 10);
  assert.ok(p.warnings.some(w => /do not agree/i.test(w)));
});

test("warns when the table has only one amount column", () => {
  const p = A.parseJournalText("date,account,amount\n2025-01-01,Cash,500\n2025-01-01,Capital,500");
  assert.ok(p.warnings.some(w => /one amount column|No Credit column/i.test(w)));
});

test("unadjusted trial balance of the sample business", () => {
  const m = sampleModel(false);
  assert.equal(m.unadjustedTB.totalDebit, 203000);
  assert.equal(m.unadjustedTB.totalCredit, 203000);
  assert.equal(m.unadjustedTB.balanced, true);
  const cash = m.unadjustedTB.rows.find(r => r.name === "Cash");
  assert.equal(cash.debit, 98800);
  const rev = m.unadjustedTB.rows.find(r => r.name === "Service Revenue");
  assert.equal(rev.credit, 46500);
  assert.equal(m.incomeStatement.netIncome, 17800);
  assert.equal(m.entity, "sole-proprietorship");
});

test("adjusting entries flow into the adjusted trial balance and statements", () => {
  const m = sampleModel(true);
  assert.equal(m.adjustedTB.totalDebit, 208800);
  assert.equal(m.adjustedTB.totalCredit, 208800);
  assert.equal(m.adjustedTB.balanced, true);
  assert.equal(m.unadjustedTB.totalDebit, 203000, "unadjusted TB is unchanged");

  const find = n => m.adjustedTB.rows.find(r => r.name === n);
  assert.equal(find("Prepaid Insurance").debit, 11000);
  assert.equal(find("Supplies").debit, 3600);
  assert.equal(find("Accounts Receivable").debit, 7000);
  assert.equal(find("Accumulated Depreciation - Office Equipment").credit, 800);
  assert.equal(find("Salaries Payable").credit, 2000);
  assert.equal(find("Service Revenue").credit, 49500);
  assert.equal(find("Salaries Expense").debit, 16000);

  assert.equal(m.incomeStatement.totalRevenue, 49500);
  assert.equal(m.incomeStatement.totalOpex, 35400);
  assert.equal(m.incomeStatement.netIncome, 14100);
  assert.equal(m.incomeStatement.hasCOGS, false);
});

test("statement of changes in owner's equity", () => {
  const m = sampleModel(true);
  const eq = m.equityStatement;
  assert.equal(eq.isCorp, false);
  assert.equal(eq.beginCapital, 0);
  assert.equal(eq.investments, 150000);
  assert.equal(eq.totalDrawings, 5000);
  assert.equal(eq.endCapital, 159100); // 150,000 + 14,100 - 5,000
  assert.ok(eq.rows.some(r => /NET INCOME|Net Income/.test(r.label) && r.amount === 14100));
});

test("classified balance sheet balances", () => {
  const m = sampleModel(true);
  const bs = m.balanceSheet;
  assert.equal(bs.totalCash, 98800);
  assert.equal(bs.totalCurrentAssets, 120400); // 98,800 + 7,000 + 3,600 + 11,000
  assert.equal(bs.grossPPE, 48000);
  assert.equal(bs.accumDep, 800);
  assert.equal(bs.netPPE, 47200);
  assert.equal(bs.totalAssets, 167600);
  assert.equal(bs.totalCurrentLiab, 8500); // 6,500 AP + 2,000 salaries payable
  assert.equal(bs.totalLiabilities, 8500);
  assert.equal(bs.totalEquity, 159100);
  assert.equal(bs.totalLiabAndEquity, 167600);
  assert.equal(bs.balanced, true);
  // PPE section is presented gross, less accumulated depreciation
  assert.ok(bs.rows.some(r => r.label === "Less: Accumulated Depreciation" && r.amount === -800));
});

test("statement of cash flows (indirect) ties to the change in cash", () => {
  const m = sampleModel(true);
  const cf = m.cashFlow;
  assert.equal(cf.depreciation, 800);
  // every account starts at zero here, so the whole ending balance is the "change":
  // -AR 7,000 - supplies 3,600 - prepaid 11,000 + AP 6,500 + salaries payable 2,000
  assert.equal(cf.workingCapitalChange, -13100);
  assert.equal(cf.operating, 1800);
  assert.equal(cf.investing, -48000);
  assert.equal(cf.financing, 145000); // 150,000 investment - 5,000 drawings
  assert.equal(cf.netChange, 98800);
  assert.equal(cf.beginCash, 0);
  assert.equal(cf.endCash, 98800);
  assert.equal(cf.ties, true);
  assert.equal(cf.unexplained, 0);
  const label = cf.rows.find(r => /investing activities$/.test(r.label) && r.bold);
  assert.equal(label.label, "Net cash used in investing activities");
});

test("general ledger runs a balance for every account", () => {
  const m = sampleModel(true);
  const ledger = A.buildLedger(m);
  const cash = ledger.find(a => a.name === "Cash");
  assert.equal(cash.postings.length, 11);
  assert.equal(cash.balance, 98800);
  assert.equal(cash.postings[cash.postings.length - 1].balance, 98800);
  const accum = ledger.find(a => a.name === "Accumulated Depreciation - Office Equipment");
  assert.equal(accum.balance, 800);
  assert.equal(accum.normal, "credit");
  assert.ok(ledger.every(a => Math.abs(a.balance) < 1e9));
});

test("worksheet columns agree with the trial balance and income statement", () => {
  const m = sampleModel(true);
  const w = m.worksheet;
  assert.equal(w.totals.tbDr, 208800);
  assert.equal(w.totals.tbCr, 208800);
  assert.equal(w.totals.isCr - w.totals.isDr, 0, "income statement columns agree once net income is carried across");
  assert.equal(w.totals.bsDr - w.totals.bsCr, 0, "balance sheet columns net to zero");
  const niRow = w.rows.find(r => r.name === "Net Income");
  assert.equal(niRow.isDr, 14100);
  assert.equal(niRow.bsCr, 14100);
  assert.equal(w.totals.adjDr, 9700);
  assert.equal(w.totals.adjCr, 9700);
});

test("checks report a clean run for a correct journal", () => {
  const m = sampleModel(true);
  const errors = m.checks.filter(c => c.level === "error");
  assert.deepEqual(errors, []);
  assert.ok(m.checks.some(c => /Journal entries/.test(c.label) && c.level === "ok"));
  assert.ok(m.checks.some(c => /Balance sheet/.test(c.label) && c.level === "ok"));
  assert.ok(m.checks.some(c => /cash flows/i.test(c.label) && c.level === "ok"));
});

test("an unbalanced entry surfaces as an error check", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100\t",
    "2025-01-01\tOwner's Capital\t\t90"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  assert.ok(m.checks.some(c => c.level === "error" && /Journal entries/.test(c.label)));
  assert.equal(m.balanceSheet.balanced, false);
});

test("an unclassified account is reported, not silently dropped", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t1000\t",
    "2025-01-01\tOwner's Capital\t\t1000",
    "2025-01-02\tZzz Mystery Thing\t500\t",
    "2025-01-02\tCash\t\t500"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  assert.equal(m.balanceSheet.unclassified.length, 1);
  assert.equal(m.balanceSheet.unclassified[0].name, "Zzz Mystery Thing");
  assert.ok(m.warnings.some(w => /Unclassified account/.test(w)));
  assert.equal(m.balanceSheet.balanced, true, "still shown on the balance sheet so A = L + E holds");
  assert.ok(m.balanceSheet.rows.some(r => /UNCLASSIFIED/.test(r.label)));
});

test("manual account overrides move a balance", () => {
  const p = A.parseJournalText(JOURNAL_TSV);
  const m = A.buildModel({ lines: p.lines, entries: p.entries, overrides: { "Supplies": "expense:operating-expense" } });
  const supp = m.accounts.find(a => a.name === "Supplies");
  assert.equal(supp.type, "expense");
  assert.equal(m.incomeStatement.totalOpex, 28700 + 6500);
  assert.equal(m.balanceSheet.totalCurrentAssets, 98800 + 4000 + 12000);
});

test("opening balances are carried into the statements", () => {
  const p = A.parseJournalText(JOURNAL_TSV);
  const opening = A.parseBalanceList("Cash\t20000\nOwner's Capital\t20000");
  const m = A.buildModel({ lines: p.lines, entries: p.entries, opening });
  assert.equal(m.balanceSheet.totalCash, 118800);
  assert.equal(m.equityStatement.beginCapital, 20000);
  assert.equal(m.equityStatement.endCapital, 182800); // 20,000 + 150,000 + 17,800 - 5,000
  assert.equal(m.balanceSheet.totalAssets, 189300);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlow.beginCash, 20000);
  assert.equal(m.cashFlow.endCash, 118800);
  assert.equal(m.cashFlow.ties, true);
});

test("parseBalanceList reads the common layouts", () => {
  assert.deepEqual(A.parseBalanceList("Cash\t5,000\nAccounts Payable, 2500\nLand 10000 Dr"), {
    "Cash": 5000, "Accounts Payable": 2500, "Land": 10000
  });
  assert.deepEqual(A.parseBalanceList("# comment\n\n"), {});
});

test("a merchandising business shows gross profit", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100000\t",
    "2025-01-01\tOwner's Capital\t\t100000",
    "2025-01-04\tMerchandise Inventory\t20000\t",
    "2025-01-04\tAccounts Payable\t\t20000",
    "2025-01-10\tCash\t30000\t",
    "2025-01-10\tSales\t\t30000",
    "2025-01-10\tCost of Goods Sold\t12000\t",
    "2025-01-10\tMerchandise Inventory\t\t12000",
    "2025-01-15\tSales Returns and Allowances\t1000\t",
    "2025-01-15\tCash\t\t1000",
    "2025-01-20\tSalaries Expense\t5000\t",
    "2025-01-20\tCash\t\t5000",
    "2025-01-31\tIncome Tax Expense\t2000\t",
    "2025-01-31\tIncome Tax Payable\t\t2000"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  const is = m.incomeStatement;
  assert.equal(is.hasCOGS, true);
  assert.equal(is.totalRevenue, 30000);
  assert.equal(is.totalContraRevenue, 1000);
  assert.equal(is.netSales, 29000);
  assert.equal(is.totalCOGS, 12000);
  assert.equal(is.grossProfit, 17000);
  assert.equal(is.operatingIncome, 12000);
  assert.equal(is.totalTax, 2000);
  assert.equal(is.netIncome, 10000);
  assert.ok(is.rows.some(r => r.label === "Gross Profit"));

  assert.equal(m.balanceSheet.totalAssets, 132000); // 124,000 cash + 8,000 inventory
  assert.equal(m.balanceSheet.totalLiabilities, 22000);
  assert.equal(m.balanceSheet.totalEquity, 110000);
  assert.equal(m.balanceSheet.balanced, true);

  const cf = m.cashFlow;
  assert.equal(cf.operating, 24000); // 29,000 from customers - 5,000 salaries
  assert.equal(cf.financing, 100000);
  assert.equal(cf.netChange, 124000);
  assert.equal(cf.ties, true);
});

test("a corporation gets a retained earnings statement", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t500000\t",
    "2025-01-01\tCommon Stock\t\t400000",
    "2025-01-01\tAdditional Paid-in Capital\t\t100000",
    "2025-01-15\tCash\t20000\t",
    "2025-01-15\tService Revenue\t\t20000",
    "2025-01-20\tSalaries Expense\t8000\t",
    "2025-01-20\tCash\t\t8000",
    "2025-01-30\tCash Dividends\t3000\t",
    "2025-01-30\tCash\t\t3000"
  ].join("\n"));
  const m = A.buildModel({
    lines: p.lines, entries: p.entries,
    opening: A.parseBalanceList("Cash\t50000\nRetained Earnings\t50000")
  });
  assert.equal(m.entity, "corporation");
  assert.equal(m.incomeStatement.netIncome, 12000);
  assert.equal(m.equityStatement.isCorp, true);
  assert.equal(m.equityStatement.beginRetained, 50000);
  assert.equal(m.equityStatement.totalDividends, 3000);
  assert.equal(m.equityStatement.endRetained, 59000);
  assert.equal(m.equityStatement.totalEquity, 559000);
  assert.equal(m.balanceSheet.totalAssets, 559000);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlow.financing, 497000);
  assert.equal(m.cashFlow.beginCash, 50000);
  assert.equal(m.cashFlow.ties, true);
  assert.ok(m.balanceSheet.rows.some(r => /STOCKHOLDERS' EQUITY/.test(r.label)));
});

test("asset disposal: purchases exclude the cost sold and proceeds are picked up", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100000\t",
    "2025-01-01\tOwner's Capital\t\t100000",
    "2025-01-05\tEquipment\t40000\t",
    "2025-01-05\tCash\t\t40000",
    "2025-01-20\tCash\t9000\t",
    "2025-01-20\tAccumulated Depreciation - Equipment\t6000\t",
    "2025-01-20\tEquipment\t\t15000",
    "2025-01-31\tDepreciation Expense\t1000\t",
    "2025-01-31\tAccumulated Depreciation - Equipment\t\t1000"
  ].join("\n"));
  // opening: Cash 20,000 + Equipment 30,000 - Accum. Dep. 10,000 = Capital 40,000
  const opening = A.parseBalanceList("Cash\t20000\nEquipment\t30000\nAccumulated Depreciation - Equipment\t10000\nOwner's Capital\t40000");
  const m = A.buildModel({ lines: p.lines, entries: p.entries, opening });
  const cf = m.cashFlow;
  const invest = cf.rows.filter(r => /Equipment/.test(r.label) && r.level === 1);
  assert.deepEqual(invest.map(r => r.label).sort(), ["Proceeds from sale of Equipment", "Purchase of Equipment"]);
  assert.equal(invest.find(r => /Purchase/.test(r.label)).amount, -40000);
  assert.equal(invest.find(r => /Proceeds/.test(r.label)).amount, 9000);
  assert.equal(cf.depreciation, 1000);
  assert.equal(cf.investing, -31000);
  assert.equal(m.incomeStatement.netIncome, -1000);
  assert.equal(cf.operating, 0, "depreciation add-back cancels the expense");
  assert.equal(cf.financing, 100000);
  assert.equal(cf.netChange, 69000);
  assert.equal(cf.ties, true);
  assert.equal(m.balanceSheet.grossPPE, 55000);
  assert.equal(m.balanceSheet.accumDep, 5000);
  assert.equal(m.balanceSheet.netPPE, 50000);
  assert.equal(m.balanceSheet.totalAssets, 139000);
  assert.equal(m.balanceSheet.balanced, true);
});

test("xlsx worksheet XML becomes rows", () => {
  const shared = '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4">' +
    '<si><t>Date</t></si><si><t>Account Titles</t></si><si><t>Cash</t></si><si><t>Owner\'s Capital</t></si></sst>';
  const sheet = '<?xml version="1.0"?><worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2"><v>45658</v></c><c r="B2" t="s"><v>2</v></c><c r="C2"><v>150000</v></c></row>' +
    '<row r="3"><c r="B3" t="inlineStr"><is><t>Owner&#39;s Capital</t></is></c><c r="C3"><v>-150000</v></c></row>' +
    '</sheetData></worksheet>';
  const rows = A.xlsxSheetToRows(sheet, shared);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ["Date", "Account Titles", "Account Titles"]);
  assert.deepEqual(rows[1], ["45658", "Cash", "150000"]);
  assert.deepEqual(rows[2], ["", "Owner's Capital", "-150000"]);
  assert.equal(A.xlsxColumnIndex("A"), 0);
  assert.equal(A.xlsxColumnIndex("B"), 1);
  assert.equal(A.xlsxColumnIndex("AA"), 26);
  assert.equal(A.excelSerialToDate(45658), "2025-01-01");

  const p = A.parseJournalRows(rows);
  assert.equal(p.lines.length, 2);
  assert.equal(p.lines[0].date, "2025-01-01");
  assert.equal(p.lines[0].debit, 150000);
  assert.equal(p.lines[1].credit, 150000, "negative debit read from the sheet becomes a credit");
});

test("exports produce the numbers the UI shows", () => {
  const m = sampleModel(true);
  const tb = A.statementToCSV(m, "trial-balance");
  assert.match(tb, /^Cash,asset,98800.00,0.00$/m);
  assert.match(tb, /^TOTAL,,208800.00,208800.00$/m);
  const bs = A.statementToCSV(m, "balance-sheet");
  assert.match(bs, /TOTAL ASSETS,167600.00/);
  const journal = A.statementToCSV(m, "journal");
  assert.match(journal, /^2025-01-02,Cash,150000.00,,Owner invested cash$/m);
  const ledger = A.statementToCSV(m, "ledger");
  assert.match(ledger, /Cash,,Balance forward|Cash,2025-01-02/);
  const ws = A.statementToCSV(m, "worksheet");
  assert.match(ws, /TOTALS,/);
  const is = A.statementToCSV(m, "income-statement");
  assert.match(is, /NET INCOME,14100.00/);
  assert.throws(() => A.statementToCSV(m, "nope"));
});

test("plain-text report renders every statement", () => {
  const m = sampleModel(true);
  const txt = A.toTextReport(m, { company: "Ramos Consulting", period: "January 31, 2025", totalDebit: 320700, totalCredit: 320700 });
  for (const heading of ["GENERAL JOURNAL", "GENERAL LEDGER", "TRIAL BALANCE", "INCOME STATEMENT", "BALANCE SHEET", "STATEMENT OF CASH FLOWS", "CHECKS"]) {
    assert.ok(txt.includes(heading), `missing ${heading}`);
  }
  assert.ok(txt.includes("RAMOS CONSULTING"));
  assert.ok(txt.includes("January 31, 2025"));
  assert.ok(txt.includes("167,600.00"));
  assert.ok(!/\[ERROR\]/.test(txt));
});

test("direct method: cash receipts and payments traced from the journal", () => {
  const m = sampleModel(true);
  const d = m.cashFlowDirect;
  assert.equal(d.method, "direct");
  assert.equal(d.flows.customers, 42500);   // 18,500 + 15,000 + 9,000 collections
  assert.equal(d.flows.employees, -14000);
  assert.equal(d.flows.opex, -26700);       // prepaid 12,000 + utilities 3,200 + rent 9,000 + advertising 2,500
  assert.equal(d.flows.suppliers, 0);       // supplies were bought on account
  assert.equal(d.receipts, 42500);
  assert.equal(d.payments, -40700);
  assert.equal(d.operatingTraced, 1800);
  assert.equal(d.reconciliation, 0, "nothing left over to reconcile");
  assert.equal(d.operating, m.cashFlow.operating, "agrees with the indirect method");
  assert.equal(d.investing, -48000);
  assert.equal(d.financing, 145000);
  assert.equal(d.netChange, 98800);
  assert.equal(d.endCash, 98800);
  assert.equal(d.ties, true);
  // the operating detail rows are the direct-method ones, not the add-backs
  assert.ok(d.rows.some(r => r.label === "Customers" && r.amount === 42500));
  assert.ok(d.rows.some(r => r.label === "Total cash receipts"));
  assert.ok(!d.rows.some(r => /^Net Income$/.test(r.label)), "no net income line in the direct method");
  assert.ok(!d.rows.some(r => /Depreciation and amortization/.test(r.label)), "no depreciation add-back in the direct method");
  // investing and financing are copied through so both statements match
  assert.ok(d.rows.some(r => r.label === "INVESTING ACTIVITIES"));
  assert.ok(d.rows.some(r => r.label === "FINANCING ACTIVITIES"));
  assert.ok(d.rows.some(r => /Purchase of Office Equipment/.test(r.label)));
});

test("direct method on a merchandising business", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100000\t",
    "2025-01-01\tOwner's Capital\t\t100000",
    "2025-01-04\tMerchandise Inventory\t20000\t",
    "2025-01-04\tAccounts Payable\t\t20000",
    "2025-01-10\tCash\t30000\t",
    "2025-01-10\tSales\t\t30000",
    "2025-01-10\tCost of Goods Sold\t12000\t",
    "2025-01-10\tMerchandise Inventory\t\t12000",
    "2025-01-15\tSales Returns and Allowances\t1000\t",
    "2025-01-15\tCash\t\t1000",
    "2025-01-16\tAccounts Payable\t20000\t",
    "2025-01-16\tCash\t\t20000",
    "2025-01-20\tSalaries Expense\t5000\t",
    "2025-01-20\tCash\t\t5000",
    "2025-01-31\tIncome Tax Expense\t2000\t",
    "2025-01-31\tCash\t\t2000"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  const d = m.cashFlowDirect;
  assert.equal(d.flows.customers, 29000);      // 30,000 sales less 1,000 returns
  assert.equal(d.flows.suppliers, -20000);     // paying off the trade payable
  assert.equal(d.flows.employees, -5000);
  assert.equal(d.flows.taxes, -2000);
  assert.equal(d.operating, m.cashFlow.operating);
  assert.equal(d.operating, 2000);             // 29,000 - 20,000 - 5,000 - 2,000
  assert.equal(d.reconciliation, 0);
  assert.equal(d.netChange, 102000);
  assert.equal(d.ties, true);
  assert.ok(d.rows.some(r => r.label === "Income taxes"));
});

test("direct method splits a compound entry between investing and operating", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t100000\t",
    "2025-01-01\tOwner's Capital\t\t100000",
    "2025-01-09\tEquipment\t10000\t",
    "2025-01-09\tRepairs Expense\t500\t",
    "2025-01-09\tCash\t\t10500"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  const d = m.cashFlowDirect;
  assert.equal(d.flows.opex, -500);
  assert.equal(d.flows.investing, -10000);
  assert.equal(d.flows.financing, 100000);
  assert.equal(d.operating, -500);
  assert.equal(d.reconciliation, 0);
  assert.equal(d.netChange, 89500);
  assert.equal(d.ties, true);
});

test("a transfer between two cash accounts nets to zero in the direct method", () => {
  const p = A.parseJournalText([
    "Date\tAccount\tDebit\tCredit",
    "2025-01-01\tCash\t50000\t",
    "2025-01-01\tOwner's Capital\t\t50000",
    "2025-01-02\tPetty Cash Fund\t5000\t",
    "2025-01-02\tCash\t\t5000"
  ].join("\n"));
  const m = A.buildModel({ lines: p.lines, entries: p.entries });
  const d = m.cashFlowDirect;
  assert.equal(d.flows.other, 0);
  assert.equal(d.flows.financing, 50000);
  assert.equal(d.operating, 0);
  assert.equal(m.balanceSheet.totalCash, 50000);
  assert.equal(d.netChange, 50000);
  assert.equal(d.ties, true);
});

test("directBucket routes counterparties to the right line", () => {
  const cases = [
    ["Accounts Receivable", "customers"],
    ["Service Revenue", "customers"],
    ["Unearned Service Revenue", "customers"],
    ["Sales Returns and Allowances", "customers"],
    ["Accounts Payable", "suppliers"],
    ["Merchandise Inventory", "suppliers"],
    ["Cost of Goods Sold", "suppliers"],
    ["Freight-In", "suppliers"],
    ["Salaries Expense", "employees"],
    ["Salaries Payable", "employees"],
    ["SSS Payable", "employees"],
    ["Utilities Expense", "opex"],
    ["Prepaid Insurance", "opex"],
    ["Interest Expense", "interestPaid"],
    ["Income Tax Expense", "taxes"],
    ["Income Tax Payable", "taxes"],
    ["Interest Revenue", "interestReceived"],
    ["Equipment", "investing"],
    ["Accumulated Depreciation - Equipment", "investing"],
    ["Owner's Capital", "financing"],
    ["Owner's Drawings", "financing"],
    ["Bonds Payable", "financing"],
    ["Zzz Mystery Thing", "other"]
  ];
  for (const [name, expected] of cases) {
    const account = A.classifyAccount(name);
    assert.equal(A.directBucket(name, { type: account.type, subtype: account.subtype }), expected, `${name} -> ${expected}`);
  }
});

test("exports include the direct-method statement", () => {
  const m = sampleModel(true);
  const csv = A.statementToCSV(m, "cash-flow-direct");
  assert.match(csv, /STATEMENT OF CASH FLOWS - DIRECT METHOD/);
  assert.match(csv, /^Customers,42500.00$/m);
  assert.match(csv, /^Total cash receipts,42500.00$/m);
  const txt = A.toTextReport(m, { company: "Test Co", totalDebit: 1, totalCredit: 1 });
  assert.ok(txt.includes("STATEMENT OF CASH FLOWS (DIRECT METHOD)"));
  assert.ok(txt.includes("STATEMENT OF CASH FLOWS (INDIRECT METHOD)"));
  assert.ok(txt.includes("Both methods agree"));
});

test("money formatting", () => {
  assert.equal(A.fmtMoney(1234.5, { currency: "PHP" }), "₱1,234.50");
  assert.equal(A.fmtMoney(-1234.5, { currency: "PHP" }), "(₱1,234.50)");
  assert.equal(A.fmtMoney(0, { currency: "NONE" }), "0.00");
  assert.equal(A.fmtMoney(1000, { currency: "USD" }), "$1,000.00");
  assert.equal(A.fmtMoney(0.004, { currency: "NONE" }), "0.00");
});

test("the bundled sample data parses and balances", () => {
  const j = A.parseJournalText(A.SAMPLE_JOURNAL);
  const adj = A.parseJournalText(A.SAMPLE_ADJUSTMENTS);
  assert.deepEqual(j.warnings, []);
  assert.deepEqual(adj.warnings, []);
  const m = A.buildModel({ lines: j.lines, entries: j.entries, adjustments: adj.lines });
  assert.equal(m.checks.filter(c => c.level === "error").length, 0);
  assert.equal(m.incomeStatement.netIncome, 14100);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlow.ties, true);
});
