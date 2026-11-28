/* ---------- Setup guide (source: shared-app/src/onboarding.js, put into the app by build.py) ----------
   A brand-new copy opens here: one short question at a time, each one skippable.
   Every answer is written straight into the normal settings, so it can be changed later on its own page,
   and running the guide again shows what's already set. Nothing here leaves the device. */
const SETUP_STEPS = [
  ["welcome","Welcome"],["about","What you're managing"],["foods","Foods to avoid"],["meds","Medicines and supplements"],["labs","Lab results"],
  ["day","Your day"],["routine","Your routine"],["household","Who you cook for"],["kitchen","Your kitchen"],["pantry","What's in your kitchen"],
  ["reminders","Reminders"],["done","All set"]];
/* Health conditions offered, and the starter food list each one turns on. The lists are drafts until a clinician reviews them. */
const SETUP_CONDITIONS = [
  ["blood_sugar","Blood sugar: diabetes, prediabetes or insulin resistance","blood_sugar",["cdc-carbs","cdc-drinks"]],
  ["mold","Mold illness or mold exposure","low_mold",["nci-aflatoxin","break-the-mold"]],
  ["celiac","Celiac disease or gluten sensitivity","gluten_free",["celiac-sources"]],
  ["hsv","Cold sores or herpes (HSV) flares","low_arginine",["mailoo-2017","griffith-1987","usda-fdc"]]];
const SETUP_MED_SRC = ["fda-grapefruit","ods-vitamin-k","fda-licorice","mayo-maoi"];
/* Pantry starter items, filled in at build time from the pantry page: [id, name, section]. */
const SETUP_PANTRY = /*PANTRYITEMS*/[];
const SETUP_CATS = [["produce","Fruit and vegetables"],["meat","Meat, fish, eggs and tofu"],["pantry","Pantry shelf"],["dairy","Dairy and bread"],["spice","Spices, oils and staples"]];
const PANTRY_KEY = "pantryplanner.v1";
/* Common health routine steps to tick: [id, name, how, where, sources]. Ids match the starter examples, so ticking one turns that example on. */
const SETUP_ROUTINE = [
  ["walk","Walk","As your energy allows.","home"],
  ["move","Exercise or movement","","home"],
  ["stretch","Stretching or yoga","A few gentle minutes.","home"],
  ["breath","Breath work","A few minutes of slow breathing.","home"],
  ["quiet","Meditation or quiet time","","home"],
  ["outside","Time outside or in daylight","","home"],
  ["drybrush","Dry brushing","","home"],
  ["sinus","Sinus rinse","Use distilled, sterile, or boiled and cooled water. Never water straight from the tap.","home",["fda-neti"]],
  ["epsom","Epsom salt bath","","home"],
  ["sauna","Sauna","","town"],
  ["gym","Gym or class","","town"]];
const SU_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function setupState(){ return S.setup = Object.assign({status:"new", step:0}, S.setup||{}); }
function setupStep(){ const n = Number(setupState().step)||0; return Math.min(Math.max(n,0), SETUP_STEPS.length-1); }
const setupIdx = id=>SETUP_STEPS.findIndex(x=>x[0]===id);
function setupGo(n){ setupState().step = n; save(); render(); window.scrollTo(0,0); }
function setupLeave(status){
  const st = setupState(); st.status = status; if(status==="done") st.done = ymd(new Date());
  save(); TAB = "today"; try{ sessionStorage.setItem("dh-tab",TAB); }catch(_){} render(); window.scrollTo(0,0);
}
const suCk = (attr, on, label, hint)=>`<label class="su-ck"><input type="checkbox" ${attr} ${on?"checked":""}><span><b>${label}</b>${hint?`<small class="muted">${hint}</small>`:""}</span></label>`;

/* What's ticked in the pantry right now, plus anything picked here that the pantry page hasn't taken in yet. */
function setupPantryHave(){
  let have = {};
  try{ const p = JSON.parse(localStorage.getItem(PANTRY_KEY)||"null"); if(p && p.pantry) have = Object.assign({}, p.pantry); }catch(_){}
  const pk = (S.setup||{}).pantry;
  if(pk){ for(const id of pk.on||[]) have[id] = 1; for(const id of pk.off||[]) delete have[id]; }
  return have;
}
/* The pantry page keeps its own saved list (on a computer it lives with the computer app), so picks wait in
   setup.pantry and the pantry page adds them the next time it opens. */
function setupPantrySet(ids, on){
  const pk = setupState().pantry = Object.assign({on:[], off:[]}, S.setup.pantry||{});
  for(const id of ids){
    pk.on = pk.on.filter(x=>x!==id); pk.off = pk.off.filter(x=>x!==id);
    (on ? pk.on : pk.off).push(id);
  }
  pk.at = Date.now(); save();
}

/* How often: one set of controls for a new medicine (key "new") or a routine step (key = its id).
   Changes to a routine step save right away; a new medicine is read when you press Add. */
function suFreqMode(x){ return x.asNeeded?"prn":x.alt?"alt":(x.days||[]).length?"days":"every"; }
function suFreqHtml(key, x, prn){
  const m = suFreqMode(x), show = on=>on?"":` style="display:none"`;
  return `<div class="stack" data-su-fx="${esc(key)}" style="gap:6px">
    <div class="grid2">
      <label>How often<select data-su-f="mode">${[["every","Every day"],["days","Some days of the week"],["alt","Every other day"],...(prn?[["prn","Only as needed"]]:[])].map(([v,n])=>`<option value="${v}" ${m===v?"selected":""}>${n}</option>`).join("")}</select></label>
      <label data-su-show="sched"${show(m!=="prn")}>Times a day<select data-su-f="perDay">${[1,2,3,4].map(n=>`<option value="${n}" ${(Number(x.perDay)||1)===n?"selected":""}>${n}</option>`).join("")}</select></label>
      <label data-su-show="prn"${show(m==="prn")}>Most per day <small class="muted" style="font-weight:400">optional</small><input type="number" min="0" max="20" data-su-f="maxPerDay" value="${esc(x.maxPerDay||"")}" placeholder="any"></label>
    </div>
    <div class="row" data-su-show="days"${show(m==="days")}>${DAYS.map((n,dw)=>`<label class="inline"><input type="checkbox" data-su-f="day" value="${dw}" ${(x.days||[]).includes(dw)?"checked":""}> ${n}</label>`).join("")}</div>
    <label class="inline" data-su-show="alt"${show(m==="alt")}>First day <input type="date" data-su-f="altFrom" value="${esc(x.altFrom||ymd(new Date()))}"></label>
  </div>`;
}
function suFreqRead(box){
  const v = f=>box.querySelector(`[data-su-f="${f}"]`), mode = v("mode").value;
  const days = [...box.querySelectorAll('[data-su-f="day"]:checked')].map(x=>+x.value);
  const out = {asNeeded:mode==="prn", alt:mode==="alt", days:mode==="days"?days:[], perDay:Number(v("perDay").value)||1};
  if(mode==="alt") out.altFrom = (v("altFrom").value)||ymd(new Date());
  if(mode==="prn") out.maxPerDay = v("maxPerDay").value;
  return out;
}
function suFreqShow(box){
  const m = box.querySelector('[data-su-f="mode"]').value;
  box.querySelectorAll("[data-su-show]").forEach(el=>{ const k = el.dataset.suShow; el.style.display = (k==="sched" ? m!=="prn" : k===m) ? "" : "none"; });
}
function suFreqText(x){
  const m = suFreqMode(x);
  if(m==="prn") return "only as needed"+(x.maxPerDay?", up to "+x.maxPerDay+" a day":"");
  const n = Number(x.perDay)||1;
  return (m==="alt"?"every other day":m==="days"?x.days.map(d=>DAYS[d]).join(", "):"every day")+(n>1&&!parseTimes(x.times||"").length?", "+n+" times a day":"");
}
/* Re-draw the step but keep anything typed into a box that isn't saved yet. */
function renderSetupKeep(){
  const keep = {};
  view.querySelectorAll("input[id],textarea[id]").forEach(el=>{ if(!/^(checkbox|radio|file)$/.test(el.type) && el.value) keep[el.id] = el.value; });
  renderSetup();
  for(const [k,v] of Object.entries(keep)){ const el = document.getElementById(k); if(el && !el.value) el.value = v; }
}
/* Frost months for "local now" on the pantry page. The pantry keeps its own saved data, so a choice here waits in
   setup.pantry.season until the pantry page opens, the same way ticked pantry items do. */
function setupSeason(){
  let s = {}, appliedAt = 0;
  try{ const p = JSON.parse(localStorage.getItem(PANTRY_KEY)||"null"); if(p){ s = Object.assign({}, p.season||{}); appliedAt = p.seasonAt||0; } }catch(_){}
  const pk = (S.setup||{}).pantry;
  if(pk && pk.season && pk.seasonAt !== appliedAt) Object.assign(s, pk.season);
  return {last:Number(s.last)||4, fall:Number(s.fall)||10, noFrost:!!s.noFrost};
}
function setupSeasonSet(k, v){
  const cur = setupSeason(), pk = setupState().pantry = Object.assign({on:[], off:[]}, S.setup.pantry||{});
  pk.season = Object.assign(cur, {[k]:v}); pk.seasonAt = Date.now(); save();
}
function setupRoutineRow(r, id, label, hint){
  const on = !!(r && r.active);
  return `<div class="su-rt">${suCk(`data-su-rt="${esc(id)}"`, on, esc(r?r.name:label), hint)}
    ${on?`<div class="stack" style="gap:6px;margin:6px 0 10px 30px">
      ${suFreqHtml(r.id, r, false)}
      <div class="grid2">
        <label>Where<select data-su-rwhere="${esc(r.id)}"><option value="home" ${(r.where||"home")==="home"?"selected":""}>At home</option><option value="town" ${r.where==="town"?"selected":""}>In town (earlier alerts)</option></select></label>
        <label>Time <small class="muted" style="font-weight:400">optional</small><input type="text" data-su-rtimes="${esc(r.id)}" value="${esc(r.times||"")}" placeholder="e.g. 7:30am"></label>
      </div></div>`:""}</div>`;
}

function setupBody(id){
  const R = S.rules, packs = new Set(R.packs||[]);
  if(id==="welcome") return `
    <h2>Welcome to all systems you</h2>
    <p class="su-time"><b>About 10 minutes</b> · ${SETUP_STEPS.length-2} short steps</p>
    <p>This guide asks about your health, your food and your day, one step at a time. You can skip any question, and change every answer later.</p>
    <ul class="su-list">
      <li>Everything you enter stays on this device. There's no account.</li>
      <li>The app helps you follow the plan you and your care team set. It is not medical advice.</li>
      <li>Not sure about something? Skip it. The app leaves numbers blank until you fill them in.</li>
    </ul>
    <label>What should the app call you? <small class="muted" style="font-weight:400">Optional. Shown on food cards you share with your household.</small>
      <input type="text" id="su-name" maxlength="40" value="${esc((S.household&&S.household.me&&S.household.me.name)||"")}" placeholder="First name or nickname"></label>
    <details class="su-more"><summary>Already use the app on another device?</summary>
      <p class="muted">Load a backup file from that device instead of starting over. You'll find "Download a backup file" under More, then Times &amp; reminders.</p>
      <label class="btn ghost" style="cursor:pointer;justify-self:start">Load a backup file<input type="file" id="su-backup" accept=".json,application/json" hidden></label>
    </details>`;
  if(id==="about") return `
    <h2>What are you managing?</h2>
    <p class="muted">Tick any that apply. Each one turns on a starter food list, so the meal checker, pantry and shopping list can flag foods for you. The lists are drafts until a clinician has reviewed them, so treat them as reminders.</p>
    <div class="su-grid">${SETUP_CONDITIONS.map(([cid,label,pack,src])=>suCk(`data-su-cond="${cid}"`, packs.has(pack), esc(label), "Turns on the "+esc((PACKS.find(p=>p[0]===pack)||[])[1]||pack)+" list. "+srcNote(...src))).join("")}</div>
    ${(()=>{ const D = allDiag(), ids = Object.keys(D); return ids.length ? `<div class="su-grid">${ids.map(did=>suCk(`data-diag="${did}"`, diagOn(did), esc(D[did].name),
      esc(D[did].about)+(D[did].qs.length?" Adds "+D[did].qs.length+" question"+(D[did].qs.length===1?"":"s")+" to your doctor list.":"")+(D[did].src?" Sources: "+esc(D[did].src)+".":""))).join("")}</div>` : ""; })()}
    <details class="su-more"><summary>Add a diagnosis that isn't listed</summary>
      <p class="muted">Type the foods it means you avoid or keep small, separated by commas. The meal checker, pantry and meals will flag them. You can turn each one off later.</p>
      <label>Diagnosis<input type="text" id="dg-name" maxlength="80" placeholder="e.g. Gout"></label>
      <div class="grid2">
        <label>Foods to avoid<input type="text" id="dg-avoid" placeholder="e.g. organ meats, beer"></label>
        <label>Foods to keep small<input type="text" id="dg-limit" placeholder="e.g. red meat, shellfish"></label>
      </div>
      <label>Questions for your doctor <small class="muted" style="font-weight:400">optional, one per line</small><textarea id="dg-qs" rows="2"></textarea></label>
      <div><button class="btn ghost" data-diagadd="1">Add it</button></div>
    </details>
    <label>Anything else you're managing? <small class="muted" style="font-weight:400">Optional. For your own notes and your visit summary. It doesn't change any food lists.</small>
      <input type="text" id="su-other" maxlength="200" value="${esc((S.profile||{}).other||"")}" placeholder="e.g. high blood pressure, IBS"></label>
    <small class="muted">Change these any time under More, then My diagnoses.</small>`;
  if(id==="foods"){
    const preset = new Set((R.extra||[]).filter(x=>x.preset).map(x=>x.preset));
    const typed = (R.extra||[]).map((x,i)=>[x,i]).filter(([x])=>!x.preset);
    return `
    <h2>Foods you avoid</h2>
    <p class="muted">Allergies, foods that bother you, or foods you just don't eat. Ticked ones get flagged as "avoid" everywhere in the app.</p>
    <details class="su-more" ${SU_LIST.length||!(R.extra||[]).length?"open":""}><summary>Already have a list? Add it all at once</summary>
      <p class="muted">Pick a text file, or paste your list. One food per line or separated by commas. Lines like <b>Avoid:</b>, <b>Limit:</b> or <b>OK:</b> sort the foods under them. For a PDF, photo or Word file, open it, select all the text, copy it and paste it here. On an iPhone, press and hold on the text in a photo and choose Copy All.</p>
      ${setupAiHint("List every food in this file, one per line. Put them under the headings Avoid:, Limit: and OK:, the way the file sorts them. Leave out everything else.")}
      <label class="btn ghost" style="cursor:pointer;justify-self:start">Pick a file<input type="file" id="su-listfile" accept=".txt,.csv,.md,.text,text/plain,text/csv,text/markdown" hidden></label>
      <label>Or paste your list<textarea id="su-listtext" placeholder="Avoid: dairy, eggs, vinegar, mushrooms\nLimit: potatoes, dried fruit\nOK: coconut, cilantro"></textarea></label>
      <div><button class="btn ghost" id="su-listRead">Read my list</button></div>
      ${setupListHtml()}
    </details>
    <div class="su-grid">${HH.PRESETS.map(([pid,label,,src])=>suCk(`data-su-pre="${pid}"`, preset.has(pid), esc(label), src.length?srcNote(...src):"")).join("")}</div>
    ${typed.length?`<div><b>Also on your list</b><div class="chips" style="margin-top:6px">${typed.map(([x,i])=>`<span class="chip ${x.level==="avoid"?"pending":""}">${esc(x.label||x.word)} <button class="linkbtn" style="padding:0 0 0 6px" data-su-xdel="${i}" aria-label="Remove ${esc(x.label||x.word)}">✕</button></span>`).join("")}</div></div>`:""}
    <div class="grid2">
      <label>Other foods to avoid <small class="muted" style="font-weight:400">Separate with commas</small><input type="text" id="su-avoid" placeholder="e.g. paprika, mushrooms"></label>
      <label>Foods to keep small <small class="muted" style="font-weight:400">Flagged as "limit"</small><input type="text" id="su-limit" placeholder="e.g. potatoes, dried fruit"></label>
    </div>
    <label>Foods you know are fine for you <small class="muted" style="font-weight:400">Never flagged, even if a list would catch them</small><input type="text" id="su-ok" placeholder="e.g. coconut, cilantro"></label>
    <div><button class="btn ghost" id="su-foodsAdd">Add these</button></div>
    <small class="muted">Your full list, and short "food breaks" with an end date, are under More, then My rules.</small>`;
  }
  if(id==="meds") return `
    <h2>Medicines and supplements</h2>
    <p class="muted">Add what you take, so the app can remind you. Not sure of the time yet? Leave it blank. You can add more detail later.</p>
    ${S.supplements.length?`<ol class="su-list">${S.supplements.map((s,i)=>`<li><b>${esc(s.name)}</b>${s.dose?", "+esc(s.dose):""}${s.times?" at "+esc(s.times):""}, ${esc(suFreqText(s))}${s.how?" ("+esc(s.how)+")":""} <button class="linkbtn" data-su-mdel="${i}" aria-label="Remove ${esc(s.name)}">Remove</button></li>`).join("")}</ol>`:""}
    <div class="grid2">
      <label>Name<input type="text" id="su-mname" placeholder="e.g. Metformin, vitamin D"></label>
      <label>Dose <small class="muted" style="font-weight:400">optional</small><input type="text" id="su-mdose" placeholder="e.g. 500 mg"></label>
      <label>Times <small class="muted" style="font-weight:400">optional</small><input type="text" id="su-mtimes" placeholder="e.g. 8:00, 6:30pm"></label>
      <label>With food?<select id="su-mhow"><option value="">Not sure</option><option value="with a meal">With food</option><option value="without food">Without food</option></select></label>
    </div>
    ${suFreqHtml("new", {}, true)}
    <small class="muted">No times? It shows on your list that many times a day with no clock time, and you tick each one off. "Only as needed" never reminds you. You log each one when you take it.</small>
    <div><button class="btn ghost" id="su-medAdd">Add it</button></div>
    ${suCk(`data-pack="medicines"`, packs.has("medicines"), "Warn me about foods that interact with common medicines", "Grapefruit, vitamin K greens, black licorice and tyramine. "+srcNote(...SETUP_MED_SRC))}
    <small class="muted">Change any of this later under More, then Supplements &amp; routine. You can also mark one as a fiber or binder there, so it's kept apart from the others.</small>`;
  if(id==="labs"){
    const labs = S.labs||[], names = [...new Set(labs.map(x=>x.name))];
    return `
    <h2>Lab results</h2>
    <p class="muted">Optional. Saving recent labs lets you see trends and puts them on your visit summary. Pick a text file of your results, or copy the text from your lab report and paste it here. On an iPhone, open the photo or PDF, press and hold on the text and choose Copy All. On Android, use Google Lens or select the text and copy it.</p>
    ${names.length?`<div><b>Already saved:</b> ${esc(names.slice(0,12).join(", "))}${names.length>12?" and "+(names.length-12)+" more":""}</div>`:""}
    <label>Date of the labs<input type="date" id="lp-date" value="${ymd(new Date())}"></label>
    ${setupAiHint("List every lab test in this report, one per line, as: test name, result, unit, low-high range. Leave out names, dates and everything else.")}
    <label class="btn ghost" style="cursor:pointer;justify-self:start">Pick a text file<input type="file" id="su-labfile" accept=".txt,.csv,.text,text/plain,text/csv" hidden></label>
    <label>Or paste the report<textarea id="lp-text" placeholder="Vitamin D, 25-Hydroxy  28  ng/mL  30-100\nFerritin 45 ng/mL 15-150"></textarea></label>
    <div><button class="btn ghost" id="lpRead">Read the results</button></div>
    <div id="lp-out" class="stack"></div>
    <small class="muted">The app picks out each test, result, unit and range for you to check before saving. Type single results, fix numbers, and log visits under More, then Labs &amp; visits.</small>`;
  }
  if(id==="day"){
    const T = S.times, Rh = S.rhythm, tf = (k,label)=>`<label>${label}<input type="time" id="su-t-${k}" data-t="${k}" value="${esc(parseTime(T[k])||"")}"></label>`;
    return `
    <h2>Your day</h2>
    <p class="muted">Reminders are built around these times. They're starting guesses, so change them to fit your day.</p>
    <div class="grid2">
      <label>I usually wake up<input type="time" id="su-wake" data-rh="wake" value="${esc(Rh.wake)}"></label>
      <label>I usually go to bed<input type="time" id="su-bed" data-rh="bed" value="${esc(Rh.bed)}"></label>
    </div>
    <h3>Meals</h3>
    <div class="grid2">${tf("breakfast","Breakfast")}${tf("lunch","Lunch")}${tf("snack","Snack")}${tf("dinner","Dinner")}</div>
    <h3>Through the day</h3>
    <div class="su-grid">
      ${suCk(`data-pbool="checkin"`, S.checkin, "Evening check-in", "A short \"how did today go\" about 30 minutes before bed. It helps you spot patterns.")}
      ${[["b","breakfast"],["l","lunch"],["d","dinner"]].map(([k,n])=>suCk(`data-rhw="${k}"`, !!(Rh.walkAfter||{})[k], (Number(Rh.walkMin)||10)+"-minute walk after "+n)).join("")}
    </div>
    ${S.waterMode==="weight"?"":`<label style="max-width:16rem">Daily water goal <small class="muted" style="font-weight:400">ounces, optional</small><input type="number" id="su-water" min="0" max="300" data-p="waterGoal" value="${Number(S.waterGoal)?esc(S.waterGoal):""}" placeholder="Not set"></label>`}
    <small class="muted">Fasting windows, walks after meals and other daily rhythm options are under More, then Times &amp; reminders. Check fasting with your care team first, especially with diabetes medicines.</small>`;
  }
  if(id==="routine"){
    const R = S.routine = S.routine||[], starter = new Set(SETUP_ROUTINE.map(x=>x[0]));
    const own = R.filter(r=>!starter.has(r.id));
    return `
    <h2>Your routine</h2>
    <p class="muted">Things you do for your health besides food. Tick what you do, or want to start. For each one, pick how often and where. A clock time is optional: without one, it shows on your list to tick off.</p>
    <div class="su-rts">${SETUP_ROUTINE.map(([rid,name,how,,src])=>setupRoutineRow(R.find(r=>r.id===rid), rid, name, [how, src?srcNote(...src):""].filter(Boolean).join(" "))).join("")}</div>
    ${own.length?`<h3>Your own</h3><div class="su-rts">${own.map(r=>setupRoutineRow(r, r.id, r.name, r.how?esc(r.how):"")).join("")}</div>`:""}
    <div class="grid2"><label>Add your own<input type="text" id="su-rname" maxlength="60" placeholder="e.g. Castor oil pack, journaling"></label></div>
    <div><button class="btn ghost" id="su-rAdd">Add it</button></div>
    <small class="muted">"In town" steps, like a gym or sauna, get earlier alerts so you have time to get there. Change any of this later under More, then Supplements &amp; routine. Ask your care team before starting a sauna or hard exercise if you're unsure it's right for you.</small>`;
  }
  if(id==="household"){
    const h = HH.fix(S.household); S.household = h;
    return `
    <h2>Who do you cook for?</h2>
    <p class="muted">If others eat with you, the app can plan one shared dish and note what each person leaves out or adds on their own plate.</p>
    <label style="max-width:16rem">People eating dinner, counting you<input type="number" id="su-eaters" data-p="eaters" min="1" max="12" value="${esc(S.eaters)}"></label>
    ${h.people.length?`<div><b>Already added</b><ol class="su-list">${h.people.map(p=>`<li><b>${esc(p.name)}</b>${p.items&&p.items.length?": avoids "+esc(p.items.map(x=>x.label).join(", ")):""}${p.adds?". Adds "+esc(p.adds):""}</li>`).join("")}</ol></div>`:""}
    <details class="su-more" ${h.people.length?"":"open"}><summary>Add someone</summary>
      <div class="grid2">
        <label>Their name<input type="text" id="su-pname" maxlength="40" placeholder="e.g. Sam"></label>
        <label>What they add on their own plate <small class="muted" style="font-weight:400">optional</small><input type="text" id="su-padds" maxlength="200" placeholder="e.g. potatoes or rice"></label>
      </div>
      <b>Leave out of shared meals</b>
      <div class="su-grid">${HH.PRESETS.map(([pid,label])=>suCk(`data-su-ppre="${pid}"`, false, esc(label))).join("")}</div>
      <label>Anything else they avoid <small class="muted" style="font-weight:400">Separate with commas</small><input type="text" id="su-pavoid" placeholder="e.g. mushrooms"></label>
      ${suCk(`id="su-pok"`, false, "They said it's OK to keep their food rules on this device")}
      <div><button class="btn ghost" id="su-personAdd">Add this person</button></div>
    </details>
    <small class="muted">They can also send you their own food card from their phone, locked with a passcode. See More, then Household.</small>`;
  }
  if(id==="kitchen") return `
    <h2>Your kitchen</h2>
    <p class="muted">So the cook day plan only asks for what your kitchen can do.</p>
    <div class="grid2">
      <label>Stove burners<input type="number" id="su-burners" data-p="burners" min="1" max="8" value="${esc(S.burners)}"></label>
      <label>Cook day<select id="su-cookday" data-p="cookDay">${DAYS_LONG.map((n,i)=>`<option value="${i}" ${Number(S.cookDay)===i?"selected":""}>${n}</option>`).join("")}</select></label>
    </div>
    <div class="su-grid">
      ${suCk(`data-pbool="oven"`, S.oven, "I have an oven")}
      ${suCk(`data-su-freezer="1"`, S.freezer!==false, "I have a freezer", "Batch cooking freezes meals and reminds you the night before to move them to the fridge.")}
    </div>
    <small class="muted">The cook day is when the app plans a batch cooking session. Change any of this under More, then Times &amp; reminders.</small>`;
  if(id==="pantry"){
    const have = setupPantryHave();
    return `
    <h2>What's in your kitchen now?</h2>
    <p class="muted">Tick what you have. The pantry uses this to show meals you can make now and to build your shopping list. A rough guess is fine.</p>
    ${SETUP_CATS.map(([c,name])=>{ const its = SETUP_PANTRY.filter(x=>x[2]===c); if(!its.length) return "";
      return `<fieldset class="su-cat"><legend><b>${esc(name)}</b> <button class="linkbtn" data-su-pall="${c}">${its.every(x=>have[x[0]])?"Untick all":"Tick all"}</button></legend>
        <div class="su-grid tight">${its.map(([pid,n])=>suCk(`data-su-pan="${pid}"`, !!have[pid], esc(n))).join("")}</div></fieldset>`; }).join("")}
    ${(c=>`<fieldset class="su-cat"><legend><b>Your growing season</b></legend>
      <p class="muted" style="margin:0 0 6px">The pantry marks fruit and vegetables that are "local now". Pick your frost months so it follows your season.</p>
      <div class="grid2">
        <label>Last spring frost<select data-su-season="last">${SU_MONTHS.map((n,i)=>`<option value="${i+1}" ${c.last===i+1?"selected":""}>${n}</option>`).join("")}</select></label>
        <label>First fall frost<select data-su-season="fall">${SU_MONTHS.map((n,i)=>`<option value="${i+1}" ${c.fall===i+1?"selected":""}>${n}</option>`).join("")}</select></label>
      </div>
      ${suCk(`data-su-season="noFrost"`, c.noFrost, "No frost where I live")}
      <small class="muted">Not sure? Look up your town on <a href="https://www.climate.gov/LastFreeze" target="_blank" rel="noopener">NOAA Climate.gov</a> or ask your local extension office. ${srcNote("noaa-last-freeze","psu-cool-warm")}</small></fieldset>`)(setupSeason())}
    <small class="muted">Add anything else, or take a photo of a label, on the Pantry page. You can pick which section a new item goes in.</small>`;
  }
  if(id==="reminders"){
    const on = S.on, ck = (k,label)=>suCk(`data-on="${k}"`, on[k], label);
    return `
    <h2>Reminders</h2>
    <p class="muted">Pick what the app should remind you about.</p>
    <div class="su-grid">${ck("supps","Medicines and supplements")}${ck("meals","Meals")}${ck("snack","Snack")}${ck("water","Water")}${ck("walk","Walk after meals")}${ck("routine","Health routine")}${ck("pull","Move frozen meals to the fridge")}${ck("cook","Cook day")}${ck("treat","Evening treat")}</div>
    <div class="grid2">
      <label>Alerts for things at home <small class="muted" style="font-weight:400">minutes before</small><input type="text" id="su-lhome" data-lead="home" value="${esc(S.leads.home)}" placeholder="10, 5"></label>
      <label>Alerts for trips into town <small class="muted" style="font-weight:400">minutes before, like a gym or sauna</small><input type="text" id="su-ltown" data-lead="town" value="${esc(S.leads.town)}" placeholder="40, 30"></label>
    </div>
    <small class="muted">Separate more than one with commas. For example, 10, 5 gives you an alert 10 minutes before and another 5 minutes before.</small>
    <h3>Reminder times</h3>
    <p class="muted">Meal times are on Your day. Supplement and routine times are on their own steps. These are the rest.</p>
    <div class="grid2">
      <label>Glasses of water <small class="muted" style="font-weight:400">times, separated by commas</small><input type="text" id="su-twater" data-t="water" value="${esc(S.times.water||"")}" placeholder="10:00, 13:00, 16:00"></label>
      <label>Evening treat<input type="time" id="su-ttreat" data-t="treat" value="${esc(parseTime(S.times.treat)||"")}"></label>
      <label>Move frozen meals to the fridge<input type="time" id="su-tpull" data-t="pull" value="${esc(parseTime(S.times.pull)||"")}"></label>
      <label>Start cooking on cook day<input type="time" id="su-tcook" data-t="cook" value="${esc(parseTime(S.times.cook)||"")}"></label>
    </div>
    ${SERVER?`<p class="muted">The computer app shows desktop reminders even when this window is closed.</p>`
      :`<p class="muted">On a phone or in a browser, reminders only pop up while the app is open. For alerts when it's closed, save the calendar file under More, then Times &amp; reminders.</p>
        <div><button class="btn ghost" id="notifyBtn">Allow reminders in this browser</button></div>`}
    ${typeof openOnHtml==="function"?`<h3>Start page</h3><div>${openOnHtml("quick", true)}${openOnHtml("lite", true)}</div><small class="muted">Quick is one page of big buttons for water, supplements and meals. Lite shows only what's next: tap I'm up or Eating now, and it lists what to take with that moment. Pick one, or neither to open on Today. Handy on a phone.</small>`:""}`;
  }
  // done
  const cond = [...SETUP_CONDITIONS.filter(c=>packs.has(c[2])).map(c=>c[1].split(":")[0]), ...Object.entries(allDiag()).filter(([k])=>diagOn(k)).map(([,D])=>D.short||D.name)];
  const avoid = (R.extra||[]).filter(x=>x.level==="avoid").map(x=>x.label||x.word);
  const pk = (S.setup||{}).pantry, nPan = Object.keys(setupPantryHave()).length, hh = S.household = HH.fix(S.household);
  const line = (label, v, step)=>`<li><b>${label}:</b> ${v?esc(v):`<span class="muted">not set</span>`} <button class="linkbtn" data-su-go="${setupIdx(step)}">Change</button></li>`;
  return `
    <h2>You're set up</h2>
    <p>Here's what the app knows. Change any of it now, or later from More.</p>
    <ul class="su-list">
      ${line("Managing", [...cond, (S.profile||{}).other].filter(Boolean).join(", "), "about")}
      ${line("Avoiding", avoid.join(", "), "foods")}
      ${line("Medicines and supplements", S.supplements.map(s=>s.name).join(", "), "meds")}
      ${line("Lab results", (S.labs||[]).length ? (S.labs.length+" saved") : "", "labs")}
      ${line("Your day", S.rhythm.wake||S.rhythm.bed ? "up "+(S.rhythm.wake?niceTime(S.rhythm.wake):"?")+", bed "+(S.rhythm.bed?niceTime(S.rhythm.bed):"?") : "", "day")}
      ${line("Routine", (S.routine||[]).filter(r=>r.active).map(r=>r.name).join(", "), "routine")}
      ${line("Eating dinner", S.eaters+(S.eaters==1?" person":" people")+(hh.people.length?" ("+hh.people.map(p=>p.name).join(", ")+")":""), "household")}
      ${line("Kitchen", S.burners+" burner"+(S.burners==1?"":"s")+(S.oven?", oven":", no oven")+(S.freezer===false?", no freezer":", freezer")+", cook day "+DAYS_LONG[Number(S.cookDay)||0], "kitchen")}
      ${line("Pantry", nPan||pk ? nPan+" item"+(nPan===1?"":"s")+" ticked" : "", "pantry")}
      ${line("Reminders", Object.keys(S.on).filter(k=>S.on[k]).length+" kinds on", "reminders")}
    </ul>
    <div><button class="linkbtn" data-su-go="1">Go through every step again</button></div>
    <h3>Good next steps</h3>
    <ol class="su-list">
      <li><a href="pantry.html">Pantry</a>: see meals you can make now and build a shopping list.</li>
      <li><b>More, then Meals &amp; freezer</b>: swap the sample meals for your own.</li>
      <li><b>More, then My rules</b>: add numbers like a carb or fiber goal, once your care team gives them to you.</li>
      <li><b>More, then Times &amp; reminders</b>: download a backup file now and then. Your data lives only on this device.</li>
    </ol>
    <small class="muted">Run this guide again any time from More, then Setup guide.</small>`;
}

/* A tip for a PDF or photo the app can't read: an AI chat can pull out the text in the shape this guide reads. */
function setupAiHint(ask){
  return `<div class="next"><b>Tip for a PDF or photo:</b> an AI chat app (like ChatGPT, Claude or Gemini) can pull the text out for you. Give it the file, ask it this, then paste its answer here:
    <div style="margin:6px 0"><code style="white-space:normal">${esc(ask)}</code> <button class="linkbtn" data-su-copy="${esc(ask)}">Copy this</button></div>
    <small class="muted">Your file goes to that company when you do this. Read what it gives back before you paste it.</small></div>`;
}
/* ---------- A food list someone already has (a file or pasted text) ----------
   No AI: each line or comma-separated item is one food. A heading such as "Avoid:", "Limit:" or "OK:" sets how the foods under it count.
   Food group names like "dairy" or "eggs" use the same group as the tick boxes above, so dishes made from them are caught too. */
let SU_LIST = [];
const SU_HEADS = [["ok",/^(?:ok|okay|fine|safe|tolerated|allowed|good|yes|can (?:eat|have)|foods? (?:that are |i can )?(?:ok|fine|safe|eat))\b/i],
  ["limit",/^(?:limit|limited|small amounts?|in moderation|moderate|sometimes|occasionally|keep (?:it )?small|careful|caution|reduce)\b/i],
  ["avoid",/^(?:avoid|no|never|don'?t eat|do not eat|not ok|allerg(?:y|ies|ic)|intoleran(?:ce|t)|sensitiv(?:e|ities|ity)|bothers? me|reactions?|foods? (?:to )?avoid|restricted|eliminate)\b/i]];
function setupParseList(text){
  const out = [], seen = new Set(); let level = "avoid";
  for(let raw of String(text||"").split(/\r?\n/)){
    let line = raw.replace(/^[\s>*•·▪◦‣–—-]+|^\s*\d+[.)]\s+/g,"").trim(); if(!line) continue;
    const m = line.match(/^([^:]{1,40}):\s*(.*)$/);
    const head = m ? SU_HEADS.find(([,re])=>re.test(m[1].trim())) : SU_HEADS.find(([,re])=>re.test(line) && line.length<40 && !/,/.test(line));
    if(head){ level = head[0]; line = m ? m[2] : ""; if(!line) continue; }
    else if(m && !m[2]) continue;   // some other heading, like "Grains:"
    for(let item of line.split(/[,;|\t]+/)){
      let why = ""; item = item.replace(/\(([^)]*)\)/g,(_,w)=>{ why = why ? why+"; "+w : w; return " "; }).replace(/\s+/g," ").trim().replace(/[.!]+$/,"");
      if(!item || item.length>40 || !/[a-z]/i.test(item)) continue;
      const key = item.toLowerCase(); if(seen.has(key)) continue; seen.add(key);
      const g = groupFor(key) || groupFor(key.replace(/ (?:products?|foods?|allergy|intolerance)$/,""));
      // A title line like "My food issues" comes through unticked.
      out.push({on:!/\b(?:foods?|lists?|issues|diet|plan|notes|sensitivit(?:y|ies)|page)\b/i.test(item), word:item, level, why, preset: g && HH.PRESETS.some(x=>x[0]===g[0]) ? g[0] : ""});
    }
  }
  return out;
}
function setupListHtml(){
  if(!SU_LIST.length) return "";
  const sel = (r,i)=>`<select data-su-li="${i}" data-su-lf="level">${[["avoid","Avoid"],["limit","Limit"],["ask","Check first"],["ok","Fine"]].map(([v,n])=>`<option value="${v}" ${r.level===v?"selected":""}>${n}</option>`).join("")}</select>`;
  return `<div class="tablewrap"><table class="rep"><thead><tr><th>Add</th><th>Food</th><th>Counts as</th></tr></thead><tbody>
    ${SU_LIST.map((r,i)=>`<tr><td><input type="checkbox" data-su-li="${i}" data-su-lf="on" ${r.on?"checked":""} aria-label="Add ${esc(r.word)}"></td>
      <td><input type="text" data-su-li="${i}" data-su-lf="word" value="${esc(r.word)}" style="min-width:9em">${r.preset?`<small class="muted">Uses the ${esc((HH.PRESETS.find(x=>x[0]===r.preset)||[])[1])} group</small>`:""}${r.why?`<small class="muted">${esc(r.why)}</small>`:""}</td><td>${sel(r,i)}</td></tr>`).join("")}
    </tbody></table></div><small class="muted">Check the list, untick anything that came through wrong, then add it.</small>
    <div><button class="btn" id="su-listSave">Add ${SU_LIST.filter(r=>r.on).length} foods</button></div>`;
}
function setupListSave(){
  const R = S.rules, cap = w=>w.charAt(0).toUpperCase()+w.slice(1); let n = 0;
  for(const r of SU_LIST){
    const w = String(r.word||"").trim(); if(!r.on || !w) continue;
    const x = r.preset && r.level!=="ok" && HH.PRESETS.find(y=>y[0]===r.preset);
    if(r.level==="ok"){ if(!(R.ok||[]).some(y=>y.word===w.toLowerCase())){ R.ok = [...(R.ok||[]), {word:w.toLowerCase(), label:cap(w)}]; n++; } continue; }
    if(x){ R.extra = (R.extra||[]).filter(y=>y.preset!==x[0]); R.extra.push({word:x[1].toLowerCase(), label:x[1], level:r.level, why:r.why||"From my list", pat:x[2], src:x[3], preset:x[0]}); n++; continue; }
    if((R.extra||[]).some(y=>!y.preset && y.word===w.toLowerCase())) continue;
    R.extra = [...(R.extra||[]), {word:w.toLowerCase(), label:cap(w), level:r.level, why:r.why||"From my list"}]; n++;
  }
  if(n) logRule("Added "+n+" foods from a list");
  SU_LIST = []; save(); return n;
}

function renderSetup(){
  const n = setupStep(), [id, name] = SETUP_STEPS[n], last = SETUP_STEPS.length-1;
  view.innerHTML = `<div class="stack su">
    ${n>0&&n<last?`<div class="su-prog" aria-label="Step ${n} of ${last-1}"><span style="width:${Math.round(n/(last-1)*100)}%"></span></div>
      <small class="muted">Step ${n} of ${last-1}: ${esc(name)}</small>`:""}
    <section class="panel su-step">${setupBody(id)}</section>
    <div class="su-nav">
      ${n===0?`<button class="btn" data-su-next>Let's start</button><button class="btn ghost" data-su-leave="skipped">Skip setup for now</button>`
        :n<last?`<button class="btn ghost" data-su-back>Back</button><button class="btn" data-su-next>Next</button><button class="linkbtn" data-su-leave="skipped">Finish later</button>`
        :`<button class="btn ghost" data-su-back>Back</button><button class="btn" data-su-leave="done">Go to today</button>`}
    </div></div>`;
}

/* A brand-new copy opens on the guide (a food card link still goes to Household). */
function setupFirstRun(){
  if(!FRESH) return;
  S.setup = {status:"new", step:0};
  if(TAB!=="household") TAB = "setup";
}
/* Today shows this until the guide is finished or put away. */
function setupNudge(){
  const st = S.setup;
  if(!st || (st.status!=="skipped" && st.status!=="new")) return "";
  const n = setupStep();
  return `<section class="panel"><h2>Finish setting up?</h2>
    <p style="margin:0">${n>0?"You got to step "+n+". Pick up where you left off.":"A few quick questions so the app fits your health, food and day."} About 10 minutes.</p>
    <div class="chips" style="gap:8px"><button class="btn" data-goto="setup">${n>0?"Keep going":"Start setup"}</button><button class="btn ghost" data-su-leave="dismissed">Not now</button></div></section>`;
}

/* Text boxes are read when you press Add or Next, so nothing typed is lost by moving on. */
function setupAddFoods(){
  const R = S.rules, words = id=>String((document.getElementById(id)||{}).value||"").split(",").map(x=>x.trim()).filter(Boolean);
  const cap = w=>w.charAt(0).toUpperCase()+w.slice(1);
  let n = 0;
  for(const [box, level] of [["su-avoid","avoid"],["su-limit","limit"]]) for(const w of words(box)){
    if((R.extra||[]).some(x=>!x.preset && x.word===w.toLowerCase())) continue;
    R.extra = [...(R.extra||[]), {word:w.toLowerCase(), label:cap(w), level, why:"Added in setup"}]; logRule("Added "+cap(w)+" ("+level+")"); n++; }
  for(const w of words("su-ok")){
    if((R.ok||[]).some(x=>x.word===w.toLowerCase())) continue;
    R.ok = [...(R.ok||[]), {word:w.toLowerCase(), label:cap(w)}]; logRule("Marked "+w+" as fine"); n++; }
  return n;
}
function setupAddMed(){
  const g = id=>String((document.getElementById(id)||{}).value||"").trim(), name = g("su-mname");
  if(!name) return false;
  const times = g("su-mtimes"), box = view.querySelector('[data-su-fx="new"]'), f = box ? suFreqRead(box) : {};
  S.supplements.push(Object.assign({id:"s"+Date.now(), name, dose:g("su-mdose"), times, how:g("su-mhow"), binder:false, active:true, pending:!times && !f.asNeeded, notes:"", where:"home"}, f));
  return true;
}
function setupAddRoutine(){
  const el = document.getElementById("su-rname"), name = String((el||{}).value||"").trim();
  if(!name) return false;
  (S.routine = S.routine||[]).push({id:"r"+Date.now(), name, how:"", times:"", days:[], active:true, pending:false, notes:"", where:"home"});
  S.on.routine = true; return true;
}
function setupAddPerson(quiet){
  const g = id=>String((document.getElementById(id)||{}).value||"").trim(), name = g("su-pname");
  if(!name){ if(!quiet) toast("Add their name"); return false; }
  if(!(document.getElementById("su-pok")||{}).checked){ toast("Check that they said it's OK first"); return null; }
  const presets = [...view.querySelectorAll("[data-su-ppre]:checked")].map(x=>x.dataset.suPpre), avoid = g("su-pavoid");
  const items = presets.map(pid=>{ const x = HH.PRESETS.find(y=>y[0]===pid); return {label:x[1], pat:x[2], level:"avoid", src:x[3]}; });
  if(HH.wordsPat(avoid)) items.push({label:avoid, pat:HH.wordsPat(avoid), level:"avoid"});
  const h = S.household = HH.fix(S.household);
  h.people.push({id:"t"+Date.now().toString(36), name, adds:g("su-padds"), src:"typed", ok:true, got:ymd(new Date()), shared:true, items, form:{presets, packs:[], avoid, limit:""}});
  if(Number(S.eaters) < h.people.length+1) S.eaters = h.people.length+1;
  return true;
}
/* Before leaving a step, keep anything typed but not yet added. Returns false to stay on the step. */
function setupKeepTyped(id){
  if(id==="welcome"){ const v = (document.getElementById("su-name")||{}).value; if(v!=null){ S.household = HH.fix(S.household); S.household.me.name = v.trim(); } }
  if(id==="about"){ const v = (document.getElementById("su-other")||{}).value; if(v!=null) S.profile = Object.assign({}, S.profile, {other:v.trim()}); }
  if(id==="foods"){ if(SU_LIST.some(r=>r.on)){ toast("Press Add to keep the foods from your list, or untick them"); return false; } setupAddFoods(); }
  if(id==="meds") setupAddMed();
  if(id==="about"){ const b = view.querySelector("[data-diagadd]"), n = document.getElementById("dg-name"); if(b && n && n.value.trim()) b.click(); }
  if(id==="routine") setupAddRoutine();
  if(id==="labs" && LAB_PASTE.some(r=>r.on)){ toast("Press Save to keep those results, or untick them"); return false; }
  if(id==="household" && setupAddPerson(true)===null) return false;
  return true;
}

view.addEventListener("click", e=>{
  if(TAB!=="setup" && TAB!=="today") return;
  const t = e.target.closest("button"); if(!t) return;
  const d = t.dataset, id = SETUP_STEPS[setupStep()][0];
  if(d.suNext!==undefined){ if(setupKeepTyped(id)) setupGo(setupStep()+1); else save(); return; }
  if(d.suBack!==undefined){ setupKeepTyped(id); setupGo(setupStep()-1); return; }
  if(d.suGo!==undefined){ setupGo(+d.suGo); return; }
  if(d.suLeave!==undefined){ if(TAB==="setup") setupKeepTyped(id); setupLeave(d.suLeave); if(d.suLeave==="skipped") toast("Setup is waiting on Today, and under More"); return; }
  if(d.suCopy!==undefined){ copyText(d.suCopy); return; }
  if(t.id==="su-listRead"){ SU_LIST = setupParseList((document.getElementById("su-listtext")||{}).value); renderSetup(); if(!SU_LIST.length) toast("No foods found. Put one per line or separate them with commas"); return; }
  if(t.id==="su-listSave"){ const n = setupListSave(); renderSetup(); toast(n+" food"+(n===1?"":"s")+" added"); return; }
  if(t.id==="su-foodsAdd"){ const n = setupAddFoods(); save(); renderSetup(); toast(n?"Added":"Type a food first"); return; }
  if(d.suMdel!==undefined){ const s = S.supplements[+d.suMdel]; if(s){ S.supplements.splice(+d.suMdel,1); save(); renderSetupKeep(); toast("Removed "+s.name); } return; }
  if(t.id==="su-rAdd"){ if(setupAddRoutine()){ save(); renderSetup(); toast("Added"); } else toast("Type a name first"); return; }
  if(t.id==="su-medAdd"){ if(setupAddMed()){ save(); renderSetup(); toast("Added"); } else toast("Type a name first"); return; }
  if(t.id==="su-personAdd"){ if(setupAddPerson(false)){ save(); renderSetup(); toast("Added"); } return; }
  if(d.suXdel!==undefined){ const x = S.rules.extra[+d.suXdel]; if(x){ S.rules.extra = S.rules.extra.filter((_,j)=>j!==+d.suXdel); logRule("Removed "+(x.label||x.word)+" from flagged foods"); save(); renderSetup(); } return; }
  if(d.suPall!==undefined){ const have = setupPantryHave(), ids = SETUP_PANTRY.filter(x=>x[2]===d.suPall).map(x=>x[0]);
    setupPantrySet(ids, !ids.every(x=>have[x])); renderSetup(); return; }
});
view.addEventListener("change", e=>{
  const t = e.target, d = t.dataset;
  if(d.prof){ S.profile = Object.assign({}, S.profile, {[d.prof]:t.value.trim()}); save(); return; }
  if(TAB!=="setup") return;
  if(d.suCond){ const c = SETUP_CONDITIONS.find(x=>x[0]===d.suCond), on = new Set(S.rules.packs||[]);
    if(t.checked) on.add(c[2]); else on.delete(c[2]);
    S.rules.packs = PACKS.map(x=>x[0]).filter(x=>on.has(x));
    logRule("Starter list "+(PACKS.find(x=>x[0]===c[2])||[])[1]+(t.checked?" on":" off")); save(); return; }
  if(d.suPre){ const x = HH.PRESETS.find(y=>y[0]===d.suPre), R = S.rules;
    R.extra = (R.extra||[]).filter(y=>y.preset!==x[0]);
    if(t.checked) R.extra.push({word:x[1].toLowerCase(), label:x[1], level:"avoid", why:"Added in setup", pat:x[2], src:x[3], preset:x[0]});
    logRule((t.checked?"Added ":"Removed ")+x[1]+(t.checked?" (avoid)":" from flagged foods")); save(); return; }
  if(d.suFreezer){ S.freezer = t.checked; S.on.pull = t.checked; save(); return; }
  if(d.suLi!==undefined){ const r = SU_LIST[+d.suLi]; if(!r) return; r[d.suLf] = d.suLf==="on" ? t.checked : t.value;
    if(d.suLf==="word"){ const g = groupFor(t.value); r.preset = g && HH.PRESETS.some(x=>x[0]===g[0]) ? g[0] : ""; }
    if(d.suLf==="on"){ const btn = document.getElementById("su-listSave"); if(btn) btn.textContent = "Add "+SU_LIST.filter(x=>x.on).length+" foods"; } return; }
  if((t.id==="su-listfile" || t.id==="su-labfile") && t.files && t.files[0]){ const f = t.files[0], r = new FileReader();
    if(!/^text\/|\.(?:txt|csv|md|text)$/i.test(f.type+" "+f.name)){ toast("That file isn't plain text. Open it, copy the text and paste it instead"); t.value = ""; return; }
    r.onload = ()=>{ if(t.id==="su-listfile"){ SU_LIST = setupParseList(r.result); renderSetup(); toast(SU_LIST.length ? SU_LIST.length+" foods found. Check them below" : "No foods found in that file"); }
      else { document.getElementById("lp-text").value = r.result; document.getElementById("lpRead").click(); } };
    r.readAsText(f); t.value = ""; return; }
  if(d.suPan){ setupPantrySet([d.suPan], t.checked); return; }
  if(d.suSeason){ setupSeasonSet(d.suSeason, d.suSeason==="noFrost" ? t.checked : +t.value); return; }
  if(d.suF!==undefined){ const box = t.closest("[data-su-fx]"); if(!box) return; suFreqShow(box);
    const r = box.dataset.suFx!=="new" && (S.routine||[]).find(x=>x.id===box.dataset.suFx);
    if(r){ const f = suFreqRead(box); delete f.asNeeded; Object.assign(r, f); save(); } return; }
  if(d.suRt){ const R = S.routine = S.routine||[], st = SETUP_ROUTINE.find(x=>x[0]===d.suRt); let r = R.find(x=>x.id===d.suRt);
    if(!r && st && t.checked){ r = {id:st[0], name:st[1], how:st[2], times:"", days:[], active:true, pending:false, notes:"", where:st[3]}; R.push(r); }
    if(r){ r.active = t.checked; if(t.checked) S.on.routine = true; logRule((t.checked?"Started ":"Paused ")+r.name); }
    save(); renderSetupKeep(); return; }
  if(d.suRwhere){ const r = (S.routine||[]).find(x=>x.id===d.suRwhere); if(r){ r.where = t.value; save(); } return; }
  if(d.suRtimes){ const r = (S.routine||[]).find(x=>x.id===d.suRtimes); if(r){ r.times = t.value.trim(); r.pending = false; save();
    const bad = badTimes(r.times); if(bad.length) toast("Couldn't read "+bad.join(", ")+". Use a form like 8:00 or 6:30pm"); } return; }
  if(t.id==="su-backup" && t.files && t.files[0]){ const r = new FileReader();
    r.onload = ()=>{ try{ const v = JSON.parse(r.result); if(!v || typeof v!=="object" || !v.supplements) throw 0;
      S = merge(v); S.setup = Object.assign({}, S.setup, {status:"done", done:ymd(new Date())}); save(); toast("Backup loaded"); TAB = "today"; render(); }
      catch(_){ toast("That file isn't an all systems you backup"); } };
    r.readAsText(t.files[0]); return; }
});
