/* ---------- phone build: works anywhere with the data on this phone only ---------- */
/* Adds the Quick view, one-tap links for iPhone Shortcuts (?do=...), first-run setup, backups to Files, and offline install. */
const TOUCH = matchMedia("(pointer: coarse)").matches;
let QUICK_FLASH = "";
function pGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function pSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){} }
/* Not set up yet: no supplements (the phone build starts with none) and the welcome hasn't been dismissed. */
function needsSetup(){ return PHX.welcome && !pGet("dh.welcomed") && !(S.supplements||[]).length; }
function appUrl(q){ return location.origin + location.pathname.replace(/[^/]*$/, "") + (q||""); }
function daysSinceBackup(){ const d = parseYmd(pGet("dh.lastBackup")||""); return d ? Math.round((parseYmd(ymd(new Date())) - d)/864e5) : null; }

/* The meals and supplements on today's list, in time order, for the Quick view and the tap links. */
function quickItems(d){
  const {timed, untimed} = itemsFor(d||new Date());
  const all = timed.concat(untimed);
  return {meals: all.filter(i=>i.kind==="meal"||i.id==="snack"||i.id==="treat"), supps: all.filter(i=>i.kind==="supp")};
}
const MEAL_IDS = {b:"meal:b", l:"meal:l", d:"meal:d", s:"snack", e:"treat"};
function minutesNow(){ const n = new Date(); return n.getHours()*60+n.getMinutes(); }
function markDone(key, id){ const lg = dayLog(key); lg.done[id] = true; undoMissed(key, id); }

/* One-tap links. Shortcuts opens the app with ?do=..., the change is saved here, then the address is cleaned so a reload can't count it twice. */
function runAction(p){
  const act = p.get("do"); if(!act) return "";
  const key = ymd(new Date()), lg = dayLog(key), {meals, supps} = quickItems(new Date());
  if(act==="water"){
    const n = Number(p.get("oz")) || PHX.firstSize();
    PHX.addWater(lg, n);
    return "Added "+n+" oz. "+PHX.waterText(lg)+".";
  }
  if(act==="supps"){
    // Everything due up to an hour from now that isn't ticked yet. Supplements with no time set are left for you to tick.
    const due = supps.filter(i=>i.time && !lg.done[i.id] && mins(i.time) <= minutesNow()+60);
    due.forEach(i=>markDone(key, i.id));
    return due.length ? "Checked off "+due.map(i=>i.title).join(", ")+"." : "Nothing due right now. Tick the ones you took below.";
  }
  if(act==="meal"){
    const m = p.get("m")||"next";
    let it = m==="next" ? meals.filter(i=>!lg.done[i.id] && i.time && mins(i.time) <= minutesNow()+90).pop() || meals.find(i=>!lg.done[i.id]) : meals.find(i=>i.id===MEAL_IDS[m]);
    if(!it) return m==="next" ? "All of today's meals are already ticked." : "That meal isn't on today's list.";
    markDone(key, it.id); return "Done: "+it.title+".";
  }
  if(act==="feel"){
    const v = Math.max(1, Math.min(5, Number(p.get("v"))||3));
    lg.feel = Object.assign({}, lg.feel, {overall:v}); lg.done[PHX.feelId] = true;
    return "Today feels "+["rough","low","OK","good","great"][v-1]+". Saved.";
  }
  if(act==="done" && p.get("id")){ markDone(key, p.get("id")); return "Checked off."; }
  return "";
}
function phoneAfterLoad(){
  const p = new URLSearchParams(location.search);
  if(p.get("do")){ QUICK_FLASH = runAction(p); TAB = "quick"; save(); }
  if(p.get("view")==="quick") TAB = "quick";
  if(needsSetup()) TAB = "quick";
  if(location.search) history.replaceState(null, "", location.pathname + (TAB==="quick" ? "#quick" : ""));
  if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
}

function welcomeHtml(){
  if(!needsSetup()) return "";
  return `<section class="panel" style="border-color:var(--juniper)"><h2>Bring your data to this phone</h2>
    <p style="margin:0">Your information lives only on this phone. To start with your own supplements, routine, labs and pantry, open a backup file from your laptop or your setup file.</p>
    <div class="chips" style="gap:8px"><label class="btn">Open a backup or setup file<input type="file" accept=".json,application/json" ${PHX.restoreAttr} hidden></label>
    <button class="btn ghost" data-welcomed="1">Start empty</button></div>
    <small class="muted">On the laptop: More, then Backups, then Download a backup now. Send the file to your phone (email it to yourself or save it to iCloud), then tap the button above.</small></section>`;
}
function backupNudge(){
  if(needsSetup()) return "";
  const n = daysSinceBackup();
  if(n!==null && n<7) return "";
  return `<section class="panel"><b>${n===null?"Save your first backup":"Last backup was "+n+" days ago"}</b>
    <small class="muted">Your data is only on this phone. A backup in Files or iCloud keeps it safe if the phone is lost or reset.</small>
    <div><button class="btn ghost" ${PHX.backupAttr}>Save a backup now</button></div></section>`;
}
function qRow(it, key, lg){
  const done = !!lg.done[it.id];
  return `<button class="qrow ${done?"on":""}" data-qdone="${esc(it.id)}" data-day="${key}" aria-pressed="${done}">
    <span class="qtick" aria-hidden="true">${done?"✓":""}</span><span class="qt">${it.time?niceTime(it.time):"—"}</span><span class="qn">${esc(it.title.replace(/^(Breakfast|Lunch|Dinner|Snack|Evening treat): /,"$1 · "))}</span></button>`;
}
function renderQuick(){
  const d = new Date(), key = ymd(d), lg = S.log[key]||{done:{}};
  const {meals, supps} = quickItems(d);
  const dueNow = supps.filter(i=>i.time && !lg.done[i.id] && mins(i.time) <= minutesNow()+60).length;
  view.innerHTML = `<div class="stack">
    ${QUICK_FLASH?`<div class="next" role="status"><b>${esc(QUICK_FLASH)}</b></div>`:""}
    ${welcomeHtml()}
    ${PHX.waterHtml(lg)}
    <section class="panel"><h2>Meals</h2>${meals.length?`<div class="qlist">${meals.map(i=>qRow(i,key,lg)).join("")}</div>`:`<p class="muted" style="margin:0">No meals planned for today.</p>`}</section>
    <section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h2>Supplements</h2>${dueNow?`<button class="btn" data-qsupps="1">Took all due now (${dueNow})</button>`:""}</div>
      ${supps.length?`<div class="qlist">${supps.map(i=>qRow(i,key,lg)).join("")}</div>`:`<p class="muted" style="margin:0">No supplements on today's list.</p>`}</section>
    ${backupNudge()}
    <div><button class="linkbtn" data-goto="today">See the full day</button></div>
  </div>`;
  QUICK_FLASH = "";
}

/* Ready-made links for the Shortcuts app, plus how to set one up. */
const SHORTCUTS = [
  ["+4 oz water","?do=water&oz=4"],["+8 oz water","?do=water&oz=8"],["Took my supplements","?do=supps"],
  ["Ate my meal","?do=meal&m=next"],["Breakfast done","?do=meal&m=b"],["Lunch done","?do=meal&m=l"],["Dinner done","?do=meal&m=d"],
  ["Quick view","?view=quick"]
];
function renderPhone(){
  const n = daysSinceBackup();
  view.innerHTML = `<div class="stack">
  <section class="panel"><h2>One-tap buttons</h2>
    <p style="margin:0">Each link below does one thing, like adding 4 oz of water. Put them in the iPhone Shortcuts app and you get buttons on your home screen or lock screen. They work anywhere, with no computer.</p>
    <ol class="day">${SHORTCUTS.map(([n,q],i)=>`<li style="grid-template-columns:1fr auto"><span><b>${esc(n)}</b><br><code style="font-size:.8rem;word-break:break-all;color:var(--muted)">${esc(appUrl(q))}</code></span><button class="btn ghost" data-copylink="${i}">Copy</button></li>`).join("")}</ol>
  </section>
  <section class="panel"><h2>Make a shortcut on iPhone</h2>
    <ol style="margin:0;padding-left:22px;display:grid;gap:6px">
      <li>Tap <b>Copy</b> next to the button you want above.</li>
      <li>Open the <b>Shortcuts</b> app and tap <b>+</b>.</li>
      <li>Search for <b>Open URLs</b>, add it, and paste the link into it.</li>
      <li>Tap the name at the top to call it something like "+4 oz water", then tap <b>Done</b>.</li>
      <li>For a button on the home screen: press and hold the shortcut, tap <b>Share</b>, then <b>Add to Home Screen</b>.</li>
      <li>For a box of several buttons: press and hold the home screen, tap <b>Edit</b>, then <b>Add Widget</b>, pick <b>Shortcuts</b>, and choose a folder with your all systems you shortcuts.</li>
    </ol>
    <small class="muted">Shortcuts opens the app in Safari, so keep using all systems you in Safari too. When you add it to the home screen, turn off <b>Open as Web App</b> so the icon and the shortcuts share the same data.</small>
  </section>
  <section class="panel"><h2>Reminders without the laptop</h2>
    <p style="margin:0">A web app can't pop up reminders on its own while it's closed. Add your schedule to the iPhone Calendar instead: More, then Times &amp; reminders, then the calendar file. Calendar alerts work offline.</p>
  </section>
  <section class="panel"><h2>Backups</h2>
    <p style="margin:0">Your data is only on this phone. ${n===null?"You haven't saved a backup yet.":"Your last backup was "+(n===0?"today":n+" day"+(n===1?"":"s")+" ago")+"."} Save one to Files or iCloud once a week. To move your data to another device, open the same file there.</p>
    <div class="chips" style="gap:8px"><button class="btn" ${PHX.backupAttr}>Save a backup now</button><label class="btn ghost">Open a backup file<input type="file" accept=".json,application/json" ${PHX.restoreAttr} hidden></label></div>
  </section></div>`;
}

/* Backups and other files: on a phone, use the share sheet so they can go straight to Files, iCloud or email. */
function phoneSave(download){
  return async function(name, text, type){
    if(/\.json$/.test(name)) pSet("dh.lastBackup", ymd(new Date()));
    if(TOUCH && navigator.canShare){
      const f = new File([text], name, {type:type||"text/plain"});
      if(navigator.canShare({files:[f]})){ try{ await navigator.share({files:[f], title:name}); return; }catch(e){ if(e && e.name==="AbortError") return; } }
    }
    return download(name, text, type);
  };
}
PHX.wrapSave();

view.addEventListener("click", e=>{
  const t = e.target.closest("button"); if(!t) return;
  if(t.dataset.qdone){ const lg = dayLog(t.dataset.day), id = t.dataset.qdone;
    if(lg.done[id]) delete lg.done[id]; else markDone(t.dataset.day, id); save(); render(); return; }
  if(t.dataset.qsupps){ const key = ymd(new Date()), lg = dayLog(key);
    const due = quickItems(new Date()).supps.filter(i=>i.time && !lg.done[i.id] && mins(i.time) <= minutesNow()+60); due.forEach(i=>markDone(key, i.id));
    save(); render(); toast("Checked off "+due.length); return; }
  if(t.dataset.welcomed){ pSet("dh.welcomed","1"); render(); return; }
  if(t.dataset.copylink!==undefined){ const u = appUrl(SHORTCUTS[+t.dataset.copylink][1]);
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(()=>toast("Link copied"), ()=>{ prompt("Copy this link", u); }); return; }
});
view.addEventListener("change", e=>{ if(PHX.isRestore(e.target)) pSet("dh.welcomed","1"); });

