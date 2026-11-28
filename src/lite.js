/* ---- Lite view: just what's next, by what you're doing (ported from the personal app). ---- */
const QM_DONE = {b:"meal:b", l:"meal:l", d:"meal:d", s:"snack"};
/* Meals you save from Lite, so you can pick them again. */
function myMeals(){ return S.myMeals = S.myMeals||[]; }
function addMyMeal(slot, name){
  name = String(name||"").trim(); if(!name) return "";
  const ex = myMeals().find(m=>m.t===slot && m.n.toLowerCase()===name.toLowerCase()); if(ex) return ex.id;
  const id = "my_"+Date.now().toString(36); myMeals().push({id, t:slot, n:name}); return id;
}
function liteRecipe(id){ const mm = (S.myMeals||[]).find(r=>r.id===id); return mm ? {n:mm.n} : recipe(id); }
/* A tick on Today or Quick updates Lite too: meals start their countdowns, Kitchen closes shows as closed, and unticking a supplement puts it back. */
function syncFromTick(key, id, on){
  const lg = dayLog(key), ev = lg.ev = lg.ev||{}, now = fromMins(new Date().getHours()*60+new Date().getMinutes());
  const slot = id==="snack" ? "s" : /^meal:[bld]$/.test(id) ? id.slice(5) : "";
  if(slot){ if(on){ if(!ev[slot]) ev[slot] = now; } else if(!(lg.ate||[]).some(a=>a.m===slot)) delete ev[slot]; }
  if(id==="fastclose"){ if(on){ if(!ev.closed) ev.closed = now; } else delete ev.closed; }
  if(id.startsWith("supp:") && !on && lg.lite){ const sid = id.split(":")[1], ks = Object.keys(lg.lite).filter(x=>x.split("@")[0]===sid);
    const order = x=>{ const a = x.split("@")[1]; const i = LITE_ANCHORS.findIndex(v=>v[0]===a); return i<0?99:i; };
    ks.sort((a,b)=>order(a)-order(b)); if(ks.length) delete lg.lite[ks[ks.length-1]]; }
}
/* An alert while the app is open: a banner, a chime, a buzz where allowed, and a notification if you allowed them. */
let AUDIO = null;
document.addEventListener("pointerdown", ()=>{ try{ if(!AUDIO){ const C = window.AudioContext||window.webkitAudioContext; if(C) AUDIO = new C(); } if(AUDIO && AUDIO.state==="suspended") AUDIO.resume(); }catch(_){} }, true);
function chime(){
  if(S.alertSound===false || !AUDIO) return;
  try{ const t0 = AUDIO.currentTime; [[880,0],[1175,0.18],[880,0.36]].forEach(([f,d])=>{ const o = AUDIO.createOscillator(), g = AUDIO.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0+d); g.gain.exponentialRampToValueAtTime(0.35, t0+d+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0+d+0.16); o.connect(g); g.connect(AUDIO.destination); o.start(t0+d); o.stop(t0+d+0.18); }); }catch(_){}
}
function alertNow(title, body){
  if(S.alertsOn===false) return;
  let bar = document.getElementById("dueBanner");
  if(!bar){ bar = document.createElement("div"); bar.id = "dueBanner"; bar.setAttribute("role","alert");
    bar.style.cssText = "position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9999;background:var(--juniper,#2f6b57);color:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;justify-content:space-between;font-weight:600";
    document.body.appendChild(bar); }
  const prev = bar.dataset.lines ? JSON.parse(bar.dataset.lines) : [];
  prev.push(title + (body ? " · " + body : "")); bar.dataset.lines = JSON.stringify(prev.slice(-4));
  bar.innerHTML = `<div>${prev.slice(-4).map(x=>`<div>${esc(x)}</div>`).join("")}</div><button type="button" style="background:#fff;color:#1d3b31;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700">OK</button>`;
  bar.querySelector("button").onclick = ()=>bar.remove();
  chime(); try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(_){}
  if("Notification" in window && Notification.permission==="granted"){
    const opts = {body: body||"", tag: "dh-"+title};
    if(navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r=>{ if(r && r.showNotification) r.showNotification(title, opts); else { try{ new Notification(title, opts); }catch(_){} } }).catch(()=>{});
    else { try{ new Notification(title, opts); }catch(_){} }
  }
}
/* Quick tab: what you've eaten today, and a button to log more. */
function quickMealHtml(key){ return `${ateListHtml(key)}<div><button class="btn" data-liteeat="1">Log what I ate</button></div>`; }
const LITE_ANCHORS = [["wake","On waking"],["b","Breakfast"],["l","Lunch"],["s","Snack"],["d","Dinner"],["bed","Bedtime"]];
const LITE_MEALS = [["b","Breakfast"],["l","Lunch"],["s","Snack"],["d","Dinner"]];
const LITE_AFTER = [[-1,"1 h before"],[-0.5,"30 min before"],[0,"with it"],[0.5,"30 min after"],[1,"1 h after"],[2,"2 h after"],[3,"3 h after"]];
/* "Before" can't wait for you to tap Eating now, so it counts down from the planned time of that meal (or bedtime) on the full app's schedule. */
function litePlanned(a, d){ const t = a==="bed" ? parseTime((S.rhythm||{}).bed||"") : parseTime((S.times||{})[{b:"breakfast", l:"lunch", s:"snack", d:"dinner"}[a]]||""); return t ? mins(t) : null; }
const PANTRY_NAMES = Object.fromEntries((/*LITEPANTRY*/[]).map(x=>[x[0], x[1]]));
let LITE_SET_OPEN = false;
let LITE = {eat:null, pick:{}, other:"", meal:"", edit:-1, time:"", day:""};
const liteReset = ()=>{ LITE = {eat:null, pick:{}, other:"", meal:"", edit:-1, time:"", day:""}; };
const liteName = a=>(LITE_ANCHORS.find(x=>x[0]===a)||[a,a])[1];
function liteItemName(id, plist){
  if(id.startsWith("n:")) return id.slice(2);
  if(id.startsWith("meal:")){ const r = liteRecipe(id.slice(5)); return r ? r.n : id.slice(5); }
  return ((plist||pantryList()).find(p=>p.id===id)||{n:id}).n;
}
function liteMealOpts(slot){
  const opts = [...(S.myMeals||[]).filter(m=>m.t===slot).map(m=>[m.id, m.n+" (yours)"]), ...recipeOptions(slot)], seen = new Set(opts.map(o=>o[0]));
  const mine = opts.filter(o=>(S.myMeals||[]).some(m=>m.id===o[0])), rest = opts.filter(o=>!mine.includes(o));
  const other = (S.myMeals||[]).filter(m=>!seen.has(m.id) && (m.items||[]).length).map(m=>[m.id, m.n+" (yours, "+((LITE_MEALS.find(x=>x[0]===m.t)||[0,"other"])[1]).toLowerCase()+")"]);
  return [...mine, ...rest, ...other];
}
function ateListHtml(key, panel){
  const lg = S.log[key]||{}, ate = lg.ate||[];
  if(!ate.length) return "";
  const rows = ate.map((a,i)=>`<div class="lrow"><div><b>${esc((LITE_MEALS.find(m=>m[0]===a.m)||[0,"Meal"])[1])}</b> <small class="muted">${niceTime(a.t)}</small><br><small>${esc(a.items.map(x=>x.n+qLabel(x.q)).join(", ")||"(nothing listed)")}</small></div><span class="chips" style="gap:10px"><button class="linkbtn" data-liteedit="${i}" data-day="${key}">Edit</button><button class="linkbtn" data-liteatedel="${i}" data-day="${key}">Remove</button></span></div>`).join("");
  const lbl = key===ymd(new Date()) ? "Eaten today" : "Eaten that day";
  return panel ? `<section class="panel"><h2>${lbl}</h2>${rows}</section>` : `<div class="stack" style="gap:4px"><b>${lbl}</b>${rows}</div>`;
}
const liteSavedMeal = ()=> LITE.meal ? (S.myMeals||[]).find(m=>m.id===LITE.meal && (m.items||[]).length) : null;
const liteItems = ()=>{ const plist = pantryList(); return Object.entries(LITE.pick).map(([id,q])=>({id: id.startsWith("n:")?"":id, n:liteItemName(id, plist), q})); };
const LITE_STEPS = [0.25,0.5,0.75,1,1.5,2,2.5,3,4,5,6,8,10];
function fmtQ(q){ q = Number(q)||0; const w = Math.floor(q), f = Math.round((q-w)*4); const fr = ["","¼","½","¾"][f]||""; return (w?String(w):"")+fr || "0"; }
const qLabel = q=> Number(q)===1 ? "" : " × "+fmtQ(q);
function liteStep(q, dir){ q = Number(q)||0; if(dir>0) return LITE_STEPS.find(v=>v>q+1e-9) || q+1; const lower = LITE_STEPS.filter(v=>v<q-1e-9); return lower.length ? lower[lower.length-1] : 0; }
function liteNowM(){ const n = new Date(); return n.getHours()*60+n.getMinutes(); }
function pantryList(){
  let p = null; try{ p = JSON.parse(localStorage.getItem("pantryplanner.v1")||"null"); }catch(_){}
  const have = (p&&p.pantry)||{}, out = [];
  for(const [id,n] of Object.entries(PANTRY_NAMES)) out.push({id, n, have:!!have[id]});
  for(const c of ((p&&p.custom)||[])) out.push({id:c.id, n:c.n, have:!!have[c.id]});
  for(const f of (S.myFoods||[])) if(!out.some(o=>o.n.toLowerCase()===f.n.toLowerCase())) out.push({id:f.id, n:f.n, have:true, mine:true});
  return out.sort((a,b)=>(b.have-a.have) || a.n.localeCompare(b.n));
}
/* Today's supplements by moment. due = minutes after midnight once its moment has happened. */
function liteSupps(key){
  const d = parseYmd(key), lg = S.log[key]||{}, ev = lg.ev||{}, done = lg.lite||{}, fdone = lg.done||{}, out = [];
  const {timed, untimed} = itemsFor(d), full = [...timed, ...untimed];
  for(const s of S.supplements){
    if(!s.active || s.asNeeded || !dueOn(s,d)) continue;
    const ws = s.whens||[], h = Number(s.afterH)||0, mine = [];
    if(!ws.length) mine.push({s, a:"", k:s.id+"@any", due:null, h:0, done:!!done[s.id+"@any"]});
    for(const a of ws){ const at = ev[a]; let due, hh = h;
      if(h<0 && a!=="wake"){ const pl = litePlanned(a, d); due = pl!=null ? pl+Math.round(h*60) : null; if(at) due = due==null ? mins(at) : Math.min(due, mins(at)); }
      else { if(h<0) hh = 0; due = at ? mins(at)+Math.round(hh*60) : null; }
      mine.push({s, a, k:s.id+"@"+a, due, h:hh, done:!!done[s.id+"@"+a]}); }
    /* Ticks on the full checklist count too: each one covers one more of today's doses, earliest first. */
    const fi = full.filter(i=>i.id==="supp:"+s.id || i.id.startsWith("supp:"+s.id+":")), fd = fi.filter(i=>fdone[i.id]).length;
    let extra = (fi.length && fd===fi.length) ? mine.length : fd - mine.filter(x=>x.done).length;
    for(const x of mine) if(extra>0 && !x.done){ x.done = true; x.viaFull = true; extra--; }
    out.push(...mine);
  }
  return out;
}
function liteWhy(x){ return x.a ? (x.h ? (LITE_AFTER.find(v=>v[0]===x.h)||[0,Math.abs(x.h)+(x.h<0?" h before":" h after")])[1]+" "+liteName(x.a).toLowerCase()+(x.h<0&&x.due!=null?" (around "+niceTime(fromMins(x.due))+")":"") : (x.a==="wake"||x.a==="bed" ? liteName(x.a).toLowerCase() : "with "+liteName(x.a).toLowerCase())) : "any time today"; }
function liteIn(m){ const n = Math.max(0, m - liteNowM()), h = Math.floor(n/60); return "in "+(h?h+" h ":"")+(n%60)+" min"; }
/* Also tick it off on the full checklist, so both views agree. */
function liteMarkFull(key, sid){
  const lg = dayLog(key), {timed, untimed} = itemsFor(parseYmd(key));
  const it = [...timed, ...untimed].find(i=>(i.id==="supp:"+sid || i.id.startsWith("supp:"+sid+":")) && !lg.done[i.id]);
  if(it) lg.done[it.id] = true;
}
function liteKitchen(key, on){
  const lg = dayLog(key), {timed, untimed} = itemsFor(parseYmd(key));
  for(const i of [...timed, ...untimed]) if(i.id==="fastclose" || i.id.startsWith("rt:fast")){ if(on) lg.done[i.id] = true; else delete lg.done[i.id]; }
}
function liteRow(x, key, btn){
  return `<div class="lrow"><div><b>${esc(x.s.name)}</b>${suppDose(x.s,new Date())?` <small class="muted">${esc(suppDose(x.s,new Date()))}</small>`:""}<br><small class="muted">${esc(liteWhy(x))}${x.due!=null&&x.due>liteNowM()?" · "+liteIn(x.due):""}</small></div>${btn?`<button class="btn" data-litedone="${esc(x.k)}" data-sid="${esc(x.s.id)}" data-day="${key}">Done</button>`:""}</div>`;
}
function renderLite(){
  const key = ymd(new Date()), lg = S.log[key]||{done:{}}, ev = lg.ev||{}, now = liteNowM();
  const all = liteSupps(key), open = all.filter(x=>!x.done);
  const dueNow = open.filter(x=>x.due!=null && x.due<=now), soon = open.filter(x=>x.due!=null && x.due>now).sort((a,b)=>a.due-b.due), unset = open.filter(x=>!x.a);
  const oz = waterOz(lg), goal = Number(waterGoalNow())||64;
  if(LITE.eat){
    const plist = pantryList(), picked = LITE.pick;
    view.innerHTML = `<div class="stack lite">
      <section class="panel"><h2>${LITE.edit>=0?"Change what you ate":LITE.day?"What you ate":"Eating now"}</h2>${LITE.day?`<small class="muted">For ${esc(DAYS_LONG[parseYmd(LITE.day).getDay()])}, ${esc(parseYmd(LITE.day).toLocaleDateString(undefined,{month:"long",day:"numeric"}))}</small>`:""}
        <div class="chips" style="gap:8px">${LITE_MEALS.map(([m,n])=>`<button class="btn ${LITE.eat===m?"":"ghost"}" data-liteslot="${m}">${n}</button>`).join("")}</div>
        <label style="display:flex;gap:8px;align-items:center">What time<input type="time" id="lite-time" value="${esc(LITE.time||fromMins(liteNowM()))}" style="width:auto"></label>
        ${Object.keys(picked).length?`<div class="stack" style="gap:6px">${Object.entries(picked).map(([id,q])=>`<div class="lrow"><b>${esc(liteItemName(id, plist))}</b><span class="chips" style="gap:6px;align-items:center;flex-wrap:nowrap;flex-shrink:0"><button class="btn ghost" data-liteminus="${esc(id)}" aria-label="Less">−</button><select data-liteq="${esc(id)}" aria-label="How much" style="width:auto;min-width:64px">${[...new Set([...LITE_STEPS, Number(q)])].sort((a,b)=>a-b).map(v=>`<option value="${v}" ${v===Number(q)?"selected":""}>${fmtQ(v)}</option>`).join("")}</select><button class="btn ghost" data-liteplus="${esc(id)}" aria-label="More">+</button></span></div>`).join("")}</div>`:`<small class="muted">Pick one of your meals, or tap foods from your pantry. Change the amount with − and +, or pick ¼, ½ and so on.</small>`}
        <label for="lite-other">Something not on the list</label>
        <div style="display:flex;gap:8px"><input type="text" id="lite-other" style="flex:1" value="${esc(LITE.other)}" placeholder="e.g. leftover stew" enterkeyhint="done"><button class="btn" data-liteadd="1">Add</button></div>
        <small class="muted">Added foods stay on your list for next time.</small>
        ${liteSavedMeal()?`<div class="stack" style="gap:6px;border-top:1px solid var(--line,#ddd);padding-top:8px"><small class="muted">This is your saved meal "${esc(liteSavedMeal().n)}". Change foods or amounts above, then:</small><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="lite-upd"> Also update my saved meal</label><div class="chips" style="gap:12px"><button class="linkbtn" data-litemealupd="1">Update the saved meal only (don't log)</button><button class="linkbtn" data-litemealdel="1">Remove it from my meals</button></div></div>`:""}
        ${Object.keys(picked).length && !liteSavedMeal()?`<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="lite-keep"> Save this as a meal I can pick next time</label><input type="text" id="lite-keepname" placeholder="Name it (optional)" aria-label="Meal name">`:""}
        <div class="chips" style="gap:8px"><button class="btn" data-litesave="1">Save</button><button class="btn ghost" data-litecancel="1">Cancel</button></div>
      </section>
      ${(()=>{ const mo = liteMealOpts(LITE.eat); return `<section class="panel"><h2>Your meals</h2>${mo.length?`<div class="stack" style="gap:4px">${mo.map(([id,n])=>`<button class="lpick ${LITE.meal===id?"on":""}" data-litemeal="${esc(id)}">${esc(n)}</button>`).join("")}</div>`:`<small class="muted">None yet for this meal. Pick foods below and tick "Save this as a meal".</small>`}</section>`; })()}
      <section class="panel"><h2>From your pantry</h2>
        <input type="search" id="lite-q" style="width:100%;padding:10px;font-size:16px;border-radius:10px;border:1px solid var(--line,#ccc)" placeholder="Find a food…" aria-label="Find a food">
        <div class="stack" style="gap:4px" id="lite-plist">${plist.map(p=>`<button class="lpick ${picked[p.id]?"on":""}" data-litepick="${esc(p.id)}" data-n="${esc(p.n.toLowerCase())}">${esc(p.n)}${p.mine?` <small class="muted">yours</small>`:p.have?"":` <small class="muted">not in pantry</small>`}${picked[p.id]?` <b>× ${esc(fmtQ(picked[p.id]))}</b>`:""}</button>`).join("")}</div>
      </section></div>`;
    return;
  }
  const evLine = [...LITE_ANCHORS, ["closed","Kitchen closed"]].filter(([a])=>ev[a]).map(([a,n])=>`<span class="chip">${esc(n)} ${niceTime(ev[a])} <button class="linkbtn" data-liteunev="${a}" aria-label="Clear ${esc(n)}">×</button></span>`).join(" ");
  view.innerHTML = `<div class="stack lite">
    <section class="panel"><div class="lbig">
      ${ev.wake?"":`<button class="btn" data-liteev="wake">I'm up</button>`}
      <button class="btn" data-liteeat="1">Eating now</button>
      ${ev.closed?"":`<button class="btn ghost" data-liteclosed="1">Done eating for today</button>`}
      ${ev.bed?"":`<button class="btn ghost" data-liteev="bed">Going to bed</button>`}
    </div>${evLine?`<div class="chips" style="gap:6px;margin-top:8px">${evLine}</div>`:""}</section>
    <section class="panel"><h2>${dueNow.length?"Take now":"Nothing due right now"}</h2>
      ${dueNow.map(x=>liteRow(x,key,true)).join("")}
      ${soon.length?`<h3 style="margin:8px 0 0">Coming up</h3>${soon.map(x=>liteRow(x,key,false)).join("")}`:""}
      ${!dueNow.length&&!soon.length?`<small class="muted">Tap I'm up or Eating now, and what goes with it shows here.</small>`:""}
    </section>
    <section class="panel"><div class="lrow"><div><b>Water</b><br><small class="muted">${esc(Math.round(oz))} of ${esc(goal)} oz</small></div><button class="btn" data-wadd="8">+8 oz</button></div></section>
    ${prnHtml(key, lg)}
    ${ateListHtml(key, true)}
    ${unset.length?`<details class="panel"><summary><b>Any time today (${unset.length})</b></summary>${unset.map(x=>liteRow(x,key,true)).join("")}</details>`:""}
    <details class="panel" ${LITE_SET_OPEN?"open":""}><summary><b>Set when you take each one</b></summary>
      <small class="muted">Pick the moments for each supplement. "After" waits that long after you tap the moment, for things like psyllium. "Before" a meal or bedtime counts down from the time planned for it in the full app, and moves up if you eat early.</small>
      ${S.supplements.filter(s=>s.active&&!s.asNeeded).map(s=>`<div class="stack" style="gap:4px;border-top:1px solid var(--line,#ddd);padding-top:8px"><b>${esc(s.name)}</b>
        <div class="chips" style="gap:4px 12px">${LITE_ANCHORS.map(([a,n])=>`<label class="inline" style="font-weight:400"><input type="checkbox" data-litewhen="${esc(s.id)}:${a}" ${(s.whens||[]).includes(a)?"checked":""}> ${n}</label>`).join("")}</div>
        <label class="inline" style="font-weight:400">Take it <select data-liteafter="${esc(s.id)}">${LITE_AFTER.map(([v,n])=>`<option value="${v}" ${(Number(s.afterH)||0)===v?"selected":""}>${n}</option>`).join("")}</select></label></div>`).join("")}
      <div class="stack" style="gap:6px;border-top:1px solid var(--line,#ddd);padding-top:8px"><b>Add a supplement or powder</b>
        <small class="muted">For something you take every day, like a fiber powder with lunch. Add it here, then tick when you take it.</small>
        <label>Name<input type="text" id="lite-sname" placeholder="e.g. Fiber powder"></label>
        <label>How much<input type="text" id="lite-sdose" placeholder="e.g. 1 scoop in water"></label>
        <div><button class="btn" data-liteaddsupp="1">Add it</button></div></div>
    </details>
    <details class="panel"><summary><b>Alerts while the app is open</b></summary>
      <label class="inline" style="font-weight:400"><input type="checkbox" data-alert="alertsOn" ${S.alertsOn===false?"":"checked"}> Show a banner when something comes due</label>
      <label class="inline" style="font-weight:400"><input type="checkbox" data-alert="alertSound" ${S.alertSound===false?"":"checked"}> Play a chime</label>
      <div class="chips" style="gap:8px"><button class="btn ghost" id="notifyBtn">Allow notifications</button><button class="btn ghost" data-alerttest="1">Test it</button></div>
      <small class="muted">This only works while the app is open on screen. iPhone doesn't let web apps buzz, and the chime follows your ringer switch. If you allow notifications, iPhone also shows one at the top.</small>
    </details>
    ${typeof openOnHtml==="function"?`<div>${openOnHtml("lite")}</div>`:""}
    <div class="chips" style="gap:8px;justify-content:center"><a class="btn ghost" href="pantry.html">Pantry</a></div>
  </div>`;
}
function liteAddFood(){
  const el = document.getElementById("lite-other"), n = ((el||{}).value||"").trim(); if(!n) return false;
  const ex = pantryList().find(o=>o.n.toLowerCase()===n.toLowerCase());
  let id = ex ? ex.id : "";
  if(!id){ id = "f_"+Date.now().toString(36); (S.myFoods = S.myFoods||[]).push({id, n}); save(); }
  LITE.pick[id] = (LITE.pick[id]||0)+1; LITE.other = ""; el.value = ""; return true;
}
function liteClick(t){
  const key = LITE.day || (t.dataset && t.dataset.day) || ymd(new Date());
  if(t.dataset.liteev){ const lg = dayLog(key); (lg.ev=lg.ev||{})[t.dataset.liteev] = fromMins(liteNowM()); save(); render(); toast(t.dataset.liteev==="wake"?"Good morning":"Good night"); return true; }
  if(t.dataset.liteclosed){ const lg = dayLog(key); (lg.ev=lg.ev||{}).closed = fromMins(liteNowM()); liteKitchen(key, true); save(); render(); toast("Kitchen closed. Ticked in the full app too."); return true; }
  if(t.dataset.liteunev){ const lg = dayLog(key); if(lg.ev) delete lg.ev[t.dataset.liteunev]; if(t.dataset.liteunev==="closed") liteKitchen(key, false); if(QM_DONE[t.dataset.liteunev] && !(lg.ate||[]).some(a=>a.m===t.dataset.liteunev)) delete lg.done[QM_DONE[t.dataset.liteunev]]; save(); render(); return true; }
  if(t.dataset.liteeat){ const ev = (S.log[key]||{}).ev||{}; LITE = {eat:(LITE_MEALS.find(([m])=>!ev[m])||["s"])[0], pick:{}, other:"", meal:"", edit:-1, time:"", day:(key===ymd(new Date())?"":key)}; render(); window.scrollTo(0,0); return true; }
  if(t.dataset.liteslot){ LITE.eat = t.dataset.liteslot; if(LITE.meal && LITE.edit<0){ LITE.meal = ""; LITE.pick = {}; } LITE.other = (document.getElementById("lite-other")||{}).value||""; render(); return true; }
  const pk = t.closest && t.closest("[data-litepick]");
  if(pk){ const id = pk.dataset.litepick; LITE.pick[id] = (LITE.pick[id]||0)+1; LITE.other = (document.getElementById("lite-other")||{}).value||""; const y = window.scrollY; render(); window.scrollTo(0,y); return true; }
  const mp = t.closest && t.closest("[data-litemeal]");
  if(mp){ const id = mp.dataset.litemeal, mm = (S.myMeals||[]).find(x=>x.id===id), r = liteRecipe(id);
    LITE.other = (document.getElementById("lite-other")||{}).value||"";
    if(LITE.meal===id){ LITE.meal = ""; LITE.pick = {}; }
    else { LITE.meal = id; LITE.pick = {}; if(mm && (mm.items||[]).length) for(const x of mm.items) LITE.pick[x.id||("n:"+x.n)] = x.q||1; else LITE.pick["meal:"+id] = 1; }
    render(); window.scrollTo(0,0); return true; }
  if(t.dataset.liteplus||t.dataset.liteminus){ const id = t.dataset.liteplus||t.dataset.liteminus; LITE.pick[id] = liteStep(LITE.pick[id], t.dataset.liteplus?1:-1); if(LITE.pick[id]<=0) delete LITE.pick[id]; LITE.other = (document.getElementById("lite-other")||{}).value||""; render(); return true; }
  if(t.dataset.liteedit!==undefined){ const a = ((S.log[key]||{}).ate||[])[+t.dataset.liteedit]; if(!a) return true;
    LITE = {eat:a.m, pick:{}, other:"", meal:a.meal||"", edit:+t.dataset.liteedit, time:a.t, day:(key===ymd(new Date())?"":key)}; for(const x of a.items) LITE.pick[x.id||("n:"+x.n)] = (LITE.pick[x.id||("n:"+x.n)]||0)+(x.q||1);
    render(); window.scrollTo(0,0); return true; }
  if(t.dataset.litemealupd){ const sm = liteSavedMeal(); if(sm){ liteAddFood(); sm.items = liteItems(); save(); toast("Updated \u201c"+sm.n+"\u201d"); } liteReset(); render(); return true; }
  if(t.dataset.litemealdel){ const sm = liteSavedMeal(); if(sm){ S.myMeals = S.myMeals.filter(m=>m!==sm); save(); toast("Removed \u201c"+sm.n+"\u201d from your meals"); } LITE.meal = ""; render(); return true; }
  if(t.dataset.alerttest){ alertNow("Test alert", "This is how a due item looks"); return true; }
  if(t.dataset.liteaddsupp){ const g = id=>((document.getElementById(id)||{}).value||"").trim(), name = g("lite-sname");
    if(!name){ toast("Type a name first"); return true; }
    S.supplements.push({id:"s"+Date.now(), name, dose:g("lite-sdose"), times:"", how:"", binder:false, active:true, pending:false, notes:"", where:"home", whens:[]});
    LITE_SET_OPEN = true; save(); render(); LITE_SET_OPEN = false;
    const row = [...document.querySelectorAll("[data-litewhen]")].pop(); if(row) row.scrollIntoView({block:"center"});
    toast("Added. Now tick when you take it."); return true; }
  if(t.dataset.liteadd){ if(liteAddFood()){ render(); toast("Added"); } else toast("Type a food first"); return true; }
  if(t.dataset.litecancel){ liteReset(); render(); return true; }
  if(t.dataset.litesave){
    const other = ((document.getElementById("lite-other")||{}).value||"").trim(), plist = pantryList();
    const items = liteItems();
    if(other && liteAddFood()) return liteClick(t);
    const lg = dayLog(key), m = LITE.eat, t0 = ((document.getElementById("lite-time")||{}).value||"").slice(0,5) || fromMins(liteNowM());
    const old = LITE.edit>=0 && (lg.ate||[])[LITE.edit] ? lg.ate[LITE.edit] : null;
    lg.ev = lg.ev||{};
    if(old && old.m!==m && lg.ev[old.m]===old.t && !(lg.ate||[]).some((a,i)=>i!==LITE.edit && a.m===old.m)) delete lg.ev[old.m];
    if(!lg.ev[m] || (old && lg.ev[m]===old.t) || !(lg.ate||[]).some((a,i)=>i!==LITE.edit && a.m===m)) lg.ev[m] = t0;
    const entry = LITE.meal ? {m, t:t0, items, meal:LITE.meal} : {m, t:t0, items};
    if(old) lg.ate[LITE.edit] = entry; else (lg.ate=lg.ate||[]).push(entry);
    lg.ate.sort((a,b)=>(a.t||"").localeCompare(b.t||""));
    const upd = document.getElementById("lite-upd"), sm = liteSavedMeal(); if(upd && upd.checked && sm) sm.items = items.map(x=>({id:x.id, n:x.n, q:x.q}));
    if(QM_DONE[m]) lg.done[QM_DONE[m]] = true;
    const keep = document.getElementById("lite-keep"), kname = ((document.getElementById("lite-keepname")||{}).value||"").trim();
    let kept = "";
    if(keep && keep.checked && items.length){ const nm = kname || items.map(x=>x.n).join(", "); const id = addMyMeal(m, nm); const mm = myMeals().find(x=>x.id===id); if(mm){ mm.items = items.map(x=>({id:x.id, n:x.n, q:x.q})); kept = nm; } }
    liteReset(); save(); render(); window.scrollTo(0,0); toast(kept ? "Saved, and \u201c"+kept+"\u201d is now one of your meals." : (TAB==="lite" ? "Saved. What goes with it is at the top." : "Saved.")); return true; }
  if(t.dataset.litedone){ const lg = dayLog(t.dataset.day); (lg.lite=lg.lite||{})[t.dataset.litedone] = true; liteMarkFull(t.dataset.day, t.dataset.sid); save(); render(); return true; }
  if(t.dataset.liteatedel!==undefined){ const lg = dayLog(key), gone = (lg.ate||[]).splice(+t.dataset.liteatedel,1)[0];
    if(gone && !(lg.ate||[]).some(a=>a.m===gone.m)){ if(QM_DONE[gone.m]) delete lg.done[QM_DONE[gone.m]]; if(lg.ev) delete lg.ev[gone.m]; }
    save(); render(); return true; }
  if(t.dataset.litefull){ TAB = "today"; render(); window.scrollTo(0,0); return true; }
  return false;
}
function liteChange(t){
  if(t.dataset.alert){ S[t.dataset.alert] = t.checked; save(); return true; }
  if(t.dataset.liteq){ const v = Number(t.value); if(v>0) LITE.pick[t.dataset.liteq] = v; LITE.other = (document.getElementById("lite-other")||{}).value||""; render(); return true; }
  if(t.dataset.litewhen){ const [sid,a] = t.dataset.litewhen.split(":"), s = S.supplements.find(x=>x.id===sid); if(!s) return true;
    s.whens = (s.whens||[]).filter(x=>x!==a); if(t.checked) s.whens.push(a); s.whens.sort((x,y)=>LITE_ANCHORS.findIndex(v=>v[0]===x)-LITE_ANCHORS.findIndex(v=>v[0]===y)); save(); return true; }
  if(t.dataset.liteafter){ const s = S.supplements.find(x=>x.id===t.dataset.liteafter); if(s){ s.afterH = Number(t.value)||0; save(); } return true; }
  return false;
}
view.addEventListener("keydown", e=>{ if(e.target.id==="lite-other" && e.key==="Enter"){ e.preventDefault(); if(liteAddFood()){ render(); const o = document.getElementById("lite-other"); if(o) o.focus(); } } });
view.addEventListener("input", e=>{ if(e.target.id==="lite-time"){ LITE.time = e.target.value; return; } if(e.target.id!=="lite-q") return; const q = e.target.value.trim().toLowerCase();
  for(const b of document.querySelectorAll("#lite-plist [data-litepick]")) b.style.display = !q || b.dataset.n.includes(q) ? "" : "none"; });
setInterval(()=>{ if(TAB==="lite" && !LITE.eat && !document.querySelector("#view input:focus, #view select:focus") && !document.querySelector("#view details[open]")) render(); }, 60000);
