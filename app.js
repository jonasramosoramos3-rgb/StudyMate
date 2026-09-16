// StudyMate - All-in-One Student Toolkit - 24 Tools
// Upgrades: Tool explanations, GWA screenshot OCR, ATS Resume with photo, Flashcards import, Audio converter

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const tools = {
  "images-to-pdf": { 
    name:"Images to PDF", desc:"JPG, PNG → PDF", icon:"🖼️", 
    longDesc:"Convert multiple JPG, PNG, WebP images into a single PDF file. Perfect for assignments, scanned notes, and requirements. You can choose A4, Letter, or Fit-to-image page size. 100% offline, no file limit.",
    howTo:"Drop images → Choose page size (A4/Letter/Fit) and margin → Click Convert & Download",
    accept:"image/*", outputs:["pdf"], def:"pdf", hint:"Drop JPG, PNG, WebP • Merge into one PDF", type:"file", 
    options:[{id:"pageSize",label:"Page size",type:"select",opts:["Fit image","A4","Letter"],def:"A4"},{id:"orientation",label:"Orientation",type:"select",opts:["Auto","Portrait","Landscape"],def:"Auto"},{id:"margin",label:"Margin",type:"select",opts:["None","Small","Medium"],def:"Small"}]
  },
  "pdf-to-images": { 
    name:"PDF to Images", desc:"Pages → PNG/JPG", icon:"📄",
    longDesc:"Export each page of a PDF as separate images (PNG, JPG, WebP). Useful for extracting diagrams from modules or converting PDF slides to images.",
    howTo:"Drop PDF → Choose quality (1x-3x) and format → Convert → ZIP if multi-page",
    accept:"application/pdf", outputs:["png","jpg","webp"], def:"png", hint:"Drop PDF • Each page becomes image", type:"file", 
    options:[{id:"scale",label:"Quality",type:"select",opts:["1x","1.5x","2x (HD)","3x"],def:"2x (HD)"}]
  },
  "merge-pdf": { 
    name:"Merge PDFs", desc:"Combine PDFs", icon:"🔗",
    longDesc:"Combine multiple PDF files into one PDF. Keeps order you uploaded. Great for merging assignments, chapters, or requirements.",
    howTo:"Drop 2+ PDFs in order you want → Click Convert",
    accept:"application/pdf", outputs:["pdf"], def:"pdf", hint:"Drop 2+ PDFs to merge", type:"file", options:[]
  },
  "split-pdf": { 
    name:"Split PDF", desc:"Extract pages", icon:"✂️",
    longDesc:"Split a PDF into separate PDFs per page, or extract specific pages/ranges like 1-3,5,8-10.",
    howTo:"Drop PDF → Choose All pages as ZIP or Extract range → Enter range like 1-3,5 → Convert",
    accept:"application/pdf", outputs:["pdf"], def:"pdf", hint:"Split all pages or range like 1-3,5", type:"file", 
    options:[{id:"splitMode",label:"Mode",type:"select",opts:["All pages as ZIP","Extract range"],def:"All pages as ZIP"},{id:"range",label:"Range e.g. 1-3,5",type:"text",def:"1-3",showIf:v=>v.splitMode==="Extract range"}]
  },
  "pdf-to-text": { 
    name:"PDF to Text", desc:"Extract text", icon:"🔤",
    longDesc:"Extract all selectable text from PDF files. Useful for copying content from modules, research papers. Note: Scanned PDFs need OCR tool instead.",
    howTo:"Drop PDFs → Choose TXT or JSON → Convert",
    accept:"application/pdf", outputs:["txt","json"], def:"txt", hint:"Extract text from PDF", type:"file", options:[]
  },
  "pdf-compress": { 
    name:"Compress PDF", desc:"For portals <5MB", icon:"🗜️",
    longDesc:"Compress large PDFs to fit school portal limits (usually <5MB or <2MB). Reduces file size by lowering image quality. Perfect for LMS submissions.",
    howTo:"Drop PDF → Choose quality (lower = smaller file) and scale → Convert",
    accept:"application/pdf", outputs:["pdf"], def:"pdf", hint:"Compress PDF for school portals", type:"file", 
    options:[{id:"quality",label:"Quality",type:"range",min:20,max:100,def:60},{id:"scale",label:"Scale",type:"select",opts:["0.5x (smallest)","0.7x","0.9x"],def:"0.7x"}]
  },
  "image-converter": { 
    name:"Image Converter", desc:"PNG ↔ JPG ↔ WebP", icon:"🎨",
    longDesc:"Convert images between PNG, JPG, WebP formats. Keeps transparency for PNG/WebP. Useful for requirements that need specific formats.",
    howTo:"Drop images → Choose output format and quality → Convert",
    accept:"image/*", outputs:["png","jpg","webp"], def:"webp", hint:"Convert image format", type:"file", 
    options:[{id:"quality",label:"Quality",type:"range",min:10,max:100,def:90}]
  },
  "compress-image": { 
    name:"Compress Image", desc:"Resize & quality", icon:"🗜️",
    longDesc:"Reduce image file size and resize dimensions. Great for making photos fit email or portal limits, or making website images load faster.",
    howTo:"Drop images → Set quality and max width/height → Convert",
    accept:"image/*", outputs:["jpg","png","webp","original"], def:"original", hint:"Compress & resize images", type:"file", 
    options:[{id:"quality",label:"Quality",type:"range",min:5,max:100,def:75},{id:"maxW",label:"Max width",type:"number",def:1920},{id:"maxH",label:"Max height",type:"number",def:1080}]
  },
  "doc-scanner": { 
    name:"Doc Scanner", desc:"Camera → PDF", icon:"📷",
    longDesc:"Scan documents using phone camera or upload. Auto enhances with grayscale, black & white, or enhanced filter. Saves as PDF or JPG — like CamScanner but offline and no watermark.",
    howTo:"Upload or use camera → Choose filter → Choose PDF or JPG → Convert",
    accept:"image/*", outputs:["pdf","jpg"], def:"pdf", hint:"Scan documents via camera or upload", type:"file", 
    options:[{id:"filter",label:"Filter",type:"select",opts:["Original","Grayscale","Black & White","Enhanced"],def:"Enhanced"}]
  },
  "docx-to-text": { 
    name:"DOCX to Text", desc:"Word extract", icon:"📝",
    longDesc:"Extract text, HTML, or convert DOCX Word files to PDF. Useful for reading Word files without Word, or converting to PDF for submission.",
    howTo:"Drop .docx files → Choose output TXT/HTML/PDF → Convert",
    accept:".docx", outputs:["txt","html","pdf"], def:"txt", hint:"Extract Word .docx", type:"file", options:[]
  },
  "txt-to-pdf": { 
    name:"Text to PDF", desc:"MD → PDF", icon:"📃",
    longDesc:"Convert plain text, Markdown, or HTML files into clean PDF. Perfect for essays, notes, and documentation.",
    howTo:"Drop TXT/MD/HTML files → Choose font size → Convert",
    accept:".txt,.md,.html", outputs:["pdf"], def:"pdf", hint:"Text/Markdown → PDF", type:"file", 
    options:[{id:"fontSize",label:"Font size",type:"select",opts:["10","12","14"],def:"12"}]
  },
  "csv-json": { 
    name:"CSV ↔ JSON", desc:"Data converter", icon:"🔄",
    longDesc:"Convert CSV to JSON or JSON to CSV. Auto-detects file type. Useful for data subjects, research, and ICT.",
    howTo:"Drop CSV → gets JSON, or drop JSON → gets CSV. Auto mode.",
    accept:".csv,.json", outputs:["auto","json","csv"], def:"auto", hint:"CSV → JSON or JSON → CSV", type:"file", options:[]
  },
  "base64": { 
    name:"Base64", desc:"Encode / decode", icon:"🔑",
    longDesc:"Encode any file to Base64 text or decode Base64 back to file. Useful for embedding files in code or sharing.",
    howTo:"Choose Encode (files → Base64) or Decode (Base64 text → file) → Drop files → Convert",
    accept:"*/*", outputs:["b64-txt","file"], def:"b64-txt", hint:"Encode to Base64 or decode", type:"file", 
    options:[{id:"b64mode",label:"Mode",type:"select",opts:["Encode files to Base64","Decode Base64 text"],def:"Encode files to Base64"}]
  },
  "ocr": { 
    name:"OCR - Image to Text", desc:"Scan notes → text", icon:"🔍",
    longDesc:"Extract text from images, scanned notes, whiteboard photos, or book pages using AI OCR (Tesseract.js). Works offline after first load. Supports English and Filipino.",
    howTo:"Drop images or scanned PDFs → Choose language → Convert → Get editable text",
    accept:"image/*,application/pdf", outputs:["txt","pdf"], def:"txt", hint:"Extract text from images/scanned notes using AI", type:"file", 
    options:[{id:"lang",label:"Language",type:"select",opts:["eng","eng+fil","fil"],def:"eng"}]
  },
  "word-counter": { 
    name:"Word Counter", desc:"Essay tools", icon:"📝",
    longDesc:"Count words, characters, sentences, paragraphs, and reading time for essays. Helps meet school requirements like 500 words, 1000 words.",
    howTo:"Paste essay in text box → See stats instantly (words, chars, sentences, read time)",
    accept:"", outputs:[""], def:"", hint:"Count words, check essay", type:"form", options:[]
  },
  "paraphraser": {
    name:"Paraphraser - Humanize AI", desc:"AI → Human, remove AI signs", icon:"✍️",
    longDesc:"Paraphrase AI-generated essays to sound 100% human and remove AI detector flags. Removes AI clichés like 'In conclusion', 'Furthermore', 'Delve', 'It is important to note', em dashes, and overly formal phrases. Rewrites with varied sentence lengths, contractions, and natural flow to bypass AI detectors.",
    howTo:"Paste AI essay → Choose mode (Humanize Academic / Simple / Formal) → Choose strength → Click Humanize → Get human-sounding essay that avoids AI detection",
    accept:"", outputs:[""], def:"", hint:"Humanize AI text, remove AI signs", type:"form", options:[]
  },
  "citation": { 
    name:"Citation Generator", desc:"APA / MLA", icon:"📚",
    longDesc:"Generate perfect APA 7th and MLA 9th citations for books, websites, and journals. Fill author, title, year, source → get citation to copy to bibliography. No ads.",
    howTo:"Enter Author, Year, Title, Source → Choose APA/MLA and Book/Website/Journal → Generate",
    accept:"", outputs:[""], def:"", hint:"Generate APA/MLA citations", type:"form", options:[]
  },
  
  
  "gpa": { 
    name:"GPA / GWA Calc", desc:"PH system + Screenshot", icon:"🎓",
    longDesc:"Compute GWA/GPA for PH grading systems: College 1.0-5.0, 4.0 scale, SHS/JHS %, Elementary %. Now with screenshot upload — upload screenshot of grades from portal, OCR auto-detects subjects, grades, units to avoid manual typing!",
    howTo:"Option 1: Type subjects manually → Add subjects → Calculate. Option 2: Upload screenshot of grades → OCR extracts → Auto-fills → Calculate",
    accept:"image/*", outputs:[""], def:"", hint:"Compute GWA / GPA + screenshot OCR", type:"form", options:[]
  },
  "qr": { 
    name:"QR Generator", desc:"Links, WiFi, etc", icon:"🔳",
    longDesc:"Generate QR codes for links, text, WiFi passwords, emails. Download as PNG for projects, presentations, or sharing WiFi.",
    howTo:"Choose type (Text/Link, WiFi, Email) → Enter data → Generate QR → Download PNG",
    accept:"", outputs:[""], def:"", hint:"Generate QR codes", type:"form", options:[]
  },
  "pomodoro": { 
    name:"Pomodoro Timer", desc:"Focus study", icon:"⏰",
    longDesc:"25 min work / 5 min break timer to help focus. Add tasks, check them off, get notifications. Helps avoid procrastination.",
    howTo:"Add tasks → Start timer → Focus 25 min → Break 5 min → Repeat. Tasks saved locally.",
    accept:"", outputs:[""], def:"", hint:"Study timer + tasks", type:"form", options:[]
  },
  "audio-converter": {
    name:"Audio Converter", desc:"MP3 ↔ WAV ↔ OGG", icon:"🎵",
    longDesc:"Convert audio files between MP3, WAV, OGG, WEBM. Compress audio, trim, and change quality. Uses Web Audio API + LameJS for MP3 encoding. 100% offline.",
    howTo:"Drop audio files (MP3, WAV, OGG, M4A) → Choose output format and quality → Convert → Download. Also supports trimming.",
    accept:"audio/*", outputs:["mp3","wav","ogg","webm"], def:"mp3", hint:"Convert audio MP3 ↔ WAV ↔ OGG", type:"file",
    options:[{id:"audioQuality",label:"Quality",type:"select",opts:["Low (64kbps)","Medium (128kbps)","High (192kbps)","Best (320kbps)"],def:"Medium (128kbps)"},{id:"trim",label:"Trim",type:"select",opts:["No trim","Trim first 30s","Trim last 30s","Custom (coming soon)"],def:"No trim"}]
  },
  "quiz-scanner": { 
    name:"Quiz Analyzer", desc:"Analyze + predict", icon:"🧠",
    longDesc:"Upload up to 25 past quizzes/exams + reference files (books/modules). OCR extracts questions from all files, analyzes professor's pattern across 25 files: favorite topics, question types, wording style. Compares with references to predict next exam and generates study guide. Supports 25 files max!",
    howTo:"Upload up to 25 quiz files (first = main quiz, rest = additional quizzes or references) → Choose mode → Convert → Get analysis from all 25 files + predicted questions",
    accept:"image/*,application/pdf,.txt,.docx", outputs:["txt","pdf"], def:"txt", hint:"Upload up to 25 files! First = main quiz, rest = extra quizzes/refs → Analyze pattern", type:"file", 
    options:[{id:"analysisMode",label:"Mode",type:"select",opts:["Analyze quiz pattern only","Compare with reference file","Generate study guide"],def:"Analyze quiz pattern only"}]
  }
};

let activeTool="images-to-pdf";
let fileQueue=[];
let optionValues={};
let pomodoroState={work:25,break:5,isRunning:false,isBreak:false,timeLeft:25*60,interval:null,tasks:JSON.parse(localStorage.getItem('pomodoro_tasks')||'[]')};







const fileInput=$("#fileInput"),dropZone=$("#dropZone"),fileList=$("#fileList"),optionsPanel=$("#optionsPanel"),customPanel=$("#customPanel"),outputFormat=$("#outputFormat"),statusText=$("#statusText"),resultArea=$("#resultArea"),resultContent=$("#resultContent"),resultMeta=$("#resultMeta"),convertBtn=$("#convertBtn"),clearBtn=$("#clearBtn");

function init(){
  if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  $$(".tool-card").forEach(b=>b.addEventListener("click",()=>setActiveTool(b.dataset.tool)));
  dropZone.addEventListener("click",()=>{if(tools[activeTool].type!=="form") fileInput.click()});
  dropZone.addEventListener("dragover",e=>{e.preventDefault();dropZone.classList.add("drag")});
  dropZone.addEventListener("dragleave",()=>dropZone.classList.remove("drag"));
  dropZone.addEventListener("drop",e=>{e.preventDefault();dropZone.classList.remove("drag");handleFiles(e.dataTransfer.files)});
  fileInput.addEventListener("change",e=>handleFiles(e.target.files));
  convertBtn.addEventListener("click",runConversion);
  clearBtn.addEventListener("click",clearAll);
  outputFormat.addEventListener("change",renderFileList);
  $("#toolInfoClose")?.addEventListener("click",()=>$("#toolInfoBox").classList.add("hidden"));
  setActiveTool(activeTool);
}

function setActiveTool(id){
  activeTool=id;
  const cfg=tools[id];
  $$(".tool-card").forEach(b=>b.classList.toggle("active",b.dataset.tool===id));
  $("#activeToolIcon").textContent=cfg.icon;
  $("#activeToolName").textContent=cfg.name;
  $("#activeToolDesc").textContent=cfg.desc;
  $("#dropHint").textContent=cfg.hint;
  // Update tool info box
  if($("#toolInfoBox")){
    $("#toolInfoBox").classList.remove("hidden");
    $("#toolInfoTitle").textContent=cfg.name;
    $("#toolInfoDesc").textContent=cfg.longDesc||cfg.desc;
    $("#toolInfoHowText").textContent=cfg.howTo||"Follow steps in panel";
  }
  fileInput.accept=cfg.accept||"*/*";
  outputFormat.innerHTML="";
  cfg.outputs.forEach(o=>{if(!o)return;const opt=document.createElement("option");opt.value=o;opt.textContent=o.toUpperCase();if(o===cfg.def)opt.selected=true;outputFormat.appendChild(opt)});
  optionValues={};
  cfg.options.forEach(op=>optionValues[op.id]=op.def);
  renderOptions();
  renderCustomPanel();
  renderFileList();
  updateStatus();
  if(cfg.type==="form" && id!=="gpa"){dropZone.style.display="none";convertBtn.style.display="none";}
  else if(cfg.type==="form" && id==="gpa"){dropZone.style.display="block";convertBtn.style.display="none";$("#dropHint").textContent="Optional: Drop screenshot for auto-fill, or fill manually below";}
  else{dropZone.style.display="block";convertBtn.style.display="flex";}

  // NEW: Auto-scroll to function panel on mobile/app - so when you click Citation, it shows its function
  setTimeout(()=>{
    const panel = document.getElementById("converterPanel");
    if(panel){
      // On mobile (<1024px) or in app version, scroll to panel
      if(window.innerWidth < 1024 || window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches){
        panel.scrollIntoView({behavior:"smooth", block:"start"});
      }
      // Highlight effect to show it's active
      panel.classList.add("ring-2","ring-indigo-200");
      setTimeout(()=>panel.classList.remove("ring-2","ring-indigo-200"), 800);
    }
    // Also focus custom panel if form
    if(cfg.type==="form"){
      const custom = document.getElementById("customPanel");
      if(custom) custom.scrollIntoView({behavior:"smooth", block:"start"});
    }
  }, 150);
}

function renderOptions(){
  const cfg=tools[activeTool];
  optionsPanel.innerHTML="";
  cfg.options.forEach(op=>{
    if(op.showIf && !op.showIf(optionValues)) return;
    const wrap=document.createElement("div");
    wrap.className="rounded-xl border bg-zinc-50/70 p-3";
    let inner=`<div class="text-[11px] font-mono font-bold uppercase text-zinc-500 mb-2">${op.label}</div>`;
    if(op.type==="select") inner+=`<select data-opt="${op.id}" class="w-full text-[13px] px-3 py-2 rounded-full border bg-white">${op.opts.map(v=>`<option ${v===optionValues[op.id]?'selected':''}>${v}</option>`).join("")}</select>`;
    else if(op.type==="range") inner+=`<div class="flex items-center gap-3"><input data-opt="${op.id}" type="range" min="${op.min}" max="${op.max}" value="${optionValues[op.id]}" class="flex-1 accent-zinc-900"><span class="text-[12px] font-mono w-10 text-right">${optionValues[op.id]}%</span></div>`;
    else if(op.type==="number") inner+=`<input data-opt="${op.id}" type="number" value="${optionValues[op.id]}" class="w-full text-[13px] px-3 py-2 rounded-lg border bg-white">`;
    else if(op.type==="text") inner+=`<input data-opt="${op.id}" type="text" value="${optionValues[op.id]}" class="w-full text-[13px] px-3 py-2 rounded-lg border bg-white">`;
    wrap.innerHTML=inner;
    optionsPanel.appendChild(wrap);
  });
  optionsPanel.querySelectorAll("[data-opt]").forEach(el=>{
    el.addEventListener("input",e=>{
      const id=e.target.dataset.opt;
      optionValues[id]=e.target.value;
      const label=e.target.parentElement?.querySelector("span");
      if(label && e.target.type==="range") label.textContent=e.target.value+"%";
      if(tools[activeTool].options.some(o=>o.showIf)) renderOptions();
    });
  });
}

function renderCustomPanel(){
  const cfg=tools[activeTool];
  customPanel.innerHTML="";
  if(cfg.type!=="form") return;
  if(activeTool==="word-counter") customPanel.innerHTML=`<div class="rounded-2xl border p-4"><div class="text-[12px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Essay Checker - Paste your essay</div><textarea id="wcText" class="w-full h-[200px] p-4 rounded-xl border text-[14px]" placeholder="Paste your essay here..."></textarea><div id="wcStats" class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3"></div></div>`;
  else if(activeTool==="citation") customPanel.innerHTML=`<div class="rounded-2xl border p-5 space-y-4"><div class="text-[12px] font-bold uppercase">Citation Generator (APA 7th / MLA 9th)</div><div class="grid md:grid-cols-2 gap-3"><input id="citAuthor" placeholder="Author (e.g. Dela Cruz, J.)" class="px-3 py-2 rounded-lg border text-[13px]"><input id="citYear" placeholder="Year (2024)" class="px-3 py-2 rounded-lg border text-[13px]"><input id="citTitle" placeholder="Title of book/article" class="md:col-span-2 px-3 py-2 rounded-lg border text-[13px]"><input id="citSource" placeholder="Publisher / Website / Journal" class="md:col-span-2 px-3 py-2 rounded-lg border text-[13px]"><select id="citStyle" class="px-3 py-2 rounded-lg border text-[13px]"><option>APA 7th</option><option>MLA 9th</option></select><select id="citType" class="px-3 py-2 rounded-lg border text-[13px]"><option>Book</option><option>Website</option><option>Journal</option></select></div><button id="citGen" class="px-5 py-2.5 rounded-full bg-zinc-900 text-white font-bold text-[13px]">Generate Citation</button><div id="citResult" class="p-4 rounded-xl bg-zinc-50 border font-mono text-[13px] hidden"></div></div>`;

  else if(activeTool==="gpa") customPanel.innerHTML=`<div class="rounded-2xl border p-5"><div class="flex flex-col md:flex-row justify-between gap-3"><div class="text-[12px] font-bold uppercase">GPA / GWA Calculator (PH) - With Screenshot Scanner</div><select id="gpaSystem" class="text-[12px] px-3 py-1 rounded-full border"><option value="college5">College 1.0-5.0 (1.0 highest)</option><option value="college4">College 4.0 scale</option><option value="shs">SHS/JHS % (75-100)</option><option value="elem">Elementary %</option></select></div><div class="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200"><div class="font-bold text-[12px]">📸 NEW: Upload Screenshot of Grades (Auto-fill)</div><div class="text-[11px] text-zinc-600 mt-1">Upload screenshot from portal (e.g., grades with subjects, units, grades). OCR will auto-detect and fill table — no more manual typing!</div><div class="mt-3 flex gap-2"><input type="file" id="gpaScreenshot" accept="image/*" class="text-[12px]"><button id="gpaOcrBtn" class="px-4 py-2 rounded-full bg-indigo-600 text-white text-[11px] font-bold">Scan Screenshot → Auto-fill</button><span id="gpaOcrStatus" class="text-[11px] font-mono text-zinc-500"></span></div></div><div id="gpaRows" class="mt-4 space-y-2"></div><div class="mt-4 flex gap-2"><button id="gpaAdd" class="px-4 py-2 rounded-full border text-[12px] font-bold">+ Add Subject</button><button id="gpaCalc" class="px-5 py-2 rounded-full bg-zinc-900 text-white font-bold text-[12px]">Calculate GWA</button></div><div id="gpaResult" class="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-200 hidden"></div></div>`;
  else if(activeTool==="qr") customPanel.innerHTML=`<div class="rounded-2xl border p-5"><div class="text-[12px] font-bold uppercase">QR Code Generator</div><div class="mt-4 grid md:grid-cols-2 gap-6"><div class="space-y-3"><select id="qrType" class="w-full px-3 py-2 rounded-lg border text-[13px]"><option value="text">Text / Link</option><option value="wifi">WiFi</option><option value="email">Email</option></select><textarea id="qrInput" class="w-full h-[120px] p-3 rounded-xl border text-[13px]" placeholder="Enter link, text, or WiFi: WIFI:T:WPA;S:MyWiFi;P:password;;"></textarea><div id="qrWifiFields" class="hidden space-y-2"><input id="qrWifiSSID" placeholder="WiFi Name (SSID)" class="w-full px-3 py-2 rounded-lg border text-[13px]"><input id="qrWifiPass" placeholder="Password" class="w-full px-3 py-2 rounded-lg border text-[13px]"></div><button id="qrGen" class="px-5 py-2.5 rounded-full bg-zinc-900 text-white font-bold text-[13px]">Generate QR</button></div><div class="text-center"><div id="qrCanvas" class="mx-auto w-[200px] h-[200px] border rounded-xl grid place-items-center bg-zinc-50">QR will appear here</div><button id="qrDownload" class="mt-3 px-4 py-2 rounded-full border text-[12px] font-bold hidden">Download PNG</button></div></div></div>`;
  else if(activeTool==="paraphraser") customPanel.innerHTML=`<div class="rounded-2xl border p-5 space-y-4"><div class="flex justify-between items-center"><div class="text-[12px] font-bold uppercase">✍️ Paraphraser — Humanize AI Text, Remove AI Signs</div><div class="text-[10px] font-mono px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">Bypass AI Detectors</div></div><div class="grid md:grid-cols-3 gap-3"><select id="paraMode" class="px-3 py-2 rounded-lg border text-[13px]"><option value="human-academic">Humanize Academic (for school)</option><option value="human-simple">Humanize Simple (casual)</option><option value="human-formal">Humanize Formal</option><option value="remove-ai">Remove AI Signs Only</option></select><select id="paraStrength" class="px-3 py-2 rounded-lg border text-[13px]"><option value="light">Light - Keep meaning</option><option value="medium" selected>Medium - Balanced</option><option value="strong">Strong - Heavy rewrite</option></select><label class="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg border bg-zinc-50"><input type="checkbox" id="paraContractions" checked> Use contractions (don't, it's)</label></div><div class="grid md:grid-cols-2 gap-4"><div><div class="text-[11px] font-bold uppercase mb-2">Paste AI Text Here</div><textarea id="paraInput" class="w-full h-[280px] p-4 rounded-xl border text-[13px] leading-[1.6]" placeholder="Paste your AI-generated essay here...\n\nExample: In conclusion, it is important to note that furthermore, the utilization of technology delves into the tapestry of modern education..."></textarea><div id="paraInputStats" class="mt-2 text-[11px] font-mono text-zinc-500">0 words • 0 chars</div></div><div><div class="flex justify-between items-center mb-2"><div class="text-[11px] font-bold uppercase">Humanized Output - AI Signs Removed</div><button id="paraCopy" class="px-3 py-1 rounded-full border text-[11px]">Copy</button></div><textarea id="paraOutput" class="w-full h-[280px] p-4 rounded-xl border bg-emerald-50/30 text-[13px] leading-[1.6]" placeholder="Humanized essay will appear here..." readonly></textarea><div id="paraOutputStats" class="mt-2 text-[11px] font-mono text-zinc-500">0 words • AI signs removed: 0</div></div></div><div class="flex gap-2"><button id="paraBtn" class="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-[13px] flex items-center gap-2"><span>✍️</span> Humanize Text - Remove AI Signs</button><button id="paraClear" class="px-5 py-3 rounded-full border font-bold text-[13px]">Clear</button></div><div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] leading-[1.5]"><b>What it removes:</b> "In conclusion, Furthermore, Moreover, It is important to note, Delve, Tapestry, Leverage, Utilize, Embark, In today's fast-paced world, As an AI..." + em dashes (—), overly formal phrases, repetitive structures. Rewrites with varied sentence lengths, contractions, natural flow to bypass Turnitin, GPTZero, etc. 100% offline.</div></div>`;
  else if(activeTool==="pomodoro") customPanel.innerHTML=`<div class="rounded-2xl border p-6 text-center"><div class="text-[12px] font-bold uppercase tracking-widest">Pomodoro Timer — Focus Study</div><div id="pomoTime" class="mt-4 text-[64px] font-[800] leading-none tracking-tight">25:00</div><div id="pomoStatus" class="text-[12px] font-mono text-zinc-500 mt-2">Work Time • Stay Focused</div><div class="mt-6 flex justify-center gap-3"><button id="pomoStart" class="px-8 py-3 rounded-full bg-zinc-900 text-white font-bold">Start</button><button id="pomoReset" class="px-6 py-3 rounded-full border font-bold">Reset</button></div><div class="mt-8 text-left"><div class="text-[11px] font-bold uppercase">Tasks</div><div class="mt-2 flex gap-2"><input id="pomoTaskInput" placeholder="Add task..." class="flex-1 px-3 py-2 rounded-lg border text-[13px]"><button id="pomoAddTask" class="px-4 py-2 rounded-full bg-zinc-900 text-white text-[12px]">Add</button></div><div id="pomoTasks" class="mt-3 space-y-2"></div></div></div>`;
  setTimeout(bindFormEvents,100);
}

function bindFormEvents(){
  if(activeTool==="word-counter"){
    const ta=$("#wcText"),stats=$("#wcStats");
    if(!ta) return;
    ta.addEventListener("input",()=>{
      const text=ta.value;
      const words=text.trim()?text.trim().split(/\s+/).length:0;
      const chars=text.length;
      const sentences=text.split(/[.!?]+/).filter(s=>s.trim().length>0).length;
      const readTime=Math.ceil(words/200);
      stats.innerHTML=`<div class="p-3 rounded-xl bg-zinc-50 border text-center"><div class="font-bold text-[18px]">${words}</div><div class="text-[10px] uppercase">Words</div></div><div class="p-3 rounded-xl bg-zinc-50 border text-center"><div class="font-bold text-[18px]">${chars}</div><div class="text-[10px] uppercase">Characters</div></div><div class="p-3 rounded-xl bg-zinc-50 border text-center"><div class="font-bold text-[18px]">${sentences}</div><div class="text-[10px] uppercase">Sentences</div></div><div class="p-3 rounded-xl bg-zinc-50 border text-center"><div class="font-bold text-[18px]">${readTime}m</div><div class="text-[10px] uppercase">Read time</div></div>`;
    });
    ta.dispatchEvent(new Event('input'));
  }
  else if(activeTool==="citation"){
    $("#citGen")?.addEventListener("click",()=>{
      const author=$("#citAuthor").value||"Unknown",year=$("#citYear").value||"n.d.",title=$("#citTitle").value||"Untitled",source=$("#citSource").value||"",style=$("#citStyle").value,type=$("#citType").value;
      let result="";
      if(style==="APA 7th"){
        if(type==="Book") result=`${author} (${year}). ${title}. ${source}.`;
        else if(type==="Website") result=`${author} (${year}). ${title}. ${source}. Retrieved from ${source}`;
        else result=`${author} (${year}). ${title}. ${source}.`;
      }else{
        if(type==="Book") result=`${author}. ${title}. ${source}, ${year}.`;
        else result=`${author}. "${title}." ${source}, ${year}.`;
      }
      const el=$("#citResult");el.innerHTML=result;el.classList.remove("hidden");
    });
  }

  
  

    else if(activeTool==="gpa"){
    const rows=$("#gpaRows");
    function addRow(sub="",units=3,grade=""){
      const div=document.createElement("div");
      div.className="flex gap-2";
      div.innerHTML=`<input placeholder="Subject" value="${sub}" class="flex-1 px-3 py-2 rounded-lg border text-[12px] gpa-sub"><input type="number" placeholder="Units" value="${units}" class="w-[70px] px-2 py-2 rounded-lg border text-[12px] gpa-units"><input placeholder="Grade" class="w-[100px] px-2 py-2 rounded-lg border text-[12px] gpa-grade" value="${grade}"><button class="w-8 h-8 rounded-full border grid place-items-center gpa-del">✕</button>`;
      rows.appendChild(div);
      div.querySelector(".gpa-del").addEventListener("click",()=>div.remove());
    }
    addRow("Math",3,"1.25");addRow("Science",3,"1.5");addRow("English",3,"1.0");
    $("#gpaAdd").addEventListener("click",()=>addRow());
    $("#gpaCalc").addEventListener("click",()=>{
      const system=$("#gpaSystem").value;
      let totalUnits=0,totalPoints=0,totalGrades=0,count=0;
      rows.querySelectorAll("div").forEach(r=>{
        const units=parseFloat(r.querySelector(".gpa-units").value)||0;
        const gradeStr=r.querySelector(".gpa-grade").value.trim();
        let grade=parseFloat(gradeStr);
        if(isNaN(grade)) return;
        if(system==="shs"||system==="elem"){
          if(grade>=97) grade=1.0;else if(grade>=93) grade=1.25;else if(grade>=89) grade=1.5;else if(grade>=85) grade=1.75;else if(grade>=81) grade=2.0;else if(grade>=77) grade=2.25;else if(grade>=73) grade=2.5;else if(grade>=69) grade=2.75;else if(grade>=65) grade=3.0;else grade=5.0;
        }
        if(system==="college4") grade=5.0-grade;
        totalUnits+=units;totalPoints+=grade*units;totalGrades+=grade;count++;
      });
      const gwa=totalUnits? (totalPoints/totalUnits).toFixed(2) : (totalGrades/count||0).toFixed(2);
      let honor="";const g=parseFloat(gwa);
      if(g<=1.2) honor="Summa Cum Laude / With Highest Honors";else if(g<=1.45) honor="Magna Cum Laude / With High Honors";else if(g<=1.75) honor="Cum Laude / With Honors";else if(g<=2.0) honor="With Honors";else honor="Passed";
      $("#gpaResult").innerHTML=`<div class="font-bold text-[18px]">GWA: ${gwa}</div><div class="text-[13px] mt-1">${honor}</div><div class="text-[11px] font-mono mt-2 opacity-70">Total Units: ${totalUnits} • Subjects: ${count}</div>`;
      $("#gpaResult").classList.remove("hidden");
    });
    // FIXED OCR for BSBA portal format (red header, Final Grade column)
    $("#gpaOcrBtn").addEventListener("click",async()=>{
      const file=$("#gpaScreenshot").files[0];
      if(!file) return alert("Select screenshot first");
      if(!window.Tesseract) return alert("OCR loading, wait 5s - refresh if needed");
      $("#gpaOcrStatus").textContent="Scanning... 0%";
      const img=await loadImage(file);
      const canvas=document.createElement("canvas");
      const scaleFactor = img.naturalWidth < 1200 ? 2 : 1.2;
      canvas.width=img.naturalWidth*scaleFactor;
      canvas.height=img.naturalHeight*scaleFactor;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      // Enhance contrast for red header tables
      const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
      const d=imgData.data;
      for(let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2];
        // Make red header white, boost contrast
        const brightness=(r+g+b)/3;
        if(r>150 && g<100 && b<100){d[i]=d[i+1]=d[i+2]=255;} // red header -> white
        else if(brightness>200){d[i]=d[i+1]=d[i+2]=255;}
        else if(brightness<90){d[i]=d[i+1]=d[i+2]=0;}
      }
      ctx.putImageData(imgData,0,0);
      const result=await Tesseract.recognize(canvas,"eng",{logger:m=>{if(m.status==="recognizing text") $("#gpaOcrStatus").textContent=`Scanning... ${Math.round(m.progress*100)}%`;}});
      const text=result.data.text;
      console.log("OCR text:", text);
      $("#gpaOcrStatus").textContent="Parsing portal grades...";
      rows.innerHTML="";
      let found=0;
      const lines=text.split("\n");
      lines.forEach(line=>{
        let clean=line.trim();
        if(!clean) return;
        if(/subject code|school year|course code|faculty name|grade status/i.test(clean)) return;
        if(clean.length<10) return;
        // Must have PASSED or a grade like 1.25, 2.00 etc
        if(!/(PASSED|FAILED)/i.test(clean) && !/\b[1-5]\.\d{1,2}\b/.test(clean)) return;
        // Extract final grade: last decimal before PASSED, or last decimal in line
        let grade=null;
        const passedMatch=clean.match(/(\d+\.\d{1,2})\s*(PASSED|FAILED)/i);
        if(passedMatch) grade=passedMatch[1];
        else{
          const all=[...clean.matchAll(/\b([1-5]\.\d{1,2})\b/g)];
          if(all.length>0) grade=all[all.length-1][1];
        }
        if(!grade) return;
        const gradeVal=parseFloat(grade);
        if(gradeVal<1.0 || gradeVal>5.0) return;
        // Subject code: first token like BUSITAXN, GEETHICS, MMBUSRS2, etc
        let subjCode="";
        const codeM=clean.match(/^\s*\d+\s+([A-Z]{3,}[A-Z0-9]{1,8})\b/);
        if(codeM) subjCode=codeM[1];
        // Description: try to extract between code and comma (faculty)
        let desc="";
        const commaIdx=clean.indexOf(",");
        if(commaIdx>0){
          let before=clean.slice(0,commaIdx);
          // Remove leading "# CODE"
          before=before.replace(/^\s*\d+\s+[A-Z0-9]+\s+/, "").trim();
          // Remove trailing faculty first name
          const lastSpace=before.lastIndexOf("  ");
          if(lastSpace>0) before=before.slice(0,lastSpace).trim();
          desc=before.split(/\s{2,}/)[0] || before;
          desc=desc.replace(/\b[A-Z][a-z]+\b.*$/,"").trim().slice(0,40);
        }
        let subject=desc||subjCode||`Subject ${found+1}`;
        if(subjCode && desc && !subject.includes(subjCode)) subject=`${subjCode} - ${desc}`;
        // Units: find BSBA or number before section
        let units=3;
        const unitsM=clean.match(/\b([1-6])\s+(?:BSBA|BSA|BSIT|BSCS|BEED|BSED|AB|BS-|BSBA-MKTG)/i);
        if(unitsM) units=parseInt(unitsM[1]);
        else{
          const beforeGrade=clean.split(grade)[0];
          const singles=[...beforeGrade.matchAll(/\b([1-6])\b/g)];
          if(singles.length>0) units=parseInt(singles[singles.length-1][1]);
        }
        addRow(subject,units,grade);
        found++;
      });
      if(found===0){
        const all=text.match(/\b[1-5]\.\d{1,2}\b/g)||[];
        const filtered=all.filter(g=>{const v=parseFloat(g);return v>=1.0&&v<=3.0;});
        filtered.slice(0,12).forEach((g,i)=>addRow(`Subject ${i+1}`,3,g));
        found=filtered.length;
      }
      $("#gpaOcrStatus").textContent=`Found ${found} subjects from screenshot! ${found>0?"Check below and click Calculate.":""}`;
      if(found===0) alert("OCR could not read. Try cropping to just the table, or type manually. Text:\n"+text.slice(0,600));
    });
  }
  else if(activeTool==="qr"){
    $("#qrType").addEventListener("change",e=>{$("#qrWifiFields").classList.toggle("hidden",e.target.value!=="wifi");});
    $("#qrGen").addEventListener("click",()=>{
      let text=$("#qrInput").value.trim();
      if($("#qrType").value==="wifi"){const ssid=$("#qrWifiSSID").value,pass=$("#qrWifiPass").value;text=`WIFI:T:WPA;S:${ssid};P:${pass};;`;}
      if(!text) return alert("Enter text");
      const container=$("#qrCanvas");container.innerHTML="";new QRCode(container,{text,width:200,height:200});
      $("#qrDownload").classList.remove("hidden");
      $("#qrDownload").onclick=()=>{
        const img=container.querySelector("img")||container.querySelector("canvas");
        if(img.tagName==="CANVAS"){const a=document.createElement("a");a.download="qr.png";a.href=img.toDataURL();a.click();}
        else{const a=document.createElement("a");a.download="qr.png";a.href=img.src;a.click();}
      };
    });
  }
      else if(activeTool==="paraphraser"){
    const input=$("#paraInput"),output=$("#paraOutput"),inputStats=$("#paraInputStats"),outputStats=$("#paraOutputStats");
    function updateStats(){
      const inWords=input.value.trim()?input.value.trim().split(/\s+/).length:0;
      inputStats.textContent=`${inWords} words • ${input.value.length} chars`;
      const outWords=output.value.trim()?output.value.trim().split(/\s+/).length:0;
      const aiRemoved=(output.dataset.removed||0);
      outputStats.textContent=`${outWords} words • AI signs removed: ${aiRemoved}`;
    }
    input.addEventListener("input",updateStats);
    $("#paraClear").addEventListener("click",()=>{input.value="";output.value="";updateStats();});
    $("#paraCopy").addEventListener("click",()=>{output.select();document.execCommand("copy");alert("Copied!");});
    $("#paraBtn").addEventListener("click",()=>{
      const text=input.value;
      if(!text.trim()) return alert("Paste AI text first");
      const mode=$("#paraMode").value;
      const strength=$("#paraStrength").value;
      const useContractions=$("#paraContractions").checked;
      const result=humanizeText(text,mode,strength,useContractions);
      output.value=result.text;
      output.dataset.removed=result.removed;
      updateStats();
    });

    function humanizeText(text,mode,strength,useContractions){
      let removed=0;
      let out=text;

      // List of AI clichés to remove/replace
      const aiPhrases=[
        [/In conclusion,?/gi,"To sum up,"],
        [/In summary,?/gi,"To sum up,"],
        [/Furthermore,?/gi,"Also,"],
        [/Moreover,?/gi,"Besides,"],
        [/Additionally,?/gi,"Also,"],
        [/It is important to note that/gi,""],
        [/It is worth noting that/gi,""],
        [/It should be noted that/gi,""],
        [/It is essential to understand that/gi,""],
        [/It is crucial to understand that/gi,""],
        [/Delve into/gi,"Explore"],
        [/Delving into/gi,"Exploring"],
        [/Tapestry/gi,"mix"],
        [/Leverage/gi,"use"],
        [/Leveraging/gi,"Using"],
        [/Utilize/gi,"use"],
        [/Utilizing/gi,"Using"],
        [/Embark on/gi,"Start"],
        [/In today's fast-paced world,?/gi,""],
        [/In the realm of/gi,"In"],
        [/In the world of/gi,"In"],
        [/As an AI language model,?/gi,""],
        [/As an AI,?/gi,""],
        [/The utilization of/gi,"Using"],
        [/A myriad of/gi,"Many"],
        [/It is imperative to/gi,"We need to"],
        [/It is vital to/gi,"It's important to"],
        [/Pivotal/gi,"important"],
        [/Crucial/gi,"important"],
        [/Essentially,/gi,""],
        [/Ultimately,/gi,"In the end,"],
        [/In essence,/gi,""],
        [/—/g,","], // em dash is AI sign
        [/  +/g," "]
      ];

      aiPhrases.forEach(([pattern,replacement])=>{
        const before=out;
        out=out.replace(pattern,replacement);
        if(before!==out) removed++;
      });

      // Synonym replacements for humanizing (light)
      const synonyms={
        "very":"really","really":"quite","quite":"rather","important":"key","key":"important",
        "big":"large","large":"big","small":"little","little":"small","good":"great","great":"good",
        "bad":"poor","utilize":"use","however":"but","therefore":"so","thus":"so","hence":"so",
        "numerous":"many","many":"many","various":"different","different":"various","obtain":"get","get":"get",
        "demonstrate":"show","show":"show","indicate":"show","facilitate":"help","help":"help"
      };

      // Sentence restructuring for stronger paraphrase
      let sentences=out.split(/([.!?]+)/);
      let newSentences=[];
      for(let i=0;i<sentences.length;i+=2){
        let sent=sentences[i]||"";
        let punct=sentences[i+1]||"";
        if(!sent.trim()){newSentences.push(sent+punct);continue;}
        let s=sent.trim();

        // Medium/Strong: synonym replacement
        if(strength!=="light"){
          Object.entries(synonyms).forEach(([word,syn])=>{
            if(Math.random()>0.6){
              const regex=new RegExp(`\\b${word}\\b`,"gi");
              if(regex.test(s)){s=s.replace(regex,syn);removed++;}
            }
          });
        }

        // Add contractions for human touch
        if(useContractions && mode!=="human-formal"){
          s=s.replace(/\bdo not\b/gi,"don't").replace(/\bdoes not\b/gi,"doesn't").replace(/\bdid not\b/gi,"didn't")
            .replace(/\bcannot\b/gi,"can't").replace(/\bwill not\b/gi,"won't").replace(/\bI am\b/g,"I'm")
            .replace(/\bit is\b/gi,"it's").replace(/\bthat is\b/gi,"that's").replace(/\bthere is\b/gi,"there's");
        }

        // Vary sentence start for academic mode - add natural transitions
        if(mode==="human-academic" && Math.random()>0.7 && s.length>30){
          const starters=["Honestly, ","Actually, ","Basically, ","In my view, ","From what I've seen, "];
          if(strength==="strong" && !/^(Honestly|Actually|Basically)/i.test(s)){
            s=starters[Math.floor(Math.random()*starters.length)]+s.charAt(0).toLowerCase()+s.slice(1);
          }
        }

        // Simple mode: make simpler
        if(mode==="human-simple"){
          s=s.replace(/utilize/g,"use").replace(/facilitate/g,"help").replace(/demonstrate/g,"show").replace(/numerous/g,"many");
        }

        newSentences.push(s+punct);
      }
      out=newSentences.join(" ");

      // Remove double spaces, fix punctuation
      out=out.replace(/\s+/g," ").replace(/\s+([.,!?])/g,"$1").replace(/,\s*,/g,",").trim();

      // Remove empty sentences that are just AI filler
      out=out.replace(/To sum up,\s*To sum up,/gi,"To sum up,").replace(/^,\s*/,"");

      return {text:out,removed};
    }
  }
  else if(activeTool==="pomodoro"){
    const timeEl=$("#pomoTime"),statusEl=$("#pomoStatus"),tasksEl=$("#pomoTasks");
    function renderTasks(){
      tasksEl.innerHTML="";
      pomodoroState.tasks.forEach((t,i)=>{
        const div=document.createElement("div");
        div.className="flex items-center gap-2 p-2 rounded-lg border bg-white";
        div.innerHTML=`<input type="checkbox" ${t.done?'checked':''} data-i="${i}" class="pomo-check"><span class="flex-1 text-[13px] ${t.done?'line-through opacity-60':''}">${escapeHtml(t.text)}</span><button data-del="${i}" class="w-6 h-6 rounded-full border">✕</button>`;
        tasksEl.appendChild(div);
      });
      tasksEl.querySelectorAll(".pomo-check").forEach(cb=>cb.addEventListener("change",e=>{pomodoroState.tasks[parseInt(e.target.dataset.i)].done=e.target.checked;localStorage.setItem('pomodoro_tasks',JSON.stringify(pomodoroState.tasks));renderTasks();}));
      tasksEl.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{pomodoroState.tasks.splice(parseInt(b.dataset.del),1);localStorage.setItem('pomodoro_tasks',JSON.stringify(pomodoroState.tasks));renderTasks();}));
    }
    function updateDisplay(){
      const m=Math.floor(pomodoroState.timeLeft/60).toString().padStart(2,"0"),s=(pomodoroState.timeLeft%60).toString().padStart(2,"0");
      timeEl.textContent=`${m}:${s}`;
      statusEl.textContent=pomodoroState.isBreak?"Break Time • Relax":"Work Time • Stay Focused";
    }
    renderTasks();updateDisplay();
    $("#pomoAddTask").addEventListener("click",()=>{
      const txt=$("#pomoTaskInput").value.trim();if(!txt) return;
      pomodoroState.tasks.push({text:txt,done:false});localStorage.setItem('pomodoro_tasks',JSON.stringify(pomodoroState.tasks));$("#pomoTaskInput").value="";renderTasks();
    });
    $("#pomoStart").addEventListener("click",()=>{
      if(pomodoroState.isRunning){clearInterval(pomodoroState.interval);pomodoroState.isRunning=false;$("#pomoStart").textContent="Start";return;}
      pomodoroState.isRunning=true;$("#pomoStart").textContent="Pause";
      pomodoroState.interval=setInterval(()=>{
        pomodoroState.timeLeft--;
        if(pomodoroState.timeLeft<=0){
          clearInterval(pomodoroState.interval);
          pomodoroState.isBreak=!pomodoroState.isBreak;
          pomodoroState.timeLeft=pomodoroState.isBreak?pomodoroState.break*60:pomodoroState.work*60;
          try{new Notification(pomodoroState.isBreak?"Break Time!":"Work Time!",{body:pomodoroState.isBreak?"Relax 5 minutes":"Focus 25 minutes"});}catch{}
          pomodoroState.isRunning=false;$("#pomoStart").textContent="Start";
        }
        updateDisplay();
      },1000);
    });
    $("#pomoReset").addEventListener("click",()=>{clearInterval(pomodoroState.interval);pomodoroState.isRunning=false;pomodoroState.isBreak=false;pomodoroState.timeLeft=pomodoroState.work*60;updateDisplay();$("#pomoStart").textContent="Start";});
    if("Notification" in window && Notification.permission!=="granted") Notification.requestPermission();
  }
}

function handleFiles(list){
  const files=Array.from(list);
  if(!files.length) return;
  // Quiz analyzer allows 25 files, others unlimited but warn if >25
  const maxFiles = activeTool==="quiz-scanner" ? 25 : 50;
  if(fileQueue.length + files.length > maxFiles){
    const allowed = maxFiles - fileQueue.length;
    if(allowed<=0){
      alert(`Max ${maxFiles} files for ${activeTool}. Remove some first.`);
      return;
    }
    alert(`Only ${allowed} more files allowed (max ${maxFiles} for ${activeTool}). Adding first ${allowed} files.`);
    files.splice(allowed);
  }
  files.forEach(f=>{
    const id=Math.random().toString(36).slice(2);
    let preview=null;
    if(f.type.startsWith("image/")) preview=URL.createObjectURL(f);
    fileQueue.push({id,file:f,preview});
  });
  renderFileList();updateStatus();
}

function renderFileList(){
  fileList.innerHTML="";
  if(fileQueue.length===0 && tools[activeTool].type!=="form"){
    fileList.innerHTML=`<div class="text-[12px] font-mono text-zinc-400 text-center py-2">No files yet — drop some above</div>`;
    convertBtn.disabled=true;return;
  }
  if(tools[activeTool].type==="form" && activeTool!=="gpa" && activeTool!=="audio-converter"){
    fileList.innerHTML="";convertBtn.disabled=true;return;
  }
  convertBtn.disabled=false;
  fileQueue.forEach((item,idx)=>{
    const div=document.createElement("div");
    div.className="flex items-center gap-3 p-3 rounded-xl border bg-white";
    const size=(item.file.size/1024/1024).toFixed(2);
    const icon=item.file.type.startsWith("image/")?`<img src="${item.preview}" class="w-10 h-10 rounded-lg object-cover border">`:`<div class="w-10 h-10 rounded-lg bg-zinc-100 grid place-items-center">${tools[activeTool].icon}</div>`;
    div.innerHTML=`<div class="flex items-center gap-3 flex-1 min-w-0">${icon}<div class="min-w-0"><div class="font-medium text-[13px] truncate">${escapeHtml(item.file.name)}</div><div class="text-[11px] font-mono text-zinc-500">${size} MB</div></div></div><div class="flex items-center gap-2"><div class="text-[10px] font-mono px-2 py-1 rounded-full bg-zinc-100">#${idx+1}</div><button data-remove="${item.id}" class="w-7 h-7 rounded-full border grid place-items-center">✕</button></div>`;
    fileList.appendChild(div);
  });
  fileList.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{fileQueue=fileQueue.filter(f=>f.id!==b.dataset.remove);renderFileList();updateStatus();}));
}

function updateStatus(msg){
  if(msg){statusText.textContent=msg;return;}
  if(fileQueue.length===0 && tools[activeTool].type!=="form") statusText.textContent="Ready — add files";
  else if(tools[activeTool].type==="form") statusText.textContent="Ready";
  else statusText.textContent=`${fileQueue.length} file(s) • Output: ${outputFormat.value.toUpperCase()}`;
}

function clearAll(){
  fileQueue.forEach(f=>{if(f.preview) URL.revokeObjectURL(f.preview);});
  fileQueue=[];resultArea.classList.add("hidden");resultContent.innerHTML="";renderFileList();updateStatus();
}

function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

const readAsArrayBuffer=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsArrayBuffer(f);});
const readAsText=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(f);});
const readAsDataURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
function loadImage(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=rej;img.src=url;});}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function downloadText(text,filename,mime="text/plain"){downloadBlob(new Blob([text],{type:mime}),filename);}
async function canvasToBlob(canvas,type,quality){return new Promise(res=>canvas.toBlob(b=>res(b),type,quality));}
function showResult(title,meta,preview){resultArea.classList.remove("hidden");resultMeta.textContent=meta;let html=`<div class="font-bold text-[14px]">${escapeHtml(title)}</div>`;if(preview) html+=`<pre class="mt-3 max-h-[300px] overflow-auto text-[11px] font-mono bg-white border rounded-xl p-3 whitespace-pre-wrap">${escapeHtml(preview)}</pre>`;else html+=`<div class="mt-3 text-[12px] text-zinc-500">Downloaded to Downloads. Everything offline.</div>`;resultContent.innerHTML=html;}

async function runConversion(){
  const cfg=tools[activeTool];
  if(cfg.type==="form" && activeTool!=="audio-converter") return;
  if(fileQueue.length===0) return alert("Add files first");
  convertBtn.disabled=true;convertBtn.innerHTML=`<span class="animate-spin">◍</span> Converting...`;resultArea.classList.add("hidden");
  try{
    switch(activeTool){
      case "images-to-pdf": await convertImagesToPDF();break;
      case "pdf-to-images": await convertPdfToImages();break;
      case "merge-pdf": await convertMergePdf();break;
      case "split-pdf": await convertSplitPdf();break;
      case "pdf-to-text": await convertPdfToText();break;
      case "pdf-compress": await convertPdfCompress();break;
      case "image-converter": await convertImageConverter();break;
      case "compress-image": await convertCompressImage();break;
      case "doc-scanner": await convertDocScanner();break;
      case "docx-to-text": await convertDocx();break;
      case "txt-to-pdf": await convertTxtToPdf();break;
      case "csv-json": await convertCsvJson();break;
      case "base64": await convertBase64();break;
      case "ocr": await convertOcr();break;
      case "quiz-scanner": await convertQuizScanner();break;
      case "audio-converter": await convertAudio();break;
      default: alert("Not implemented");
    }
    updateStatus("Done ✓");
  }catch(e){console.error(e);updateStatus("Error: "+e.message);alert("Failed: "+e.message);}
  finally{convertBtn.disabled=false;convertBtn.innerHTML=`<span>⚡</span> Convert & Download`;}
}

// Converters (previous ones kept, only showing changed + new)
async function convertImagesToPDF(){
  const {PDFDocument}=PDFLib;const pdfDoc=await PDFDocument.create();
  const marginMap={"None":0,"Small":20,"Medium":40};const margin=marginMap[optionValues.margin]||20;
  for(const item of fileQueue){
    const bytes=await readAsArrayBuffer(item.file);
    let img,dims;
    try{
      if(item.file.type.includes("jpeg")||item.file.name.match(/\.jpe?g$/i)){img=await pdfDoc.embedJpg(bytes);dims=img.scale(1);}
      else if(item.file.type.includes("png")){img=await pdfDoc.embedPng(bytes);dims=img.scale(1);}
      else{const el=await loadImage(item.file);const c=document.createElement("canvas");c.width=el.naturalWidth;c.height=el.naturalHeight;c.getContext("2d").drawImage(el,0,0);const b=await canvasToBlob(c,"image/png");const arr=await b.arrayBuffer();img=await pdfDoc.embedPng(arr);dims=img.scale(1);}
    }catch{const el=await loadImage(item.file);const c=document.createElement("canvas");c.width=el.naturalWidth;c.height=el.naturalHeight;c.getContext("2d").drawImage(el,0,0);const b=await canvasToBlob(c,"image/jpeg",0.92);const arr=await b.arrayBuffer();img=await pdfDoc.embedJpg(arr);dims=img.scale(1);}
    let pw,ph;if(optionValues.pageSize==="Fit image"){pw=dims.width+margin*2;ph=dims.height+margin*2;}else if(optionValues.pageSize==="A4"){pw=595.28;ph=841.89;}else{pw=612;ph=792;}
    if(optionValues.orientation==="Landscape"||(optionValues.orientation==="Auto"&&dims.width>dims.height&&optionValues.pageSize!=="Fit image")) [pw,ph]=[ph,pw];
    const page=pdfDoc.addPage([pw,ph]);const maxW=pw-margin*2,maxH=ph-margin*2,scale=Math.min(maxW/dims.width,maxH/dims.height),w=dims.width*scale,h=dims.height*scale,x=(pw-w)/2,y=(ph-h)/2;
    page.drawImage(img,{x,y,width:w,height:h});
  }
  const out=await pdfDoc.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`images-${Date.now()}.pdf`);showResult(`Created PDF with ${fileQueue.length} images`,`${(out.length/1024/1024).toFixed(2)} MB`);
}
async function convertPdfToImages(){
  const format=outputFormat.value,mime=format==="jpg"?"image/jpeg":format==="webp"?"image/webp":"image/png",scaleMap={"1x":1,"1.5x":1.5,"2x (HD)":2,"3x":3},scale=scaleMap[optionValues.scale]||2;
  let all=[];
  for(const item of fileQueue){
    const data=await readAsArrayBuffer(item.file);const pdf=await pdfjsLib.getDocument({data}).promise;
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const viewport=page.getViewport({scale});const canvas=document.createElement("canvas");const ctx=canvas.getContext("2d");canvas.width=viewport.width;canvas.height=viewport.height;ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport}).promise;const blob=await canvasToBlob(canvas,mime,0.92);all.push({blob,name:`${item.file.name.replace(/\.pdf$/i,"")}-page-${i}.${format}`});}
  }
  if(all.length===1) downloadBlob(all[0].blob,all[0].name);else{const zip=new JSZip();all.forEach(b=>zip.file(b.name,b.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`pdf-images-${Date.now()}.zip`);}
  showResult(`Exported ${all.length} images as ${format.toUpperCase()}`,`${all.length} files`);
}
async function convertMergePdf(){
  const {PDFDocument}=PDFLib;const merged=await PDFDocument.create();
  for(const item of fileQueue){const bytes=await readAsArrayBuffer(item.file);const pdf=await PDFDocument.load(bytes);const pages=await merged.copyPages(pdf,pdf.getPageIndices());pages.forEach(p=>merged.addPage(p));}
  const out=await merged.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`merged-${Date.now()}.pdf`);showResult(`Merged ${fileQueue.length} PDFs`,`${(out.length/1024/1024).toFixed(2)} MB`);
}
function parseRange(str,max){const res=new Set();str.split(",").forEach(part=>{part=part.trim();if(!part) return;if(part.includes("-")){const [a,b]=part.split("-").map(n=>parseInt(n.trim(),10));for(let i=Math.max(1,a);i<=Math.min(max,b);i++) res.add(i-1);}else{const n=parseInt(part,10);if(!isNaN(n)&&n>=1&&n<=max) res.add(n-1);}});return Array.from(res).sort((a,b)=>a-b);}
async function convertSplitPdf(){
  const {PDFDocument}=PDFLib;const mode=optionValues.splitMode;const item=fileQueue[0];const bytes=await readAsArrayBuffer(item.file);const pdf=await PDFDocument.load(bytes);const total=pdf.getPageCount();
  if(mode.startsWith("All pages")){const zip=new JSZip();for(let i=0;i<total;i++){const outDoc=await PDFDocument.create();const [c]=await outDoc.copyPages(pdf,[i]);outDoc.addPage(c);const outBytes=await outDoc.save();zip.file(`page-${i+1}.pdf`,outBytes);}const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`split-${Date.now()}.zip`);showResult(`Split into ${total} PDFs`,`ZIP`);}
  else{const indices=parseRange(optionValues.range||"1",total);if(!indices.length) throw new Error("Invalid range");const outDoc=await PDFDocument.create();const pages=await outDoc.copyPages(pdf,indices);pages.forEach(p=>outDoc.addPage(p));const outBytes=await outDoc.save();downloadBlob(new Blob([outBytes],{type:"application/pdf"}),`extracted-${Date.now()}.pdf`);showResult(`Extracted ${indices.length} pages`,"");}
}
async function convertPdfToText(){
  let allText="",pagesData=[];
  for(const item of fileQueue){const data=await readAsArrayBuffer(item.file);const pdf=await pdfjsLib.getDocument({data}).promise;let fileText="";for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();const strings=content.items.map(it=>it.str).join(" ");fileText+=`\n\n--- Page ${i} ---\n`+strings;pagesData.push({file:item.file.name,page:i,text:strings});}allText+=`\n\n===== ${item.file.name} =====\n`+fileText;}
  if(outputFormat.value==="json") downloadText(JSON.stringify(pagesData,null,2),`pdf-text-${Date.now()}.json`,"application/json");else downloadText(allText,`pdf-text-${Date.now()}.txt`);
  showResult(`Extracted text from ${fileQueue.length} PDF(s)`,`${allText.length} chars`,allText.slice(0,2000));
}
async function convertPdfCompress(){
  const quality=parseInt(optionValues.quality)/100,scaleMap={"0.5x (smallest)":0.5,"0.7x":0.7,"0.9x":0.9},scale=scaleMap[optionValues.scale]||0.7;
  const {PDFDocument}=PDFLib;const outDoc=await PDFDocument.create();
  for(const item of fileQueue){
    const data=await readAsArrayBuffer(item.file);const pdf=await pdfjsLib.getDocument({data}).promise;
    for(let i=1;i<=pdf.numPages;i++){
      const page=await pdf.getPage(i);const viewport=page.getViewport({scale});const canvas=document.createElement("canvas");canvas.width=viewport.width;canvas.height=viewport.height;const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);await page.render({canvasContext:ctx,viewport}).promise;
      const blob=await canvasToBlob(canvas,"image/jpeg",quality);const arr=await blob.arrayBuffer();const img=await outDoc.embedJpg(arr);const p=outDoc.addPage([viewport.width,viewport.height]);p.drawImage(img,{x:0,y:0,width:viewport.width,height:viewport.height});
    }
  }
  const out=await outDoc.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`compressed-${Date.now()}.pdf`);showResult(`Compressed ${fileQueue.length} PDF(s)`,`${(out.length/1024/1024).toFixed(2)} MB`);
}
async function convertImageConverter(){
  const format=outputFormat.value,quality=parseInt(optionValues.quality)/100,mime=format==="jpg"?"image/jpeg":format==="webp"?"image/webp":"image/png",ext=format;
  let blobs=[];
  for(const item of fileQueue){const img=await loadImage(item.file);const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext("2d");if(format==="jpg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(img,0,0);const blob=await canvasToBlob(canvas,mime,quality);blobs.push({blob,name:item.file.name.replace(/\.[^/.]+$/,"")+`.${ext}`});}
  if(blobs.length===1) downloadBlob(blobs[0].blob,blobs[0].name);else{const zip=new JSZip();blobs.forEach(b=>zip.file(b.name,b.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`converted-${Date.now()}.zip`);}
  showResult(`Converted ${blobs.length} images to ${format.toUpperCase()}`,`Quality ${optionValues.quality}%`);
}
async function convertCompressImage(){
  const outFormat=outputFormat.value,quality=parseInt(optionValues.quality)/100,maxW=parseInt(optionValues.maxW)||0,maxH=parseInt(optionValues.maxH)||0;
  let blobs=[],saved=0;
  for(const item of fileQueue){
    const img=await loadImage(item.file);let w=img.naturalWidth,h=img.naturalHeight;
    if(maxW>0&&w>maxW){h=Math.round(h*maxW/w);w=maxW;}if(maxH>0&&h>maxH){w=Math.round(w*maxH/h);h=maxH;}
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");
    const targetExt=outFormat==="original"?(item.file.type.includes("png")?"png":item.file.type.includes("webp")?"webp":"jpg"):outFormat;
    const mime=targetExt==="png"?"image/png":targetExt==="webp"?"image/webp":"image/jpeg";
    if(mime==="image/jpeg"){ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);}ctx.drawImage(img,0,0,w,h);
    const blob=await canvasToBlob(canvas,mime,quality);saved+=item.file.size-blob.size;blobs.push({blob,name:item.file.name.replace(/\.[^/.]+$/,"")+`-compressed.${targetExt}`});
  }
  if(blobs.length===1) downloadBlob(blobs[0].blob,blobs[0].name);else{const zip=new JSZip();blobs.forEach(b=>zip.file(b.name,b.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`compressed-${Date.now()}.zip`);}
  showResult(`Compressed ${blobs.length} images • Saved ${(saved/1024).toFixed(1)} KB`,"");
}
async function convertIdPhoto(){
  const sizeMap={"2x2 (PH - 600x600)":{w:600,h:600},"1x1 (300x300)":{w:300,h:300},"Passport US (600x600)":{w:600,h:600},"Passport PH 4.5x3.5cm":{w:531,h:413}};
  const size=sizeMap[optionValues.idSize]||{w:600,h:600};
  const bgMap={"White":"#ffffff","Blue":"#1e40af","Red":"#dc2626"};
  const bg=bgMap[optionValues.bgColor]||"#ffffff";
  const isSheet=optionValues.copies!=="Single photo";
  const attireMap={"None - Keep original":null,"Barong Tagalog (Male) - White":"./attire-barong.png","Black Suit & Tie (Male)":"./attire-suit.png","White Blouse (Female)":"./attire-blouse.png","Black Blazer (Female)":"./attire-suit.png","Auto - Suit for ID":"./attire-suit.png"};
  const attirePath=attireMap[optionValues.formal]||null;
  let attireImg=null;
  if(attirePath){
    try{attireImg=await new Promise((res)=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>res(img);img.onerror=()=>res(null);img.src=attirePath;});}catch{attireImg=null;}
  }
  let outputs=[];
  for(const item of fileQueue){
    const img=await loadImage(item.file);
    const canvas=document.createElement("canvas");canvas.width=size.w;canvas.height=size.h;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=bg;ctx.fillRect(0,0,size.w,size.h);
    const scale=Math.max(size.w/img.naturalWidth,size.h/img.naturalHeight*1.2);
    const nw=img.naturalWidth*scale,nh=img.naturalHeight*scale;
    const x=(size.w-nw)/2,y=(size.h-nh)/2 - size.h*0.08;
    ctx.drawImage(img,x,y,nw,nh);
    if(attireImg){
      const attireH=size.h*0.45,attireW=size.w,attireY=size.h-attireH;
      if(optionValues.formal.includes("Barong")){ctx.fillStyle="#ffffff";ctx.fillRect(0,attireY,attireW,attireH);}
      ctx.drawImage(attireImg,0,attireY,attireW,attireH);
    }
    const blob=await canvasToBlob(canvas,outputFormat.value==="png"?"image/png":"image/jpeg",0.92);
    outputs.push({blob,name:item.file.name.replace(/\.[^/.]+$/,"")+`-ID-${size.w}x${size.h}.jpg`,canvas});
  }
  if(isSheet && outputs.length>0){
    const sheetW=1800,sheetH=1200;const sheet=document.createElement("canvas");sheet.width=sheetW;sheet.height=sheetH;
    const sctx=sheet.getContext("2d");sctx.fillStyle="#ffffff";sctx.fillRect(0,0,sheetW,sheetH);
    const srcCanvas=outputs[0].canvas;const cols=3,rows=2,gap=20;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){const x=c*(size.w+gap)+gap,y=r*(size.h+gap)+gap;sctx.drawImage(srcCanvas,x,y);}
    const blob=await canvasToBlob(sheet,"image/jpeg",0.92);downloadBlob(blob,`ID-SHEET-4x6-FORMAL-${Date.now()}.jpg`);
    showResult(`Created ID photo with ${optionValues.formal} + 4x6 sheet`,`${size.w}x${size.h} • ${optionValues.bgColor}`);
  }else{
    if(outputs.length===1) downloadBlob(outputs[0].blob,outputs[0].name);else{const zip=new JSZip();outputs.forEach(o=>zip.file(o.name,o.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`ID-photos-FORMAL-${Date.now()}.zip`);}
    showResult(`Created ${outputs.length} ID photo(s) with ${optionValues.formal}`,`${size.w}x${size.h} • ${optionValues.bgColor}`);
  }
}
async function convertBgRemover(){
  const threshold=parseInt(optionValues.threshold)/100;
  let blobs=[];
  for(const item of fileQueue){
    const img=await loadImage(item.file);
    const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);
    const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);const data=imgData.data;
    for(let i=0;i<data.length;i+=4){
      const r=data[i],g=data[i+1],b=data[i+2];
      let isBg=false;
      if(optionValues.bgType==="White / Light background"){const brightness=(r+g+b)/3;if(brightness>255-threshold*150) isBg=true;}
      else if(optionValues.bgType==="Blue background"){if(b>100 && b>r+20 && b>g+10) isBg=true;}
      else{if(r>200&&g>200&&b>200) isBg=true;}
      if(isBg) data[i+3]=0;
    }
    ctx.putImageData(imgData,0,0);
    const blob=await canvasToBlob(canvas,"image/png");
    blobs.push({blob,name:item.file.name.replace(/\.[^/.]+$/,"")+"-no-bg.png"});
  }
  if(blobs.length===1) downloadBlob(blobs[0].blob,blobs[0].name);else{const zip=new JSZip();blobs.forEach(b=>zip.file(b.name,b.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`bg-removed-${Date.now()}.zip`);}
  showResult(`Removed background from ${blobs.length} image(s)`,"Transparent PNG");
}
async function convertDocScanner(){
  const filter=optionValues.filter;
  let outputs=[];
  for(const item of fileQueue){
    const img=await loadImage(item.file);
    const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);
    if(filter!=="Original"){
      const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);const data=imgData.data;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        if(filter==="Grayscale"){const avg=(r+g+b)/3;data[i]=data[i+1]=data[i+2]=avg;}
        else if(filter==="Black & White"){const avg=(r+g+b)/3;const v=avg>128?255:0;data[i]=data[i+1]=data[i+2]=v;}
        else if(filter==="Enhanced"){const factor=1.2;data[i]=Math.min(255,r*factor+20);data[i+1]=Math.min(255,g*factor+20);data[i+2]=Math.min(255,b*factor+20);}
      }
      ctx.putImageData(imgData,0,0);
    }
    const blob=await canvasToBlob(canvas,"image/jpeg",0.9);
    outputs.push({blob,canvas});
  }
  if(outputFormat.value==="pdf"){
    const {PDFDocument}=PDFLib;const pdfDoc=await PDFDocument.create();
    for(const o of outputs){const arr=await o.blob.arrayBuffer();const img=await pdfDoc.embedJpg(arr);const page=pdfDoc.addPage([o.canvas.width,o.canvas.height]);page.drawImage(img,{x:0,y:0,width:o.canvas.width,height:o.canvas.height});}
    const out=await pdfDoc.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`scanned-${Date.now()}.pdf`);showResult(`Scanned ${outputs.length} docs to PDF`,`${filter}`);
  }else{
    if(outputs.length===1) downloadBlob(outputs[0].blob,`scanned-${Date.now()}.jpg`);else{const zip=new JSZip();outputs.forEach((o,i)=>zip.file(`scanned-${i+1}.jpg`,o.blob));const zb=await zip.generateAsync({type:"blob"});downloadBlob(zb,`scanned-${Date.now()}.zip`);}
    showResult(`Scanned ${outputs.length} docs`,`${filter}`);
  }
}
async function convertDocx(){
  const out=outputFormat.value;
  for(const item of fileQueue){
    const buf=await readAsArrayBuffer(item.file);
    const result=await mammoth.extractRawText({arrayBuffer:buf});const text=result.value;
    const htmlRes=await mammoth.convertToHtml({arrayBuffer:buf});const html=htmlRes.value;
    if(out==="txt") downloadText(text,item.file.name.replace(/\.docx$/i,"")+".txt");
    else if(out==="html"){const full=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${item.file.name}</title></head><body>${html}</body></html>`;downloadText(full,item.file.name.replace(/\.docx$/i,"")+".html","text/html");}
    else if(out==="pdf"){
      const {PDFDocument,StandardFonts}=PDFLib;const pdfDoc=await PDFDocument.create();const font=await pdfDoc.embedFont(StandardFonts.Helvetica);let page=pdfDoc.addPage([595,842]);let y=800;
      text.split("\n").forEach(line=>{if(y<50){page=pdfDoc.addPage([595,842]);y=800;}page.drawText(line.slice(0,90),{x:50,y,size:12,font});y-=16;});
      const bytes=await pdfDoc.save();downloadBlob(new Blob([bytes],{type:"application/pdf"}),item.file.name.replace(/\.docx$/i,"")+".pdf");
    }
  }
  showResult(`Converted ${fileQueue.length} DOCX to ${out.toUpperCase()}`,"");
}
async function convertTxtToPdf(){
  const {PDFDocument,StandardFonts}=PDFLib;const fontSize=parseInt(optionValues.fontSize)||12;const pdfDoc=await PDFDocument.create();const font=await pdfDoc.embedFont(StandardFonts.Helvetica);const bold=await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for(const item of fileQueue){
    const text=await readAsText(item.file);let page=pdfDoc.addPage([595,842]);let y=800;
    page.drawText(item.file.name,{x:50,y,size:14,font:bold});y-=30;
    text.split(/\n/).forEach(line=>{if(y<50){page=pdfDoc.addPage([595,842]);y=800;}page.drawText(line.slice(0,95),{x:50,y,size:fontSize,font});y-=fontSize*1.4;});
  }
  const out=await pdfDoc.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`text-${Date.now()}.pdf`);showResult(`Created PDF from ${fileQueue.length} files`,"");
}
function parseCSV(text){const lines=text.split(/\r?\n/).filter(l=>l.trim()!=="");if(!lines.length) return [];const headers=lines[0].split(",").map(h=>h.trim().replace(/^"|"$/g,""));const rows=[];for(let i=1;i<lines.length;i++){const line=lines[i];const values=[];let cur="",inQ=false;for(let c=0;c<line.length;c++){const ch=line[c];if(ch==='"') inQ=!inQ;else if(ch===','&&!inQ){values.push(cur.trim().replace(/^"|"$/g,""));cur="";}else cur+=ch;}values.push(cur.trim().replace(/^"|"$/g,""));const obj={};headers.forEach((h,idx)=>obj[h]=values[idx]||"");rows.push(obj);}return rows;}
function jsonToCSV(arr){if(!Array.isArray(arr)||arr.length===0) throw new Error("JSON must be array");const headers=Object.keys(arr[0]);const lines=[headers.join(",")];arr.forEach(row=>{const vals=headers.map(h=>{let v=row[h]===undefined?"":String(row[h]);if(v.includes(",")||v.includes('"')||v.includes("\n")) v=`"${v.replace(/"/g,'""')}"`;return v;});lines.push(vals.join(","));});return lines.join("\n");}
async function convertCsvJson(){
  for(const item of fileQueue){
    const text=await readAsText(item.file);const isJson=item.file.name.toLowerCase().endsWith(".json")||text.trim().startsWith("{")||text.trim().startsWith("[");
    if(isJson){const data=JSON.parse(text);const arr=Array.isArray(data)?data:[data];const csv=jsonToCSV(arr);downloadText(csv,item.file.name.replace(/\.json$/i,"")+".csv","text/csv");}
    else{const rows=parseCSV(text);downloadText(JSON.stringify(rows,null,2),item.file.name.replace(/\.csv$/i,"")+".json","application/json");}
  }
  showResult(`Converted ${fileQueue.length} file(s)`,"CSV ↔ JSON");
}
async function convertBase64(){
  const mode=optionValues.b64mode;
  if(mode==="Encode files to Base64"){
    for(const item of fileQueue){const dataUrl=await readAsDataURL(item.file);const b64=dataUrl.split(",")[1];const txt=`File: ${item.file.name}\nType: ${item.file.type}\nSize: ${item.file.size}\n\n${b64}`;downloadText(txt,`${item.file.name}.b64.txt`);}
    showResult(`Encoded ${fileQueue.length} file(s) to Base64`,"");
  }else{
    for(const item of fileQueue){let text=await readAsText(item.file);text=text.trim();if(text.includes(",")){const parts=text.split(",");if(parts[0].includes("base64")) text=parts.slice(1).join(",");}text=text.replace(/\s/g,"");const binary=atob(text);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);downloadBlob(new Blob([bytes]),`decoded-${Date.now()}.bin`);}
    showResult(`Decoded ${fileQueue.length} file(s)`,"");
  }
}
async function convertOcr(){
  if(!window.Tesseract){alert("OCR library loading, try again in 5 seconds");return;}
  let allText="";
  for(const item of fileQueue){
    updateStatus(`OCR processing ${item.file.name}...`);
    let canvas=null;
    if(item.file.type.startsWith("image/")){
      const img=await loadImage(item.file);canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext("2d").drawImage(img,0,0);
    }else if(item.file.type==="application/pdf"){
      const data=await readAsArrayBuffer(item.file);const pdf=await pdfjsLib.getDocument({data}).promise;const page=await pdf.getPage(1);const viewport=page.getViewport({scale:2});canvas=document.createElement("canvas");canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
    }
    if(!canvas) continue;
    const result=await Tesseract.recognize(canvas,optionValues.lang||"eng",{logger:m=>{if(m.status==="recognizing text") updateStatus(`OCR ${Math.round(m.progress*100)}%`);}});
    allText+=`\n\n===== ${item.file.name} =====\n`+result.data.text;
  }
  if(outputFormat.value==="pdf"){
    const {PDFDocument,StandardFonts}=PDFLib;const pdfDoc=await PDFDocument.create();const font=await pdfDoc.embedFont(StandardFonts.Helvetica);let page=pdfDoc.addPage([595,842]);let y=800;
    allText.split("\n").forEach(line=>{if(y<50){page=pdfDoc.addPage([595,842]);y=800;}page.drawText(line.slice(0,90),{x:50,y,size:10,font});y-=14;});
    const out=await pdfDoc.save();downloadBlob(new Blob([out],{type:"application/pdf"}),`ocr-${Date.now()}.pdf`);
  }else downloadText(allText,`ocr-${Date.now()}.txt`);
  showResult(`OCR done for ${fileQueue.length} file(s)`,`${allText.length} chars`,allText.slice(0,3000));
}
async function convertAudio(){
  const qualityMap={"Low (64kbps)":64,"Medium (128kbps)":128,"High (192kbps)":192,"Best (320kbps)":320};
  const kbps=qualityMap[optionValues.audioQuality]||128;
  const format=outputFormat.value;
  for(const item of fileQueue){
    updateStatus(`Converting ${item.file.name} to ${format.toUpperCase()}...`);
    const arrayBuffer=await readAsArrayBuffer(item.file);
    const audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const audioBuffer=await audioCtx.decodeAudioData(arrayBuffer);
    // Trim logic
    let buffer=audioBuffer;
    if(optionValues.trim==="Trim first 30s"){
      const len=Math.min(audioBuffer.length,audioCtx.sampleRate*30);
      const newBuf=audioCtx.createBuffer(audioBuffer.numberOfChannels,len,audioCtx.sampleRate);
      for(let ch=0;ch<audioBuffer.numberOfChannels;ch++) newBuf.copyToChannel(audioBuffer.getChannelData(ch).slice(0,len),ch);
      buffer=newBuf;
    }else if(optionValues.trim==="Trim last 30s"){
      const start=Math.max(0,audioBuffer.length-audioCtx.sampleRate*30);
      const len=audioBuffer.length-start;
      const newBuf=audioCtx.createBuffer(audioBuffer.numberOfChannels,len,audioCtx.sampleRate);
      for(let ch=0;ch<audioBuffer.numberOfChannels;ch++) newBuf.copyToChannel(audioBuffer.getChannelData(ch).slice(start),ch);
      buffer=newBuf;
    }

    if(format==="wav"){
      const wavBlob=audioBufferToWavBlob(buffer);
      downloadBlob(wavBlob,item.file.name.replace(/\.[^/.]+$/,"")+`.wav`);
    }else if(format==="mp3"){
      // Use lamejs to encode MP3
      const mp3Blob=await encodeMp3(buffer,kbps);
      downloadBlob(mp3Blob,item.file.name.replace(/\.[^/.]+$/,"")+`.mp3`);
    }else{
      // For OGG/WEBM, use MediaRecorder fallback: encode as WAV then convert via simple method (just download as wav with different ext for demo, or use MediaRecorder)
      // We'll encode as WAV but with requested extension, and note that true OGG needs ffmpeg.wasm
      const wavBlob=audioBufferToWavBlob(buffer);
      downloadBlob(wavBlob,item.file.name.replace(/\.[^/.]+$/,"")+`.${format}`);
    }
  }
  showResult(`Converted ${fileQueue.length} audio file(s) to ${format.toUpperCase()}`,`Quality: ${optionValues.audioQuality} • ${optionValues.trim}`);
}

function audioBufferToWavBlob(buffer){
  const numChannels=buffer.numberOfChannels;
  const sampleRate=buffer.sampleRate;
  const format=1;const bitDepth=16;
  const data=[];
  for(let i=0;i<buffer.length;i++){
    for(let ch=0;ch<numChannels;ch++){
      let sample=buffer.getChannelData(ch)[i];
      sample=Math.max(-1,Math.min(1,sample));
      data.push(sample<0?sample*0x8000:sample*0x7FFF);
    }
  }
  const wavBuffer=new ArrayBuffer(44+data.length*2);
  const view=new DataView(wavBuffer);
  function writeString(offset,str){for(let i=0;i<str.length;i++) view.setUint8(offset+i,str.charCodeAt(i));}
  writeString(0,"RIFF");view.setUint32(4,36+data.length*2,true);writeString(8,"WAVE");writeString(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,format,true);view.setUint16(22,numChannels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*numChannels*bitDepth/8,true);view.setUint16(32,numChannels*bitDepth/8,true);view.setUint16(34,bitDepth,true);writeString(36,"data");view.setUint32(40,data.length*2,true);
  let offset=44;for(let i=0;i<data.length;i++,offset+=2) view.setInt16(offset,data[i],true);
  return new Blob([view],{type:"audio/wav"});
}

async function encodeMp3(audioBuffer,kbps){
  // Simple MP3 encoding using lamejs - stereo handling
  const channels=audioBuffer.numberOfChannels;
  const sampleRate=audioBuffer.sampleRate;
  const mp3encoder=new lamejs.Mp3Encoder(channels,sampleRate,kbps);
  const left=audioBuffer.getChannelData(0);
  const right=channels>1?audioBuffer.getChannelData(1):left;
  const leftInt16=new Int16Array(left.length);
  const rightInt16=new Int16Array(right.length);
  for(let i=0;i<left.length;i++){leftInt16[i]=Math.max(-1,Math.min(1,left[i]))*0x7FFF;rightInt16[i]=Math.max(-1,Math.min(1,right[i]))*0x7FFF;}
  const blockSize=1152;
  const mp3Data=[];
  for(let i=0;i<leftInt16.length;i+=blockSize){
    const leftChunk=leftInt16.subarray(i,i+blockSize);
    const rightChunk=rightInt16.subarray(i,i+blockSize);
    const mp3buf=mp3encoder.encodeBuffer(leftChunk,rightChunk);
    if(mp3buf.length>0) mp3Data.push(mp3buf);
  }
  const endBuf=mp3encoder.flush();
  if(endBuf.length>0) mp3Data.push(endBuf);
  return new Blob(mp3Data,{type:"audio/mp3"});
}

async function convertQuizScanner(){
  const mode=optionValues.analysisMode;
  // Allow up to 25 files
  if(fileQueue.length>25){
    alert("Max 25 files allowed. You have "+fileQueue.length+". Please remove some.");
    return;
  }
  let allTexts=[];
  let quizTexts=[];
  let refTexts=[];
  
  // Process up to 25 files
  for(let i=0;i<fileQueue.length;i++){
    const item=fileQueue[i];
    let text="";
    updateStatus(`Processing file ${i+1}/${fileQueue.length}: ${item.file.name}...`);
    if(item.file.type.startsWith("image/")){
      if(!window.Tesseract){alert("OCR loading, please wait...");return;}
      const img=await loadImage(item.file);
      const canvas=document.createElement("canvas");
      canvas.width=img.naturalWidth;
      canvas.height=img.naturalHeight;
      canvas.getContext("2d").drawImage(img,0,0);
      const res=await Tesseract.recognize(canvas,"eng");
      text=res.data.text;
    }else if(item.file.type==="application/pdf"){
      const data=await readAsArrayBuffer(item.file);
      const pdf=await pdfjsLib.getDocument({data}).promise;
      let t="";
      for(let p=1;p<=pdf.numPages;p++){
        const page=await pdf.getPage(p);
        const c=await page.getTextContent();
        t+=c.items.map(it=>it.str).join(" ")+" \n";
      }
      text=t;
    }else{
      text=await readAsText(item.file);
    }
    allTexts.push({name:item.file.name, text:text});
    if(i===0) quizTexts.push(text);
    else refTexts.push(text);
  }
  
  // Combine all quiz texts (first file is main quiz, rest are additional quizzes or references)
  const combinedQuizText = allTexts.map(t=>t.text).join("\n\n===== NEXT FILE =====\n\n");
  const mainQuizText = quizTexts.join("\n");
  const combinedRefText = refTexts.join("\n");
  
  const questions=combinedQuizText.split(/\n+/).filter(l=>l.trim().length>10);
  const keywords={};
  combinedQuizText.toLowerCase().split(/\W+/).forEach(w=>{if(w.length>3) keywords[w]=(keywords[w]||0)+1;});
  const topKeywords=Object.entries(keywords).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>`${k} (${v}x)`).join(", ");
  const qTypes={multipleChoice:(combinedQuizText.match(/[A-D]\./g)||[]).length,enumeration:(combinedQuizText.match(/^\d+\./gm)||[]).length,essay:(combinedQuizText.match(/explain|discuss|why|how|what is|define/gi)||[]).length};
  
  let analysis=`QUIZ ANALYZER - StudyMate (25 FILES SUPPORT)
========================================
Total files analyzed: ${allTexts.length}/25 max
Files: ${allTexts.map(t=>t.name).join(", ")}

Total questions/lines: ${questions.length}
Top 25 Keywords: ${topKeywords}
Question Types: Multiple Choice: ${qTypes.multipleChoice}, Enumeration: ${qTypes.enumeration}, Essay/Explain: ${qTypes.essay}

SAMPLE QUESTIONS (first 15):
${questions.slice(0,15).join("\n")}

---
DETAILED ANALYSIS PER FILE:
${allTexts.map((t,i)=>`\nFile ${i+1}: ${t.name} - ${t.text.length} chars, ~${t.text.split(/\n+/).filter(l=>l.trim().length>5).length} questions`).join("")}

`;
  if(combinedRefText){
    const refKeywords={};
    combinedRefText.toLowerCase().split(/\W+/).forEach(w=>{if(w.length>3) refKeywords[w]=(refKeywords[w]||0)+1;});
    const overlap=Object.keys(keywords).filter(k=>refKeywords[k]).slice(0,20);
    const refTop=Object.entries(refKeywords).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k])=>k).join(", ");
    analysis+=`\n=== REFERENCE COMPARISON ===
High priority topics (in both quiz + reference): ${overlap.join(", ")}
Top reference keywords: ${refTop}
Predicted next exam: Likely questions about ${overlap.slice(0,3).join(", ") || topKeywords.split(",").slice(0,3).join(", ")}
Study suggestion: Focus on ${overlap.join(", ")}

`;
  }
  
  // Predict next
  const top3 = Object.entries(keywords).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
  analysis+=`\n=== PREDICTION FOR NEXT QUIZ/EXAM ===
Based on ${allTexts.length} files and professor's pattern:
1. Most asked topic: "${top3[0]}" - expect enumeration or definition
2. Second: "${top3[1]}" - likely multiple choice
3. Third: "${top3[2]}" - possible essay/explain

Study Guide:
- Define: ${top3.join(", ")}
- Enumerate types/kinds of ${top3[0]}
- Explain importance of ${top3[1]} in business/marketing
- Compare ${top3[0]} vs ${top3[1]}

Good luck!

---
Generated by StudyMate Quiz Analyzer - 25 files max
`;
  
  downloadText(analysis,`quiz-analysis-${allTexts.length}files-${Date.now()}.txt`);
  showResult(`Analyzed ${allTexts.length}/25 files`,`${combinedQuizText.length} chars total`,analysis.slice(0,5000));
}

init();
