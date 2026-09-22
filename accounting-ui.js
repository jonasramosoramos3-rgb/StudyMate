/*
 * StudyMate Accounting Worksheet - UI layer
 * Renders the tool panel, wires input/parsing/export, and draws the statements
 * produced by accounting.js. No dependencies beyond the engine (+ JSZip for
 * .xlsx and .zip, already loaded by index.html).
 */
(function (global) {
  "use strict";
  const A = global.StudyMateAccounting;
  const LS_KEY = "studymate_accounting_v1";
  const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const STATE = {
    journal: "", adjustments: "", opening: "",
    company: "My Company", period: "", currency: "PHP", entity: "auto", base: "adjusted",
    overrides: {},
    parsed: null, adjParsed: null, model: null, tab: "income-statement"
  };

  const TABS = [
    { id: "income-statement", label: "Income Statement", icon: "📈" },
    { id: "balance-sheet", label: "Balance Sheet", icon: "⚖️" },
    { id: "equity-statement", label: "Owner's Equity", icon: "👤" },
    { id: "cash-flow", label: "Cash Flows", icon: "💵" },
    { id: "trial-balance", label: "Trial Balance", icon: "🧮" },
    { id: "worksheet", label: "Worksheet", icon: "📋" },
    { id: "ledger", label: "Ledger", icon: "📖" },
    { id: "journal", label: "Journal", icon: "🧾" },
    { id: "checks", label: "Checks", icon: "✅" }
  ];

  /* ---------------- persistence ---------------- */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        journal: STATE.journal, adjustments: STATE.adjustments, opening: STATE.opening,
        company: STATE.company, period: STATE.period, currency: STATE.currency,
        entity: STATE.entity, base: STATE.base, overrides: STATE.overrides
      }));
    } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      Object.assign(STATE, JSON.parse(raw));
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- formatting ---------------- */
  function money(v) { return A.fmtMoney(v, { currency: STATE.currency }); }
  const cell = (v, cls) => `<td class="px-2 py-1 text-right tabular-nums whitespace-nowrap ${cls || ""}">${v === null || v === undefined || v === "" ? "" : esc(v)}</td>`;

  function statementRowsHtml(rows, title, subtitle) {
    const body = rows.map(r => {
      const style = [];
      if (r.level) style.push(`padding-left:${10 + r.level * 18}px`);
      if (r.italic) style.push("font-style:italic");
      const cls = ["py-1"];
      if (r.bold) cls.push("font-bold");
      if (r.underline) cls.push("border-b");
      if (r.double) cls.push("border-b-4 border-double border-zinc-400");
      return `<tr class="${cls.join(" ")}">
        <td class="px-2 ${r.bold ? "font-semibold" : ""}" style="${style.join(";")}">${esc(r.label)}</td>
        ${cell(r.amount === null || r.amount === undefined ? "" : money(r.amount), r.bold ? "font-semibold" : "")}
      </tr>`;
    }).join("");
    return `<div class="rounded-xl border overflow-hidden">
      <div class="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b text-center">
        <div class="font-bold text-[14px] uppercase tracking-wide">${esc(STATE.company)}</div>
        <div class="text-[13px] font-semibold">${esc(title)}</div>
        <div class="text-[11px] text-zinc-500">${esc(subtitle || STATE.period || "")}</div>
      </div>
      <table class="w-full text-[12px]"><tbody>${body}</tbody></table>
    </div>`;
  }

  /* ---------------- tabs ---------------- */
  function renderResults() {
    const host = document.getElementById("acctResults");
    if (!host) return;
    if (!STATE.model) { host.innerHTML = ""; return; }
    const m = STATE.model;
    const tabs = TABS.map(t => `<button data-tab="${t.id}" class="acct-tab px-3 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${STATE.tab === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-zinc-900"}">${t.icon} ${esc(t.label)}</button>`).join("");
    host.innerHTML = `<div class="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
      <div class="flex gap-1.5 flex-wrap pb-3 border-b mb-4">${tabs}</div>
      <div id="acctTabBody"></div>
    </div>`;
    host.querySelectorAll(".acct-tab").forEach(b => b.addEventListener("click", () => { STATE.tab = b.dataset.tab; renderResults(); }));
    document.getElementById("acctTabBody").innerHTML = tabBody(m);
  }

  function tabBody(m) {
    const sub = STATE.period ? "For the period ended " + STATE.period : "";
    switch (STATE.tab) {
      case "income-statement":
        return statementRowsHtml(m.incomeStatement.rows, "Income Statement", sub);
      case "balance-sheet":
        return statementRowsHtml(m.balanceSheet.rows, "Balance Sheet", STATE.period ? "As of " + STATE.period : "");
      case "equity-statement":
        return statementRowsHtml(m.equityStatement.rows, m.equityStatement.isCorp ? "Statement of Changes in Retained Earnings" : "Statement of Changes in Owner's Equity", sub);
      case "cash-flow":
        return statementRowsHtml(m.cashFlow.rows, "Statement of Cash Flows (Indirect Method)", sub);
      case "trial-balance": return trialBalanceHtml(m);
      case "worksheet": return worksheetHtml(m);
      case "ledger": return ledgerHtml(m);
      case "journal": return journalHtml(m);
      case "checks": return checksHtml(m);
      default: return "";
    }
  }

  function trialBalanceHtml(m) {
    const tb = m.base === "unadjusted" ? m.unadjustedTB : m.adjustedTB;
    const rows = tb.rows.map(r => `<tr>
      <td class="px-2 py-1">${esc(r.name)}</td>
      <td class="px-2 py-1 text-[10px] uppercase text-zinc-400">${esc(r.type)}</td>
      ${cell(r.debit ? money(r.debit) : "")}${cell(r.credit ? money(r.credit) : "")}</tr>`).join("");
    return `<div class="rounded-xl border overflow-hidden">
      <div class="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/60 border-b text-center">
        <div class="font-bold text-[14px] uppercase tracking-wide">${esc(STATE.company)}</div>
        <div class="text-[13px] font-semibold">${m.base === "unadjusted" ? "Unadjusted" : "Adjusted"} Trial Balance</div>
        <div class="text-[11px] text-zinc-500">${esc(STATE.period ? "As of " + STATE.period : "")}</div>
      </div>
      <table class="w-full text-[12px]">
        <thead><tr class="text-[10px] uppercase text-zinc-500 border-b"><th class="text-left px-2 py-1">Account</th><th class="text-left px-2 py-1">Type</th><th class="text-right px-2 py-1">Debit</th><th class="text-right px-2 py-1">Credit</th></tr></thead>
        <tbody>${rows}
          <tr class="font-bold border-t-2"><td class="px-2 py-1">TOTALS</td><td></td>${cell(money(tb.totalDebit))}${cell(money(tb.totalCredit))}</tr>
        </tbody>
      </table>
    </div>`;
  }

  function worksheetHtml(m) {
    const w = m.worksheet;
    const head = ["Account", "Unadj. Dr", "Unadj. Cr", "Adj. Dr", "Adj. Cr", "Adj. TB Dr", "Adj. TB Cr", "IS Dr", "IS Cr", "BS Dr", "BS Cr"];
    const rows = w.rows.map(r => `<tr><td class="px-2 py-1 whitespace-nowrap">${esc(r.name)}</td>` +
      ["unDr", "unCr", "adjDr", "adjCr", "tbDr", "tbCr", "isDr", "isCr", "bsDr", "bsCr"].map(k => cell(r[k] ? money(r[k]) : "")).join("") + "</tr>").join("");
    const t = w.totals;
    return `<div class="rounded-xl border overflow-auto">
      <table class="text-[11px] whitespace-nowrap">
        <thead><tr class="text-[10px] uppercase text-zinc-500 border-b bg-zinc-50 dark:bg-zinc-800/60">${head.map(h => `<th class="text-right px-2 py-1 first:text-left">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}<tr class="font-bold border-t-2"><td class="px-2 py-1">TOTALS</td>${["unDr", "unCr", "adjDr", "adjCr", "tbDr", "tbCr", "isDr", "isCr", "bsDr", "bsCr"].map(k => cell(money(t[k]))).join("")}</tr></tbody>
      </table>
    </div>`;
  }

  function ledgerHtml(m) {
    const ledger = A.buildLedger(m);
    const cards = ledger.filter(a => a.postings.length || a.opening).map(a => {
      const rows = a.postings.map(p => `<tr class="${p.kind === "adjustment" ? "text-amber-700 dark:text-amber-400" : ""}">
        <td class="px-2 py-1 whitespace-nowrap">${esc(p.date)}</td>
        <td class="px-2 py-1">${esc(p.memo || (p.debit ? "Debit" : "Credit"))}</td>
        ${cell(p.debit ? money(p.debit) : "")}${cell(p.credit ? money(p.credit) : "")}${cell(money(p.balance))}</tr>`).join("");
      return `<details class="rounded-xl border" ${a.postings.length > 4 ? "" : "open"}>
        <summary class="cursor-pointer px-3 py-2 flex items-center justify-between gap-2">
          <span class="font-semibold text-[12px]">${esc(a.name)}</span>
          <span class="flex items-center gap-2"><span class="text-[10px] uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">${esc(a.subtype)}</span>
          <span class="text-[12px] font-mono font-bold">${money(a.balance)} ${a.normal === "debit" ? "Dr" : "Cr"}</span></span>
        </summary>
        <table class="w-full text-[11px] border-t">
          <thead><tr class="text-[10px] uppercase text-zinc-500"><th class="text-left px-2 py-1">Date</th><th class="text-left px-2 py-1">Particulars</th><th class="text-right px-2 py-1">Debit</th><th class="text-right px-2 py-1">Credit</th><th class="text-right px-2 py-1">Balance</th></tr></thead>
          <tbody>${a.opening ? `<tr class="italic text-zinc-500"><td class="px-2 py-1"></td><td class="px-2 py-1">Balance forward</td><td></td><td></td>${cell(money(a.opening))}</tr>` : ""}${rows}</tbody>
        </table>
      </details>`;
    }).join("");
    return `<div class="space-y-2">${cards || '<div class="text-[12px] text-zinc-500">No ledger activity yet.</div>'}</div>`;
  }

  function journalHtml(m) {
    const entries = m.entries.map(e => {
      const rows = e.lines.map((l, i) => `<tr>
        <td class="px-2 py-1 whitespace-nowrap">${i === 0 ? esc(e.date) : ""}</td>
        <td class="px-2 py-1" style="padding-left:${i === 0 ? 8 : 30}px">${esc(l.account)}</td>
        ${cell(l.debit ? money(l.debit) : "")}${cell(l.credit ? money(l.credit) : "")}
        <td class="px-2 py-1 text-[10px] text-zinc-500">${esc(l.memo || "")}</td></tr>`).join("");
      return `<div class="rounded-xl border overflow-hidden ${e.balanced ? "" : "border-rose-400"}">
        <div class="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border-b flex justify-between text-[10px] uppercase text-zinc-500">
          <span>Entry #${e.no}</span><span>${e.balanced ? "Balanced" : "OUT OF BALANCE by " + money(e.difference)}</span>
        </div>
        <table class="w-full text-[12px]">
          <thead><tr class="text-[10px] uppercase text-zinc-400"><th class="text-left px-2">Date</th><th class="text-left px-2">Account Titles and Explanation</th><th class="text-right px-2">Debit</th><th class="text-right px-2">Credit</th><th class="text-left px-2">Memo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    }).join("");
    const total = m.unadjustedTB ? null : null;
    const d = m.entries.reduce((s, e) => s + e.debit, 0), c = m.entries.reduce((s, e) => s + e.credit, 0);
    return `<div class="space-y-2">${entries}
      <div class="rounded-xl border p-3 flex justify-between text-[12px] font-bold bg-zinc-50 dark:bg-zinc-800/60">
        <span>Total (${m.entries.length} entries)</span><span>${money(d)} &nbsp;=&nbsp; ${money(c)} ${total}</span></div></div>`;
  }

  function checksHtml(m) {
    const badge = { ok: "bg-emerald-100 text-emerald-800", error: "bg-rose-100 text-rose-800", warn: "bg-amber-100 text-amber-800", info: "bg-sky-100 text-sky-800" };
    const icon = { ok: "✅", error: "⛔", warn: "⚠️", info: "ℹ️" };
    return `<div class="space-y-2">${m.checks.map(c => `<div class="flex items-start gap-3 rounded-xl border p-3">
      <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${badge[c.level] || badge.info}">${icon[c.level] || ""} ${esc(c.level)}</span>
      <div class="min-w-0"><div class="text-[12px] font-bold">${esc(c.label)}</div><div class="text-[12px] text-zinc-600 dark:text-zinc-300">${esc(c.message)}</div></div>
    </div>`).join("")}</div>`;
  }

  /* ---------------- account classification table ---------------- */
  function renderAccounts() {
    const host = document.getElementById("acctAccounts");
    if (!host) return;
    if (!STATE.model) { host.innerHTML = ""; return; }
    const m = STATE.model;
    const TYPES = [
      ["asset:cash", "Asset - Cash"], ["asset:current-asset", "Asset - Current"], ["asset:noncurrent-asset", "Asset - Non-current"],
      ["asset:contra-asset", "Asset - Contra (Accum. Dep.)"], ["liability:current-liability", "Liability - Current"],
      ["liability:noncurrent-liability", "Liability - Non-current"], ["equity:owner-capital", "Equity - Owner's Capital"],
      ["equity:contributed-capital", "Equity - Share Capital"], ["equity:retained-earnings", "Equity - Retained Earnings"],
      ["equity:drawings", "Equity - Drawings / Dividends"], ["equity:treasury", "Equity - Treasury"],
      ["revenue:operating-revenue", "Revenue - Operating"], ["revenue:contra-revenue", "Revenue - Contra (Returns/Discounts)"],
      ["revenue:other-revenue", "Revenue - Other / Gain"], ["expense:cogs", "Expense - Cost of Sales"],
      ["expense:operating-expense", "Expense - Operating"], ["expense:other-expense", "Expense - Other / Loss / Interest"],
      ["expense:income-tax-expense", "Expense - Income Tax"]
    ];
    const rows = m.accounts.map(a => {
      const val = `${a.type}:${a.subtype}`;
      const opts = TYPES.map(([v, label]) => `<option value="${v}" ${v === val ? "selected" : ""}>${label}</option>`).join("");
      const known = TYPES.some(([v]) => v === val);
      return `<tr class="${a.type === "unknown" ? "bg-rose-50 dark:bg-rose-950/30" : ""}">
        <td class="px-2 py-1 whitespace-nowrap">${esc(a.name)} ${a.source === "manual" ? '<span class="text-[9px] uppercase text-indigo-500">edited</span>' : ""}</td>
        <td class="px-2 py-1"><select data-acct="${esc(a.name)}" class="acct-type text-[11px] px-2 py-1 rounded-lg border bg-white dark:bg-zinc-900 w-full">${known ? opts : `<option value="${esc(val)}" selected>UNCLASSIFIED - pick a type</option>` + opts}</select></td>
        ${cell(money(a.value))}
        <td class="px-2 py-1 text-[10px] text-zinc-400">${a.normal === "debit" ? "Dr" : "Cr"}</td></tr>`;
    }).join("");
    host.innerHTML = `<details class="rounded-2xl border bg-white dark:bg-zinc-900" ${m.balanceSheet.unclassified.length ? "open" : ""}>
      <summary class="cursor-pointer px-4 py-3 flex items-center justify-between">
        <span class="text-[12px] font-bold uppercase tracking-wide">Account Types (${m.accounts.length})</span>
        <span class="text-[11px] text-zinc-500">Auto-classified - change anything that looks wrong, then recalculate</span>
      </summary>
      <div class="px-3 pb-3 overflow-auto max-h-[320px]">
        <table class="w-full text-[12px]">
          <thead><tr class="text-[10px] uppercase text-zinc-500 border-b"><th class="text-left px-2 py-1">Account</th><th class="text-left px-2 py-1">Classification</th><th class="text-right px-2 py-1">Balance</th><th class="text-left px-2 py-1">Normal</th></tr></thead>
          <tbody>${rows}</tbody></table>
        <button id="acctResetTypes" class="mt-3 text-[11px] px-3 py-1.5 rounded-full border">Reset to auto-classification</button>
      </div></details>`;
    host.querySelectorAll(".acct-type").forEach(sel => sel.addEventListener("change", () => {
      STATE.overrides[sel.dataset.acct] = sel.value;
      save(); calculate();
    }));
    const reset = document.getElementById("acctResetTypes");
    if (reset) reset.addEventListener("click", () => { STATE.overrides = {}; save(); calculate(); });
  }

  /* ---------------- compute ---------------- */
  function parseInputs() {
    STATE.parsed = A.parseJournalText(STATE.journal);
    STATE.adjParsed = STATE.adjustments.trim() ? A.parseJournalText(STATE.adjustments) : { lines: [], entries: [], warnings: [] };
  }

  function calculate() {
    parseInputs();
    if (!STATE.parsed.lines.length) {
      STATE.model = null;
      renderResults(); renderAccounts(); renderSummary();
      flash("Paste or upload your journal first.", "warn");
      return;
    }
    STATE.model = A.buildModel({
      lines: STATE.parsed.lines, entries: STATE.parsed.entries,
      adjustments: STATE.adjParsed.lines,
      opening: A.parseBalanceList(STATE.opening),
      overrides: STATE.overrides,
      entity: STATE.entity, base: STATE.base, currency: STATE.currency
    });
    save();
    renderAccounts(); renderSummary(); renderResults();
  }

  function renderSummary() {
    const host = document.getElementById("acctSummary");
    if (!host) return;
    if (!STATE.model) { host.innerHTML = ""; return; }
    const m = STATE.model;
    const errors = m.checks.filter(c => c.level === "error").length;
    const cards = [
      ["Net " + (m.incomeStatement.netIncome < 0 ? "Loss" : "Income"), money(m.incomeStatement.netIncome), m.incomeStatement.netIncome < 0 ? "text-rose-600" : "text-emerald-600"],
      ["Total Assets", money(m.balanceSheet.totalAssets), ""],
      ["Total Liabilities", money(m.balanceSheet.totalLiabilities), ""],
      ["Total Equity", money(m.balanceSheet.totalEquity), ""],
      ["Cash Flow", money(m.cashFlow.netChange), m.cashFlow.ties ? "text-emerald-600" : "text-amber-600"],
      ["Accounts", String(m.accounts.length), ""]
    ];
    host.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      ${cards.map(([label, value, cls]) => `<div class="rounded-xl border bg-white dark:bg-zinc-900 p-3">
        <div class="text-[10px] uppercase tracking-widest text-zinc-500">${esc(label)}</div>
        <div class="text-[15px] font-extrabold font-mono ${cls}">${esc(value)}</div></div>`).join("")}
    </div>
    <div class="mt-2 text-[11px] ${errors ? "text-rose-600" : "text-emerald-600"}">
      ${errors ? `⛔ ${errors} problem(s) found - open the Checks tab.` : "✅ Everything balances."}
      ${m.entity === "corporation" ? " • Corporation format" : " • Sole proprietorship format"}
      ${STATE.adjParsed.lines.length ? ` • ${STATE.adjParsed.lines.length} adjusting lines applied` : ""}
    </div>`;
  }

  function flash(msg, kind) {
    const el = document.getElementById("acctStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = "text-[11px] font-mono " + (kind === "warn" ? "text-amber-600" : kind === "error" ? "text-rose-600" : "text-emerald-600");
  }

  /* ---------------- file loading ---------------- */
  async function readFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      if (!global.JSZip) { flash("Spreadsheet support needs the JSZip library (offline copy not loaded).", "error"); return; }
      const buf = await file.arrayBuffer();
      const zip = await global.JSZip.loadAsync(buf);
      const sharedFile = zip.file("xl/sharedStrings.xml");
      const sharedXml = sharedFile ? await sharedFile.async("string") : "";
      const sheets = Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort();
      if (!sheets.length) { flash("No worksheet found in that .xlsx file.", "error"); return; }
      const sheetXml = await zip.file(sheets[0]).async("string");
      const rows = A.xlsxSheetToRows(sheetXml, sharedXml);
      const parsed = A.parseJournalRows(rows);
      fillJournalFromRows(rows, parsed, file.name);
      return;
    }
    const text = await file.text();
    if (name.endsWith(".json")) {
      try {
        const data = JSON.parse(text);
        Object.assign(STATE, {
          journal: data.journal || "", adjustments: data.adjustments || "", opening: data.opening || "",
          company: data.company || STATE.company, period: data.period || "", currency: data.currency || STATE.currency,
          entity: data.entity || "auto", overrides: data.overrides || {}
        });
        syncInputs(); calculate();
        flash("Loaded saved worksheet " + file.name);
      } catch (e) { flash("That JSON file could not be read.", "error"); }
      return;
    }
    const ta = document.getElementById("acctJournal");
    ta.value = (ta.value.trim() ? ta.value.replace(/\s*$/, "") + "\n\n" : "") + text;
    STATE.journal = ta.value;
    save(); calculate();
    flash(`Loaded ${file.name} - ${STATE.parsed.lines.length} journal lines`);
  }

  function fillJournalFromRows(rows, parsed, fileName) {
    const delim = ",";
    const text = rows.map(r => r.map(c => /[",\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(delim)).join("\n");
    const ta = document.getElementById("acctJournal");
    ta.value = text;
    STATE.journal = text;
    save(); calculate();
    flash(`Loaded ${fileName} (${rows.length} rows) - ${STATE.parsed.lines.length} journal lines read`);
  }

  /* ---------------- exports ---------------- */
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportCSV(which) {
    const csv = A.statementToCSV(STATE.model, which);
    download(`${slug(STATE.company)}-${which}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportAll() {
    const m = STATE.model;
    const parts = ["journal", "ledger", "trial-balance", "worksheet", "income-statement", "equity-statement", "balance-sheet", "cash-flow"];
    if (!global.JSZip) { parts.forEach(exportCSV); return; }
    const zip = new global.JSZip();
    parts.forEach(p => zip.file(`${slug(STATE.company)}-${p}.csv`, A.statementToCSV(m, p)));
    zip.file(`${slug(STATE.company)}-full-report.txt`, A.toTextReport(m, reportMeta()));
    zip.file(`${slug(STATE.company)}-worksheet.json`, JSON.stringify(savePayload(), null, 2));
    zip.generateAsync({ type: "blob" }).then(b => download(`${slug(STATE.company)}-financial-statements.zip`, b, "application/zip"));
  }

  function reportMeta() {
    return { company: STATE.company, period: STATE.period, totalDebit: STATE.parsed.meta.totalDebit, totalCredit: STATE.parsed.meta.totalCredit };
  }

  function savePayload() {
    return {
      company: STATE.company, period: STATE.period, currency: STATE.currency, entity: STATE.entity,
      journal: STATE.journal, adjustments: STATE.adjustments, opening: STATE.opening, overrides: STATE.overrides
    };
  }

  function slug(s) { return String(s || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company"; }

  function printReport() {
    const m = STATE.model;
    const sub = STATE.period ? "For the period ended " + esc(STATE.period) : "";
    const block = (rows, title, asOf) => `<section>
      <h2>${esc(STATE.company)}</h2><h3>${esc(title)}</h3>${asOf ? `<p class="period">${esc(asOf)}</p>` : ""}
      <table>${rows.map(r => `<tr class="${r.bold ? "b" : ""} ${r.double ? "d" : ""} ${r.underline ? "u" : ""}"><td style="padding-left:${(r.level || 0) * 22}px">${esc(r.label)}</td><td class="n">${r.amount === null || r.amount === undefined ? "" : esc(money(r.amount))}</td></tr>`).join("")}</table>
    </section>`;
    const tb = m.base === "unadjusted" ? m.unadjustedTB : m.adjustedTB;
    const tbHtml = `<section><h2>${esc(STATE.company)}</h2><h3>${m.base === "unadjusted" ? "Unadjusted" : "Adjusted"} Trial Balance</h3>
      <table><tr class="b"><td>Account</td><td class="n">Debit</td><td class="n">Credit</td></tr>
      ${tb.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${r.debit ? esc(money(r.debit)) : ""}</td><td class="n">${r.credit ? esc(money(r.credit)) : ""}</td></tr>`).join("")}
      <tr class="b d"><td>TOTALS</td><td class="n">${esc(money(tb.totalDebit))}</td><td class="n">${esc(money(tb.totalCredit))}</td></tr></table></section>`;

    const win = window.open("", "_blank");
    if (!win) { flash("Pop-up blocked - allow pop-ups to print.", "error"); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(STATE.company)} - Financial Statements</title>
      <style>
        body{font-family:Georgia,"Times New Roman",serif;color:#000;max-width:720px;margin:32px auto;padding:0 16px}
        section{page-break-inside:avoid;margin-bottom:34px}
        h2{text-align:center;font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.06em}
        h3{text-align:center;font-size:14px;margin:2px 0 0;font-weight:600}
        .period{text-align:center;font-size:12px;margin:2px 0 8px}
        table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}
        td{padding:2px 4px;vertical-align:top}
        td.n{text-align:right;width:130px;font-variant-numeric:tabular-nums}
        tr.b td{font-weight:700}
        tr.u td{border-bottom:1px solid #000}
        tr.d td{border-top:1px solid #000;border-bottom:3px double #000}
        @media print{body{margin:0}}
      </style></head><body>
      ${block(m.incomeStatement.rows, "Income Statement", sub)}
      ${block(m.equityStatement.rows, m.equityStatement.isCorp ? "Statement of Changes in Retained Earnings" : "Statement of Changes in Owner's Equity", sub)}
      ${block(m.balanceSheet.rows, "Statement of Financial Position (Balance Sheet)", STATE.period ? "As of " + esc(STATE.period) : "")}
      ${block(m.cashFlow.rows, "Statement of Cash Flows - Indirect Method", sub)}
      ${tbHtml}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
      </body></html>`);
    win.document.close();
  }

  /* ---------------- mount ---------------- */
  function mount(root) {
    if (!root) return;
    const restored = load();
    if (!STATE.journal) STATE.journal = "";

    root.innerHTML = `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-[13px] font-bold uppercase tracking-widest">🧾 Accounting Worksheet</div>
          <div class="text-[12px] text-zinc-500">Send a journal table - get the ledger, trial balance, worksheet, income statement, statement of changes in equity, balance sheet and statement of cash flows.</div>
        </div>
        <div class="flex gap-2">
          <button id="acctSample" class="text-[11px] px-3 py-1.5 rounded-full border font-semibold">Load sample month</button>
          <button id="acctClear" class="text-[11px] px-3 py-1.5 rounded-full border font-semibold">Clear all</button>
        </div>
      </div>

      <div class="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <div class="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">1 - Your journal table</div>
        <div id="acctDrop" class="rounded-xl border-[1.5px] border-dashed border-zinc-300 bg-zinc-50/70 dark:bg-zinc-800/40 p-4 text-center cursor-pointer">
          <div class="text-[12px] font-semibold">Drop .csv / .xlsx / .txt here, or click to browse</div>
          <div class="text-[11px] text-zinc-500">Copy-paste straight from Excel or Google Sheets too - tab separated works.</div>
          <input id="acctFile" type="file" accept=".csv,.txt,.tsv,.xlsx,.xlsm,.json" class="hidden">
        </div>
        <textarea id="acctJournal" class="mt-3 w-full h-[220px] p-3 rounded-xl border text-[12px] font-mono leading-[1.5]" spellcheck="false"
          placeholder="Date&#9;Account Titles and Explanation&#9;Debit&#9;Credit&#9;Memo\n2025-01-02&#9;Cash&#9;150000&#9;&#9;Owner invested cash\n2025-01-02&#9;Owner's Capital&#9;&#9;150000&#9;Owner invested cash"></textarea>
        <div class="mt-2 text-[11px] text-zinc-500">Expected columns: <b>Date</b>, <b>Account</b> / Particulars, <b>Debit</b>, <b>Credit</b>, optional Memo. A header row is optional. Classic indented journals (credits indented) work too.</div>
      </div>

      <div class="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
        ${field("Company", "acctCompany", "text", STATE.company)}
        ${field("Period ended", "acctPeriod", "text", STATE.period, "January 31, 2025")}
        ${selectField("Currency", "acctCurrency", [["PHP", "₱ Peso"], ["USD", "$ Dollar"], ["EUR", "€ Euro"], ["GBP", "£ Pound"], ["NONE", "No symbol"]], STATE.currency)}
        ${selectField("Business type", "acctEntity", [["auto", "Auto-detect"], ["sole-proprietorship", "Sole proprietorship"], ["corporation", "Corporation"]], STATE.entity)}
        ${selectField("Prepare from", "acctBase", [["adjusted", "Adjusted trial balance"], ["unadjusted", "Unadjusted trial balance"]], STATE.base)}
      </div>

      <details class="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <summary class="cursor-pointer text-[12px] font-bold uppercase tracking-widest">2 - Adjusting entries (optional)</summary>
        <div class="mt-3 text-[11px] text-zinc-500">Paste your adjusting journal entries in the same format. They are posted to produce the adjusted trial balance and the financial statements.</div>
        <textarea id="acctAdjustments" class="mt-2 w-full h-[140px] p-3 rounded-xl border text-[12px] font-mono" spellcheck="false" placeholder="Date&#9;Account Titles and Explanation&#9;Debit&#9;Credit&#9;Memo"></textarea>
      </details>

      <details class="rounded-2xl border bg-white dark:bg-zinc-900 p-4">
        <summary class="cursor-pointer text-[12px] font-bold uppercase tracking-widest">3 - Opening balances (optional)</summary>
        <div class="mt-3 text-[11px] text-zinc-500">If your journal only covers part of the year, paste the balances you started with, one per line: <code class="font-mono">Account&lt;tab&gt;Amount</code>. Amounts are on the account's normal side.</div>
        <textarea id="acctOpening" class="mt-2 w-full h-[120px] p-3 rounded-xl border text-[12px] font-mono" spellcheck="false" placeholder="Cash&#9;20000\nOwner's Capital&#9;20000"></textarea>
      </details>

      <div class="flex flex-wrap items-center gap-3">
        <button id="acctRun" class="px-6 py-3 rounded-full bg-indigo-600 text-white font-bold text-[13px]">⚡ Calculate financial statements</button>
        <div id="acctStatus" class="text-[11px] font-mono text-zinc-500"></div>
        <div class="ml-auto flex flex-wrap gap-2">
          <button id="acctPrint" class="acct-export text-[11px] px-3 py-1.5 rounded-full border font-semibold">🖨️ Print / PDF</button>
          <button id="acctCopy" class="acct-export text-[11px] px-3 py-1.5 rounded-full border font-semibold">📋 Copy report</button>
          <button id="acctZip" class="acct-export text-[11px] px-3 py-1.5 rounded-full border font-semibold">📦 Download all</button>
          <button id="acctSave" class="acct-export text-[11px] px-3 py-1.5 rounded-full border font-semibold">💾 Save</button>
        </div>
      </div>

      <div id="acctSummary"></div>
      <div id="acctAccounts"></div>
      <div id="acctResults"></div>
      <div class="rounded-2xl border bg-zinc-50/70 dark:bg-zinc-800/40 p-4 text-[11px] leading-[1.6] text-zinc-600 dark:text-zinc-300">
        <b>How it works:</b> every line is posted to a ledger, the accounts are classified (asset / liability / equity / revenue / expense) and the four statements are built from the adjusted trial balance.
        Cash flows use the <b>indirect method</b> - net income, add back depreciation, reverse gains and losses, then the change in every current asset and current liability; investing and financing come from the change in long-term assets, borrowings, capital and drawings.
        Everything runs offline in your browser - nothing is uploaded.
      </div>
    </div>`;

    function field(label, id, type, value, placeholder) {
      return `<label class="block"><span class="text-[10px] font-mono uppercase tracking-widest text-zinc-500">${label}</span>
        <input id="${id}" type="${type}" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}" class="mt-1 w-full text-[13px] px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800"></label>`;
    }
    function selectField(label, id, opts, value) {
      return `<label class="block"><span class="text-[10px] font-mono uppercase tracking-widest text-zinc-500">${label}</span>
        <select id="${id}" class="mt-1 w-full text-[13px] px-3 py-2 rounded-lg border bg-white dark:bg-zinc-800">${opts.map(([v, l]) => `<option value="${v}" ${v === value ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    }

    const $ = id => document.getElementById(id);
    const ta = $("acctJournal"), adjTa = $("acctAdjustments"), openTa = $("acctOpening");
    ta.value = STATE.journal; adjTa.value = STATE.adjustments || ""; openTa.value = STATE.opening || "";

    let t = null;
    const live = () => { clearTimeout(t); t = setTimeout(() => {
      STATE.journal = ta.value; STATE.adjustments = adjTa.value; STATE.opening = openTa.value;
      save(); calculate();
    }, 400); };
    [ta, adjTa, openTa].forEach(el => el.addEventListener("input", live));
    $("acctCompany").addEventListener("input", e => { STATE.company = e.target.value; save(); renderSummary(); renderResults(); });
    $("acctPeriod").addEventListener("input", e => { STATE.period = e.target.value; save(); renderResults(); });
    $("acctCurrency").addEventListener("change", e => { STATE.currency = e.target.value; save(); calculate(); });
    $("acctEntity").addEventListener("change", e => { STATE.entity = e.target.value; save(); calculate(); });
    $("acctBase").addEventListener("change", e => { STATE.base = e.target.value; save(); calculate(); });

    $("acctRun").addEventListener("click", () => {
      STATE.journal = ta.value; STATE.adjustments = adjTa.value; STATE.opening = openTa.value;
      calculate();
      if (STATE.model) {
        const n = STATE.model.checks.filter(c => c.level === "error").length;
        flash(n ? `Done with ${n} error(s) - check the Checks tab.` : `Done - ${STATE.model.accounts.length} accounts, ${STATE.model.entries.length} entries, net income ${money(STATE.model.incomeStatement.netIncome)}.`, n ? "error" : "ok");
        document.getElementById("acctSummary").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    $("acctSample").addEventListener("click", () => {
      ta.value = A.SAMPLE_JOURNAL; adjTa.value = A.SAMPLE_ADJUSTMENTS; openTa.value = "";
      STATE.journal = ta.value; STATE.adjustments = adjTa.value; STATE.opening = "";
      STATE.company = "Sample Consulting Services"; STATE.period = "January 31, 2025";
      $("acctCompany").value = STATE.company; $("acctPeriod").value = STATE.period;
      STATE.overrides = {};
      calculate(); flash("Sample month loaded - all statements recalculated.", "ok");
    });

    $("acctClear").addEventListener("click", () => {
      if (!confirm("Clear the journal, adjustments and saved worksheet?")) return;
      STATE.journal = ""; STATE.adjustments = ""; STATE.opening = ""; STATE.overrides = {}; STATE.model = null; STATE.parsed = null;
      ta.value = ""; adjTa.value = ""; openTa.value = "";
      save(); renderAccounts(); renderSummary(); renderResults(); flash("Cleared.");
    });

    const drop = $("acctDrop"), fileInput = $("acctFile");
    drop.addEventListener("click", () => fileInput.click());
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("border-indigo-500", "bg-indigo-50/60"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("border-indigo-500", "bg-indigo-50/60"));
    drop.addEventListener("drop", e => {
      e.preventDefault(); drop.classList.remove("border-indigo-500", "bg-indigo-50/60");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f).catch(err => flash("Could not read that file: " + err.message, "error"));
    });
    fileInput.addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) readFile(f).catch(err => flash("Could not read that file: " + err.message, "error")); e.target.value = ""; });

    $("acctPrint").addEventListener("click", () => { if (STATE.model) printReport(); else flash("Calculate first.", "warn"); });
    $("acctCopy").addEventListener("click", async () => {
      if (!STATE.model) return flash("Calculate first.", "warn");
      const txt = A.toTextReport(STATE.model, reportMeta());
      try { await navigator.clipboard.writeText(txt); flash("Full report copied to the clipboard.", "ok"); }
      catch (e) {
        const box = document.createElement("textarea");
        box.value = txt; document.body.appendChild(box); box.select(); document.execCommand("copy"); box.remove();
        flash("Full report copied.", "ok");
      }
    });
    $("acctZip").addEventListener("click", () => { if (STATE.model) exportAll(); else flash("Calculate first.", "warn"); });
    $("acctSave").addEventListener("click", () => {
      download(slug(STATE.company) + "-worksheet.json", JSON.stringify(savePayload(), null, 2), "application/json");
      flash("Worksheet saved - drop the .json back in any time to restore it.", "ok");
    });

    function syncInputs() {
      ta.value = STATE.journal || ""; adjTa.value = STATE.adjustments || ""; openTa.value = STATE.opening || "";
      $("acctCompany").value = STATE.company || ""; $("acctPeriod").value = STATE.period || "";
      $("acctCurrency").value = STATE.currency || "PHP"; $("acctEntity").value = STATE.entity || "auto";
      $("acctBase").value = STATE.base || "adjusted";
    }
    root._syncInputs = syncInputs;
    window.__acctSyncInputs = syncInputs;

    if (STATE.journal) { calculate(); flash(restored ? "Restored your last worksheet." : "", "ok"); }
    else flash("Ready - paste a journal or load the sample.", "ok");
  }

  function syncInputs() { if (window.__acctSyncInputs) window.__acctSyncInputs(); }

  global.StudyMateAccountingUI = { mount, syncInputs, STATE, readFile };
})(typeof window !== "undefined" ? window : globalThis);
