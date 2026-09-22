/*
 * StudyMate Accounting Engine
 * ---------------------------
 * Pure, dependency-free accounting core: journal parsing, classification,
 * general ledger, trial balance, worksheet, and the four financial statements.
 *
 * Works in the browser (window.StudyMateAccounting) and in Node
 * (require('./accounting.js')) so it can be unit tested.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StudyMateAccounting = api;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Numeric helpers
   * ------------------------------------------------------------------ */

  const EPS = 0.005;

  function r2(n) {
    if (!isFinite(n)) return 0;
    return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
  }

  function near(a, b, tol) {
    return Math.abs(r2(a) - r2(b)) <= (tol === undefined ? EPS : tol);
  }

  const CURRENCY = { "PHP": "\u20B1", "USD": "$", "EUR": "\u20AC", "NONE": "", "JPY": "\u00A5", "GBP": "\u00A3" };

  function fmtMoney(value, opts) {
    const o = opts || {};
    const sym = CURRENCY[o.currency || "PHP"] !== undefined ? CURRENCY[o.currency || "PHP"] : "";
    let n = Number(value);
    if (!isFinite(n)) n = 0;
    n = r2(n);
    if (near(n, 0)) n = 0;
    const neg = n < 0;
    const abs = Math.abs(n).toFixed(o.decimals === undefined ? 2 : o.decimals);
    const [int, dec] = abs.split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    let out = o.decimals === 0 ? grouped : grouped + "." + dec;
    if (o.blank && near(n, 0)) return "";
    if (neg) return "(" + sym + out + ")";
    return o.blank && near(n, 0) ? "" : sym + out;
  }

  /** Parse "1,234.50", "(500)", "PHP 500", "500 Cr", "-500" into a number. */
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === "number") return isFinite(raw) ? r2(raw) : 0;
    let s = String(raw).trim();
    if (!s || s === "-" || s === "--") return 0;
    s = s.replace(/[\u20B1$\u20AC\u00A3\u00A5]/g, " ").replace(/\b(php|usd|pesos?|dollars?)\b/gi, " ");
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    if (/^\s*-\s*\d/.test(s)) { negative = true; s = s.replace(/^\s*-\s*/, ""); }
    const side = s.match(/(?:^|\s)(dr|cr|debit|credit)\.?$/i);
    if (side) s = s.slice(0, side.index);
    s = s.replace(/,/g, "").replace(/\s+/g, "");
    const m = s.match(/\d+(?:\.\d+)?/);
    if (!m) return 0;
    let v = parseFloat(m[0]);
    if (isNaN(v)) return 0;
    if (negative) v = -v;
    return r2(v);
  }

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9'\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ------------------------------------------------------------------ *
   * Chart of accounts classifier (rule based, first match wins)
   *
   * subtype drives where a balance lands on the statements:
   *   asset:      cash | current-asset | noncurrent-asset | contra-asset
   *   liability:  current-liability | noncurrent-liability
   *   equity:     owner-capital | contributed-capital | retained-earnings
   *               | drawings | treasury | income-summary
   *   revenue:    operating-revenue | contra-revenue | other-revenue
   *   expense:    cogs | operating-expense | other-expense | income-tax-expense
   * ------------------------------------------------------------------ */

  const RULES = [
    // --- contra assets ---
    [/accumulated (depreciation|amortization|depletion)/, "asset", "contra-asset", { noncash: true, section: "ppe" }],
    [/allowance for (doubtful|bad|impairment)/, "asset", "contra-asset", { section: "current" }],
    [/discount on notes receivable/, "asset", "contra-asset", { section: "current" }],

    // --- revenues that look like liabilities / dividends ---
    [/dividend(s)? (revenue|income)|interest (revenue|income)|dividends received/, "revenue", "other-revenue"],
    [/unearned|deferred (revenue|rent|income|subscription|fees)|advance(s)? from customers|customer deposits?/, "liability", "current-liability"],

    // --- current liabilities (must beat generic asset/expense rules) ---
    [/(bonds|mortgage|debenture)/, "liability", "noncurrent-liability"],
    [/long[- ]term (notes?|loans?|debt|payable)|notes? payable,? long|current portion|current maturit/, "liability", "noncurrent-liability"],
    [/lease liabilit|finance lease|pension liabilit|deferred tax liabilit|warranty liabilit/, "liability", "noncurrent-liability"],
    [/(sss|philhealth|phil health|pag[- ]?ibig|pagibig|hdmf|bir|vat|withholding tax|13th month|employees? compensation)/, "liability", "current-liability"],
    [/payable|accrued|accruals/, "liability", "current-liability"],
    [/income tax(es)? (payable|due)|tax(es)? payable/, "liability", "current-liability"],

    // --- equity ---
    [/treasury (stock|shares)/, "equity", "treasury"],
    [/(owner'?s? |partner'?s? |shareholder'?s? )?(drawings?|withdrawals?)( |$)/, "equity", "drawings"],
    [/(cash |declared )?dividends?( declared)?$/, "equity", "drawings"],
    [/income summary|profit and loss summary|revenue and expense summary/, "equity", "income-summary"],
    [/retained (earnings|profits)/, "equity", "retained-earnings"],
    [/(common|ordinary|preference|preferred) (stock|shares)|share capital|capital stock|subscribed capital|paid[- ]?in capital|additional paid|share premium|share subscriptions?/, "equity", "contributed-capital"],
    [/capital$|, capital|\bcapital\b|owner'?s? equity|proprietor'?s? capital/, "equity", "owner-capital"],

    // --- expenses (suffix wins over generic asset words like "supplies") ---
    [/cash (short|over)/, "expense", "operating-expense"],
    [/(cost of (goods sold|sales|revenue)|\bcogs\b)/, "expense", "cogs"],
    [/freight[- ]?in|transportation[- ]?in|shipping[- ]?in|import duties/, "expense", "cogs"],
    [/purchase(s)? discounts?/, "expense", "cogs"],
    [/\bpurchases?\b/, "expense", "cogs"],
    [/depreciation expense|amortization expense|depletion expense/, "expense", "operating-expense", { noncash: true }],
    [/income tax(es)? expense|provision for income tax|corporate income tax|tax expense/, "expense", "income-tax-expense"],
    [/interest expense|finance (cost|charge)|loss on (sale|disposal|retirement)|loss from sale|impairment loss/, "expense", "other-expense"],
    [/expense|expenditure/, "expense", "operating-expense"],

    // --- revenues ---
    [/sales returns|sales allowances|sales discounts?|returns and allowances/, "revenue", "contra-revenue"],
    [/gain on (sale|disposal)|gain from sale|other income/, "revenue", "other-revenue"],
    [/\bsales\b|service (revenue|fees)|fees? (earned|income)|professional fees|commission (revenue|earned)|rent revenue|rental income|consulting revenue|revenue|earned|income from/, "revenue", "operating-revenue"],

    // --- assets ---
    [/\bcash( in bank| on hand| and cash equivalents)?\b|petty cash|cash equivalents|bank account|checking account/, "asset", "cash"],
    [/(accounts?|trade|notes?|interest|rent|subscriptions?) receivable|receivables?|due from/, "asset", "current-asset"],
    [/(merchandise |finished goods |raw materials )?inventor(y|ies)|\bstock[- ]?in[- ]?trade\b/, "asset", "current-asset"],
    [/\bsupplies\b|office supplies$|store supplies/, "asset", "current-asset"],
    [/prepaid|advance(d)? (rent|insurance|payments?)|security deposit|input vat|due from officers|employees? loans?/, "asset", "current-asset"],
    [/short[- ]term investments?|trading (securities|investments)|marketable securities/, "asset", "current-asset"],
    [/(land|building|equipment|furniture|fixtures|machinery|vehicle|computer|tools|leasehold improvements?|construction in progress|office equipment|store equipment|delivery equipment|service equipment)s?\b/, "asset", "noncurrent-asset", { section: "ppe" }],
    [/long[- ]term investments?|investment in (subsidiar|associate|bonds|stocks)|sinking fund/, "asset", "noncurrent-asset", { section: "investments" }],
    [/patents?|trademarks?|copyrights?|goodwill|franchise|software|intangible|computer software/, "asset", "noncurrent-asset", { section: "intangibles" }],

    // --- fallbacks ---
    [/payable|loan/, "liability", "current-liability"],
    [/receivable/, "asset", "current-asset"],
    [/\bstock|\bshares\b|equity/, "equity", "contributed-capital"],
    [/revenue|income|sales|fees/, "revenue", "operating-revenue"],
    [/cost|loss|expense|paid/, "expense", "operating-expense"]
  ];

  const NORMAL_SIDE = { asset: "debit", expense: "debit", liability: "credit", equity: "credit", revenue: "credit" };

  function baseClassification(type, subtype) {
    const normal = NORMAL_SIDE[type] || "debit";
    const flipped = subtype === "contra-asset" || subtype === "contra-revenue" || subtype === "drawings" || subtype === "treasury";
    return { type, subtype, normal: flipped ? (normal === "debit" ? "credit" : "debit") : normal, noncash: false, section: null };
  }

  /**
   * Classify an account title.
   * @param {string} name
   * @param {Object} [overrides] map of raw account name -> "type:subtype" or "type"
   */
  function classifyAccount(name, overrides) {
    const raw = String(name || "").trim();
    if (overrides) {
      const ov = overrides[raw] || overrides[normalizeName(raw)];
      if (ov) {
        const parts = String(ov).split(":");
        const c = baseClassification(parts[0], parts[1] || defaultSubtype(parts[0]));
        c.source = "manual";
        return c;
      }
    }
    const n = normalizeName(raw);
    if (!n) return { type: "unknown", subtype: "unknown", normal: "debit", noncash: false, source: "empty" };
    for (const [re, type, subtype, extra] of RULES) {
      if (re.test(n)) {
        const c = baseClassification(type, subtype);
        if (extra) Object.assign(c, extra);
        c.source = "auto";
        c.rule = re.source;
        return c;
      }
    }
    return { type: "unknown", subtype: "unknown", normal: "debit", noncash: false, source: "none" };
  }

  function defaultSubtype(type) {
    return ({ asset: "current-asset", liability: "current-liability", equity: "owner-capital", revenue: "operating-revenue", expense: "operating-expense" })[type] || "unknown";
  }

  /* ------------------------------------------------------------------ *
   * Journal parsing
   * ------------------------------------------------------------------ */

  const HEADER_KEYS = {
    date: /^(date|transaction date|posting date|when|petsa)$/i,
    account: /^(account(\s*titles?.*)?|accounts?|particulars?|description|explanation|details?|title|account name|chart of accounts?|acct\.?|ma?)$/i,
    debit: /^(debit|debits|dr\.?|debit amount|amount \(dr\)|d)$/i,
    credit: /^(credit|credits|cr\.?|credit amount|amount \(cr\)|c)$/i,
    memo: /^(memo|narration|narrative|notes?|remarks?|explanation.*|description of transaction)$/i,
    type: /^(type|account type|classification|category|normal balance|class)$/i,
    ref: /^(pr|post\.? ref\.?|ref\.?|folio|journal ref\.?|jrnl\.? no\.?|no\.?)$/i,
    amount: /^(amount|value|total|php|usd)$/i,
    side: /^(side|dr\/cr|drcr|dc)$/i
  };

  function detectDelimiter(text) {
    const lines = String(text).replace(/\r/g, "").split("\n").slice(0, 60);
    const nonEmpty = lines.filter(l => l.trim() !== "");
    if (!nonEmpty.length) return null;
    if (lines.join("\n").includes("\t")) return "\t";
    if (lines.join("\n").includes("|")) return "|";
    // a comma inside "150,000" is a thousands separator, not a CSV delimiter
    const stripThousands = s => s.replace(/(\d),\d{3}(?!\d)/g, "$1");
    const commaLines = nonEmpty.filter(l => stripThousands(l).includes(",")).length;
    const semiLines = nonEmpty.filter(l => stripThousands(l).includes(";")).length;
    if (commaLines >= Math.max(1, Math.ceil(nonEmpty.length * 0.5))) return ",";
    if (semiLines >= Math.max(1, Math.ceil(nonEmpty.length * 0.5))) return ";";
    return null;
  }

  /** Split one CSV/TSV line honouring quoted fields. */
  function splitRow(line, delim) {
    if (!delim) return [line];
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === delim && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(c => c.trim().replace(/^"|"$/g, ""));
  }

  /** Excel stores dates as days since 1899-12-30. */
  function excelSerialToDate(serial) {
    const n = Number(serial);
    if (!isFinite(n) || n < 1 || n > 200000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  function decodeXml(s) {
    return String(s)
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
      .replace(/&amp;/g, "&");
  }

  function xlsxColumnIndex(ref) {
    const m = /^([A-Z]+)/.exec(String(ref || ""));
    if (!m) return 0;
    let n = 0;
    for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }

  /**
   * Turn the XML inside an .xlsx worksheet (+ sharedStrings.xml) into rows of
   * strings. Regex based on purpose so it runs in Node tests too - xlsx XML is
   * machine generated and predictable.
   */
  function xlsxSheetToRows(sheetXml, sharedStringsXml) {
    const shared = [];
    if (sharedStringsXml) {
      const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
      let m;
      while ((m = siRe.exec(sharedStringsXml))) {
        let text = "";
        if (m[1]) {
          const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
          let t;
          while ((t = tRe.exec(m[1]))) text += decodeXml(t[1]);
        }
        shared.push(text);
      }
    }
    const rows = [];
    const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    let rm;
    while ((rm = rowRe.exec(String(sheetXml)))) {
      const cells = [];
      const cRe = /<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
      let cm;
      while ((cm = cRe.exec(rm[1]))) {
        const attrs = cm[1] !== undefined ? cm[1] : (cm[2] || "");
        const inner = cm[3] || "";
        const refM = /r="([A-Z]+)\d+"/.exec(attrs);
        const idx = refM ? xlsxColumnIndex(refM[1]) : cells.length;
        const typeM = /t="([^"]+)"/.exec(attrs);
        const type = typeM ? typeM[1] : "n";
        let value = "";
        if (type === "inlineStr") {
          const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
          let t;
          while ((t = tRe.exec(inner))) value += decodeXml(t[1]);
        } else {
          const vM = /<v[^>]*>([\s\S]*?)<\/v>/.exec(inner);
          if (vM) value = decodeXml(vM[1]);
          if (type === "s") value = shared[parseInt(value, 10)] !== undefined ? shared[parseInt(value, 10)] : "";
        }
        cells[idx] = value;
      }
      const out = [];
      for (let i = 0; i < cells.length; i++) out.push(cells[i] === undefined ? "" : cells[i]);
      rows.push(out);
    }
    return rows;
  }

  function looksLikeDate(s) {
    if (!s) return false;
    const t = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true;
    if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(t)) return true;
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}/i.test(t)) return true;
    if (/^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t)) return true;
    return false;
  }

  function isHeaderRow(cells) {
    const joined = cells.join(" ").toLowerCase();
    if (/account|particulars|debit|credit|description/.test(joined) && /\d{2,}/.test(joined) === false) return true;
    return cells.some(c => HEADER_KEYS.account.test(String(c).trim())) && cells.some(c => HEADER_KEYS.debit.test(String(c).trim()) || HEADER_KEYS.credit.test(String(c).trim()));
  }

  function mapHeader(cells) {
    const map = { date: -1, account: -1, debit: -1, credit: -1, memo: -1, type: -1, ref: -1, amount: -1, side: -1 };
    cells.forEach((cell, i) => {
      const c = String(cell).trim();
      if (!c) return;
      for (const key of Object.keys(HEADER_KEYS)) {
        if (map[key] !== -1) continue;
        if (HEADER_KEYS[key].test(c)) { map[key] = i; return; }
      }
      if (map.memo === -1 && /memo|remark|note|narration/i.test(c)) map.memo = i;
    });
    return map;
  }

  function guessColumns(cells, allRows) {
    // No header row: infer columns from the shape of the first rows.
    const map = { date: -1, account: -1, debit: -1, credit: -1, memo: -1, type: -1, ref: -1, amount: -1, side: -1 };
    const numeric = [];
    const scan = (allRows && allRows.length ? allRows : [cells]).slice(0, 40);
    const width = scan.reduce((w, r) => Math.max(w, r.length), 0);
    for (let i = 0; i < width; i++) {
      const colHasAmount = scan.some(r => {
        const c = r[i];
        return c !== undefined && c !== "" && parseAmount(c) !== 0 && !looksLikeDate(c);
      });
      const colIsText = scan.some(r => r[i] !== undefined && r[i] !== "" && !/\d/.test(String(r[i])));
      if (colHasAmount && !colIsText) numeric.push(i);
    }
    if (looksLikeDate(cells[0]) || /^\d{4,6}$/.test(String(cells[0]).trim())) { map.date = 0; map.account = 1; }
    else map.account = 0;
    if (numeric.length >= 2) {
      map.debit = numeric[numeric.length - 2];
      map.credit = numeric[numeric.length - 1];
    } else if (numeric.length === 1) {
      map.debit = numeric[0];
    }
    if (map.credit >= 0 && width > map.credit + 1) map.memo = map.credit + 1;
    return map;
  }

  /**
   * Free-form journal line: "Jan 2   Cash .......... 50,000" or
   * "            Owner's Capital ....................... 50,000"
   * Indented lines are treated as credits (textbook journal convention).
   */
  const NUM_RE = "\\(?\\d[\\d,]*(?:\\.\\d+)?\\)?";
  const FREEFORM_TWO = new RegExp("^(.*?)[\\s.\\u2026\\-_=]*\\s(" + NUM_RE + ")\\s+(" + NUM_RE + ")[\\s.,]*$");
  const FREEFORM_ONE = new RegExp("^(.*?)[\\s.\\u2026\\-_=]*\\s(" + NUM_RE + ")[\\s.,]*$");

  function parseFreeformLine(raw) {
    let line = String(raw).replace(/\s+$/, "");
    if (!line.trim()) return null;
    const indented = /^(\s{2,}|\t)/.test(line);

    // an explicit Dr/Cr marker at the end beats the indentation rule
    let forcedSide = null;
    const sideM = line.match(/(?:^|\s)(dr|cr|debit|credit)\.?$/i);
    if (sideM) {
      forcedSide = /^c/i.test(sideM[1]) ? "credit" : "debit";
      line = line.slice(0, sideM.index).replace(/\s+$/, "");
    }

    let text = line.trim();
    let debit = 0, credit = 0;
    const two = text.match(FREEFORM_TWO);
    if (two) {
      text = two[1];
      debit = parseAmount(two[2]);
      credit = parseAmount(two[3]);
    } else {
      const one = text.match(FREEFORM_ONE);
      if (!one) return null;
      text = one[1];
      const v = parseAmount(one[2]);
      if (forcedSide === "credit" || (!forcedSide && indented)) credit = v;
      else debit = v;
    }

    let account = text.replace(/[.\u2026\-_=]{2,}[\s\S]*$/, "").replace(/[\s.\-]+$/, "").trim();
    if (!account) return null;
    const dateMatch = account.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?)\s+/i);
    let date = "";
    if (dateMatch) { date = dateMatch[1].trim(); account = account.slice(dateMatch[0].length).trim(); }
    if (!account || (!debit && !credit)) return null;
    return { date, account, debit, credit, memo: "", indented };
  }

  /**
   * Parse rows (array of arrays, as produced from CSV/XLSX) into journal lines.
   * @returns {{lines: Array, entries: Array, warnings: string[], meta: Object}}
   */
  function parseJournalRows(rows, opts) {
    const options = opts || {};
    const warnings = [];
    let clean = rows.map(r => (Array.isArray(r) ? r.map(c => (c === null || c === undefined ? "" : String(c).trim())) : [String(r)]));
    clean = clean.filter(r => r.some(c => c !== ""));
    if (!clean.length) return { lines: [], entries: [], warnings: ["No rows found."], meta: {} };

    // drop obvious junk rows (merged titles, "Total" rows, page headers)
    clean = clean.filter(r => {
      const joined = r.join(" ").toLowerCase();
      if (/^(page|general journal|journal voucher|company name|prepared by)\b/.test(joined) && !/\d{3,}/.test(joined)) return false;
      if (/^\s*totals?\s*$/.test(joined)) return false;
      return true;
    });

    let map = null;
    let start = 0;
    if (isHeaderRow(clean[0])) {
      map = mapHeader(clean[0]);
      start = 1;
    } else {
      const probe = clean.find(r => r.length > 1) || clean[0];
      map = guessColumns(probe, clean.slice(start));
      if (map.debit < 0) warnings.push("No header row detected - guessed columns from the first row. Check the parsed journal below.");
    }
    if (map.account < 0) {
      // last resort: first non-numeric column is the account
      const probe = clean[start] || clean[0];
      map.account = probe.findIndex(c => c !== "" && !parseAmount(c));
      if (map.account < 0) map.account = 0;
    }
    if (map.debit < 0 && map.credit < 0 && map.amount >= 0) { map.debit = map.amount; }
    if (map.debit < 0 && map.credit < 0) {
      const taken = new Set([map.date, map.account, map.memo, map.type, map.ref].filter(i => i >= 0));
      const numCols = [];
      clean.slice(start, start + 40).forEach(r => {
        r.forEach((c, i) => {
          if (taken.has(i) || numCols.includes(i)) return;
          if (c !== undefined && c !== "" && parseAmount(c) !== 0 && !looksLikeDate(c)) numCols.push(i);
        });
      });
      numCols.sort((a, b) => a - b);
      if (numCols.length >= 2) { map.debit = numCols[numCols.length - 2]; map.credit = numCols[numCols.length - 1]; }
      else if (numCols.length === 1) { map.debit = numCols[0]; map.credit = -1; warnings.push("Only one amount column found - amounts placed in Debit. Add a Credit column or use the indented journal format."); }
      else warnings.push("No amounts detected.");
    } else if (map.credit < 0) {
      warnings.push("No Credit column found - every amount was read as a debit. Your table needs separate Debit and Credit columns.");
    }

    const rawLines = [];
    for (let i = start; i < clean.length; i++) {
      const r = clean[i];
      const account = map.account >= 0 ? (r[map.account] || "") : "";
      const debitRaw = map.debit >= 0 ? (r[map.debit] || "") : "";
      const creditRaw = map.credit >= 0 ? (r[map.credit] || "") : "";
      let debit = parseAmount(debitRaw);
      let credit = parseAmount(creditRaw);
      if (map.side >= 0 && map.amount >= 0) {
        const side = String(r[map.side] || "").toLowerCase();
        const amt = parseAmount(r[map.amount]);
        debit = /cr|credit/.test(side) ? 0 : amt;
        credit = /cr|credit/.test(side) ? amt : 0;
      }
      // spreadsheets often record credits as negative debits (and vice versa)
      if (debit < 0) { credit = r2(credit - debit); debit = 0; }
      if (credit < 0) { debit = r2(debit - credit); credit = 0; }
      // a single amount column with the other side implied by indentation
      if (!debit && !credit) continue;
      let dateVal = map.date >= 0 ? (r[map.date] || "") : "";
      if (dateVal && /^\d{4,6}$/.test(dateVal)) dateVal = excelSerialToDate(dateVal) || dateVal; // Excel serial date
      const entry = {
        date: dateVal,
        account: account.replace(/\s+/g, " ").trim(),
        debit, credit,
        memo: map.memo >= 0 ? (r[map.memo] || "") : "",
        typeHint: map.type >= 0 ? (r[map.type] || "") : "",
        row: i + 1
      };
      if (!entry.account) {
        if (entry.memo) { entry.account = ""; }
        else continue;
      }
      rawLines.push(entry);
    }

    return finalizeLines(rawLines, warnings, options);
  }

  /** Parse pasted text (Excel/Sheets copy, CSV, or a classic indented journal). */
  function parseJournalText(text, opts) {
    const options = opts || {};
    const src = String(text || "").replace(/\r/g, "");
    if (!src.trim()) return { lines: [], entries: [], warnings: ["Nothing to parse - paste your journal table first."], meta: {} };

    const delim = detectDelimiter(src);
    if (delim) {
      const rows = src.split("\n").map(l => splitRow(l, delim));
      return parseJournalRows(rows, options);
    }

    // Free-form / classic journal
    const warnings = [];
    const rawLines = [];
    let currentDate = "";
    src.split("\n").forEach(line => {
      if (!line.trim()) return;
      const parsed = parseFreeformLine(line);
      if (!parsed) return;
      if (parsed.date) currentDate = parsed.date;
      rawLines.push({ date: parsed.date || (parsed.indented ? "" : currentDate), account: parsed.account, debit: parsed.debit, credit: parsed.credit, memo: "", row: rawLines.length + 1 });
    });
    if (!rawLines.length) warnings.push("Could not read any lines. Try copying the table straight from Excel/Google Sheets.");
    return finalizeLines(rawLines, warnings, options);
  }

  /** Group flat lines into balanced journal entries. */
  function finalizeLines(lines, warnings, options) {
    const entries = [];
    let current = null;
    const tol = (options && options.tolerance) || EPS;

    lines.forEach(l => {
      const startsNew = !current ||
        (l.date && current.date && l.date !== current.date) ||
        (near(sum(current.lines, "debit"), sum(current.lines, "credit"), tol) && sum(current.lines, "debit") !== 0);
      if (startsNew) {
        current = { date: l.date || (current && current.date) || "", memo: l.memo || "", lines: [] };
        entries.push(current);
      }
      if (l.date) current.date = l.date;
      if (l.memo) current.memo = l.memo;
      current.lines.push(l);
    });

    let idx = 0;
    entries.forEach(e => {
      e.no = ++idx;
      e.debit = r2(sum(e.lines, "debit"));
      e.credit = r2(sum(e.lines, "credit"));
      e.balanced = near(e.debit, e.credit, tol);
      e.difference = r2(e.debit - e.credit);
    });

    const totalDebit = r2(lines.reduce((a, l) => a + (l.debit || 0), 0));
    const totalCredit = r2(lines.reduce((a, l) => a + (l.credit || 0), 0));
    if (lines.length && !near(totalDebit, totalCredit, tol)) {
      warnings.push(`Journal totals do not agree: debits ${fmtMoney(totalDebit)} vs credits ${fmtMoney(totalCredit)}.`);
    }
    return {
      lines, entries, warnings,
      meta: { totalDebit, totalCredit, accountCount: new Set(lines.map(l => l.account)).size }
    };
  }

  function sum(arr, key) { return arr.reduce((a, x) => a + (Number(x[key]) || 0), 0); }

  /** Parse "Account<TAB>5000" or "Account, 5000" or "Account 5000 Dr" opening balances. */
  function parseBalanceList(text) {
    const out = {};
    String(text || "").split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t || /^[#\/]/.test(t)) return;
      const cells = /\t/.test(t) ? t.split("\t") : (t.includes(",") ? splitRow(t, ",") : null);
      let name = "", amount = "";
      if (cells && cells.length >= 2) { name = cells[0]; amount = cells[cells.length - 1]; }
      else {
        const m = t.match(/^(.*?)[\s:]+(-?\(?\d[\d,]*(?:\.\d+)?\)?(?:\s*(?:dr|cr))?)\s*$/i);
        if (!m) return;
        name = m[1]; amount = m[2];
      }
      name = String(name).replace(/[.\u2026\-_=]{2,}.*$/, "").trim();
      if (!name) return;
      const v = parseAmount(amount);
      if (v) out[name] = v;
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Model: ledger, trial balances, statements
   * ------------------------------------------------------------------ */

  function blankAccount(name) {
    return {
      name, debit: 0, credit: 0, adjDebit: 0, adjCredit: 0, opening: 0,
      ledger: [], type: "unknown", subtype: "unknown", normal: "debit", noncash: false, source: "none"
    };
  }

  /**
   * Build the full accounting model.
   * @param {Object} input {lines, adjustments, opening, overrides, entity, base, currency}
   */
  function buildModel(input) {
    const cfg = Object.assign({ entity: "auto", base: "adjusted", currency: "PHP" }, input || {});
    const lines = cfg.lines || [];
    const adjustments = cfg.adjustments || [];
    const opening = cfg.opening || {};
    const overrides = cfg.overrides || {};
    const warnings = [];

    const accounts = new Map();
    function touch(name) {
      const key = String(name || "").trim();
      if (!accounts.has(key)) {
        const a = blankAccount(key);
        const c = classifyAccount(key, overrides);
        a.type = c.type; a.subtype = c.subtype; a.normal = c.normal; a.noncash = !!c.noncash;
        a.section = c.section || null; a.source = c.source;
        a.opening = opening[key] !== undefined ? r2(opening[key]) : (opening[normalizeName(key)] !== undefined ? r2(opening[normalizeName(key)]) : 0);
        accounts.set(key, a);
      }
      return accounts.get(key);
    }

    // accounts that only appear in the opening balances still need a ledger
    Object.keys(opening).forEach(k => touch(k));

    lines.forEach(l => {
      const a = touch(l.account);
      a.debit = r2(a.debit + (l.debit || 0));
      a.credit = r2(a.credit + (l.credit || 0));
      a.ledger.push({ date: l.date || "", memo: l.memo || "", debit: l.debit || 0, credit: l.credit || 0, kind: "journal" });
    });

    adjustments.forEach(l => {
      const a = touch(l.account);
      a.adjDebit = r2(a.adjDebit + (l.debit || 0));
      a.adjCredit = r2(a.adjCredit + (l.credit || 0));
      a.ledger.push({ date: l.date || "Adj.", memo: l.memo || "Adjusting entry", debit: l.debit || 0, credit: l.credit || 0, kind: "adjustment" });
    });

    accounts.forEach(a => {
      const delta = a.normal === "debit" ? (a.debit - a.credit) : (a.credit - a.debit);
      const adjDelta = a.normal === "debit" ? (a.adjDebit - a.adjCredit) : (a.adjCredit - a.adjDebit);
      a.unadjusted = r2(a.opening + delta);
      a.adjusted = r2(a.unadjusted + adjDelta);
      a.value = cfg.base === "unadjusted" ? a.unadjusted : a.adjusted;
      if (a.type === "unknown" && a.value !== 0) warnings.push(`Unclassified account: "${a.name}" (${fmtMoney(a.value)}). Set its type in the Account Types table.`);
    });

    const list = Array.from(accounts.values());
    const by = (type, subtype) => list.filter(a => a.type === type && (!subtype || a.subtype === subtype)).sort(byName);
    const byType = type => list.filter(a => a.type === type).sort(byName);

    function byName(x, y) { return x.name.localeCompare(y.name); }

    /* ---------------- Trial balances ---------------- */
    function trialBalance(kind) {
      const rows = list
        .filter(a => (kind === "adjusted" ? a.adjusted : a.unadjusted) !== 0 || (kind === "adjusted" ? (a.adjDebit || a.adjCredit) : (a.debit || a.credit)))
        .map(a => {
          const v = kind === "adjusted" ? a.adjusted : a.unadjusted;
          return {
            name: a.name, type: a.type, subtype: a.subtype,
            debit: a.normal === "debit" ? v : 0,
            credit: a.normal === "credit" ? v : 0,
            amount: v
          };
        })
        .sort((x, y) => x.name.localeCompare(y.name));
      const totalDebit = r2(rows.reduce((s, x) => s + Math.max(0, x.debit), 0));
      const totalCredit = r2(rows.reduce((s, x) => s + Math.max(0, x.credit), 0));
      return { rows, totalDebit, totalCredit, balanced: near(totalDebit, totalCredit) };
    }
    const unadjustedTB = trialBalance("unadjusted");
    const adjustedTB = trialBalance("adjusted");

    /* ---------------- Income statement ---------------- */
    const opRev = by("revenue", "operating-revenue").filter(a => a.value !== 0);
    const contraRev = by("revenue", "contra-revenue").filter(a => a.value !== 0);
    const cogs = by("expense", "cogs").filter(a => a.value !== 0);
    const opex = by("expense", "operating-expense").filter(a => a.value !== 0);
    const otherInc = by("revenue", "other-revenue").filter(a => a.value !== 0);
    const otherExp = by("expense", "other-expense").filter(a => a.value !== 0);
    const taxAcc = by("expense", "income-tax-expense").filter(a => a.value !== 0);

    const totalRevenue = r2(opRev.reduce((s, a) => s + a.value, 0));
    const totalContraRevenue = r2(contraRev.reduce((s, a) => s + a.value, 0));
    const netSales = r2(totalRevenue - totalContraRevenue);
    const totalCOGS = r2(cogs.reduce((s, a) => s + a.value, 0));
    const grossProfit = r2(netSales - totalCOGS);
    const totalOpex = r2(opex.reduce((s, a) => s + a.value, 0));
    const operatingIncome = r2((cogs.length ? grossProfit : netSales) - totalOpex);
    const totalOtherIncome = r2(otherInc.reduce((s, a) => s + a.value, 0));
    const totalOtherExpense = r2(otherExp.reduce((s, a) => s + a.value, 0));
    const incomeBeforeTax = r2(operatingIncome + totalOtherIncome - totalOtherExpense);
    const totalTax = r2(taxAcc.reduce((s, a) => s + a.value, 0));
    let netIncome = r2(incomeBeforeTax - totalTax);

    const incomeSummary = list.filter(a => a.subtype === "income-summary");
    if (near(totalRevenue + totalOpex + totalCOGS + totalOtherIncome + totalOtherExpense + totalTax, 0) && incomeSummary.some(a => a.value !== 0)) {
      netIncome = r2(incomeSummary.reduce((s, a) => s + a.value, 0));
      warnings.push("Your journal already contains closing entries - net income was read from the Income Summary account.");
    }

    const incomeStatement = {
      hasCOGS: cogs.length > 0,
      rows: [],
      totalRevenue, totalContraRevenue, netSales, totalCOGS, grossProfit,
      totalOpex, operatingIncome, totalOtherIncome, totalOtherExpense,
      incomeBeforeTax, totalTax, netIncome,
      operatingRevenue: opRev, contraRevenue: contraRev, cogsAccounts: cogs,
      operatingExpenses: opex, otherIncome: otherInc, otherExpenses: otherExp, taxes: taxAcc
    };

    // display rows (label / amount / level / bold / underline)
    const IS = incomeStatement.rows;
    if (cogs.length || contraRev.length) {
      opRev.forEach(a => IS.push({ label: a.name, amount: a.value, level: 1 }));
      IS.push({ label: cogs.length ? "Gross Sales" : "Total Revenues", amount: totalRevenue, level: 0, bold: true });
      contraRev.forEach(a => IS.push({ label: "Less: " + a.name, amount: -a.value, level: 1 }));
      IS.push({ label: "Net Sales", amount: netSales, level: 0, bold: true, underline: true });
      if (cogs.length) {
        cogs.forEach(a => IS.push({ label: a.name, amount: a.value, level: 1 }));
        IS.push({ label: "Total Cost of Goods Sold", amount: totalCOGS, level: 0, bold: true });
        IS.push({ label: "Gross Profit", amount: grossProfit, level: 0, bold: true, underline: true });
      }
    } else {
      opRev.forEach(a => IS.push({ label: a.name, amount: a.value, level: 1 }));
      IS.push({ label: "Total Revenues", amount: totalRevenue, level: 0, bold: true, underline: true });
    }
    opex.forEach(a => IS.push({ label: a.name, amount: a.value, level: 1 }));
    IS.push({ label: "Total Operating Expenses", amount: totalOpex, level: 0, bold: true });
    IS.push({ label: cogs.length ? "Income from Operations" : "Net Income from Operations", amount: operatingIncome, level: 0, bold: true, underline: true });
    if (otherInc.length || otherExp.length) {
      IS.push({ label: "Other Income and Expenses", amount: null, level: 0, bold: true });
      otherInc.forEach(a => IS.push({ label: a.name, amount: a.value, level: 1 }));
      otherExp.forEach(a => IS.push({ label: a.name, amount: -a.value, level: 1 }));
      IS.push({ label: "Income Before Income Tax", amount: incomeBeforeTax, level: 0, bold: true, underline: true });
    }
    if (taxAcc.length) {
      IS.push({ label: "Income Tax Expense", amount: totalTax, level: 1 });
    }
    IS.push({ label: "NET INCOME" + (netIncome < 0 ? " (LOSS)" : ""), amount: netIncome, level: 0, bold: true, double: true });

    /* ---------------- Equity statement ---------------- */
    const autoCorp = list.some(a => (a.subtype === "contributed-capital" || a.subtype === "retained-earnings") && (a.value !== 0 || a.opening !== 0));
    const isCorp = cfg.entity === "corporation" ? true : (cfg.entity === "sole-proprietorship" ? false : autoCorp);
    const capitalAccounts = by("equity", "owner-capital");
    const contributed = by("equity", "contributed-capital");
    const retained = by("equity", "retained-earnings");
    const drawings = by("equity", "drawings");
    const treasury = by("equity", "treasury");

    const beginCapital = r2(capitalAccounts.reduce((s, a) => s + a.opening, 0));
    const investments = r2(capitalAccounts.reduce((s, a) => s + ((a.credit - a.debit) - (a.adjCredit - a.adjDebit)), 0));
    const totalDrawings = r2(drawings.reduce((s, a) => s + a.value, 0));
    const endCapital = r2(beginCapital + investments + netIncome - totalDrawings);

    const beginContributed = r2(contributed.reduce((s, a) => s + a.opening, 0));
    const endContributed = r2(contributed.reduce((s, a) => s + a.value, 0));
    const beginRetained = r2(retained.reduce((s, a) => s + a.opening, 0));
    const journalRE = r2(retained.reduce((s, a) => s + ((a.credit - a.debit) - (a.adjCredit - a.adjDebit)), 0));
    const totalDividends = r2(drawings.reduce((s, a) => s + a.value, 0));
    const endRetained = r2(beginRetained + journalRE + netIncome - totalDividends);
    const treasuryBalance = r2(treasury.reduce((s, a) => s + a.value, 0));
    const totalEquity = isCorp ? r2(endContributed + endRetained - treasuryBalance) : r2(endCapital - treasuryBalance);

    const equityStatement = {
      isCorp,
      rows: [],
      beginCapital, investments, totalDrawings, endCapital,
      beginContributed, endContributed, beginRetained, journalRE, totalDividends, endRetained,
      treasuryBalance, totalEquity, netIncome,
      capitalAccounts, contributedAccounts: contributed, retainedAccounts: retained, drawingsAccounts: drawings
    };
    const EQ = equityStatement.rows;
    if (isCorp) {
      EQ.push({ label: "Retained Earnings, beginning", amount: beginRetained, level: 0 });
      EQ.push({ label: "Add: Net Income", amount: netIncome, level: 1 });
      EQ.push({ label: "Less: Dividends Declared", amount: -totalDividends, level: 1 });
      EQ.push({ label: "Retained Earnings, ending", amount: endRetained, level: 0, bold: true, underline: true });
    } else {
      EQ.push({ label: "Owner's Capital, beginning", amount: beginCapital, level: 0 });
      EQ.push({ label: "Add: Additional Investments", amount: investments, level: 1 });
      EQ.push({ label: netIncome < 0 ? "Less: Net Loss" : "Add: Net Income", amount: netIncome, level: 1 });
      EQ.push({ label: "Less: Drawings", amount: -totalDrawings, level: 1 });
      EQ.push({ label: "Owner's Capital, ending", amount: endCapital, level: 0, bold: true, underline: true });
    }

    /* ---------------- Balance sheet ---------------- */
    const cashAccounts = by("asset", "cash");
    const currentAssets = by("asset", "current-asset");
    const contraAssets = by("asset", "contra-asset");
    const currentContra = contraAssets.filter(a => a.section !== "ppe");
    const ppeContra = contraAssets.filter(a => a.section === "ppe");
    const ppe = list.filter(a => a.subtype === "noncurrent-asset" && (a.section === "ppe" || !a.section)).sort(byName);
    const intangibles = list.filter(a => a.subtype === "noncurrent-asset" && a.section === "intangibles").sort(byName);
    const ltInvestments = list.filter(a => a.subtype === "noncurrent-asset" && a.section === "investments").sort(byName);
    const currentLiab = by("liability", "current-liability");
    const noncurrentLiab = by("liability", "noncurrent-liability");
    const unclassified = list.filter(a => a.type === "unknown");

    const totalCash = r2(cashAccounts.reduce((s, a) => s + a.value, 0));
    const totalCurrentAssets = r2(totalCash + currentAssets.reduce((s, a) => s + a.value, 0) + currentContra.reduce((s, a) => s + a.value, 0));
    const grossPPE = r2(ppe.reduce((s, a) => s + a.value, 0));
    const accumDep = r2(ppeContra.reduce((s, a) => s + a.value, 0));
    const netPPE = r2(grossPPE - accumDep);
    const totalIntangibles = r2(intangibles.reduce((s, a) => s + a.value, 0));
    const totalLTInvestments = r2(ltInvestments.reduce((s, a) => s + a.value, 0));
    const totalNoncurrentAssets = r2(netPPE + totalIntangibles + totalLTInvestments);
    const unclassifiedDebit = r2(unclassified.filter(a => a.normal === "debit").reduce((s, a) => s + a.value, 0));
    const totalAssets = r2(totalCurrentAssets + totalNoncurrentAssets + unclassifiedDebit);

    const totalCurrentLiab = r2(currentLiab.reduce((s, a) => s + a.value, 0));
    const totalNoncurrentLiab = r2(noncurrentLiab.reduce((s, a) => s + a.value, 0));
    const unclassifiedCredit = r2(unclassified.filter(a => a.normal === "credit").reduce((s, a) => s + a.value, 0));
    const totalLiabilities = r2(totalCurrentLiab + totalNoncurrentLiab + unclassifiedCredit);
    const totalLiabAndEquity = r2(totalLiabilities + totalEquity);

    const balanceSheet = {
      rows: [],
      cashAccounts, currentAssets, currentContra, ppe, ppeContra, intangibles, ltInvestments,
      currentLiabilities: currentLiab, noncurrentLiabilities: noncurrentLiab,
      unclassified,
      totalCash, totalCurrentAssets, grossPPE, accumDep, netPPE, totalIntangibles, totalLTInvestments,
      totalNoncurrentAssets, totalAssets, totalCurrentLiab, totalNoncurrentLiab, totalLiabilities,
      totalEquity, totalLiabAndEquity, balanced: near(totalAssets, totalLiabAndEquity),
      difference: r2(totalAssets - totalLiabAndEquity)
    };
    const BS = balanceSheet.rows;
    BS.push({ label: "CURRENT ASSETS", amount: null, level: 0, bold: true });
    cashAccounts.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
    currentAssets.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
    currentContra.forEach(a => BS.push({ label: "Less: " + a.name, amount: -a.value, level: 1 }));
    BS.push({ label: "Total Current Assets", amount: totalCurrentAssets, level: 0, bold: true, underline: true });
    if (ppe.length || ppeContra.length) {
      BS.push({ label: "PROPERTY, PLANT AND EQUIPMENT", amount: null, level: 0, bold: true });
      ppe.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
      BS.push({ label: "Total Cost", amount: grossPPE, level: 0 });
      BS.push({ label: "Less: Accumulated Depreciation", amount: -accumDep, level: 1 });
      BS.push({ label: "Net Property, Plant and Equipment", amount: netPPE, level: 0, bold: true, underline: true });
    }
    if (intangibles.length) {
      BS.push({ label: "INTANGIBLE ASSETS", amount: null, level: 0, bold: true });
      intangibles.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
      BS.push({ label: "Total Intangible Assets", amount: totalIntangibles, level: 0, bold: true, underline: true });
    }
    if (ltInvestments.length) {
      BS.push({ label: "LONG-TERM INVESTMENTS", amount: null, level: 0, bold: true });
      ltInvestments.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
      BS.push({ label: "Total Long-Term Investments", amount: totalLTInvestments, level: 0, bold: true, underline: true });
    }
    if (unclassifiedDebit) {
      BS.push({ label: "UNCLASSIFIED (fix in Account Types)", amount: unclassifiedDebit, level: 0, bold: true });
      unclassified.filter(a => a.normal === "debit").forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
    }
    BS.push({ label: "TOTAL ASSETS", amount: totalAssets, level: 0, bold: true, double: true });
    BS.push({ label: "CURRENT LIABILITIES", amount: null, level: 0, bold: true });
    currentLiab.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
    BS.push({ label: "Total Current Liabilities", amount: totalCurrentLiab, level: 0, bold: true, underline: true });
    if (noncurrentLiab.length) {
      BS.push({ label: "NON-CURRENT LIABILITIES", amount: null, level: 0, bold: true });
      noncurrentLiab.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
      BS.push({ label: "Total Non-Current Liabilities", amount: totalNoncurrentLiab, level: 0, bold: true, underline: true });
    }
    if (unclassifiedCredit) {
      BS.push({ label: "UNCLASSIFIED (fix in Account Types)", amount: unclassifiedCredit, level: 0, bold: true });
      unclassified.filter(a => a.normal === "credit").forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
    }
    BS.push({ label: "TOTAL LIABILITIES", amount: totalLiabilities, level: 0, bold: true, underline: true });
    BS.push({ label: isCorp ? "STOCKHOLDERS' EQUITY" : "OWNER'S EQUITY", amount: null, level: 0, bold: true });
    if (isCorp) {
      contributed.forEach(a => BS.push({ label: a.name, amount: a.value, level: 1 }));
      BS.push({ label: "Retained Earnings", amount: endRetained, level: 1 });
      if (treasuryBalance) BS.push({ label: "Less: Treasury Shares", amount: -treasuryBalance, level: 1 });
    } else {
      BS.push({ label: capitalAccounts.length ? capitalAccounts.map(a => a.name).join(", ") : "Owner's Capital", amount: endCapital, level: 1 });
      if (treasuryBalance) BS.push({ label: "Less: Treasury Shares", amount: -treasuryBalance, level: 1 });
    }
    BS.push({ label: "Total " + (isCorp ? "Stockholders'" : "Owner's") + " Equity", amount: totalEquity, level: 0, bold: true, underline: true });
    BS.push({ label: "TOTAL LIABILITIES AND " + (isCorp ? "STOCKHOLDERS'" : "OWNER'S") + " EQUITY", amount: totalLiabAndEquity, level: 0, bold: true, double: true });

    /* ---------------- Statement of cash flows (indirect) ---------------- */
    const cashFlow = buildCashFlow({
      list, accounts, lines, adjustments, netIncome, entries: cfg.entries || [],
      beginCash: r2(cashAccounts.reduce((s, a) => s + a.opening, 0)),
      endCash: totalCash, currency: cfg.currency
    });

    /* ---------------- Worksheet ---------------- */
    const worksheet = buildWorksheet(list, { incomeStatement, balanceSheet, netIncome });

    /* ---------------- Checks ---------------- */
    const checks = [];
    const unbalanced = (cfg.entries && cfg.entries.length ? cfg.entries : []).filter(e => !e.balanced);
    checks.push(unbalanced.length === 0
      ? { level: "ok", label: "Journal entries", message: `${(cfg.entries || []).length} entries all balance (debits = credits).` }
      : { level: "error", label: "Journal entries", message: `${unbalanced.length} unbalanced entr${unbalanced.length === 1 ? "y" : "ies"}: ` + unbalanced.map(e => `#${e.no} ${e.date || ""} off by ${fmtMoney(e.difference, { currency: cfg.currency })}`).join("; ") });
    checks.push(unadjustedTB.balanced
      ? { level: "ok", label: "Unadjusted trial balance", message: `Debits ${fmtMoney(unadjustedTB.totalDebit, { currency: cfg.currency })} = Credits ${fmtMoney(unadjustedTB.totalCredit, { currency: cfg.currency })}.` }
      : { level: "error", label: "Unadjusted trial balance", message: `Out of balance by ${fmtMoney(unadjustedTB.totalDebit - unadjustedTB.totalCredit, { currency: cfg.currency })}.` });
    if (adjustments.length) {
      checks.push(adjustedTB.balanced
        ? { level: "ok", label: "Adjusted trial balance", message: `Debits ${fmtMoney(adjustedTB.totalDebit, { currency: cfg.currency })} = Credits ${fmtMoney(adjustedTB.totalCredit, { currency: cfg.currency })}.` }
        : { level: "error", label: "Adjusted trial balance", message: `Out of balance by ${fmtMoney(adjustedTB.totalDebit - adjustedTB.totalCredit, { currency: cfg.currency })}.` });
    }
    checks.push(balanceSheet.balanced
      ? { level: "ok", label: "Balance sheet", message: `Assets ${fmtMoney(totalAssets, { currency: cfg.currency })} = Liabilities + Equity ${fmtMoney(totalLiabAndEquity, { currency: cfg.currency })}.` }
      : { level: "error", label: "Balance sheet", message: `Does not balance - difference of ${fmtMoney(balanceSheet.difference, { currency: cfg.currency })}. Usually an unclassified account.` });
    checks.push(cashFlow.ties
      ? { level: "ok", label: "Statement of cash flows", message: `Reconciles to the change in cash (${fmtMoney(cashFlow.netChange, { currency: cfg.currency })}).` }
      : { level: "warn", label: "Statement of cash flows", message: `Does not tie to the change in cash - off by ${fmtMoney(cashFlow.unexplained, { currency: cfg.currency })}. Check for non-cash transactions or misclassified accounts.` });
    if (!cashAccounts.length) checks.push({ level: "warn", label: "Cash account", message: "No cash account found - the statement of cash flows will be incomplete." });
    warnings.forEach(w => checks.push({ level: "warn", label: "Notice", message: w }));
    checks.push({ level: "info", label: "Net income", message: netIncome < 0 ? `Net loss of ${fmtMoney(-netIncome, { currency: cfg.currency })} for the period.` : `Net income of ${fmtMoney(netIncome, { currency: cfg.currency })} for the period.` });

    return {
      entries: cfg.entries || [],
      accounts: list, by, byType,
      unadjustedTB, adjustedTB,
      incomeStatement, equityStatement, balanceSheet, cashFlow, worksheet,
      checks, warnings,
      entity: isCorp ? "corporation" : "sole-proprietorship",
      base: cfg.base, currency: cfg.currency,
      totals: {
        lines: lines.length, adjustments: adjustments.length,
        accountCount: list.length,
        totalDebit: unadjustedTB.totalDebit, totalCredit: unadjustedTB.totalCredit,
        netIncome, totalAssets, totalLiabilities, totalEquity
      }
    };
  }

  function buildCashFlow(ctx) {
    const { list, lines, adjustments, netIncome, beginCash, endCash, currency } = ctx;
    const money = v => fmtMoney(v, { currency });
    const rows = [];
    const all = lines.concat(adjustments);

    // --- operating ---
    const noncash = list.filter(a => a.noncash && a.type === "expense");
    const depreciation = r2(noncash.reduce((s, a) => s + a.value, 0));
    const gains = r2(list.filter(a => a.type === "revenue" && /gain/.test(normalizeName(a.name))).reduce((s, a) => s + a.value, 0));
    const losses = r2(list.filter(a => a.type === "expense" && /loss/.test(normalizeName(a.name))).reduce((s, a) => s + a.value, 0));

    const currentAssets = list.filter(a => a.type === "asset" && (a.subtype === "current-asset" || (a.subtype === "contra-asset" && a.section !== "ppe")));
    const currentLiab = list.filter(a => a.type === "liability" && a.subtype === "current-liability");

    const opRows = [];
    rows.push({ label: "OPERATING ACTIVITIES", level: 0, bold: true });
    rows.push({ label: "Net Income", amount: netIncome, level: 1 });
    rows.push({ label: "Adjustments to reconcile net income to net cash provided by operating activities:", level: 1, italic: true });
    if (depreciation) rows.push({ label: "Depreciation and amortization expense", amount: depreciation, level: 2 });
    if (gains) rows.push({ label: "Gain on sale of assets", amount: -gains, level: 2 });
    if (losses) rows.push({ label: "Loss on sale of assets", amount: losses, level: 2 });

    let wcTotal = 0;
    const wcRows = [];
    currentAssets.forEach(a => {
      const change = r2(a.value - a.opening);
      if (near(change, 0)) return;
      const effect = -change;
      wcTotal = r2(wcTotal + effect);
      wcRows.push({ label: (change > 0 ? "Increase in " : "Decrease in ") + a.name, amount: effect, level: 2 });
    });
    currentLiab.forEach(a => {
      const change = r2(a.value - a.opening);
      if (near(change, 0)) return;
      wcTotal = r2(wcTotal + change);
      wcRows.push({ label: (change > 0 ? "Increase in " : "Decrease in ") + a.name, amount: change, level: 2 });
    });
    wcRows.forEach(r => rows.push(r));
    const operating = r2(netIncome + depreciation - gains + losses + wcTotal);
    rows.push({ label: operating < 0 ? "Net cash used in operating activities" : "Net cash provided by operating activities", amount: operating, level: 0, bold: true, underline: true });

    // --- investing (paired with the cash line of the same journal entry) ---
    const noncurrent = list.filter(a => a.type === "asset" && a.subtype === "noncurrent-asset");
    const investRows = [];
    const cashName = n => /cash|bank|petty/.test(normalizeName(n));
    const entryOf = new Map();
    (ctx.entries || []).forEach(e => e.lines.forEach(l => entryOf.set(l, e)));
    noncurrent.forEach(a => {
      const postings = all.filter(l => l.account === a.name);
      const disposals = r2(postings.reduce((s, l) => s + Math.max(0, (l.credit || 0) - (l.debit || 0)), 0));
      const change = r2(a.value - a.opening);
      const purchases = r2(change + disposals);
      if (!near(purchases, 0)) {
        investRows.push({ label: "Purchase of " + a.name, amount: -purchases, level: 1 });
      }
      if (!near(disposals, 0)) {
        const proceeds = r2(postings.filter(l => l.credit > l.debit).reduce((s, l) => {
          const entry = entryOf.get(l);
          const cashLine = entry && entry.lines.find(x => x !== l && cashName(x.account) && x.debit > x.credit);
          return s + (cashLine ? cashLine.debit - cashLine.credit : 0);
        }, 0));
        if (!near(proceeds, 0)) investRows.push({ label: "Proceeds from sale of " + a.name, amount: proceeds, level: 1 });
      }
    });
    rows.push({ label: "INVESTING ACTIVITIES", level: 0, bold: true });
    investRows.forEach(r => rows.push(r));
    const investing = r2(investRows.reduce((s, r) => s + r.amount, 0));
    rows.push({ label: investing < 0 ? "Net cash used in investing activities" : "Net cash provided by investing activities", amount: investing, level: 0, bold: true, underline: true });

    // --- financing ---
    const finRows = [];
    list.filter(a => a.type === "equity" && (a.subtype === "owner-capital" || a.subtype === "contributed-capital")).forEach(a => {
      const change = r2(a.value - a.opening);
      if (near(change, 0)) return;
      finRows.push({ label: change > 0 ? "Proceeds from " + a.name : "Repayment of " + a.name, amount: change, level: 1 });
    });
    list.filter(a => a.type === "equity" && (a.subtype === "drawings" || a.subtype === "treasury")).forEach(a => {
      const change = r2(a.value - a.opening);
      if (near(change, 0)) return;
      finRows.push({ label: (a.subtype === "treasury" ? "Purchase of treasury shares" : "Owner's drawings / dividends"), amount: -change, level: 1 });
    });
    list.filter(a => a.type === "liability" && a.subtype === "noncurrent-liability").forEach(a => {
      const change = r2(a.value - a.opening);
      if (near(change, 0)) return;
      finRows.push({ label: change > 0 ? "Proceeds from " + a.name : "Repayment of " + a.name, amount: change, level: 1 });
    });
    rows.push({ label: "FINANCING ACTIVITIES", level: 0, bold: true });
    finRows.forEach(r => rows.push(r));
    const financing = r2(finRows.reduce((s, r) => s + r.amount, 0));
    rows.push({ label: financing < 0 ? "Net cash used in financing activities" : "Net cash provided by financing activities", amount: financing, level: 0, bold: true, underline: true });

    const netChange = r2(operating + investing + financing);
    const actual = r2(endCash - beginCash);
    rows.push({ label: "Net increase (decrease) in cash", amount: netChange, level: 0, bold: true });
    rows.push({ label: "Cash at beginning of period", amount: beginCash, level: 1 });
    rows.push({ label: "Cash at end of period", amount: r2(beginCash + netChange), level: 0, bold: true, underline: true });

    return {
      rows, operating, investing, financing, netChange,
      beginCash, endCash, actualChange: actual,
      unexplained: r2(netChange - actual),
      ties: near(netChange, actual),
      depreciation, gains, losses, workingCapitalChange: wcTotal,
      noncashNotes: []
    };
  }

  function buildWorksheet(list, ctx) {
    const rows = list
      .filter(a => a.unadjusted !== 0 || a.adjDebit || a.adjCredit || a.adjusted !== 0)
      .sort((x, y) => x.name.localeCompare(y.name))
      .map(a => {
        const incomeSide = a.type === "revenue" || a.type === "expense";
        return {
          name: a.name,
          unDr: a.normal === "debit" ? a.unadjusted : 0,
          unCr: a.normal === "credit" ? a.unadjusted : 0,
          adjDr: a.adjDebit, adjCr: a.adjCredit,
          tbDr: a.normal === "debit" ? a.adjusted : 0,
          tbCr: a.normal === "credit" ? a.adjusted : 0,
          isDr: incomeSide && a.normal === "debit" ? a.adjusted : 0,
          isCr: incomeSide && a.normal === "credit" ? a.adjusted : 0,
          bsDr: !incomeSide && a.normal === "debit" ? a.adjusted : 0,
          bsCr: !incomeSide && a.normal === "credit" ? a.adjusted : 0
        };
      });
    // Textbook worksheets carry net income across so all five column pairs agree.
    const ni = r2(ctx.netIncome || 0);
    if (!near(ni, 0)) {
      if (ni > 0) rows.push({ name: "Net Income", unDr: 0, unCr: 0, adjDr: 0, adjCr: 0, tbDr: 0, tbCr: 0, isDr: ni, isCr: 0, bsDr: 0, bsCr: ni });
      else rows.push({ name: "Net Loss", unDr: 0, unCr: 0, adjDr: 0, adjCr: 0, tbDr: 0, tbCr: 0, isDr: 0, isCr: -ni, bsDr: -ni, bsCr: 0 });
    }
    const total = key => r2(rows.reduce((s, r) => s + (r[key] || 0), 0));
    return {
      rows,
      totals: {
        unDr: total("unDr"), unCr: total("unCr"), adjDr: total("adjDr"), adjCr: total("adjCr"),
        tbDr: total("tbDr"), tbCr: total("tbCr"), isDr: total("isDr"), isCr: total("isCr"),
        bsDr: total("bsDr"), bsCr: total("bsCr")
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * General ledger (T-accounts) view
   * ------------------------------------------------------------------ */

  function buildLedger(model) {
    return model.accounts.map(a => {
      let running = a.opening;
      const postings = a.ledger.map(p => {
        const delta = a.normal === "debit" ? (p.debit - p.credit) : (p.credit - p.debit);
        running = r2(running + delta);
        return Object.assign({}, p, { balance: running });
      });
      return {
        name: a.name, type: a.type, subtype: a.subtype, normal: a.normal,
        opening: a.opening, postings,
        totalDebit: r2(a.debit + a.adjDebit), totalCredit: r2(a.credit + a.adjCredit),
        balance: a.adjusted
      };
    }).sort((x, y) => x.name.localeCompare(y.name));
  }

  /* ------------------------------------------------------------------ *
   * Export helpers
   * ------------------------------------------------------------------ */

  function toCSV(rows) {
    return rows.map(cells => cells.map(c => {
      const s = c === null || c === undefined ? "" : String(c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
  }

  function statementToCSV(model, which) {
    const m = model;
    const money = v => (v === null || v === undefined ? "" : r2(v).toFixed(2));
    if (which === "trial-balance") {
      const head = [["Account", "Type", "Debit", "Credit"]];
      const tb = m.base === "unadjusted" ? m.unadjustedTB : m.adjustedTB;
      return toCSV(head.concat(tb.rows.map(r => [r.name, r.type, money(r.debit), money(r.credit)]))
        .concat([["TOTAL", "", money(tb.totalDebit), money(tb.totalCredit)]]));
    }
    if (which === "income-statement") return toCSV([["INCOME STATEMENT"], ["Account", "Amount"]].concat(m.incomeStatement.rows.map(r => [r.label, r.amount === null ? "" : money(r.amount)])));
    if (which === "equity-statement") return toCSV([["STATEMENT OF CHANGES IN EQUITY"], ["Account", "Amount"]].concat(m.equityStatement.rows.map(r => [r.label, r.amount === null ? "" : money(r.amount)])));
    if (which === "balance-sheet") return toCSV([["BALANCE SHEET"], ["Account", "Amount"]].concat(m.balanceSheet.rows.map(r => [r.label, r.amount === null ? "" : money(r.amount)])));
    if (which === "cash-flow") return toCSV([["STATEMENT OF CASH FLOWS"], ["Account", "Amount"]].concat(m.cashFlow.rows.map(r => [r.label, r.amount === null || r.amount === undefined ? "" : money(r.amount)])));
    if (which === "journal") {
      const out = [["Date", "Account Titles and Explanation", "Debit", "Credit", "Memo"]];
      m.entries && m.entries.forEach(e => e.lines.forEach((l, i) => out.push([i === 0 ? e.date : "", (i === 0 ? "" : "     ") + l.account, l.debit ? money(l.debit) : "", l.credit ? money(l.credit) : "", l.memo || ""])));
      return toCSV(out);
    }
    if (which === "ledger") {
      const out = [["Account", "Date", "Particulars", "Debit", "Credit", "Balance"]];
      buildLedger(m).forEach(acc => {
        if (acc.opening) out.push([acc.name, "", "Balance forward", "", "", money(acc.opening)]);
        acc.postings.forEach(p => out.push([acc.name, p.date, p.memo || (p.debit ? "Debit" : "Credit"), money(p.debit) || "", money(p.credit) || "", money(p.balance)]));
      });
      return toCSV(out);
    }
    if (which === "worksheet") {
      const w = m.worksheet;
      const out = [["Account", "Unadjusted Dr", "Unadjusted Cr", "Adjustments Dr", "Adjustments Cr", "Adjusted TB Dr", "Adjusted TB Cr", "Income Statement Dr", "Income Statement Cr", "Balance Sheet Dr", "Balance Sheet Cr"]];
      w.rows.forEach(r => out.push([r.name, money(r.unDr), money(r.unCr), money(r.adjDr), money(r.adjCr), money(r.tbDr), money(r.tbCr), money(r.isDr), money(r.isCr), money(r.bsDr), money(r.bsCr)]));
      out.push(["TOTALS", money(w.totals.unDr), money(w.totals.unCr), money(w.totals.adjDr), money(w.totals.adjCr), money(w.totals.tbDr), money(w.totals.tbCr), money(w.totals.isDr), money(w.totals.isCr), money(w.totals.bsDr), money(w.totals.bsCr)]);
      return toCSV(out);
    }
    throw new Error("Unknown statement: " + which);
  }

  function pad(s, n) { s = String(s === null || s === undefined ? "" : s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
  function padL(s, n) { s = String(s === null || s === undefined ? "" : s); return s.length >= n ? s : " ".repeat(n - s.length) + s; }

  /** Fixed-width plain text report - safe to paste into Word or a terminal. */
  function toTextReport(model, meta) {
    const o = meta || {};
    const cur = { currency: model.currency };
    const W = 74;
    const out = [];
    const title = block => {
      out.push("");
      out.push((o.company || "").toUpperCase());
      out.push(block);
      if (o.period) out.push("For the period ended " + o.period);
      out.push("=".repeat(W));
    };
    const line = (label, amount, level, opts) => {
      const x = opts || {};
      const indent = "  ".repeat(level || 0);
      const text = x.bold ? label.toUpperCase() : label;
      let s = pad(indent + text, W - 16) + padL(amount === null || amount === undefined ? "" : fmtMoney(amount, cur), 16);
      if (x.underline) s += "\n" + " ".repeat(W - 16) + "-".repeat(16);
      if (x.double) s += "\n" + " ".repeat(W - 16) + "=".repeat(16);
      out.push(s);
    };

    title("GENERAL JOURNAL");
    out.push(pad("Date", 12) + pad("Account Titles and Explanation", 40) + padL("Debit", 11) + padL("Credit", 11));
    const entries = (o.entries || model.entries || []);
    entries.forEach(e => {
      e.lines.forEach((l, i) => {
        out.push(pad(i === 0 ? e.date : "", 12) + pad((i === 0 ? "" : "     ") + l.account, 40) + padL(l.debit ? fmtMoney(l.debit, cur) : "", 11) + padL(l.credit ? fmtMoney(l.credit, cur) : "", 11));
      });
    });
    out.push(pad("TOTALS", 52) + padL(fmtMoney(o.totalDebit !== undefined ? o.totalDebit : (model.meta ? model.meta.totalDebit : 0), cur), 11) + padL(fmtMoney(o.totalCredit !== undefined ? o.totalCredit : 0, cur), 11));

    title("GENERAL LEDGER");
    buildLedger(model).forEach(a => {
      if (!a.postings.length && !a.opening) return;
      out.push("-- " + a.name + " (" + a.type + ")");
      if (a.opening) out.push(pad("", 12) + pad("Balance forward", 40) + padL(fmtMoney(a.opening, cur), 22));
      a.postings.forEach(p => out.push(pad(p.date, 12) + pad(p.memo || (p.debit ? "Debit" : "Credit"), 40) + padL(p.debit ? fmtMoney(p.debit, cur) : "", 11) + padL(p.credit ? fmtMoney(p.credit, cur) : "", 11)));
      out.push(pad("Balance", 52) + padL(fmtMoney(a.balance, cur), 22));
      out.push("");
    });

    const tb = model.base === "unadjusted" ? model.unadjustedTB : model.adjustedTB;
    title((model.base === "unadjusted" ? "UNADJUSTED" : "ADJUSTED") + " TRIAL BALANCE");
    tb.rows.forEach(r => out.push(pad(r.name, 52) + padL(r.debit ? fmtMoney(r.debit, cur) : "", 11) + padL(r.credit ? fmtMoney(r.credit, cur) : "", 11)));
    out.push(pad("TOTALS", 52) + padL(fmtMoney(tb.totalDebit, cur), 11) + padL(fmtMoney(tb.totalCredit, cur), 11));

    title("INCOME STATEMENT");
    model.incomeStatement.rows.forEach(r => line(r.label, r.amount, r.level, r));
    title("STATEMENT OF CHANGES IN " + (model.equityStatement.isCorp ? "RETAINED EARNINGS" : "OWNER'S EQUITY"));
    model.equityStatement.rows.forEach(r => line(r.label, r.amount, r.level, r));
    title("BALANCE SHEET");
    model.balanceSheet.rows.forEach(r => line(r.label, r.amount, r.level, r));
    title("STATEMENT OF CASH FLOWS (INDIRECT METHOD)");
    model.cashFlow.rows.forEach(r => line(r.label, r.amount, r.level, r));

    title("CHECKS");
    model.checks.forEach(c => out.push(`[${c.level.toUpperCase()}] ${c.label}: ${c.message}`));
    return out.join("\n");
  }

  /* ------------------------------------------------------------------ *
   * Sample data (a full month of a small service business)
   * ------------------------------------------------------------------ */

  const SAMPLE_JOURNAL = [
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

  const SAMPLE_ADJUSTMENTS = [
    "Date\tAccount Titles and Explanation\tDebit\tCredit\tMemo",
    "2025-01-31\tInsurance Expense\t1000\t\tOne month of insurance expired",
    "2025-01-31\tPrepaid Insurance\t\t1000\tOne month of insurance expired",
    "2025-01-31\tDepreciation Expense\t800\t\tMonthly depreciation",
    "2025-01-31\tAccumulated Depreciation - Office Equipment\t\t800\tMonthly depreciation",
    "2025-01-31\tSupplies Expense\t2900\t\tSupplies used",
    "2025-01-31\tSupplies\t\t2900\tSupplies used",
    "2025-01-31\tSalaries Expense\t2000\t\tUnpaid salaries",
    "2025-01-31\tSalaries Payable\t\t2000\tUnpaid salaries",
    "2025-01-31\tAccounts Receivable\t3000\t\tAccrued service revenue",
    "2025-01-31\tService Revenue\t\t3000\tAccrued service revenue"
  ].join("\n");

  return {
    r2, near, parseAmount, fmtMoney, normalizeName, classifyAccount, baseClassification,
    parseJournalText, parseJournalRows, parseBalanceList, splitRow, detectDelimiter, parseFreeformLine,
    xlsxSheetToRows, xlsxColumnIndex, excelSerialToDate, decodeXml, looksLikeDate, mapHeader, isHeaderRow,
    buildModel, buildLedger, buildCashFlow, buildWorksheet,
    toCSV, statementToCSV, toTextReport,
    SAMPLE_JOURNAL, SAMPLE_ADJUSTMENTS,
    CURRENCY
  };
});
