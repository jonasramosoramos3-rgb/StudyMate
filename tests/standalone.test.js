/*
 * Tests for the standalone single-file site (standalone/index.html).
 * The real generated file is loaded into jsdom and driven end to end.
 *
 * Run with:  npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { build } = require("../tools/build-standalone.js");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "standalone", "index.html");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot() {
  const dom = new JSDOM(fs.readFileSync(FILE, "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost:8000/standalone/"
  });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = function () {};
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  window.confirm = () => true;
  window.addEventListener("error", e => { throw e.error || new Error(String(e.message)); });
  return { window, document: window.document, $: s => window.document.querySelector(s) };
}

test("standalone/index.html is checked in and up to date with its sources", () => {
  assert.ok(fs.existsSync(FILE), "standalone/index.html exists");
  assert.equal(fs.readFileSync(FILE, "utf8"), build(), "run: node tools/build-standalone.js");
  const html = fs.readFileSync(FILE, "utf8");
  assert.match(html, /Financial Statement Machine/);
  assert.match(html, /StudyMate Accounting Engine/, "the engine is inlined");
  // self contained: the only external reference is the optional JSZip helper
  const external = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(external, ["https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"]);
  assert.ok(!/tailwindcss|cdn\.tailwindcss/.test(html), "no Tailwind dependency");
});

test("the standalone page boots with no network at all", async () => {
  const { window, document, $ } = boot();
  await sleep(50);
  assert.ok(window.StudyMateAccounting, "engine loaded from the inline script");
  assert.ok(window.FinancialStatementMachine, "UI loaded");
  assert.equal(window.JSZip, undefined, "JSZip was never fetched - the app must still work");
  assert.ok($("#journal"), "journal box rendered");
  assert.ok($("#run"), "calculate button rendered");
  assert.match(document.body.textContent, /Financial Statement Machine/);
  assert.match($("#results").textContent, /No statements yet/);
});

test("the sample month produces every statement in the standalone page", async () => {
  const { window, document, $ } = boot();
  await sleep(50);
  $("#sample").click();
  await sleep(30);
  $("#run").click();
  await sleep(50);

  const m = window.FinancialStatementMachine.S.model;
  assert.ok(m, "model built");
  assert.equal(m.incomeStatement.netIncome, 14100);
  assert.equal(m.balanceSheet.totalAssets, 167600);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.adjustedTB.totalDebit, 208800);
  assert.equal(m.cashFlow.ties, true);
  assert.equal(m.cashFlowDirect.reconciliation, 0);
  assert.equal(m.checks.filter(c => c.level === "error").length, 0);

  assert.match($("#summary").textContent, /₱14,100\.00/);
  assert.match($("#summary").textContent, /Everything balances/);
  assert.match($("#accounts").textContent, /Account types \(18\)/);
  assert.deepEqual(
    [...m.accounts.map(a => a.name)].sort(),
    ["Accumulated Depreciation - Office Equipment", "Accounts Payable", "Accounts Receivable", "Advertising Expense",
      "Cash", "Depreciation Expense", "Insurance Expense", "Office Equipment", "Owner's Capital", "Owner's Drawings",
      "Prepaid Insurance", "Rent Expense", "Salaries Expense", "Salaries Payable", "Service Revenue", "Supplies",
      "Supplies Expense", "Utilities Expense"].sort()
  );
  assert.match($("#tabBody").textContent, /NET INCOME/);
  assert.match($("#tabBody").textContent, /₱14,100\.00/);
});

test("standalone: all tabs render and the cash flow method switches", async () => {
  const { window, document, $ } = boot();
  await sleep(50);
  $("#sample").click();
  $("#run").click();
  await sleep(50);

  const tab = label => {
    const b = Array.from(document.querySelectorAll("[data-tab]")).find(x => x.textContent.includes(label));
    assert.ok(b, `tab ${label}`);
    b.click();
    return $("#tabBody").textContent;
  };

  assert.match(tab("Balance Sheet"), /TOTAL ASSETS/);
  assert.match($("#tabBody").textContent, /₱167,600\.00/);
  assert.match(tab("Owner's Equity"), /Owner's Capital, ending/);
  assert.match(tab("Trial Balance"), /208,800\.00/);
  assert.match(tab("Worksheet"), /TOTALS/);
  assert.match(tab("Ledger"), /Accumulated Depreciation - Office Equipment/);
  assert.match(tab("Journal"), /Entry #1/);
  assert.match(tab("Checks"), /Direct vs indirect method/);

  tab("Cash Flows");
  assert.match($("#tabBody").textContent, /Indirect Method/);
  assert.match($("#tabBody").textContent, /Depreciation and amortization expense/);

  const direct = Array.from(document.querySelectorAll("[data-cf]")).find(b => b.textContent.trim() === "Direct method");
  direct.click();
  await sleep(20);
  const text = $("#tabBody").textContent;
  assert.match(text, /Direct Method/);
  assert.match(text, /Cash receipts from:/);
  assert.match(text, /₱42,500\.00/);
  assert.doesNotMatch(text, /Depreciation and amortization/);

  const both = Array.from(document.querySelectorAll("[data-cf]")).find(b => b.textContent.includes("Both"));
  both.click();
  await sleep(20);
  assert.match($("#tabBody").textContent, /Indirect Method/);
  assert.match($("#tabBody").textContent, /Direct Method/);
  assert.equal(window.FinancialStatementMachine.S.cfMethod, "both");
});

test("standalone: typing a journal recalculates by itself", async () => {
  const { window, $ } = boot();
  await sleep(50);
  $("#journal").value = [
    "Date\tAccount Titles and Explanation\tDebit\tCredit\tMemo",
    "2025-09-01\tCash\t25000\t\towner investment",
    "2025-09-01\tOwner's Capital\t\t25000\towner investment",
    "2025-09-12\tService Revenue\t\t6000\tbilled and collected",
    "2025-09-12\tCash\t6000\t\tbilled and collected",
    "2025-09-20\tUtilities Expense\t1200\t\tpaid Meralco",
    "2025-09-20\tCash\t\t1200\tpaid Meralco"
  ].join("\n");
  $("#journal").dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(600);

  const m = window.FinancialStatementMachine.S.model;
  assert.ok(m, "auto-calculated from the paste");
  assert.equal(m.incomeStatement.netIncome, 4800);
  assert.equal(m.balanceSheet.totalCash, 29800);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlowDirect.flows.customers, 6000);
  assert.equal(m.cashFlowDirect.flows.opex, -1200);
  assert.equal(m.cashFlowDirect.reconciliation, 0);
  assert.match($("#summary").textContent, /₱4,800\.00/);
});

test("standalone: an .xlsx workbook goes straight through when JSZip is available", async () => {
  const { window, $ } = boot();
  await sleep(50);
  window.JSZip = require("jszip");

  const strings = ["Date", "Account Titles and Explanation", "Debit", "Credit", "Memo",
    "2025-08-01", "Cash", "Owner's Capital", "2025-08-18", "Salaries Expense", "start-up capital", "paid salaries"];
  const s = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
  const n = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1">${s("A1", 0)}${s("B1", 1)}${s("C1", 2)}${s("D1", 3)}${s("E1", 4)}</row>
    <row r="2">${s("A2", 5)}${s("B2", 6)}${n("C2", 60000)}${s("E2", 10)}</row>
    <row r="3">${s("A3", 5)}${s("B3", 7)}${n("D3", 60000)}${s("E3", 10)}</row>
    <row r="4">${s("A4", 8)}${s("B4", 9)}${n("C4", 7500)}${s("E4", 11)}</row>
    <row r="5">${s("A5", 8)}${s("B5", 6)}${n("D5", 7500)}${s("E5", 11)}</row>
  </sheetData></worksheet>`;
  const zip = new window.JSZip();
  zip.file("xl/sharedStrings.xml", `<?xml version="1.0"?><sst>${strings.map(x => `<si><t>${x}</t></si>`).join("")}</sst>`);
  zip.file("xl/worksheets/sheet1.xml", sheet);
  const buf = await zip.generateAsync({ type: "nodebuffer" });

  await window.FinancialStatementMachine.readFile({ name: "august.xlsx", arrayBuffer: async () => buf });
  await sleep(60);

  const m = window.FinancialStatementMachine.S.model;
  assert.ok(m, "statements built from the workbook");
  assert.match($("#status").textContent, /Loaded august.xlsx - 4 journal lines/);
  assert.equal(m.entries.length, 2);
  assert.equal(m.incomeStatement.netIncome, -7500);
  assert.equal(m.balanceSheet.totalCash, 52500);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlowDirect.flows.employees, -7500);
  assert.equal(m.cashFlowDirect.flows.financing, 60000);
  assert.equal(m.cashFlowDirect.netChange, 52500);
  assert.equal(m.cashFlowDirect.ties, true);
});

test("standalone: without JSZip an .xlsx is refused with a clear message", async () => {
  const { window, $ } = boot();
  await sleep(50);
  await window.FinancialStatementMachine.readFile({ name: "nope.xlsx", arrayBuffer: async () => Buffer.from("x") });
  await sleep(20);
  assert.match($("#status").textContent, /needs JSZip|CSV/);
  assert.equal($("#status").className, "status warn");
});

test("standalone: exports fall back to CSVs and the text report has both methods", async () => {
  const { window, $ } = boot();
  await sleep(50);
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };

  $("#sample").click();
  $("#run").click();
  await sleep(50);

  $("#zip").click();
  await sleep(60);
  assert.ok(downloads.length >= 9, "one CSV per statement");
  assert.ok(downloads.some(d => /cash-flow-direct\.csv$/.test(d)));
  assert.ok(downloads.some(d => /balance-sheet\.csv$/.test(d)));

  const txt = window.StudyMateAccounting.toTextReport(window.FinancialStatementMachine.S.model, { company: "Sample Consulting Services" });
  assert.match(txt, /STATEMENT OF CASH FLOWS \(INDIRECT METHOD\)/);
  assert.match(txt, /STATEMENT OF CASH FLOWS \(DIRECT METHOD\)/);
  assert.match(txt, /Cash receipts from/);
  assert.match(txt, /167,600\.00/);

  const csv = window.StudyMateAccounting.statementToCSV(window.FinancialStatementMachine.S.model, "cash-flow-direct");
  assert.match(csv, /^Customers,42500.00$/m);
});

test("standalone: reclassifying an account updates the statements", async () => {
  const { window, document, $ } = boot();
  await sleep(50);
  $("#sample").click();
  $("#run").click();
  await sleep(50);

  const sel = document.querySelector('select[data-acct="Prepaid Insurance"]');
  assert.ok(sel);
  sel.value = "expense:operating-expense";
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  await sleep(60);

  const m = window.FinancialStatementMachine.S.model;
  assert.equal(m.balanceSheet.totalCurrentAssets, 109400, "prepaid left current assets");
  assert.equal(m.incomeStatement.totalOpex, 46400, "and became an operating expense");
  assert.equal(JSON.stringify(window.FinancialStatementMachine.S.overrides), JSON.stringify({ "Prepaid Insurance": "expense:operating-expense" }));
});

test("no template artefacts leak into the standalone tabs", async () => {
  const { document, $ } = boot();
  await sleep(50);
  $("#sample").click();
  $("#run").click();
  await sleep(50);

  const bad = [];
  document.querySelectorAll("[data-tab]").forEach(t => {
    t.click();
    const html = $("#tabBody").innerHTML;
    if (/undefined|NaN|\[object Object\]|\bnull\b/.test(html)) bad.push(t.textContent.trim());
  });
  assert.deepEqual(bad, [], "every tab renders clean markup");
});
