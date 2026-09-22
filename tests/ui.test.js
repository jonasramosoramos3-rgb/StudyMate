/*
 * Browser-level integration test: loads the real index.html in jsdom, runs the
 * real accounting.js + accounting-ui.js + app.js, clicks through the tool and
 * checks the numbers that actually get drawn on screen.
 *
 * Run with:  npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function bootApp() {
  const dom = new JSDOM(read("index.html"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost:8000/"
  });
  const { window } = dom;
  // bits jsdom does not implement that the app touches
  window.Element.prototype.scrollIntoView = function () {};
  window.HTMLCanvasElement.prototype.getContext = function () { return null; };
  window.URL.createObjectURL = () => "blob:mock";
  window.URL.revokeObjectURL = () => {};
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.addEventListener("error", e => { throw e.error || new Error(String(e.message)); });

  for (const f of ["accounting.js", "accounting-ui.js", "app.js"]) window.eval(read(f));
  await sleep(60);
  return { window, document: window.document, $: s => window.document.querySelector(s) };
}

test("index.html wires the accounting tool up", async () => {
  const { document } = await bootApp();
  const card = document.querySelector('[data-tool="accounting"]');
  assert.ok(card, "the tool card exists in the sidebar");
  assert.match(card.textContent, /Accounting Worksheet/);
  const scripts = Array.from(document.querySelectorAll("script[src]")).map(s => s.getAttribute("src"));
  assert.ok(scripts.includes("./accounting.js"), "engine is loaded before app.js");
  assert.ok(scripts.includes("./accounting-ui.js"));
  assert.ok(scripts.indexOf("./accounting.js") < scripts.indexOf("./app.js"));
});

test("clicking the tool mounts the panel and the sample month produces the statements", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);

  assert.ok($("#acctRoot").children.length, "panel mounted");
  assert.ok($("#acctJournal"), "journal textarea present");
  assert.equal($("#dropZone").style.display, "none", "the generic file dropzone is hidden for form tools");

  $("#acctSample").click();
  await sleep(80);
  $("#acctRun").click();
  await sleep(80);

  const ui = window.StudyMateAccountingUI;
  const m = ui.STATE.model;
  assert.ok(m, "a model was built");
  assert.equal(m.incomeStatement.netIncome, 14100);
  assert.equal(m.balanceSheet.totalAssets, 167600);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlow.ties, true);
  assert.equal(m.checks.filter(c => c.level === "error").length, 0);

  // summary cards
  assert.match($("#acctSummary").textContent, /14,100\.00/);
  assert.match($("#acctSummary").textContent, /167,600\.00/);
  assert.match($("#acctSummary").textContent, /Everything balances/);

  // income statement tab is the default view
  assert.match($("#acctTabBody").textContent, /NET INCOME/);
  assert.match($("#acctTabBody").textContent, /Service Revenue/);
  assert.match($("#acctTabBody").textContent, /₱14,100\.00/);
});

test("every tab renders, and the numbers match the engine", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  $("#acctRun").click();
  await sleep(80);

  const click = label => {
    const btn = Array.from(document.querySelectorAll(".acct-tab")).find(b => b.textContent.includes(label));
    assert.ok(btn, `tab ${label} exists`);
    btn.click();
    return $("#acctTabBody");
  };

  assert.match(click("Balance Sheet").textContent, /TOTAL ASSETS/);
  assert.match($("#acctTabBody").textContent, /₱167,600\.00/);
  assert.match($("#acctTabBody").textContent, /Less: Accumulated Depreciation/);

  assert.match(click("Owner's Equity").textContent, /Owner's Capital, ending/);
  assert.match($("#acctTabBody").textContent, /₱159,100\.00/);

  assert.match(click("Cash Flows").textContent, /Net cash provided by operating activities/);
  assert.match($("#acctTabBody").textContent, /Depreciation and amortization expense/);
  assert.match($("#acctTabBody").textContent, /Cash at end of period/);

  const tb = click("Trial Balance");
  assert.match(tb.textContent, /Adjusted Trial Balance/);
  assert.match(tb.textContent, /208,800\.00/);

  assert.match(click("Worksheet").textContent, /TOTALS/);
  assert.match(click("Ledger").textContent, /Accumulated Depreciation - Office Equipment/);
  assert.match(click("Journal").textContent, /Entry #1/);
  assert.match($("#acctTabBody").textContent, /Balanced/);

  const checks = click("Checks");
  assert.match(checks.textContent, /Balance sheet/);
  assert.doesNotMatch(checks.textContent, /⛔/);
  assert.equal(window.StudyMateAccountingUI.STATE.tab, "checks");
});

test("typing a journal into the box recalculates on its own", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);

  $("#acctJournal").value = [
    "Date\tAccount\tDebit\tCredit",
    "2025-05-01\tCash\t9000\t",
    "2025-05-01\tOwner's Capital\t\t9000",
    "2025-05-10\tRent Expense\t1500\t",
    "2025-05-10\tCash\t\t1500"
  ].join("\n");
  $("#acctJournal").dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(600); // debounce is 400ms

  const m = window.StudyMateAccountingUI.STATE.model;
  assert.ok(m, "auto-calculated");
  assert.equal(m.incomeStatement.netIncome, -1500, "a net loss");
  assert.equal(m.balanceSheet.totalCash, 7500);
  assert.equal(m.balanceSheet.balanced, true);
  assert.match($("#acctSummary").textContent, /Net Loss/);
});

test("reclassifying an account in the UI moves it on the statements", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  $("#acctRun").click();
  await sleep(80);

  const before = window.StudyMateAccountingUI.STATE.model.balanceSheet.totalCurrentAssets;
  assert.equal(before, 120400);

  const sel = document.querySelector('select[data-acct="Supplies"]');
  assert.ok(sel, "the Supplies account has an editable classification");
  sel.value = "expense:operating-expense";
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  await sleep(80);

  const after = window.StudyMateAccountingUI.STATE.model;
  assert.equal(after.balanceSheet.totalCurrentAssets, 116800, "Supplies left current assets");
  assert.equal(after.incomeStatement.totalOpex, 39000, "and became an operating expense (35,400 + 3,600 remaining supplies)");
  assert.equal(JSON.stringify(window.StudyMateAccountingUI.STATE.overrides), JSON.stringify({ "Supplies": "expense:operating-expense" }), "the override is remembered");
});

test("exports produce real files", async () => {
  const { window, document, $ } = await bootApp();
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };

  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  $("#acctRun").click();
  await sleep(80);

  const csv = window.StudyMateAccounting.statementToCSV(window.StudyMateAccountingUI.STATE.model, "balance-sheet");
  assert.match(csv, /TOTAL ASSETS,167600.00/);

  const txt = window.StudyMateAccounting.toTextReport(window.StudyMateAccountingUI.STATE.model, { company: "Sample Consulting Services", period: "January 31, 2025" });
  assert.match(txt, /BALANCE SHEET/);
  assert.match(txt, /167,600.00/);

  // the ZIP export path (JSZip is not loaded in jsdom, so it must fall back to CSVs)
  $("#acctZip").click();
  await sleep(120);
  assert.ok(downloads.length >= 8, "fell back to downloading each statement as CSV");
  assert.ok(downloads.some(d => /balance-sheet\.csv$/.test(d)));
  assert.ok(downloads.some(d => /cash-flow\.csv$/.test(d)));
});

test("the worksheet survives a reload through localStorage", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  await sleep(80);
  const saved = window.localStorage.getItem("studymate_accounting_v1");
  assert.ok(saved && saved.length > 500, "the worksheet was persisted");
  assert.match(saved, /Cash\\t150000/);
  assert.match(saved, /Sample Consulting Services/);
});

/* -------- the real "send a journal table" flow: an .xlsx workbook -------- */

function buildXlsx() {
  const JSZip = require("jszip");
  const strings = ["Date", "Account Titles and Explanation", "Debit", "Credit", "Memo",
    "2025-06-01", "Cash", "Owner's Capital", "2025-06-15", "Service Revenue",
    "Owner invested cash", "Cash services rendered", "Rent Expense", "Paid office rent"];
  const shared = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s => `<si><t>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`;

  const s = (ref, i) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
  const n = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1">${s("A1", 0)}${s("B1", 1)}${s("C1", 2)}${s("D1", 3)}${s("E1", 4)}</row>
<row r="2">${s("A2", 5)}${s("B2", 6)}${n("C2", 80000)}${s("E2", 10)}</row>
<row r="3">${s("A3", 5)}${s("B3", 7)}${n("D3", 80000)}${s("E3", 10)}</row>
<row r="4">${s("A4", 8)}${s("B4", 9)}${n("D4", 12000)}${s("E4", 11)}</row>
<row r="5">${s("A5", 8)}${s("B5", 6)}${n("C5", 12000)}${s("E5", 11)}</row>
<row r="6">${s("A6", 8)}${s("B6", 12)}${n("C6", 3000)}${s("E6", 13)}</row>
<row r="7">${s("A7", 8)}${s("B7", 6)}${n("D7", 3000)}${s("E7", 13)}</row>
</sheetData></worksheet>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Journal" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></sheets></workbook>');
  zip.file("xl/sharedStrings.xml", shared);
  zip.file("xl/worksheets/sheet1.xml", sheet);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("dropping an .xlsx journal builds the whole set of statements", async () => {
  const { window, document, $ } = await bootApp();
  window.JSZip = require("jszip");
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);

  const buf = await buildXlsx();
  await window.StudyMateAccountingUI.readFile({ name: "june-journal.xlsx", arrayBuffer: async () => buf });
  await sleep(80);

  const m = window.StudyMateAccountingUI.STATE.model;
  assert.ok(m, "statements were built straight from the workbook");
  assert.match($("#acctStatus").textContent, /Loaded june-journal.xlsx \(7 rows\) - 6 journal lines read/);
  assert.equal(m.entries.length, 3);
  assert.equal(m.incomeStatement.netIncome, 9000);
  assert.equal(m.balanceSheet.totalCash, 89000);
  assert.equal(m.balanceSheet.totalAssets, 89000);
  assert.equal(m.balanceSheet.totalEquity, 89000);
  assert.equal(m.balanceSheet.balanced, true);
  assert.equal(m.cashFlow.ties, true);
  assert.equal(m.cashFlow.financing, 80000);
  assert.equal(m.checks.filter(c => c.level === "error").length, 0);
  assert.match($("#acctTabBody").textContent, /₱9,000\.00/);
});

test("dropping a .csv journal works too", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);

  const csv = "Date,Account Titles,Debit,Credit\n2025-07-01,Cash,50000,\n2025-07-01,Owner's Capital,,50000\n2025-07-20,Utilities Expense,850,\n2025-07-20,Cash,,850\n";
  const buf = Buffer.from(csv, "utf8");
  await window.StudyMateAccountingUI.readFile({ name: "july.csv", text: async () => csv, arrayBuffer: async () => buf });
  await sleep(80);

  const m = window.StudyMateAccountingUI.STATE.model;
  assert.equal(m.entries.length, 2);
  assert.equal(m.incomeStatement.netIncome, -850);
  assert.equal(m.balanceSheet.totalCash, 49150);
  assert.equal(m.balanceSheet.balanced, true);
  assert.match($("#acctStatus").textContent, /Loaded july.csv - 4 journal lines/);
});

test("cash flow tab switches between indirect, direct and both", async () => {
  const { window, document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  $("#acctRun").click();
  await sleep(80);

  const tab = Array.from(document.querySelectorAll(".acct-tab")).find(b => b.textContent.includes("Cash Flows"));
  tab.click();
  await sleep(20);
  assert.match($("#acctTabBody").textContent, /Indirect Method/);
  assert.match($("#acctTabBody").textContent, /Depreciation and amortization expense/);

  const pick = label => {
    const b = Array.from(document.querySelectorAll("[data-cf]")).find(x => x.textContent.trim() === label);
    assert.ok(b, `cash flow toggle "${label}" exists`);
    b.click();
  };

  pick("Direct method");
  await sleep(20);
  const direct = $("#acctTabBody").textContent;
  assert.match(direct, /Direct Method/);
  assert.match(direct, /Cash receipts from:/);
  assert.match(direct, /₱42,500\.00/);
  assert.match(direct, /Total cash payments/);
  assert.doesNotMatch(direct, /Depreciation and amortization/);
  assert.doesNotMatch(direct, /Net Income/);
  assert.equal(window.StudyMateAccountingUI.STATE.cfMethod, "direct");

  pick("Both");
  await sleep(20);
  const both = $("#acctTabBody").textContent;
  assert.match(both, /Indirect Method/);
  assert.match(both, /Direct Method/);
  assert.match(both, /Net cash provided by operating activities/);
});

test("no template artefacts leak into the rendered tabs", async () => {
  const { document, $ } = await bootApp();
  document.querySelector('[data-tool="accounting"]').click();
  await sleep(250);
  $("#acctSample").click();
  $("#acctRun").click();
  await sleep(80);

  const bad = [];
  document.querySelectorAll(".acct-tab").forEach(t => {
    t.click();
    const html = $("#acctTabBody").innerHTML;
    if (/undefined|NaN|\[object Object\]|\bnull\b/.test(html)) bad.push(t.textContent.trim());
  });
  assert.deepEqual(bad, [], "every tab renders clean markup");
  const journal = Array.from(document.querySelectorAll(".acct-tab")).find(b => b.textContent.includes("Journal"));
  journal.click();
  assert.match($("#acctTabBody").textContent, /Total \(13 entries\)\s*₱320,700.00\s*=\s*₱320,700.00/);
});
