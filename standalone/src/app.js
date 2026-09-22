/*
 * Financial Statement Machine - standalone UI
 * Works against the StudyMate accounting engine (inlined above this file).
 * No framework, no CDN required. Optional: JSZip, if present, adds .xlsx input
 * and a single-ZIP export.
 */
(function (global) {
  "use strict";
  const A = global.StudyMateAccounting;
  const KEY = "fsm_worksheet_v1";
  const esc = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const S = {
    journal: "", adjustments: "", opening: "",
    company: "My Company", period: "", currency: "PHP", entity: "auto", base: "adjusted",
    overrides: {}, cfMethod: "indirect", tab: "income-statement", model: null, parsed: null, adjParsed: null
  };

  const TABS = [
    ["income-statement", "📈 Income Statement"],
    ["balance-sheet", "⚖️ Balance Sheet"],
    ["equity-statement", "👤 Owner's Equity"],
    ["cash-flow", "💵 Cash Flows"],
    ["trial-balance", "🧮 Trial Balance"],
    ["worksheet", "📋 Worksheet"],
    ["ledger", "📖 Ledger"],
    ["journal", "🧾 Journal"],
    ["checks", "✅ Checks"]
  ];

  /* ---------------- helpers ---------------- */
  const $ = id => document.getElementById(id);
  const money = v => A.fmtMoney(v, { currency: S.currency });
  const td = (v, extra) => `<td class="n ${extra || ""}">${v === null || v === undefined || v === "" ? "" : esc(v)}</td>`;
  const slug = s => String(s || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        journal: S.journal, adjustments: S.adjustments, opening: S.opening, company: S.company,
        period: S.period, currency: S.currency, entity: S.entity, base: S.base,
        overrides: S.overrides, cfMethod: S.cfMethod
      }));
    } catch (e) { /* storage blocked */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(S, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }
  function flash(msg, kind) {
    const el = $("status");
    el.textContent = msg || "";
    el.className = "status " + (kind || "");
  }

  /* ---------------- statement rendering ---------------- */
  function sheet(rows, title, period) {
    const body = rows.map(r => {
      const cls = [r.bold ? "b" : "", r.underline ? "u" : "", r.double ? "d" : ""].join(" ");
      const pad = 8 + (r.level || 0) * 20;
      return `<tr class="${cls}"><td style="padding-left:${pad}px${r.italic ? ";font-style:italic" : ""}">${esc(r.label)}</td>${td(r.amount === null || r.amount === undefined ? "" : money(r.amount))}</tr>`;
    }).join("");
    return `<div class="sheet"><div class="head"><div class="co">${esc(S.company)}</div><div class="ti">${esc(title)}</div>${period ? `<div class="pe">${esc(period)}</div>` : ""}</div><table class="st"><tbody>${body}</tbody></table></div>`;
  }

  function tabBody() {
    const m = S.model;
    const sub = S.period ? "For the period ended " + S.period : "";
    const asOf = S.period ? "As of " + S.period : "";
    switch (S.tab) {
      case "income-statement": return sheet(m.incomeStatement.rows, "Income Statement", sub);
      case "balance-sheet": return sheet(m.balanceSheet.rows, "Statement of Financial Position (Balance Sheet)", asOf);
      case "equity-statement": return sheet(m.equityStatement.rows, m.equityStatement.isCorp ? "Statement of Changes in Retained Earnings" : "Statement of Changes in Owner's Equity", sub);
      case "cash-flow": return cashFlowHtml(sub);
      case "trial-balance": return trialBalanceHtml();
      case "worksheet": return worksheetHtml();
      case "ledger": return ledgerHtml();
      case "journal": return journalHtml();
      case "checks": return checksHtml();
      default: return "";
    }
  }

  function cashFlowHtml(sub) {
    const m = S.model;
    const opts = [["indirect", "Indirect method"], ["direct", "Direct method"], ["both", "Both side by side"]];
    const toggle = `<div class="row" style="margin-bottom:12px">${opts.map(([v, l]) => `<button data-cf="${v}" class="${S.cfMethod === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const out = [];
    if (S.cfMethod !== "direct") out.push(sheet(m.cashFlow.rows, "Statement of Cash Flows (Indirect Method)", sub));
    if (S.cfMethod !== "indirect") out.push(sheet(m.cashFlowDirect.rows, "Statement of Cash Flows (Direct Method)", sub));
    return toggle + `<div class="grid" style="gap:14px">${out.join("")}</div>`;
  }

  function trialBalanceHtml() {
    const m = S.model;
    const tb = m.base === "unadjusted" ? m.unadjustedTB : m.adjustedTB;
    const rows = tb.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="led">${esc(r.type)}</td>${td(r.debit ? money(r.debit) : "")}${td(r.credit ? money(r.credit) : "")}</tr>`).join("");
    return `<div class="sheet"><div class="head"><div class="co">${esc(S.company)}</div><div class="ti">${m.base === "unadjusted" ? "Unadjusted" : "Adjusted"} Trial Balance</div>${S.period ? `<div class="pe">${esc("As of " + S.period)}</div>` : ""}</div>
      <div class="scroll"><table class="st"><thead><tr><th>Account</th><th>Type</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>${rows}
      <tr class="b d"><td>TOTALS</td><td></td>${td(money(tb.totalDebit))}${td(money(tb.totalCredit))}</tr></tbody></table></div></div>`;
  }

  function worksheetHtml() {
    const w = S.model.worksheet;
    const keys = ["unDr", "unCr", "adjDr", "adjCr", "tbDr", "tbCr", "isDr", "isCr", "bsDr", "bsCr"];
    const head = ["Account", "Unadj Dr", "Unadj Cr", "Adj Dr", "Adj Cr", "TB Dr", "TB Cr", "IS Dr", "IS Cr", "BS Dr", "BS Cr"];
    const rows = w.rows.map(r => `<tr><td>${esc(r.name)}</td>${keys.map(k => td(r[k] ? money(r[k]) : "")).join("")}</tr>`).join("");
    return `<div class="sheet"><div class="head"><div class="co">${esc(S.company)}</div><div class="ti">10-Column Worksheet</div></div>
      <div class="scroll"><table class="grid-t"><thead><tr>${head.map(h => `<th class="${h === "Account" ? "" : "n"}">${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}<tr class="b"><td>TOTALS</td>${keys.map(k => td(money(w.totals[k]))).join("")}</tr></tbody></table></div></div>`;
  }

  function ledgerHtml() {
    const ledger = A.buildLedger(S.model).filter(a => a.postings.length || a.opening);
    return ledger.map(a => `<details class="box" ${a.postings.length > 4 ? "" : "open"}>
      <summary>${esc(a.name)} &nbsp;<span class="led">${esc(a.subtype)}</span> &nbsp;<b>${money(a.balance)} ${a.normal === "debit" ? "Dr" : "Cr"}</b></summary>
      <div class="body scroll"><table class="st"><thead><tr><th>Date</th><th>Particulars</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>
      ${a.opening ? `<tr><td></td><td class="led">Balance forward</td><td class="n"></td><td class="n"></td>${td(money(a.opening))}</tr>` : ""}
      ${a.postings.map(p => `<tr${p.kind === "adjustment" ? ' style="color:var(--warn)"' : ""}><td class="led">${esc(p.date)}</td><td>${esc(p.memo || (p.debit ? "Debit" : "Credit"))}</td>${td(p.debit ? money(p.debit) : "")}${td(p.credit ? money(p.credit) : "")}${td(money(p.balance))}</tr>`).join("")}
      </tbody></table></div></details>`).join("") || '<p class="hint">No ledger activity yet.</p>';
  }

  function journalHtml() {
    const m = S.model;
    const rows = m.entries.map(e => `<div class="sheet" style="margin-bottom:10px">
      <div class="head" style="display:flex;justify-content:space-between;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">
        <span>Entry #${e.no} &nbsp; ${esc(e.date)}</span><span>${e.balanced ? "Balanced" : "OUT OF BALANCE by " + money(e.difference)}</span></div>
      <div class="scroll"><table class="st"><thead><tr><th>Account Titles and Explanation</th><th class="n">Debit</th><th class="n">Credit</th><th>Memo</th></tr></thead><tbody>
      ${e.lines.map((l, i) => `<tr><td style="padding-left:${i === 0 ? 10 : 34}px">${esc(l.account)}</td>${td(l.debit ? money(l.debit) : "")}${td(l.credit ? money(l.credit) : "")}<td class="led">${esc(l.memo || "")}</td></tr>`).join("")}
      </tbody></table></div></div>`).join("");
    const d = m.entries.reduce((s, e) => s + e.debit, 0), c = m.entries.reduce((s, e) => s + e.credit, 0);
    return rows + `<div class="card row spread"><b>Total &mdash; ${m.entries.length} entries</b><b>${money(d)} &nbsp;=&nbsp; ${money(c)}</b></div>`;
  }

  function checksHtml() {
    const icon = { ok: "OK", warn: "Warning", error: "Error", info: "Info" };
    return S.model.checks.map(c => `<div class="check ${c.level}"><span class="lv">${icon[c.level] || c.level}</span><div><b>${esc(c.label)}</b><p>${esc(c.message)}</p></div></div>`).join("");
  }

  /* ---------------- account types ---------------- */
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

  function renderAccounts() {
    const host = $("accounts");
    if (!S.model) { host.innerHTML = ""; return; }
    const rows = S.model.accounts.map(a => {
      const val = `${a.type}:${a.subtype}`;
      const known = TYPES.some(([v]) => v === val);
      const opts = TYPES.map(([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${l}</option>`).join("");
      return `<tr class="${a.type === "unknown" ? "bad" : ""}"><td>${esc(a.name)}${a.source === "manual" ? ' <span class="led">(edited)</span>' : ""}</td>
        <td><select class="acct" data-acct="${esc(a.name)}">${known ? opts : `<option value="${esc(val)}" selected>UNCLASSIFIED - pick a type</option>` + opts}</select></td>
        ${td(money(a.value))}<td class="led">${a.normal === "debit" ? "Dr" : "Cr"}</td></tr>`;
    }).join("");
    host.innerHTML = `<details class="box"${S.model.balanceSheet.unclassified.length ? " open" : ""}>
      <summary>Account types (${S.model.accounts.length}) - edit anything that looks wrong</summary>
      <div class="body scroll" style="max-height:340px"><table class="st"><thead><tr><th>Account</th><th>Classification</th><th class="n">Balance</th><th>Normal</th></tr></thead><tbody>${rows}</tbody></table>
      <button id="resetTypes" class="ghost" style="margin-top:10px">Reset to auto-classification</button></div></details>`;
    host.querySelectorAll(".acct").forEach(sel => sel.addEventListener("change", () => {
      S.overrides[sel.dataset.acct] = sel.value; save(); calculate();
    }));
    $("resetTypes").addEventListener("click", () => { S.overrides = {}; save(); calculate(); });
  }

  function renderSummary() {
    const host = $("summary");
    if (!S.model) { host.innerHTML = ""; return; }
    const m = S.model;
    const errs = m.checks.filter(c => c.level === "error").length;
    const cards = [
      ["Net " + (m.incomeStatement.netIncome < 0 ? "Loss" : "Income"), m.incomeStatement.netIncome, m.incomeStatement.netIncome < 0 ? "neg" : "pos"],
      ["Total Assets", m.balanceSheet.totalAssets, ""],
      ["Total Liabilities", m.balanceSheet.totalLiabilities, ""],
      ["Total Equity", m.balanceSheet.totalEquity, ""],
      ["Operating cash flow", m.cashFlow.operating, m.cashFlow.ties ? "pos" : "neg"],
      ["Net change in cash", m.cashFlow.netChange, ""]
    ];
    host.innerHTML = `<div class="cards">${cards.map(([l, v, c]) => `<div class="stat"><span>${esc(l)}</span><b class="${c}">${esc(money(v))}</b></div>`).join("")}</div>
      <p class="hint">${errs ? `⛔ ${errs} problem(s) - see the Checks tab.` : "✅ Everything balances."}
      ${m.entity === "corporation" ? "Corporation format" : "Sole proprietorship format"} &middot; ${m.accounts.length} accounts &middot; ${m.entries.length} journal entries
      ${S.adjParsed && S.adjParsed.lines.length ? `&middot; ${S.adjParsed.lines.length} adjusting lines` : ""}
      ${Object.keys(S.overrides).length ? `&middot; ${Object.keys(S.overrides).length} manual classification(s)` : ""}</p>`;
  }

  function renderTabs() {
    const host = $("results");
    if (!S.model) { host.innerHTML = '<p class="hint">No statements yet - paste a journal above (or load the sample) and press Calculate.</p>'; return; }
    host.innerHTML = `<div class="card"><div class="tabs">${TABS.map(([id, label]) => `<button data-tab="${id}" class="${S.tab === id ? "on" : ""}">${label}</button>`).join("")}</div><div id="tabBody"></div></div>`;
    host.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { S.tab = b.dataset.tab; renderTabs(); }));
    const body = $("tabBody");
    body.innerHTML = tabBody();
    body.querySelectorAll("[data-cf]").forEach(b => b.addEventListener("click", () => { S.cfMethod = b.dataset.cf; save(); renderTabs(); }));
  }

  /* ---------------- calculate ---------------- */
  function calculate() {
    S.parsed = A.parseJournalText(S.journal);
    S.adjParsed = S.adjustments.trim() ? A.parseJournalText(S.adjustments) : { lines: [], entries: [], warnings: [] };
    if (!S.parsed.lines.length) {
      S.model = null;
      renderSummary(); renderAccounts(); renderTabs();
      return;
    }
    S.model = A.buildModel({
      lines: S.parsed.lines, entries: S.parsed.entries, adjustments: S.adjParsed.lines,
      opening: A.parseBalanceList(S.opening), overrides: S.overrides,
      entity: S.entity, base: S.base, currency: S.currency
    });
    save();
    renderSummary(); renderAccounts(); renderTabs();
  }

  /* ---------------- files ---------------- */
  async function readFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      if (!global.JSZip) { flash("Spreadsheet input needs JSZip - either go online once or export the sheet as CSV.", "warn"); return; }
      const zip = await global.JSZip.loadAsync(await file.arrayBuffer());
      const sharedFile = zip.file("xl/sharedStrings.xml");
      const shared = sharedFile ? await sharedFile.async("string") : "";
      const sheets = Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)).sort();
      if (!sheets.length) { flash("No worksheet found in that file.", "err"); return; }
      const rows = A.xlsxSheetToRows(await zip.file(sheets[0]).async("string"), shared);
      setJournal(rows.map(r => r.map(c => /[",\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(",")).join("\n"));
      flash(`Loaded ${file.name} - ${S.parsed.lines.length} journal lines`, "ok");
      return;
    }
    const text = await file.text();
    if (name.endsWith(".json")) {
      try {
        const d = JSON.parse(text);
        Object.assign(S, {
          journal: d.journal || "", adjustments: d.adjustments || "", opening: d.opening || "",
          company: d.company || S.company, period: d.period || "", currency: d.currency || S.currency,
          entity: d.entity || "auto", base: d.base || "adjusted", overrides: d.overrides || {}
        });
        syncInputs(); calculate(); flash("Worksheet restored from " + file.name, "ok");
      } catch (e) { flash("That JSON file could not be read.", "err"); }
      return;
    }
    setJournal(S.journal.trim() ? S.journal.replace(/\s+$/, "") + "\n\n" + text : text);
    flash(`Loaded ${file.name} - ${S.parsed.lines.length} journal lines`, "ok");
  }

  function setJournal(text) {
    S.journal = text;
    $("journal").value = text;
    save(); calculate();
  }

  /* ---------------- exports ---------------- */
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const PARTS = ["journal", "ledger", "trial-balance", "worksheet", "income-statement", "equity-statement", "balance-sheet", "cash-flow", "cash-flow-direct"];
  const meta = () => ({ company: S.company, period: S.period, totalDebit: S.parsed.meta.totalDebit, totalCredit: S.parsed.meta.totalCredit });
  const payload = () => ({ company: S.company, period: S.period, currency: S.currency, entity: S.entity, base: S.base, journal: S.journal, adjustments: S.adjustments, opening: S.opening, overrides: S.overrides });

  function exportAll() {
    if (!S.model) return flash("Calculate first.", "warn");
    if (!global.JSZip) {
      PARTS.forEach(p => download(`${slug(S.company)}-${p}.csv`, A.statementToCSV(S.model, p), "text/csv;charset=utf-8"));
      flash("Downloaded " + PARTS.length + " CSV files (JSZip not loaded, so no single ZIP).", "ok");
      return;
    }
    const zip = new global.JSZip();
    PARTS.forEach(p => zip.file(`${slug(S.company)}-${p}.csv`, A.statementToCSV(S.model, p)));
    zip.file(`${slug(S.company)}-full-report.txt`, A.toTextReport(S.model, meta()));
    zip.file(`${slug(S.company)}-worksheet.json`, JSON.stringify(payload(), null, 2));
    zip.generateAsync({ type: "blob" }).then(b => { download(`${slug(S.company)}-financial-statements.zip`, b, "application/zip"); flash("ZIP downloaded.", "ok"); });
  }

  function printReport() {
    if (!S.model) return flash("Calculate first.", "warn");
    const m = S.model;
    const sub = S.period ? "For the period ended " + esc(S.period) : "";
    const asOf = S.period ? "As of " + esc(S.period) : "";
    const block = (rows, title, when) => `<section><h2>${esc(S.company)}</h2><h3>${esc(title)}</h3>${when ? `<p class="pe">${esc(when)}</p>` : ""}
      <table>${rows.map(r => `<tr class="${r.bold ? "b" : ""} ${r.underline ? "u" : ""} ${r.double ? "d" : ""}"><td style="padding-left:${(r.level || 0) * 22}px">${esc(r.label)}</td><td class="n">${r.amount === null || r.amount === undefined ? "" : esc(money(r.amount))}</td></tr>`).join("")}</table></section>`;
    const tb = m.base === "unadjusted" ? m.unadjustedTB : m.adjustedTB;
    const tbBlock = `<section><h2>${esc(S.company)}</h2><h3>${m.base === "unadjusted" ? "Unadjusted" : "Adjusted"} Trial Balance</h3><table>
      <tr class="b"><td>Account</td><td class="n">Debit</td><td class="n">Credit</td></tr>
      ${tb.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${r.debit ? esc(money(r.debit)) : ""}</td><td class="n">${r.credit ? esc(money(r.credit)) : ""}</td></tr>`).join("")}
      <tr class="b d"><td>TOTALS</td><td class="n">${esc(money(tb.totalDebit))}</td><td class="n">${esc(money(tb.totalCredit))}</td></tr></table></section>`;
    const win = window.open("", "_blank");
    if (!win) return flash("Pop-up blocked - allow pop-ups to print.", "err");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(S.company)} - Financial Statements</title><style>
      body{font-family:Georgia,"Times New Roman",serif;max-width:720px;margin:32px auto;padding:0 16px;color:#000}
      section{page-break-inside:avoid;margin-bottom:34px}h2{text-align:center;font-size:15px;margin:0;text-transform:uppercase;letter-spacing:.06em}
      h3{text-align:center;font-size:14px;margin:2px 0 0;font-weight:600}.pe{text-align:center;font-size:12px;margin:2px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}td{padding:2px 4px;vertical-align:top}
      td.n{text-align:right;width:130px;font-variant-numeric:tabular-nums}tr.b td{font-weight:700}
      tr.u td{border-bottom:1px solid #000}tr.d td{border-top:1px solid #000;border-bottom:3px double #000}
      @media print{body{margin:0}}</style></head><body>
      ${block(m.incomeStatement.rows, "Income Statement", sub)}
      ${block(m.equityStatement.rows, m.equityStatement.isCorp ? "Statement of Changes in Retained Earnings" : "Statement of Changes in Owner's Equity", sub)}
      ${block(m.balanceSheet.rows, "Statement of Financial Position (Balance Sheet)", asOf)}
      ${block(m.cashFlow.rows, "Statement of Cash Flows - Indirect Method", sub)}
      ${block(m.cashFlowDirect.rows, "Statement of Cash Flows - Direct Method", sub)}
      ${tbBlock}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
    win.document.close();
  }

  /* ---------------- boot ---------------- */
  function syncInputs() {
    $("journal").value = S.journal || "";
    $("adjustments").value = S.adjustments || "";
    $("opening").value = S.opening || "";
    $("company").value = S.company || "";
    $("period").value = S.period || "";
    $("currency").value = S.currency || "PHP";
    $("entity").value = S.entity || "auto";
    $("base").value = S.base || "adjusted";
  }

  function boot() {
    load();
    document.body.insertAdjacentHTML("afterbegin", `
    <div class="wrap">
      <header class="top">
        <div class="brand"><div class="mark">🧾</div>
          <div><h1>Financial Statement Machine</h1><p class="tagline">Send a journal table &rarr; get the ledger, trial balance, worksheet and all four financial statements.</p></div>
        </div>
        <div class="row"><span class="pill">Offline &middot; No upload</span><span class="pill">Direct + Indirect</span></div>
      </header>

      <div class="card">
        <h2>1 &middot; Your journal table</h2>
        <div class="drop" id="drop"><b>Drop a .csv, .txt or .xlsx here</b><small>or click to browse &middot; pasting straight from Excel / Google Sheets works too</small>
          <input type="file" id="file" accept=".csv,.txt,.tsv,.xlsx,.xlsm,.json" class="hidden"></div>
        <textarea id="journal" rows="11" spellcheck="false" style="margin-top:12px"
placeholder="Date&#9;Account Titles and Explanation&#9;Debit&#9;Credit&#9;Memo
2025-01-02&#9;Cash&#9;150000&#9;&#9;Owner invested cash
2025-01-02&#9;Owner's Capital&#9;&#9;150000&#9;Owner invested cash"></textarea>
        <p class="hint">Columns are found by name: <b>Date</b>, <b>Account</b> / Particulars / Description, <b>Debit</b> / Dr, <b>Credit</b> / Cr, <b>Memo</b>. The header row is optional. Amounts may use <code>₱</code>, commas, parentheses or a trailing <code>Cr</code>. A classic indented journal (credits indented) is understood too.</p>
        <div class="row" style="margin-top:10px"><button id="sample">Load a sample month</button><button id="clear" class="ghost">Clear everything</button></div>
      </div>

      <div class="card">
        <h2>2 &middot; Statement settings</h2>
        <div class="grid five">
          <label class="f"><span>Company</span><input type="text" id="company" placeholder="My Company"></label>
          <label class="f"><span>Period ended</span><input type="text" id="period" placeholder="January 31, 2025"></label>
          <label class="f"><span>Currency</span><select id="currency">
            <option value="PHP">₱ Philippine Peso</option><option value="USD">$ US Dollar</option>
            <option value="EUR">€ Euro</option><option value="GBP">£ Pound</option><option value="JPY">¥ Yen</option><option value="NONE">No symbol</option></select></label>
          <label class="f"><span>Business type</span><select id="entity">
            <option value="auto">Auto-detect</option><option value="sole-proprietorship">Sole proprietorship</option><option value="corporation">Corporation</option></select></label>
          <label class="f"><span>Prepare from</span><select id="base">
            <option value="adjusted">Adjusted trial balance</option><option value="unadjusted">Unadjusted trial balance</option></select></label>
        </div>
      </div>

      <details class="box"><summary>Adjusting entries (optional)</summary><div class="body">
        <p class="hint" style="margin-top:0">Same format as the journal. These are posted on top of it to produce the adjusted trial balance and the statements.</p>
        <textarea id="adjustments" rows="6" spellcheck="false" placeholder="Date&#9;Account Titles and Explanation&#9;Debit&#9;Credit&#9;Memo"></textarea>
      </div></details>

      <details class="box"><summary>Opening balances (optional)</summary><div class="body">
        <p class="hint" style="margin-top:0">For journals that only cover part of a year. One per line: <code>Account&lt;tab&gt;Amount</code>, on the account's normal side.</p>
        <textarea id="opening" rows="5" spellcheck="false" placeholder="Cash&#9;20000
Owner's Capital&#9;20000"></textarea>
      </div></details>

      <div class="card row spread">
        <div class="row"><button id="run" class="primary">⚡ Calculate financial statements</button><span id="status" class="status"></span></div>
        <div class="row">
          <button id="print">🖨️ Print / PDF</button>
          <button id="copy">📋 Copy report</button>
          <button id="zip">📦 Download all</button>
          <button id="save">💾 Save worksheet</button>
        </div>
      </div>

      <div id="summary" style="margin-bottom:14px"></div>
      <div id="accounts"></div>
      <div id="results"></div>

      <footer>
        <b>How it works.</b> Every line is posted to a ledger, each account is classified from its title (asset, liability, equity, revenue, expense, plus contra and current / non-current groups), then the statements are built from the adjusted trial balance.
        The <b>indirect</b> cash flow starts from net income, adds back depreciation, reverses gains and losses and applies the change in every current asset and current liability.
        The <b>direct</b> cash flow traces each cash line back to the other side of its own journal entry and totals receipts and payments by class &mdash; customers, suppliers, employees, operating expenses, interest and taxes. Both must agree, and the difference is reported if they do not.
        Everything runs in this file: no server, no upload, works from your desktop.
      </footer>
    </div>`);

    syncInputs();

    let timer = null;
    const live = () => { clearTimeout(timer); timer = setTimeout(() => {
      S.journal = $("journal").value; S.adjustments = $("adjustments").value; S.opening = $("opening").value;
      save(); calculate();
    }, 400); };
    ["journal", "adjustments", "opening"].forEach(id => $(id).addEventListener("input", live));
    $("company").addEventListener("input", e => { S.company = e.target.value; save(); renderSummary(); renderTabs(); });
    $("period").addEventListener("input", e => { S.period = e.target.value; save(); renderTabs(); });
    $("currency").addEventListener("change", e => { S.currency = e.target.value; save(); calculate(); });
    $("entity").addEventListener("change", e => { S.entity = e.target.value; save(); calculate(); });
    $("base").addEventListener("change", e => { S.base = e.target.value; save(); calculate(); });

    $("run").addEventListener("click", () => {
      S.journal = $("journal").value; S.adjustments = $("adjustments").value; S.opening = $("opening").value;
      calculate();
      if (S.model) {
        const errs = S.model.checks.filter(c => c.level === "error").length;
        flash(errs ? `Done with ${errs} error(s) - open the Checks tab.` : `Done - ${S.model.accounts.length} accounts, ${S.model.entries.length} entries, net income ${money(S.model.incomeStatement.netIncome)}.`, errs ? "err" : "ok");
        $("summary").scrollIntoView({ behavior: "smooth", block: "start" });
      } else flash("Nothing to calculate - paste a journal first.", "warn");
    });

    $("sample").addEventListener("click", () => {
      S.journal = A.SAMPLE_JOURNAL; S.adjustments = A.SAMPLE_ADJUSTMENTS; S.opening = "";
      S.company = "Sample Consulting Services"; S.period = "January 31, 2025"; S.overrides = {};
      syncInputs(); calculate(); flash("Sample month loaded.", "ok");
    });

    $("clear").addEventListener("click", () => {
      if (!global.confirm("Clear the journal, adjustments and saved worksheet?")) return;
      Object.assign(S, { journal: "", adjustments: "", opening: "", overrides: {}, model: null, parsed: null });
      syncInputs(); save(); renderSummary(); renderAccounts(); renderTabs(); flash("Cleared.");
    });

    const drop = $("drop"), fileInput = $("file");
    drop.addEventListener("click", () => fileInput.click());
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", e => {
      e.preventDefault(); drop.classList.remove("over");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f).catch(err => flash("Could not read that file: " + err.message, "err"));
    });
    fileInput.addEventListener("change", e => {
      const f = e.target.files && e.target.files[0];
      if (f) readFile(f).catch(err => flash("Could not read that file: " + err.message, "err"));
      e.target.value = "";
    });

    $("print").addEventListener("click", printReport);
    $("copy").addEventListener("click", async () => {
      if (!S.model) return flash("Calculate first.", "warn");
      const txt = A.toTextReport(S.model, meta());
      try { await navigator.clipboard.writeText(txt); flash("Full report copied.", "ok"); }
      catch (e) {
        const box = document.createElement("textarea");
        box.value = txt; document.body.appendChild(box); box.select(); document.execCommand("copy"); box.remove();
        flash("Full report copied.", "ok");
      }
    });
    $("zip").addEventListener("click", exportAll);
    $("save").addEventListener("click", () => {
      download(slug(S.company) + "-worksheet.json", JSON.stringify(payload(), null, 2), "application/json");
      flash("Worksheet saved - drop the .json back in to restore it.", "ok");
    });

    calculate();
    flash(S.journal ? "Restored your last worksheet." : "Ready - paste a journal, drop a file, or load the sample.", "ok");
  }

  global.FinancialStatementMachine = { boot, calculate, readFile, S };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : globalThis);
