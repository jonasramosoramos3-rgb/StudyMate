// FinanceFlow - Complete Automated Accounting System - GAAP Double Entry
// Fixed issues: persistence, accounts preview, journal posting, company modal closable, copy all journals

const DEFAULT_ACCOUNTS = [
  {code:'1000', name:'Cash', type:'Asset', normal:'Debit'},
  {code:'1010', name:'Accounts Receivable', type:'Asset', normal:'Debit'},
  {code:'1020', name:'Supplies', type:'Asset', normal:'Debit'},
  {code:'1030', name:'Prepaid Rent', type:'Asset', normal:'Debit'},
  {code:'1040', name:'Prepaid Insurance', type:'Asset', normal:'Debit'},
  {code:'1500', name:'Equipment', type:'Asset', normal:'Debit'},
  {code:'1510', name:'Accumulated Depreciation - Equipment', type:'Asset', normal:'Credit'},
  {code:'1600', name:'Buildings', type:'Asset', normal:'Debit'},
  {code:'2000', name:'Accounts Payable', type:'Liability', normal:'Credit'},
  {code:'2010', name:'Salaries Payable', type:'Liability', normal:'Credit'},
  {code:'2020', name:'Unearned Revenue', type:'Liability', normal:'Credit'},
  {code:'2100', name:'Notes Payable', type:'Liability', normal:'Credit'},
  {code:'2110', name:'Interest Payable', type:'Liability', normal:'Credit'},
  {code:'3000', name:"Owner's Capital", type:'Equity', normal:'Credit'},
  {code:'3010', name:'Retained Earnings', type:'Equity', normal:'Credit'},
  {code:'3020', name:"Owner's Drawings", type:'Equity', normal:'Debit'},
  {code:'3100', name:'Common Stock', type:'Equity', normal:'Credit'},
  {code:'4000', name:'Sales Revenue', type:'Revenue', normal:'Credit'},
  {code:'4010', name:'Service Revenue', type:'Revenue', normal:'Credit'},
  {code:'4020', name:'Interest Revenue', type:'Revenue', normal:'Credit'},
  {code:'5000', name:'Cost of Goods Sold', type:'Expense', normal:'Debit'},
  {code:'5010', name:'Salaries Expense', type:'Expense', normal:'Debit'},
  {code:'5020', name:'Rent Expense', type:'Expense', normal:'Debit'},
  {code:'5030', name:'Utilities Expense', type:'Expense', normal:'Debit'},
  {code:'5040', name:'Depreciation Expense', type:'Expense', normal:'Debit'},
  {code:'5050', name:'Supplies Expense', type:'Expense', normal:'Debit'},
  {code:'5060', name:'Insurance Expense', type:'Expense', normal:'Debit'},
  {code:'5070', name:'Interest Expense', type:'Expense', normal:'Debit'},
  {code:'5080', name:'Advertising Expense', type:'Expense', normal:'Debit'},
];

class LedgerApp {
  constructor(){
    this.storageKey='financeflow_v1';
    this.company = {
      name:'Acme Corporation',
      address:'123 Business Ave, New York, NY 10001',
      currency:'$',
      fyEnd:'2025-12-31',
      start:'2025-01-01',
      end:'2025-12-31',
      method:'accrual'
    };
    this.accounts = [];
    this.journals = [];
    this.editingJournalId = null;
    this.currentView='dashboard';
    this.currentLedgerCode=null;
    this.currentStmt='income';
    this.init();
  }

  init(){
    this.load();
    this.bindNav();
    this.bindEvents();
    this.renderAll();
    this.switchView('dashboard');
    // set today's date for new entry
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('jDate').value = today;
    if(!document.getElementById('compFY').value) document.getElementById('compFY').value='2025-12-31';
    if(!document.getElementById('compStart').value) document.getElementById('compStart').value='2025-01-01';
    if(!document.getElementById('compEnd').value) document.getElementById('compEnd').value='2025-12-31';
  }

  load(){
    try{
      const raw = localStorage.getItem(this.storageKey);
      if(raw){
        const data = JSON.parse(raw);
        this.company = data.company || this.company;
        this.accounts = data.accounts || [];
        this.journals = data.journals || [];
      }
    }catch(e){ console.error('load failed',e); }
    if(this.accounts.length===0){
      this.accounts = DEFAULT_ACCOUNTS.map((a,i)=>({...a, id:'acc_'+i+'_'+a.code, balance:0}));
      // seed with sample opening entry if no journals
      if(this.journals.length===0){
        const opening = {
          id:'j_'+Date.now(),
          date:this.company.start,
          ref:'JE-0001',
          desc:'Initial investment by owner',
          lines:[
            {accountCode:'1000', accountName:'Cash', debit:50000, credit:0, memo:''},
            {accountCode:'3000', accountName:"Owner's Capital", debit:0, credit:50000, memo:''}
          ],
          isAdjusting:false,
          createdAt:Date.now()
        };
        this.journals=[opening];
      }
      this.save();
    }
    // ensure ids
    this.accounts = this.accounts.map((a,i)=>({id:a.id||'acc_'+i+'_'+a.code, balance:a.balance||0, ...a}));
  }

  save(){
    localStorage.setItem(this.storageKey, JSON.stringify({
      company:this.company,
      accounts:this.accounts,
      journals:this.journals
    }));
  }

  bindNav(){
    document.querySelectorAll('.nav-btn').forEach(b=>{
      b.addEventListener('click',()=>this.switchView(b.dataset.view));
    });
    document.querySelectorAll('.stmt-tab').forEach(b=>{
      b.addEventListener('click',()=>{
        document.querySelectorAll('.stmt-tab').forEach(x=>{x.className='stmt-tab px-4 py-2 rounded-full border bg-white mono text-[12px] font-bold';});
        b.className='stmt-tab px-4 py-2 rounded-full bg-ink-900 text-white mono text-[12px] font-bold';
        this.currentStmt=b.dataset.stmt;
        document.querySelectorAll('.stmt-view').forEach(v=>v.classList.add('hidden'));
        document.getElementById('stmt-'+this.currentStmt).classList.remove('hidden');
      });
    });
  }

  bindEvents(){
    document.getElementById('coaSearch')?.addEventListener('input',()=>this.renderCOA());
    document.getElementById('coaFilter')?.addEventListener('change',()=>this.renderCOA());
    document.getElementById('journalSearch')?.addEventListener('input',()=>this.renderJournals());
    document.getElementById('ledgerAccount')?.addEventListener('change',(e)=>this.showLedger(e.target.value));
    document.getElementById('importFile')?.addEventListener('change',(e)=>this.importJSON(e));
    // company live preview
    ['compName','compAddress','compCurrency','compFY','compStart','compEnd'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input',()=>this.updateCompanyPreview());
    });
    document.querySelectorAll('input[name="method"]').forEach(r=>r.addEventListener('change',()=>this.updateCompanyPreview()));
  }

  switchView(view){
    this.currentView=view;
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.getElementById('view-'+view).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b=>{
      const isActive=b.dataset.view===view;
      b.classList.toggle('nav-active',isActive);
      if(isActive){
        b.classList.remove('hover:bg-slate-800','hover:text-white');
      } else {
        b.classList.add('hover:bg-slate-800','hover:text-white');
      }
    });
    const titles={
      dashboard:['Dashboard','Overview • Real-time accounting equation'],
      company:['Company Setup','Edit company info — you can leave anytime by clicking another tab'],
      coa:['Chart of Accounts','GAAP • Click any account to view its ledger'],
      journal:['Journal Entries','Double-entry • Every entry persists in localStorage'],
      ledger:['General Ledger','Account-wise transaction history • Click accounts on left to preview'],
      trial:['Trial Balance','Debits = Credits • Unadjusted + Adjusted'],
      adjusting:['Adjusting Entries','Period-end adjustments • Accruals, Deferrals, Depreciation'],
      statements:['Financial Statements','Income → Retained Earnings → Balance Sheet → Cash Flow']
    };
    const [t,s]=titles[view]||[view,''];
    document.getElementById('viewTitle').textContent=t;
    document.getElementById('viewSubtitle').textContent=s;
    // render view-specific
    if(view==='dashboard') this.renderDashboard();
    if(view==='company') this.renderCompany();
    if(view==='coa') this.renderCOA();
    if(view==='journal') this.renderJournals();
    if(view==='ledger') this.renderLedger();
    if(view==='trial') this.renderTrial();
    if(view==='adjusting') this.renderAdjusting();
    if(view==='statements') this.renderStatements();
  }

  // ---------- Calculations ----------
  calculateBalances(){
    // reset
    const map={};
    this.accounts.forEach(a=>{ map[a.code]={...a, debit:0, credit:0, net:0, balance:0}; });
    // sum journals
    this.journals.forEach(j=>{
      j.lines.forEach(l=>{
        const acc = map[l.accountCode];
        if(!acc) return;
        acc.debit += Number(l.debit)||0;
        acc.credit += Number(l.credit)||0;
      });
    });
    // compute net based on normal
    Object.values(map).forEach(a=>{
      if(a.normal==='Debit'){
        a.net = a.debit - a.credit;
      } else {
        a.net = a.credit - a.debit;
      }
      // for trial balance, we need debit/credit balance
      if(a.type==='Asset' || a.type==='Expense' || a.code==='3020'){
        // these normally debit, but if credit > debit, show credit
        if(a.debit >= a.credit){
          a.balanceDebit = a.debit - a.credit;
          a.balanceCredit = 0;
        } else {
          a.balanceDebit = 0;
          a.balanceCredit = a.credit - a.debit;
        }
      } else {
        if(a.credit >= a.debit){
          a.balanceCredit = a.credit - a.debit;
          a.balanceDebit = 0;
        } else {
          a.balanceDebit = a.debit - a.credit;
          a.balanceCredit = 0;
        }
      }
      a.balance = a.net; // for financial statements
    });
    return map;
  }

  getTotals(){
    const balances = this.calculateBalances();
    let totalDebit=0, totalCredit=0;
    Object.values(balances).forEach(a=>{
      totalDebit+=a.balanceDebit||0;
      totalCredit+=a.balanceCredit||0;
    });
    // assets, liab, equity, revenue, expense totals for statements
    let assets=0, liab=0, equity=0, revenue=0, expense=0;
    Object.values(balances).forEach(a=>{
      if(a.type==='Asset') assets+=a.balance;
      if(a.type==='Liability') liab+=a.balance;
      if(a.type==='Equity') equity+=a.balance;
      if(a.type==='Revenue') revenue+=a.balance;
      if(a.type==='Expense') expense+=a.balance;
    });
    // equity includes capital + retained earnings, but drawings is negative
    // For our simple model, equity total as calculated already includes drawings (debit reduces equity)
    // Actually need to handle: Owner's Drawings is contra equity (debit)
    // Our balance calc: for equity type, balance = credit - debit, so drawings (debit normal but type equity) would be negative? Wait we set normal Debit for 3020
    // So handle: if account is Drawings, its balance is debit, but for equity calc we should subtract
    // Let's recalc equity properly: sum all equity accounts where normal credit minus debit, but drawings is debit
    let equityProper=0;
    Object.values(balances).forEach(a=>{
      if(a.type==='Equity'){
        if(a.code==='3020'){ equityProper -= (a.balanceDebit||0) - (a.balanceCredit||0); } // drawings
        else { equityProper += a.balance; }
      }
    });
    // Actually previous equity variable already does that because for drawings normal debit, balance = debit - credit? No we forced equity to credit - debit for all equity except drawings? Let's just compute again clean:
    // We'll trust balances.balance for each account's contribution to its type
    // For equity: capital + retained + stock - drawings
    // So recalc:
    let cap=0, ret=0, draw=0, stock=0;
    Object.values(balances).forEach(a=>{
      if(a.code==='3000') cap+=a.balance;
      if(a.code==='3010') ret+=a.balance;
      if(a.code==='3020') draw+= (a.balanceDebit||a.debit - a.credit); // debit balance
      if(a.code==='3100') stock+=a.balance;
    });
    // total equity = cap+stock+ret - draw + netIncome? netIncome will be added later in statements
    // For dashboard, we want equity = cap+stock+ret - draw (before net income closed)
    // But for accounting equation check, we need to include net income in equity
    const netIncome = revenue - expense;
    const totalEquityForEquation = equityProper + netIncome; // equityProper already includes cap, ret, stock - draw? Let's compute equityProper as cap+ret+stock - draw
    // To avoid confusion, compute from scratch for equation:
    let assetsEq=0, liabEq=0;
    Object.values(balances).forEach(a=>{
      if(a.type==='Asset') assetsEq+= a.net; // debit - credit, but for contra asset like Accum Dep, normal credit, net = credit - debit, but asset type? We treat accum dep as negative asset
      // Actually for equation we want: Assets = Liabilities + Equity
      // So Assets: sum of all asset accounts where debit normal positive, credit normal (contra) negative
    });
    // Simplify: for equation, we already have assets = sum of asset balances where contra assets are negative (because their net is credit - debit, but asset type we added net which for contra asset net = credit - debit positive, but should be negative)
    // So adjust: if account is contra asset (1510), its balance should be subtracted from assets
    let assetsCalc=0;
    Object.values(balances).forEach(a=>{
      if(a.type==='Asset'){
        if(a.code==='1510'){ assetsCalc -= a.balance; } // accum dep is contra
        else { assetsCalc += a.balance; }
      }
    });
    // Liabilities as sum of liability balances (credit - debit)
    let liabCalc=0;
    Object.values(balances).forEach(a=>{ if(a.type==='Liability') liabCalc+=a.balance; });
    // Equity calc: capital + stock + retained - drawings + netIncome
    let equityCalc = cap + stock + ret - draw + netIncome;

    return {balances, totalDebit, totalCredit, assets, liab, equity, revenue, expense, netIncome, assetsCalc, liabCalc, equityCalc, cap, ret, draw, stock};
  }

  // ---------- Renderers ----------
  renderAll(){
    this.renderCompany();
    this.renderCOA();
    this.renderJournals();
    this.renderLedger();
    this.renderDashboard();
    this.renderTrial();
    this.renderAdjusting();
    this.renderStatements();
    this.updateSidebar();
  }

  updateSidebar(){
    const {totalDebit, totalCredit, assetsCalc, liabCalc, equityCalc} = this.getTotals();
    const balanced = Math.abs(totalDebit-totalCredit) < 0.01;
    document.getElementById('sideCompanyName').textContent=this.company.name||'My Company';
    document.getElementById('sideCompanyPeriod').textContent=`${this.company.start||''} → ${this.company.end||''}`;
    document.getElementById('sideStatus').textContent=balanced?'BALANCED':'UNBALANCED';
    document.getElementById('sideStatus').className= balanced ? 'mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'mono text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20';
    document.getElementById('sideEntries').textContent=`${this.journals.length} entries`;
    document.getElementById('navJournalCount').textContent=this.journals.length;
    document.getElementById('sideCompanyName').title=this.company.name;
  }

  renderCompany(){
    document.getElementById('compName').value=this.company.name||'';
    document.getElementById('compAddress').value=this.company.address||'';
    document.getElementById('compCurrency').value=this.company.currency||'$';
    document.getElementById('compFY').value=this.company.fyEnd||'';
    document.getElementById('compStart').value=this.company.start||'';
    document.getElementById('compEnd').value=this.company.end||'';
    document.querySelectorAll('input[name="method"]').forEach(r=>{ r.checked = r.value===this.company.method; });
    this.updateCompanyPreview();
  }

  updateCompanyPreview(){
    const name=document.getElementById('compName')?.value||'Your Company';
    const addr=document.getElementById('compAddress')?.value||'';
    const cur=document.getElementById('compCurrency')?.value||'$';
    const fy=document.getElementById('compFY')?.value||'';
    const start=document.getElementById('compStart')?.value||'';
    const end=document.getElementById('compEnd')?.value||'';
    const method=document.querySelector('input[name="method"]:checked')?.value||'accrual';
    const preview = `${name}\n${addr}\n\nIncome Statement\nFor the period ${start} to ${end}\nCurrency: ${cur} • Method: ${method}\nFY End: ${fy}\n\n[This header will appear on all statements]`;
    const el=document.getElementById('compPreview');
    if(el) el.textContent=preview;
  }

  saveCompany(){
    this.company.name=document.getElementById('compName').value||'My Company';
    this.company.address=document.getElementById('compAddress').value||'';
    this.company.currency=document.getElementById('compCurrency').value||'$';
    this.company.fyEnd=document.getElementById('compFY').value||'';
    this.company.start=document.getElementById('compStart').value||'';
    this.company.end=document.getElementById('compEnd').value||'';
    this.company.method=document.querySelector('input[name="method"]:checked')?.value||'accrual';
    this.save();
    this.renderAll();
    this.toast('Company info saved ✓');
  }

  renderCOA(){
    const search=(document.getElementById('coaSearch')?.value||'').toLowerCase();
    const filter=document.getElementById('coaFilter')?.value||'all';
    const {balances}=this.getTotals();
    const body=document.getElementById('coaBody');
    if(!body) return;
    body.innerHTML='';
    this.accounts
      .filter(a=>{
        if(filter!=='all' && a.type!==filter) return false;
        if(search && !(a.code.toLowerCase().includes(search) || a.name.toLowerCase().includes(search))) return false;
        return true;
      })
      .sort((a,b)=>a.code.localeCompare(b.code))
      .forEach(acc=>{
        const bal = balances[acc.code];
        const balanceDisplay = bal ? this.fmt(bal.net) : '$0.00';
        const typeColor={Asset:'bg-emerald-50 text-emerald-700 border-emerald-200', Liability:'bg-amber-50 text-amber-700 border-amber-200', Equity:'bg-indigo-50 text-indigo-700 border-indigo-200', Revenue:'bg-violet-50 text-violet-700 border-violet-200', Expense:'bg-rose-50 text-rose-700 border-rose-200'}[acc.type]||'bg-ink-50';
        const tr=document.createElement('tr');
        tr.className='hover:bg-ink-50/70 cursor-pointer transition-colors';
        tr.innerHTML=`
          <td class="px-6 py-3 mono font-bold">${acc.code}</td>
          <td class="px-4 py-3 font-medium">${acc.name}</td>
          <td class="px-4 py-3"><span class="mono text-[11px] px-2 py-1 rounded-full border ${typeColor}">${acc.type}</span></td>
          <td class="px-4 py-3 mono text-[12px]">${acc.normal}</td>
          <td class="px-4 py-3 mono text-right font-bold">${balanceDisplay}</td>
          <td class="px-6 py-3 text-right">
            <button class="px-3 py-1 rounded-full border bg-white mono text-[11px] font-bold hover:bg-ink-900 hover:text-white" data-ledger="${acc.code}">View Ledger</button>
            <button class="ml-1 w-7 h-7 rounded-full border bg-white hover:bg-red-50" data-del="${acc.code}">✕</button>
          </td>
        `;
        tr.addEventListener('click',(e)=>{
          if(e.target.closest('button')) return;
          this.showLedger(acc.code);
          this.switchView('ledger');
        });
        body.appendChild(tr);
      });
    body.querySelectorAll('[data-ledger]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); this.showLedger(b.dataset.ledger); this.switchView('ledger'); }));
    body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); this.deleteAccount(b.dataset.del); }));
  }

  deleteAccount(code){
    // check if used in journals
    const used = this.journals.some(j=>j.lines.some(l=>l.accountCode===code));
    if(used) return this.toast('Cannot delete: account used in journal entries','⚠️');
    if(!confirm(`Delete account ${code}?`)) return;
    this.accounts=this.accounts.filter(a=>a.code!==code);
    this.save();
    this.renderAll();
    this.toast('Account deleted');
  }

  renderJournals(){
    const search=(document.getElementById('journalSearch')?.value||'').toLowerCase();
    const body=document.getElementById('journalBody');
    if(!body) return;
    body.innerHTML='';
    let totalD=0,totalC=0;
    const filtered = this.journals
      .filter(j=>{
        if(!search) return true;
        return j.desc.toLowerCase().includes(search) || j.ref.toLowerCase().includes(search) || j.lines.some(l=>l.accountName.toLowerCase().includes(search));
      })
      .sort((a,b)=> new Date(b.date)-new Date(a.date) || b.createdAt-a.createdAt);
    filtered.forEach(j=>{
      const debit = j.lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
      const credit = j.lines.reduce((s,l)=>s+(Number(l.credit)||0),0);
      totalD+=debit; totalC+=credit;
      const tr=document.createElement('tr');
      tr.className='hover:bg-ink-50 cursor-pointer transition-colors';
      tr.innerHTML=`
        <td class="px-6 py-3 mono text-[12px]">${j.date}</td>
        <td class="px-3 py-3 mono font-bold text-[12px]">${j.ref}</td>
        <td class="px-3 py-3 max-w-[320px] truncate" title="${this.esc(j.desc)}"><div class="font-medium text-[13px]">${this.esc(j.desc)}</div><div class="mono text-[11px] text-ink-500">${j.lines.length} lines • ${j.isAdjusting?'Adjusting':'Regular'}</div></td>
        <td class="px-3 py-3 mono text-right">${this.fmt(debit)}</td>
        <td class="px-3 py-3 mono text-right">${this.fmt(credit)}</td>
        <td class="px-3 py-3"><span class="mono text-[10px] px-2 py-1 rounded-full ${Math.abs(debit-credit)<0.01?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}">${Math.abs(debit-credit)<0.01?'POSTED ✓':'UNBALANCED'}</span></td>
        <td class="px-6 py-3 text-right">
          <button class="px-3 py-1 rounded-full border bg-white mono text-[11px] font-bold hover:bg-ink-900 hover:text-white" data-view="${j.id}">View</button>
          <button class="ml-1 px-3 py-1 rounded-full border bg-white mono text-[11px] font-bold hover:bg-ink-50" data-copy="${j.id}">Copy</button>
          <button class="ml-1 w-7 h-7 rounded-full border bg-white hover:bg-red-50" data-delj="${j.id}">✕</button>
        </td>
      `;
      tr.addEventListener('click',(e)=>{ if(e.target.closest('button')) return; this.viewJournal(j.id); });
      body.appendChild(tr);
    });
    if(filtered.length===0){
      body.innerHTML=`<tr><td colspan="7" class="px-6 py-12 text-center mono text-[13px] text-ink-400">No journal entries found. Click "New Journal Entry" to start — entries will persist and never disappear.</td></tr>`;
    }
    document.getElementById('journalCountBadge').textContent=`${filtered.length} entries`;
    document.getElementById('journalTotal').textContent=`Total Debits ${this.fmt(totalD)} | Credits ${this.fmt(totalC)}`;
    body.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); this.viewJournal(b.dataset.view); }));
    body.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); this.copyJournal(b.dataset.copy); }));
    body.querySelectorAll('[data-delj]').forEach(b=>b.addEventListener('click',(e)=>{ e.stopPropagation(); this.deleteJournal(b.dataset.delj); }));
  }

  renderLedger(){
    const sel=document.getElementById('ledgerAccount');
    const list=document.getElementById('ledgerList');
    if(!sel||!list) return;
    const {balances}=this.getTotals();
    // populate dropdown
    sel.innerHTML='<option value="">Select account...</option>' + this.accounts.sort((a,b)=>a.code.localeCompare(b.code)).map(a=>`<option value="${a.code}" ${this.currentLedgerCode===a.code?'selected':''}>${a.code} — ${a.name} (${this.fmt(balances[a.code]?.net||0)})</option>`).join('');
    // left list
    list.innerHTML='';
    this.accounts.sort((a,b)=>a.code.localeCompare(b.code)).forEach(acc=>{
      const bal=balances[acc.code];
      const isActive=this.currentLedgerCode===acc.code;
      const div=document.createElement('div');
      div.className=`p-3 rounded-xl border cursor-pointer transition-all ${isActive?'bg-ink-900 text-white border-ink-900':'bg-white hover:bg-ink-50 border-ink-200'}`;
      div.innerHTML=`
        <div class="flex justify-between items-start">
          <div class="font-bold mono text-[12px]">${acc.code}</div>
          <div class="mono text-[10px] px-2 py-0.5 rounded-full ${isActive?'bg-white/20 text-white':'bg-ink-100'}">${acc.type}</div>
        </div>
        <div class="font-medium text-[13px] mt-1 truncate">${acc.name}</div>
        <div class="mono text-[11px] mt-1 ${isActive?'text-slate-300':'text-ink-500'}">${this.fmt(bal?.net||0)} • ${acc.normal}</div>
      `;
      div.addEventListener('click',()=>this.showLedger(acc.code));
      list.appendChild(div);
    });
    if(this.currentLedgerCode) this.showLedger(this.currentLedgerCode);
  }

  showLedger(code){
    this.currentLedgerCode=code;
    const acc=this.accounts.find(a=>a.code===code);
    if(!acc) return;
    document.getElementById('ledgerAccount').value=code;
    document.getElementById('ledgerType').textContent=`${acc.type} • Normal ${acc.normal}`;
    // highlight left list
    this.renderLedger();
    const {balances}=this.getTotals();
    const bal=balances[code];
    // gather transactions
    const txs=[];
    this.journals.forEach(j=>{
      j.lines.forEach(l=>{
        if(l.accountCode===code){
          txs.push({
            date:j.date,
            ref:j.ref,
            desc:j.desc,
            debit:l.debit||0,
            credit:l.credit||0,
            memo:l.memo||'',
            isAdjusting:j.isAdjusting
          });
        }
      });
    });
    txs.sort((a,b)=> new Date(a.date)-new Date(b.date));
    let running=0;
    const rows = txs.map(t=>{
      // running balance: for debit normal, running += debit - credit, else credit - debit
      if(acc.normal==='Debit') running+= (Number(t.debit)||0) - (Number(t.credit)||0);
      else running+= (Number(t.credit)||0) - (Number(t.debit)||0);
      return {...t, running};
    });
    const detail=document.getElementById('ledgerDetail');
    detail.innerHTML=`
      <div class="p-6 border-b bg-ink-50/50">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-bold text-[16px]">${acc.code} — ${acc.name}</div>
            <div class="mono text-[12px] text-ink-500 mt-1">${acc.type} • Normal balance: ${acc.normal} • Current balance: <span class="font-bold text-ink-800">${this.fmt(bal?.net||0)}</span></div>
          </div>
          <div class="mono text-[11px] px-3 py-1 rounded-full bg-white border">${rows.length} transactions</div>
        </div>
      </div>
      <div class="overflow-auto scroll max-h-[520px]">
        <table class="w-full text-left">
          <thead class="mono text-[11px] uppercase tracking-widest text-ink-400 border-b bg-white sticky top-0"><tr><th class="px-6 py-3">Date</th><th class="px-3 py-3">Ref</th><th class="px-3 py-3">Description</th><th class="px-3 py-3 text-right">Debit</th><th class="px-3 py-3 text-right">Credit</th><th class="px-6 py-3 text-right">Balance</th></tr></thead>
          <tbody class="divide-y mono text-[12px]">
            ${rows.length===0?`<tr><td colspan="6" class="px-6 py-12 text-center text-ink-400">No transactions for this account yet. Create a journal entry that uses ${acc.code}.</td></tr>`:
              rows.map(r=>`
                <tr class="hover:bg-ink-50 ${r.isAdjusting?'bg-amber-50/50':''}">
                  <td class="px-6 py-2.5">${r.date}</td>
                  <td class="px-3 py-2.5 font-bold">${r.ref}</td>
                  <td class="px-3 py-2.5 max-w-[240px] truncate" title="${this.esc(r.desc)}">${this.esc(r.desc)} ${r.memo?`<span class="text-ink-400">• ${this.esc(r.memo)}</span>`:''} ${r.isAdjusting?'<span class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">ADJ</span>':''}</td>
                  <td class="px-3 py-2.5 text-right">${r.debit?this.fmt(r.debit):''}</td>
                  <td class="px-3 py-2.5 text-right">${r.credit?this.fmt(r.credit):''}</td>
                  <td class="px-6 py-2.5 text-right font-bold">${this.fmt(r.running)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
      <div class="p-4 bg-ink-900 text-white mono text-[12px] flex justify-between"><span>Ending Balance</span><span class="font-bold">${this.fmt(bal?.net||0)}</span></div>
    `;
  }

  renderDashboard(){
    const {assetsCalc, liabCalc, equityCalc, revenue, expense, netIncome, balances, totalDebit, totalCredit} = this.getTotals();
    document.getElementById('dashAssets').textContent=this.fmt(assetsCalc);
    document.getElementById('dashLiab').textContent=this.fmt(liabCalc);
    document.getElementById('dashEquity').textContent=this.fmt(equityCalc);
    document.getElementById('dashIncome').textContent=this.fmt(netIncome);
    document.getElementById('dashIncomeLabel').textContent= netIncome>=0?`Profit • Revenue ${this.fmt(revenue)} - Expenses ${this.fmt(expense)}`:`Loss • Revenue ${this.fmt(revenue)} - Expenses ${this.fmt(expense)}`;
    document.getElementById('eqAssets').textContent=this.fmt(assetsCalc);
    document.getElementById('eqLiabEquity').textContent=this.fmt(liabCalc+equityCalc);
    const eqBalanced = Math.abs(assetsCalc-(liabCalc+equityCalc))<0.01 && Math.abs(totalDebit-totalCredit)<0.01;
    document.getElementById('eqBalanced').textContent=eqBalanced?'BALANCED ✓':'UNBALANCED';
    document.getElementById('eqBalanced').className= eqBalanced?'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold':'px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-bold';
    // recent journals
    const recentEl=document.getElementById('dashRecent');
    recentEl.innerHTML='';
    this.journals.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,5).forEach(j=>{
      const d=j.lines.reduce((s,l)=>s+(Number(l.debit)||0),0);
      const div=document.createElement('div');
      div.className='p-4 flex justify-between items-center hover:bg-ink-50 cursor-pointer';
      div.innerHTML=`<div><div class="font-medium text-[13px]">${this.esc(j.desc)}</div><div class="mono text-[11px] text-ink-500">${j.date} • ${j.ref} • ${j.lines.length} lines</div></div><div class="mono text-[12px] font-bold">${this.fmt(d)}</div>`;
      div.addEventListener('click',()=>{ this.viewJournal(j.id); this.switchView('journal'); });
      recentEl.appendChild(div);
    });
    if(this.journals.length===0) recentEl.innerHTML=`<div class="p-8 text-center mono text-[12px] text-ink-400">No entries yet. Create your first journal entry.</div>`;
    // top accounts
    const topEl=document.getElementById('dashTopAccounts');
    topEl.innerHTML='';
    Object.values(balances).sort((a,b)=>Math.abs(b.net)-Math.abs(a.net)).slice(0,6).forEach(a=>{
      const div=document.createElement('div');
      div.className='flex justify-between items-center p-2.5 rounded-xl border bg-ink-50/50 mono text-[12px]';
      div.innerHTML=`<span><span class="font-bold">${a.code}</span> ${a.name}</span><span class="font-bold">${this.fmt(a.net)}</span>`;
      div.style.cursor='pointer';
      div.addEventListener('click',()=>{ this.showLedger(a.code); this.switchView('ledger'); });
      topEl.appendChild(div);
    });
  }

  renderTrial(){
    const {balances, totalDebit, totalCredit} = this.getTotals();
    const body=document.getElementById('trialBody');
    const adjBody=document.getElementById('adjTrialBody');
    const trialDateEl=document.getElementById('trialDate');
    if(trialDateEl) trialDateEl.textContent=`As of ${this.company.end||new Date().toISOString().slice(0,10)}`;
    body.innerHTML='';
    // group by type
    const order={Asset:1, Liability:2, Equity:3, Revenue:4, Expense:5};
    Object.values(balances).sort((a,b)=> (order[a.type]-order[b.type]) || a.code.localeCompare(b.code)).forEach(a=>{
      if(Math.abs(a.balanceDebit)<0.01 && Math.abs(a.balanceCredit)<0.01) return;
      const tr=document.createElement('tr');
      tr.className='hover:bg-ink-50 cursor-pointer';
      tr.innerHTML=`<td class="px-6 py-2.5"><span class="font-bold">${a.code}</span> ${a.name} <span class="ml-2 mono text-[10px] px-1.5 py-0.5 rounded bg-ink-100 border">${a.type}</span></td><td class="px-4 py-2.5 text-right">${a.balanceDebit?this.fmt(a.balanceDebit):''}</td><td class="px-4 py-2.5 text-right">${a.balanceCredit?this.fmt(a.balanceCredit):''}</td>`;
      tr.addEventListener('click',()=>{ this.showLedger(a.code); this.switchView('ledger'); });
      body.appendChild(tr);
    });
    document.getElementById('trialDebitTotal').textContent=this.fmt(totalDebit);
    document.getElementById('trialCreditTotal').textContent=this.fmt(totalCredit);
    const balanced=Math.abs(totalDebit-totalCredit)<0.01;
    document.getElementById('trialBalanced').textContent=balanced?`BALANCED • ${this.fmt(totalDebit)}`:'UNBALANCED!';
    document.getElementById('trialBalanced').className=balanced?'mono text-[11px] px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-200':'mono text-[11px] px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold border border-red-200';

    // adjusted trial - same for now, but separate adjusting entries already included; we could show same but highlight adjusting
    adjBody.innerHTML='';
    Object.values(balances).sort((a,b)=> (order[a.type]-order[b.type]) || a.code.localeCompare(b.code)).forEach(a=>{
      if(Math.abs(a.balanceDebit)<0.01 && Math.abs(a.balanceCredit)<0.01) return;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="px-4 py-2"><span class="font-bold">${a.code}</span> ${a.name}</td><td class="px-3 py-2 text-right">${a.balanceDebit?this.fmt(a.balanceDebit):''}</td><td class="px-3 py-2 text-right">${a.balanceCredit?this.fmt(a.balanceCredit):''}</td>`;
      adjBody.appendChild(tr);
    });
    document.getElementById('adjTotals').textContent=`D ${this.fmt(totalDebit)} | C ${this.fmt(totalCredit)}`;

    // rules check
    const rulesEl=document.getElementById('rulesCheck');
    const {assetsCalc, liabCalc, equityCalc, revenue, expense, netIncome} = this.getTotals();
    rulesEl.innerHTML=`
      <div class="flex justify-between"><span>Debits = Credits?</span><span class="${balanced?'text-emerald-400':'text-red-400'} font-bold">${balanced?'YES ✓':'NO ✗'} ${this.fmt(totalDebit)} = ${this.fmt(totalCredit)}</span></div>
      <div class="flex justify-between"><span>Assets = Liab + Equity?</span><span class="${Math.abs(assetsCalc-(liabCalc+equityCalc))<0.01?'text-emerald-400':'text-red-400'} font-bold">${Math.abs(assetsCalc-(liabCalc+equityCalc))<0.01?'YES ✓':'NO ✗'}</span></div>
      <div class="flex justify-between"><span>Net Income</span><span class="font-bold">${this.fmt(netIncome)} (Rev ${this.fmt(revenue)} - Exp ${this.fmt(expense)})</span></div>
      <div class="mt-2 p-2 rounded-lg bg-white/5 border border-white/10">If unbalanced, check journal entries — each must have equal debits and credits.</div>
    `;
  }

  renderAdjusting(){
    const list=document.getElementById('adjustingList');
    list.innerHTML='';
    const adj = this.journals.filter(j=>j.isAdjusting).sort((a,b)=> new Date(b.date)-new Date(a.date));
    if(adj.length===0) list.innerHTML=`<div class="p-6 text-center mono text-[12px] text-ink-400">No adjusting entries yet. Use quick templates above or create a journal entry marked as Adjusting.</div>`;
    adj.forEach(j=>{
      const div=document.createElement('div');
      div.className='p-4 flex justify-between items-start hover:bg-ink-50';
      div.innerHTML=`<div><div class="font-bold text-[13px]">${this.esc(j.desc)}</div><div class="mono text-[11px] text-ink-500">${j.date} • ${j.ref} • ${j.lines.map(l=>`${l.accountCode} ${this.fmt(l.debit||l.credit)}`).join(', ')}</div></div><div class="flex gap-1"><button class="px-3 py-1 rounded-full border bg-white mono text-[11px] font-bold" data-view="${j.id}">View</button><button class="w-7 h-7 rounded-full border bg-white" data-del="${j.id}">✕</button></div>`;
      list.appendChild(div);
    });
    list.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>this.viewJournal(b.dataset.view)));
    list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>this.deleteJournal(b.dataset.del)));
  }

  renderStatements(){
    const {balances, revenue, expense, netIncome, cap, stock, ret, draw} = this.getTotals();
    const cur=this.company.currency||'$';
    const name=this.company.name||'Company';
    const period=`For the period ${this.company.start||''} to ${this.company.end||''}`;
    const asOf=`As of ${this.company.end||new Date().toISOString().slice(0,10)}`;

    // header
    ['incCompany','retCompany','balCompany','cashCompany'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=name; });
    ['incPeriod','retPeriod'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=period; });
    ['balPeriod','cashPeriod'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=asOf; });

    // Income Statement
    const revAccounts = Object.values(balances).filter(a=>a.type==='Revenue' && Math.abs(a.balance)>0.01).sort((a,b)=>b.balance-a.balance);
    const expAccounts = Object.values(balances).filter(a=>a.type==='Expense' && Math.abs(a.balance)>0.01).sort((a,b)=>b.balance-a.balance);
    const incBody=document.getElementById('incomeBody');
    incBody.innerHTML=`
      <div class="space-y-1">
        <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500">Revenue</div>
        ${revAccounts.length?revAccounts.map(a=>`<div class="flex justify-between"><span>${a.code} ${a.name}</span><span>${this.fmt(a.balance)}</span></div>`).join(''):`<div class="text-ink-400">No revenue recorded</div>`}
        <div class="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Revenue</span><span>${this.fmt(revenue)}</span></div>
      </div>
      <div class="mt-8 space-y-1">
        <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500">Expenses</div>
        ${expAccounts.length?expAccounts.map(a=>`<div class="flex justify-between"><span>${a.code} ${a.name}</span><span>${this.fmt(a.balance)}</span></div>`).join(''):`<div class="text-ink-400">No expenses recorded</div>`}
        <div class="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Expenses</span><span>${this.fmt(expense)}</span></div>
      </div>
      <div class="mt-8 p-4 rounded-xl bg-ink-900 text-white flex justify-between font-bold text-[15px]"><span>Net Income ${netIncome>=0?'(Profit)':'(Loss)'}</span><span>${this.fmt(netIncome)}</span></div>
    `;

    // Retained Earnings
    const retBody=document.getElementById('retainedBody');
    const begRet = 0; // for simplicity, beginning retained = 0 or existing retained account balance before net income? We'll use ret account balance as beginning
    // Actually ret account is beginning retained earnings. Net income adds, drawings subtracts
    const beginningRE = ret; // from account 3010
    const endingRE = beginningRE + netIncome - draw;
    retBody.innerHTML=`
      <div class="space-y-3 max-w-[500px]">
        <div class="flex justify-between"><span>Retained Earnings, Beginning</span><span>${this.fmt(beginningRE)}</span></div>
        <div class="flex justify-between"><span>Add: Net Income</span><span class="${netIncome>=0?'text-emerald-600':'text-red-600'}">${this.fmt(netIncome)}</span></div>
        <div class="flex justify-between"><span>Less: Owner's Drawings</span><span>(${this.fmt(draw)})</span></div>
        <div class="flex justify-between font-bold border-t pt-3 text-[15px]"><span>Retained Earnings, Ending</span><span>${this.fmt(endingRE)}</span></div>
        <div class="mt-6 p-3 rounded-xl bg-ink-50 border mono text-[11px]">Formula: Ending RE = Beginning RE + Net Income - Dividends/Drawings. This flows to Balance Sheet equity section.</div>
      </div>
    `;

    // Balance Sheet
    const assetAccounts = Object.values(balances).filter(a=>a.type==='Asset').sort((a,b)=>a.code.localeCompare(b.code));
    const liabAccounts = Object.values(balances).filter(a=>a.type==='Liability').sort((a,b)=>a.code.localeCompare(b.code));
    const equityAccounts = Object.values(balances).filter(a=>a.type==='Equity' && a.code!=='3020').sort((a,b)=>a.code.localeCompare(b.code));
    let totalAssets=0;
    assetAccounts.forEach(a=>{ if(a.code==='1510') totalAssets-=a.balance; else totalAssets+=a.balance; });
    let totalLiab=0;
    liabAccounts.forEach(a=> totalLiab+=a.balance);
    let totalEquity = cap + stock + endingRE; // ending RE includes net income - drawings
    // If there are other equity accounts not captured, add them
    // For simplicity, total equity = totalLiab? No, compute
    const totalLiabEquity = totalLiab + totalEquity;
    const balancedBS = Math.abs(totalAssets - totalLiabEquity) < 0.01;

    const balBody=document.getElementById('balanceBody');
    balBody.innerHTML=`
      <div class="grid md:grid-cols-2 gap-8">
        <div>
          <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500 mb-3">Assets</div>
          <div class="space-y-1">
            ${assetAccounts.map(a=>{
              const isContra = a.code==='1510';
              const display = isContra ? `(${this.fmt(a.balance)})` : this.fmt(a.balance);
              return `<div class="flex justify-between ${isContra?'text-ink-500':''}"><span>${a.code} ${a.name}${isContra?' (Contra)':''}</span><span>${display}</span></div>`;
            }).join('')}
            <div class="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Assets</span><span>${this.fmt(totalAssets)}</span></div>
          </div>
        </div>
        <div class="space-y-8">
          <div>
            <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500 mb-3">Liabilities</div>
            <div class="space-y-1">
              ${liabAccounts.map(a=>`<div class="flex justify-between"><span>${a.code} ${a.name}</span><span>${this.fmt(a.balance)}</span></div>`).join('')||'<div class="text-ink-400">No liabilities</div>'}
              <div class="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Liabilities</span><span>${this.fmt(totalLiab)}</span></div>
            </div>
          </div>
          <div>
            <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500 mb-3">Equity</div>
            <div class="space-y-1">
              ${equityAccounts.map(a=>`<div class="flex justify-between"><span>${a.code} ${a.name}</span><span>${this.fmt(a.code==='3010'?endingRE:a.balance)}</span></div>`).join('')}
              <div class="flex justify-between text-ink-500"><span>Less: Owner's Drawings</span><span>(${this.fmt(draw)})</span></div>
              <div class="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Equity</span><span>${this.fmt(totalEquity)}</span></div>
            </div>
            <div class="mt-4 p-3 rounded-xl ${balancedBS?'bg-emerald-50 border border-emerald-200 text-emerald-800':'bg-red-50 border border-red-200 text-red-800'} font-bold flex justify-between"><span>Total Liab + Equity</span><span>${this.fmt(totalLiabEquity)} ${balancedBS?'✓ BALANCED':'✗ UNBALANCED'}</span></div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('balBalanced').textContent=balancedBS?'BALANCED ✓':'UNBALANCED';
    document.getElementById('balBalanced').className=balancedBS?'mono text-[11px] px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold h-fit':'mono text-[11px] px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold h-fit';

    // Cash Flow (simplified indirect)
    const cashBody=document.getElementById('cashBody');
    // Very simplified: Net Income + Depreciation + changes in working capital
    const depreciation = balances['5040']?.balance||0;
    const ar = balances['1010']?.balance||0;
    const ap = balances['2000']?.balance||0;
    const cash = balances['1000']?.balance||0;
    cashBody.innerHTML=`
      <div class="max-w-[600px] space-y-6">
        <div>
          <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500">Cash Flows from Operating Activities (Indirect)</div>
          <div class="mt-3 space-y-1">
            <div class="flex justify-between"><span>Net Income</span><span>${this.fmt(netIncome)}</span></div>
            <div class="flex justify-between"><span>Add: Depreciation Expense</span><span>${this.fmt(depreciation)}</span></div>
            <div class="flex justify-between text-ink-500"><span>Less: Increase in Accounts Receivable</span><span>(${this.fmt(ar)})</span></div>
            <div class="flex justify-between text-ink-500"><span>Add: Increase in Accounts Payable</span><span>${this.fmt(ap)}</span></div>
            <div class="flex justify-between font-bold border-t pt-2"><span>Net Cash from Operating</span><span>${this.fmt(netIncome + depreciation - ar + ap)}</span></div>
          </div>
        </div>
        <div>
          <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500">Cash Flows from Investing</div>
          <div class="mt-2 mono text-[12px] text-ink-500">(Equipment purchases would appear here — track via Equipment account)</div>
        </div>
        <div>
          <div class="font-bold text-[13px] uppercase tracking-widest text-ink-500">Cash Flows from Financing</div>
          <div class="mt-2 space-y-1">
            <div class="flex justify-between"><span>Owner Investment (Capital + Stock)</span><span>${this.fmt(cap+stock)}</span></div>
            <div class="flex justify-between"><span>Less: Drawings</span><span>(${this.fmt(draw)})</span></div>
          </div>
        </div>
        <div class="p-4 rounded-xl bg-ink-900 text-white flex justify-between font-bold"><span>Ending Cash (from Ledger)</span><span>${this.fmt(cash)}</span></div>
        <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 mono text-[11px]">Simplified cash flow. For full GAAP, track changes in all balance sheet accounts between periods. This version uses current balances and net income.</div>
      </div>
    `;
  }

  // ---------- Journal Modal ----------
  newJournal(){
    this.editingJournalId=null;
    document.getElementById('jRef').value=this.nextRef();
    document.getElementById('jDesc').value='';
    document.getElementById('jDate').value=new Date().toISOString().slice(0,10);
    const linesEl=document.getElementById('jLines');
    linesEl.innerHTML='';
    this.addJournalLine();
    this.addJournalLine();
    this.updateJournalTotals();
    document.getElementById('journalModal').classList.remove('hidden');
  }

  viewJournal(id){
    const j=this.journals.find(x=>x.id===id);
    if(!j) return;
    this.editingJournalId=id;
    document.getElementById('jRef').value=j.ref;
    document.getElementById('jDesc').value=j.desc;
    document.getElementById('jDate').value=j.date;
    const linesEl=document.getElementById('jLines');
    linesEl.innerHTML='';
    j.lines.forEach(l=>this.addJournalLine(l));
    this.updateJournalTotals();
    document.getElementById('journalModal').classList.remove('hidden');
  }

  closeJournalModal(){
    document.getElementById('journalModal').classList.add('hidden');
    this.editingJournalId=null;
  }

  nextRef(){
    const nums=this.journals.map(j=>{ const m=j.ref.match(/JE-(\d+)/); return m?parseInt(m[1]):0; });
    const max=Math.max(0,...nums);
    return `JE-${String(max+1).padStart(4,'0')}`;
  }

  addJournalLine(data=null){
    const linesEl=document.getElementById('jLines');
    const div=document.createElement('div');
    div.className='grid grid-cols-[1.6fr_.7fr_.7fr_1fr_40px] gap-2 px-4 py-2 items-center bg-white';
    const accountOptions = this.accounts.sort((a,b)=>a.code.localeCompare(b.code)).map(a=>`<option value="${a.code}" ${data && data.accountCode===a.code?'selected':''}>${a.code} — ${a.name}</option>`).join('');
    div.innerHTML=`
      <select class="j-account px-3 py-2 rounded-lg border text-[13px] bg-white w-full"><option value="">Select account...</option>${accountOptions}</select>
      <input type="number" step="0.01" class="j-debit px-3 py-2 rounded-lg border mono text-[13px] text-right" placeholder="0.00" value="${data?.debit||''}">
      <input type="number" step="0.01" class="j-credit px-3 py-2 rounded-lg border mono text-[13px] text-right" placeholder="0.00" value="${data?.credit||''}">
      <input class="j-memo px-3 py-2 rounded-lg border text-[12px]" placeholder="Memo" value="${this.esc(data?.memo||'')}">
      <button class="j-remove w-8 h-8 rounded-full border bg-white hover:bg-red-50 grid place-items-center">✕</button>
    `;
    linesEl.appendChild(div);
    const debitInput=div.querySelector('.j-debit');
    const creditInput=div.querySelector('.j-credit');
    // mutual exclusivity
    debitInput.addEventListener('input',()=>{ if(Number(debitInput.value)>0) creditInput.value=''; this.updateJournalTotals(); });
    creditInput.addEventListener('input',()=>{ if(Number(creditInput.value)>0) debitInput.value=''; this.updateJournalTotals(); });
    div.querySelector('.j-account').addEventListener('change',()=>this.updateJournalTotals());
    div.querySelector('.j-remove').addEventListener('click',()=>{ div.remove(); this.updateJournalTotals(); });
    div.querySelector('.j-memo').addEventListener('input',()=>{});
  }

  updateJournalTotals(){
    const linesEl=document.getElementById('jLines');
    let d=0,c=0;
    let valid=true;
    linesEl.querySelectorAll('div').forEach(row=>{
      const acc=row.querySelector('.j-account')?.value;
      const debit=Number(row.querySelector('.j-debit')?.value)||0;
      const credit=Number(row.querySelector('.j-credit')?.value)||0;
      if(acc) { d+=debit; c+=credit; }
      if(!acc && (debit>0||credit>0)) valid=false;
    });
    document.getElementById('jDebitTotal').textContent=this.fmt(d);
    document.getElementById('jCreditTotal').textContent=this.fmt(c);
    const balanced = Math.abs(d-c)<0.01 && d>0;
    const statusEl=document.getElementById('jBalanceStatus');
    statusEl.textContent= balanced?`BALANCED ✓ ${this.fmt(d)}` : `UNBALANCED ${this.fmt(d)} ≠ ${this.fmt(c)}`;
    statusEl.className= balanced ? 'px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200' : 'px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold border border-amber-200';
    document.getElementById('jPostBtn').disabled=!balanced || !valid;
  }

  postJournal(){
    const ref=document.getElementById('jRef').value.trim()||this.nextRef();
    const desc=document.getElementById('jDesc').value.trim()||'(No description)';
    const date=document.getElementById('jDate').value||new Date().toISOString().slice(0,10);
    const lines=[];
    document.getElementById('jLines').querySelectorAll('div').forEach(row=>{
      const code=row.querySelector('.j-account')?.value;
      if(!code) return;
      const acc=this.accounts.find(a=>a.code===code);
      const debit=Number(row.querySelector('.j-debit')?.value)||0;
      const credit=Number(row.querySelector('.j-credit')?.value)||0;
      const memo=row.querySelector('.j-memo')?.value||'';
      if(debit===0 && credit===0) return;
      lines.push({accountCode:code, accountName:acc?acc.name:code, debit, credit, memo});
    });
    if(lines.length<2) return this.toast('Need at least 2 lines','⚠️');
    const d=lines.reduce((s,l)=>s+l.debit,0);
    const c=lines.reduce((s,l)=>s+l.credit,0);
    if(Math.abs(d-c)>=0.01) return this.toast('Debits must equal credits','⚠️');

    if(this.editingJournalId){
      const idx=this.journals.findIndex(j=>j.id===this.editingJournalId);
      if(idx>=0){
        this.journals[idx]={...this.journals[idx], date, ref, desc, lines, isAdjusting:this.journals[idx].isAdjusting||false};
      }
    } else {
      this.journals.push({
        id:'j_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        date, ref, desc, lines,
        isAdjusting:false,
        createdAt:Date.now()
      });
    }
    this.save();
    this.renderAll();
    this.closeJournalModal();
    this.toast(`Journal ${ref} posted ✓ — saved to localStorage, will not disappear`);
  }

  deleteJournal(id){
    if(!confirm('Delete this journal entry? This will update all balances.')) return;
    this.journals=this.journals.filter(j=>j.id!==id);
    this.save();
    this.renderAll();
    this.toast('Journal deleted');
  }

  // ---------- Account Modal ----------
  openAccountModal(){
    document.getElementById('aCode').value='';
    document.getElementById('aName').value='';
    document.getElementById('aType').value='Asset';
    document.getElementById('aBalance').value='';
    document.getElementById('accountModal').classList.remove('hidden');
  }
  closeAccountModal(){ document.getElementById('accountModal').classList.add('hidden'); }
  saveAccount(){
    const code=document.getElementById('aCode').value.trim();
    const name=document.getElementById('aName').value.trim();
    const type=document.getElementById('aType').value;
    const bal=Number(document.getElementById('aBalance').value)||0;
    if(!code||!name) return this.toast('Code and Name required','⚠️');
    if(this.accounts.some(a=>a.code===code)) return this.toast('Code already exists','⚠️');
    const normal = (type==='Asset'||type==='Expense'||code==='3020')?'Debit':'Credit';
    this.accounts.push({id:'acc_'+Date.now(), code, name, type, normal, balance:0});
    // if opening balance, create journal entry
    if(bal!==0){
      const isDebit = (normal==='Debit' && bal>0) || (normal==='Credit' && bal<0);
      const absBal=Math.abs(bal);
      // need opposite account - use Owner's Capital or Retained Earnings as opening balance equity
      const oppCode = type==='Asset' ? '3000' : '1000';
      const oppName = this.accounts.find(a=>a.code===oppCode)?.name || oppCode;
      const lines = isDebit ? [
        {accountCode:code, accountName:name, debit:absBal, credit:0, memo:'Opening balance'},
        {accountCode:oppCode, accountName:oppName, debit:0, credit:absBal, memo:'Opening balance'}
      ] : [
        {accountCode:oppCode, accountName:oppName, debit:absBal, credit:0, memo:'Opening balance'},
        {accountCode:code, accountName:name, debit:0, credit:absBal, memo:'Opening balance'}
      ];
      this.journals.push({
        id:'j_'+Date.now(),
        date:this.company.start||new Date().toISOString().slice(0,10),
        ref:this.nextRef(),
        desc:`Opening balance for ${name}`,
        lines,
        isAdjusting:false,
        createdAt:Date.now()
      });
    }
    this.save();
    this.renderAll();
    this.closeAccountModal();
    this.toast(`Account ${code} created ✓ — now visible in ledger`);
  }

  // ---------- Copy / Export ----------
  copyAllJournals(){
    if(this.journals.length===0) return this.toast('No journals to copy','⚠️');
    // Format: Date | Ref | Account Code | Account Name | Debit | Credit | Description | Memo | Type
    const header = ['Date','Ref','Description','Account Code','Account Name','Debit','Credit','Memo','Type'].join('\t');
    const lines=[header];
    this.journals.sort((a,b)=> new Date(a.date)-new Date(b.date)).forEach(j=>{
      j.lines.forEach(l=>{
        lines.push([
          j.date,
          j.ref,
          `"${j.desc.replace(/"/g,'""')}"`,
          l.accountCode,
          `"${l.accountName.replace(/"/g,'""')}"`,
          l.debit||0,
          l.credit||0,
          `"${(l.memo||'').replace(/"/g,'""')}"`,
          j.isAdjusting?'Adjusting':'Regular'
        ].join('\t'));
      });
    });
    const text=lines.join('\n');
    // also create pretty text version
    const pretty = this.journals.sort((a,b)=> new Date(a.date)-new Date(b.date)).map(j=>{
      const total=j.lines.reduce((s,l)=>s+l.debit,0);
      return `${j.date} | ${j.ref} | ${j.desc} | ${this.fmt(total)} | ${j.isAdjusting?'ADJ':'REG'}\n` + j.lines.map(l=>`  ${l.accountCode} ${l.accountName.padEnd(30)} ${l.debit?this.fmt(l.debit).padStart(12):' '.repeat(12)} ${l.credit?this.fmt(l.credit).padStart(12):' '.repeat(12)} ${l.memo||''}`).join('\n');
    }).join('\n\n');

    // Try clipboard
    navigator.clipboard.writeText(pretty + '\n\n--- TSV (Excel) ---\n' + text).then(()=>{
      this.toast(`Copied ${this.journals.length} entries (${lines.length-1} lines) to clipboard ✓`);
    }).catch(()=>{
      // fallback
      const ta=document.createElement('textarea');
      ta.value=pretty + '\n\n' + text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.toast(`Copied ${this.journals.length} entries to clipboard ✓`);
    });
  }

  copyJournal(id){
    const j=this.journals.find(x=>x.id===id);
    if(!j) return;
    const text = `${j.date} | ${j.ref} | ${j.desc}\n` + j.lines.map(l=>`${l.accountCode} ${l.accountName} | Debit ${this.fmt(l.debit)} | Credit ${this.fmt(l.credit)} | ${l.memo||''}`).join('\n');
    navigator.clipboard.writeText(text).then(()=>this.toast('Journal copied ✓'));
  }

  exportJournalsCSV(){
    if(this.journals.length===0) return this.toast('No journals','⚠️');
    const header=['Date','Ref','Description','Account Code','Account Name','Debit','Credit','Memo','Type'];
    const rows=[header];
    this.journals.forEach(j=>{
      j.lines.forEach(l=>{
        rows.push([j.date,j.ref,j.desc,l.accountCode,l.accountName,l.debit,l.credit,l.memo||'',j.isAdjusting?'Adjusting':'Regular']);
      });
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    this.download(csv,`journal-entries-${new Date().toISOString().slice(0,10)}.csv`,'text/csv');
  }

  exportAll(){
    const data={
      company:this.company,
      accounts:this.accounts,
      journals:this.journals,
      exportedAt:new Date().toISOString()
    };
    this.download(JSON.stringify(data,null,2),`ledgerflow-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');
    this.toast('Backup exported ✓');
  }

  importJSON(e){
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(data.accounts && data.journals){
          if(!confirm(`Import ${data.journals.length} journals and ${data.accounts.length} accounts? This will replace current data.`)) return;
          this.company=data.company||this.company;
          this.accounts=data.accounts;
          this.journals=data.journals;
          this.save();
          this.renderAll();
          this.toast('Import successful ✓');
        } else {
          this.toast('Invalid file','⚠️');
        }
      }catch(err){ this.toast('Invalid JSON','⚠️'); }
    };
    reader.readAsText(file);
    e.target.value='';
  }

  quickAdjust(type){
    let template=null;
    if(type==='depreciation'){
      template={
        desc:'Adjusting: Depreciation expense for the period',
        lines:[
          {code:'5040', debit:500, credit:0, memo:'Depreciation'},
          {code:'1510', debit:0, credit:500, memo:'Accum Dep'}
        ]
      };
    } else if(type==='accrued-salaries'){
      template={
        desc:'Adjusting: Accrued salaries payable',
        lines:[
          {code:'5010', debit:1200, credit:0, memo:'Salaries'},
          {code:'2010', debit:0, credit:1200, memo:'Payable'}
        ]
      };
    } else if(type==='prepaid'){
      template={
        desc:'Adjusting: Rent expense from prepaid rent',
        lines:[
          {code:'5020', debit:1000, credit:0, memo:'Rent used'},
          {code:'1030', debit:0, credit:1000, memo:'Prepaid'}
        ]
      };
    } else if(type==='unearned'){
      template={
        desc:'Adjusting: Unearned revenue now earned',
        lines:[
          {code:'2020', debit:800, credit:0, memo:'Unearned'},
          {code:'4010', debit:0, credit:800, memo:'Revenue earned'}
        ]
      };
    }
    if(!template) return;
    // open journal modal with template
    this.newJournal();
    document.getElementById('jDesc').value=template.desc;
    const linesEl=document.getElementById('jLines');
    linesEl.innerHTML='';
    template.lines.forEach(l=>{
      const acc=this.accounts.find(a=>a.code===l.code);
      this.addJournalLine({accountCode:l.code, accountName:acc?.name||l.code, debit:l.debit, credit:l.credit, memo:l.memo});
    });
    this.updateJournalTotals();
    // mark as adjusting on post - we will set flag after
    const originalPost=this.postJournal.bind(this);
    const self=this;
    // override post to mark adjusting
    const postBtn=document.getElementById('jPostBtn');
    const oldOnClick=postBtn.onclick;
    postBtn.onclick=function(){
      const ref=document.getElementById('jRef').value.trim()||self.nextRef();
      const desc=document.getElementById('jDesc').value.trim();
      const date=document.getElementById('jDate').value;
      const lines=[];
      document.getElementById('jLines').querySelectorAll('div').forEach(row=>{
        const code=row.querySelector('.j-account')?.value;
        if(!code) return;
        const acc=self.accounts.find(a=>a.code===code);
        const debit=Number(row.querySelector('.j-debit')?.value)||0;
        const credit=Number(row.querySelector('.j-credit')?.value)||0;
        const memo=row.querySelector('.j-memo')?.value||'';
        if(debit===0&&credit===0) return;
        lines.push({accountCode:code, accountName:acc?acc.name:code, debit, credit, memo});
      });
      const d=lines.reduce((s,l)=>s+l.debit,0);
      const c=lines.reduce((s,l)=>s+l.credit,0);
      if(Math.abs(d-c)>=0.01) return self.toast('Unbalanced','⚠️');
      self.journals.push({
        id:'j_'+Date.now(),
        date, ref, desc, lines,
        isAdjusting:true,
        createdAt:Date.now()
      });
      self.save();
      self.renderAll();
      self.closeJournalModal();
      self.toast(`Adjusting entry ${ref} posted ✓`);
      postBtn.onclick=oldOnClick;
    };
  }

  printStatement(type){
    window.print();
  }

  resetData(){
    if(!confirm('Reset ALL data? This deletes all journals and accounts and restores defaults.')) return;
    localStorage.removeItem(this.storageKey);
    this.accounts=[];
    this.journals=[];
    this.company={name:'Acme Corporation', address:'123 Business Ave', currency:'$', fyEnd:'2025-12-31', start:'2025-01-01', end:'2025-12-31', method:'accrual'};
    this.load();
    this.renderAll();
    this.toast('Data reset to defaults');
  }

  // ---------- utils ----------
  fmt(n){
    const cur=this.company.currency||'$';
    const num=Number(n)||0;
    return cur + num.toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
  }
  esc(s){ return String(s||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  download(text,filename,type){ const blob=new Blob([text],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),2000); }
  toast(msg,icon='✓'){
    const t=document.getElementById('toast');
    document.getElementById('toastMsg').textContent=msg;
    document.getElementById('toastIcon').textContent=icon;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer=setTimeout(()=>t.classList.add('hidden'),3500);
  }
}

const app = new LedgerApp();
window.app=app;
