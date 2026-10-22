/* ---------- Household screen (source: shared-app/src/household/hh-ui.js) ----------
   Needs HH (hh-core.js) and an adapter from the page:
   {get() -> app state, save(), myItems() -> [{key, label, detail, item, on}], meals() -> [{when, name, text}],
    appUrl() -> page address for card links or null, qrSrc, saveFile(name, text), toast(msg), sources -> link or null} */
var HHUI = (function(){
  "use strict";
  var A = null, el = null, mode = "", made = null, busy = "", msg = "";
  var PK = "hh-pending-card";
  var esc = HH.esc;
  function H(){ var S = A.get(); S.household = HH.fix(S.household); return S.household; }
  function pending(){ try{ return sessionStorage.getItem(PK)||""; }catch(e){ return ""; } }
  function setPending(t){ try{ if(t) sessionStorage.setItem(PK, t); else sessionStorage.removeItem(PK); }catch(e){} }
  // A card link (#hh-card=...) from a phone camera: keep the card, clean the address bar. Returns true if there was one.
  function takeHash(){
    var h = location.hash;
    if(h.indexOf("#hh-card=")!==0) return false;
    setPending(HH.cardText(decodeURIComponent(h.slice(9)))); mode = "open";
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    return true;
  }
  function nice(d){ return d ? new Date(d+"T12:00").toLocaleDateString(undefined,{month:"short", day:"numeric", year:"numeric"}) : ""; }
  function itemText(it){ return (it.level && it.level!=="avoid" ? HH.LEVELS[it.level]+": " : "")+it.label+(it.until?" (until "+nice(it.until)+")":""); }
  function chips(items){ return items.length ? '<div class="chips">'+items.map(function(it){ return '<span class="chip">'+esc(itemText(it))+'</span>'; }).join("")+'</div>' : '<small class="muted">No food rules yet.</small>'; }

  function personCard(p, i){
    var from = p.src==="card" ? "From "+esc(p.name)+"'s food card, made "+esc(nice(p.made)) : "Typed in by you"+(p.ok?", with their OK":"");
    return '<div class="hh-person"><div class="hh-ph"><b>'+esc(p.name)+'</b><label class="inline"><input type="checkbox" data-hh-shared="'+i+'"'+(p.shared!==false?" checked":"")+'> Eats shared meals</label></div>'
      +chips(p.items||[])
      +(p.adds?'<small>Adds on their own plate: '+esc(p.adds)+'</small>':'')
      +'<small class="muted">'+from+'.</small>'
      +'<div class="chips">'+(p.src==="card"?'':'<button class="linkbtn" data-hh-edit="'+i+'">Edit</button>')+'<button class="linkbtn" data-hh-del="'+i+'">Remove</button></div></div>';
  }
  function presetBoxes(form){
    var pre = form.presets||[], packs = form.packs||[];
    return '<div class="hh-picks">'+HH.PRESETS.map(function(x){ return '<label class="inline"><input type="checkbox" data-hh-pre="'+x[0]+'"'+(pre.indexOf(x[0])>=0?" checked":"")+'> '+esc(x[1])+'</label>'; }).join("")
      +Object.keys(HH.PACKS).map(function(id){ return '<label class="inline"><input type="checkbox" data-hh-pack="'+id+'"'+(packs.indexOf(id)>=0?" checked":"")+'> '+esc(HH.PACKS[id].name)+'</label>'; }).join("")+'</div>';
  }
  function typeForm(p){
    var f = (p && p.form) || {};
    return '<section class="panel" id="hh-type"><h2>'+(p?"Edit "+esc(p.name):"Type someone in")+'</h2>'
      +'<p class="muted" style="margin:0">For someone who won\'t make their own card. Only add what they agree to. You can change or remove it any time.</p>'
      +'<div class="grid2"><label>Name<input type="text" id="hh-t-name" maxlength="40" value="'+esc(p?p.name:"")+'" placeholder="e.g. Sam"></label>'
      +'<label>What they add on their own plate<input type="text" id="hh-t-adds" maxlength="200" value="'+esc(p?p.adds:"")+'" placeholder="e.g. potatoes or rice"></label></div>'
      +'<div><b>Leave out of shared pots</b>'+presetBoxes(f)+'</div>'
      +'<label>Other foods to leave out<input type="text" id="hh-t-avoid" value="'+esc(f.avoid||"")+'" placeholder="Commas between, e.g. mushrooms, olives"></label>'
      +'<label>Foods to keep small<input type="text" id="hh-t-limit" value="'+esc(f.limit||"")+'" placeholder="Commas between"></label>'
      +'<label class="inline"><input type="checkbox" id="hh-t-ok"'+(p&&p.ok?" checked":"")+'> They said it\'s OK to keep their food rules on this device</label>'
      +'<div class="chips"><button class="btn" data-hh-tsave="'+(p?p.id:"")+'">Save</button><button class="btn ghost" data-hh-cancel>Cancel</button></div></section>';
  }
  function openForm(){
    var t = pending();
    return '<section class="panel" id="hh-open"><h2>Open a food card</h2>'
      +(t ? '<p style="margin:0">A food card is ready to open. Ask the person for its passcode.</p>'
            +'<small class="muted">Opened in the wrong app? <button class="linkbtn" data-hh-copypending>Copy the card</button>, then paste it under Household in your own app.</small>'
          : '<p class="muted" style="margin:0">Scan their QR code with your phone\'s camera, or open the card file they sent, or paste the card text here.</p>'
            +'<label>Card file<input type="file" id="hh-file" accept=".txt,text/plain"></label>'
            +'<label>Or paste the card<textarea id="hh-paste" rows="3" placeholder="Starts with DHC1."></textarea></label>')
      +'<label>Passcode<input type="text" id="hh-pass" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="four words and a number"></label>'
      +'<div class="chips"><button class="btn" data-hh-open'+(busy?" disabled":"")+'>'+(busy==="open"?"Opening…":"Open card")+'</button><button class="btn ghost" data-hh-cancel>Cancel</button></div>'
      +(msg?'<div class="warnbox">'+esc(msg)+'</div>':'')+'</section>';
  }
  function tablePanel(h){
    var at = HH.atTable(h);
    if(!at.length) return "";
    var meals = (A.meals && A.meals()) || [], clash = [];
    var comp = at.map(function(p){ return HH.compile(p); });
    meals.forEach(function(m){ at.forEach(function(p, i){ var x = HH.check(m.text, p, comp[i]); if(x.length) clash.push({m:m, p:p, x:x}); }); });
    return '<section class="panel"><h2>Shared meals</h2>'
      +'<p style="margin:0">Shared pots leave out everything on your own lists, plus:</p><ul class="hh-ul">'
      +at.map(function(p){ var its = (p.items||[]).filter(function(it){ return !it.until || it.until >= HH.ymd(new Date()); }); return '<li><b>'+esc(p.name)+'</b>: '+(its.length?esc(its.map(itemText).join(", ")):"nothing extra")+'</li>'; }).join("")+'</ul>'
      +(at.some(function(p){ return p.adds; }) || h.me.adds ? '<p style="margin:0">On each plate, after serving:</p><ul class="hh-ul">'+(h.me.adds?'<li><b>You</b>: '+esc(h.me.adds)+'</li>':'')
        +at.filter(function(p){ return p.adds; }).map(function(p){ return '<li><b>'+esc(p.name)+'</b>: '+esc(p.adds)+'</li>'; }).join("")+'</ul>' : '')
      +(meals.length ? (clash.length ? '<div class="warnbox"><b>This week.</b> '+clash.map(function(c){ return esc(c.m.when+", "+c.m.name+": "+c.p.name+" can\'t have "+c.x.map(function(y){ return y.words.join(", "); }).join(", ")); }).join(". ")+'. Take their share out before adding it, or swap the meal.</div>'
        : '<small class="muted">Shared meals planned this week look fine for everyone at the table.</small>') : '')
      +'<small class="muted">The Pantry and the Checker show the same check on shared meals.</small></section>';
  }
  function pick(h, it){ return h.card.pick[it.key]!==undefined ? !!h.card.pick[it.key] : !!it.on; }
  function cardItems(h){
    var out = (A.myItems() || []).filter(function(it){ return pick(h, it); }).map(function(it){ return it.item; });
    if(h.card.words && HH.wordsPat(h.card.words)) out.push({label:h.card.words.trim(), pat:HH.wordsPat(h.card.words), level:"avoid"});
    return out;
  }
  function seeHtml(h){ return '<b>They will see</b>: '+esc(h.me.name||"(no name yet)")+(h.me.adds?", adds "+esc(h.me.adds):"")+'.'+chips(cardItems(h)); }
  function cardPanel(h){
    var mine = A.myItems() || [];
    var res = '';
    if(made){
      res = '<div class="hh-made">'
        +(made.qr ? '<div class="hh-qr">'+made.qr+'</div><small class="muted">Have them point their phone\'s camera at this. It opens all systems you with your card.</small>'
                  : '<small class="muted">'+(made.url?"The QR code couldn't load here.":"This page has no web address phones can open, so there's no QR code.")+' Share the card file or copy the text instead.</small>')
        +'<div class="hh-pass"><small>Passcode</small><b>'+esc(made.pass)+'</b><small>Tell them in person or on a call. Don\'t send it with the card.</small></div>'
        +'<div class="chips"><button class="btn ghost" data-hh-share>Share card file</button><button class="btn ghost" data-hh-copy>Copy card text</button><button class="btn ghost" data-hh-done>Done</button></div>'
        +'<small class="muted">AirDrop, Quick Share or Bluetooth keep it phone to phone. Email and texts pass through other companies\' servers. The card is locked, but in person is best.</small></div>';
    }
    return '<section class="panel" id="hh-card"><h2>My food card</h2>'
      +'<p class="muted" style="margin:0">Share your food rules with someone you cook with. You pick each line. Health details like conditions, medicines and labs are never on a card.</p>'
      +'<div class="grid2"><label>Your name on the card<input type="text" id="hh-me-name" maxlength="40" value="'+esc(h.me.name)+'" placeholder="e.g. Kat"></label>'
      +'<label>What you add on your own plate<input type="text" id="hh-me-adds" maxlength="200" value="'+esc(h.me.adds)+'" placeholder="e.g. jalapeño and lime"></label></div>'
      +(mine.length ? '<div><b>On the card</b> <button class="linkbtn" data-hh-all="1">Tick all</button> · <button class="linkbtn" data-hh-all="0">Untick all</button><div class="hh-picks">'+mine.map(function(it){ return '<label class="inline"><input type="checkbox" data-hh-pick="'+esc(it.key)+'"'+(pick(h,it)?" checked":"")+'> '+esc(it.label)+(it.detail?' <small class="muted">'+esc(it.detail)+'</small>':'')+'</label>'; }).join("")+'</div></div>'
        : '<small class="muted">Your own food lists are empty. Add foods on My rules, or type them below.</small>')
      +'<label>Also on my card<input type="text" id="hh-me-words" value="'+esc(h.card.words||"")+'" placeholder="Foods to leave out, commas between"></label>'
      +'<label>Card can be opened until<select id="hh-days">'+[[1,"Tomorrow"],[3,"3 days"],[7,"1 week"],[30,"30 days"],[0,"No end date"]].map(function(o){ return '<option value="'+o[0]+'"'+(+h.card.days===o[0]?" selected":"")+'>'+o[1]+'</option>'; }).join("")+'</select></label>'
      +'<div id="hh-see">'+seeHtml(h)+'</div>'
      +'<div><button class="btn" data-hh-make'+(busy?" disabled":"")+'>'+(busy==="make"?"Locking…":made?"Make a new card":"Make my card")+'</button></div>'+res+'</section>';
  }
  function render(target){
    el = target || el; if(!el || !A) return;
    var h = H(), edit = mode.indexOf("edit:")===0 ? h.people.find(function(p){ return p.id===mode.slice(5); }) : null;
    if(pending() && !mode) mode = "open";
    el.innerHTML = '<div class="stack hh">'
      +(mode==="open" ? openForm() : "")
      +(mode==="type" || edit ? typeForm(edit) : "")
      +'<section class="panel"><h2>Household</h2><p class="muted" style="margin:0">People you share meals with. Their food rules stay on this device and are never sent online.</p>'
      +(h.people.length ? h.people.map(personCard).join("") : '<small class="muted">No one added yet.</small>')
      +'<div class="chips"><button class="btn" data-hh-mode="open">Add from a food card</button><button class="btn ghost" data-hh-mode="type">Type someone in</button></div>'
      +'<small class="muted">Best: each person makes their own card in their own copy of all systems you, so they choose what\'s on it.</small></section>'
      +tablePanel(h) + cardPanel(h)
      +(h.given.length ? '<section class="panel"><h2>Cards you\'ve made</h2><ul class="hh-ul">'+h.given.slice().reverse().slice(0,10).map(function(g){ return '<li>'+esc(nice(g.date))+": "+g.n+" line"+(g.n===1?"":"s")+(g.until?", could be opened until "+esc(nice(g.until)):", no end date")+'</li>'; }).join("")+'</ul><small class="muted">A card can\'t be taken back once opened. To change what someone has, send them a new card. It replaces the old one.</small></section>' : '')
      +'<section class="panel"><details><summary><b>How sharing stays private</b></summary><ul class="hh-ul">'
      +'<li>No accounts and no server. Everything stays on each person\'s own device.</li>'
      +'<li>Only food rules go on a card. You tick each line, and sensitive lists start unticked.</li>'
      +'<li>Each card is locked with a passcode (PBKDF2 with 600,000 rounds, then sealed so changes are caught). Say the passcode out loud; never send it with the card.</li>'
      +'<li>Cards stop opening after the date you pick.</li>'
      +'<li>Whoever made a card owns it. You can turn it off or remove it, but only they can change it.</li></ul>'
      +(A.sources?'<small class="muted">Sources: <a href="'+esc(A.sources)+'#household">how cards are locked and why only food rules are shared</a>.</small>':'')+'</details></section></div>';
    if(made && made.wantQr) drawQr();
  }
  function loadQr(){
    return new Promise(function(res){ if(window.qrcode || !A.qrSrc) return res(); var s = document.createElement("script"); s.src = A.qrSrc; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  }
  async function drawQr(){
    made.wantQr = false; if(!made.url) return;
    await loadQr();
    try{ var q = qrcode(0, "L"); q.addData(made.url); q.make(); made.qr = q.createSvgTag({cellSize:4, margin:4, scalable:true}); }catch(e){ made.qr = ""; }
    render();
  }
  function cardFile(){
    return "all systems you food card from "+(made.name||"someone")+".\nOpen all systems you, go to More, then Household, then Add from a food card.\n"
      +(made.until?"It can be opened until "+nice(made.until)+".\n":"")+"\n"+(made.url||made.text)+"\n";
  }
  async function open(text, pass){
    busy = "open"; msg = ""; render();
    try{
      var c = await HH.unlock(text, pass), p = HH.personFrom(c), h = H();
      if(p.id === h.me.id) throw new Error("mine");
      var i = h.people.findIndex(function(x){ return x.id===p.id; });
      if(i>=0){ p.shared = h.people[i].shared; h.people[i] = p; } else h.people.push(p);
      A.save(); setPending(""); mode = ""; busy = "";
      A.toast((i>=0?"Updated ":"Added ")+p.name+"'s food card");
    }catch(e){
      busy = "";
      msg = e.message==="passcode" ? "That passcode doesn't open this card. Check it with them, letter by letter."
        : e.message==="expired" ? "This card stopped opening on "+nice(e.until)+". Ask them for a new one."
        : e.message==="mine" ? "That's your own card."
        : e.message==="old browser" ? "This browser is too old to open the card. Update it, or open the card on another device."
        : "That doesn't look like a food card. It starts with DHC1.";
    }
    render();
  }
  function onClick(e){
    var b = e.target.closest("button"); if(!b || !el.contains(b)) return;
    var d = b.dataset, h = H();
    if(d.hhMode!==undefined){ mode = d.hhMode; msg = ""; render(); var f = el.querySelector(mode==="open"?"#hh-open":"#hh-type"); if(f) f.scrollIntoView({block:"start"}); return; }
    if(d.hhCancel!==undefined){ mode = ""; msg = ""; setPending(""); render(); return; }
    if(d.hhEdit!==undefined){ mode = "edit:"+h.people[+d.hhEdit].id; render(); var t = el.querySelector("#hh-type"); if(t) t.scrollIntoView({block:"start"}); return; }
    if(d.hhDel!==undefined){ var p = h.people[+d.hhDel]; if(p && confirm("Remove "+p.name+" and their food rules from this device?")){ h.people.splice(+d.hhDel,1); A.save(); render(); A.toast("Removed"); } return; }
    if(d.hhTsave!==undefined){
      var name = el.querySelector("#hh-t-name").value.trim(); if(!name){ A.toast("Add a name"); return; }
      if(!el.querySelector("#hh-t-ok").checked){ A.toast("Check that they said it's OK first"); return; }
      var form = {presets:[].map.call(el.querySelectorAll("[data-hh-pre]:checked"), function(x){ return x.dataset.hhPre; }),
        packs:[].map.call(el.querySelectorAll("[data-hh-pack]:checked"), function(x){ return x.dataset.hhPack; }),
        avoid:el.querySelector("#hh-t-avoid").value, limit:el.querySelector("#hh-t-limit").value};
      var items = form.presets.map(function(id){ var x = HH.PRESETS.find(function(y){ return y[0]===id; }); return {label:x[1], pat:x[2], level:"avoid", src:x[3]}; })
        .concat(form.packs.map(function(id){ return {label:HH.PACKS[id].name, pack:id, level:"avoid"}; }));
      if(HH.wordsPat(form.avoid)) items.push({label:form.avoid.trim(), pat:HH.wordsPat(form.avoid), level:"avoid"});
      if(HH.wordsPat(form.limit)) items.push({label:form.limit.trim(), pat:HH.wordsPat(form.limit), level:"limit"});
      var old = h.people.find(function(x){ return x.id===d.hhTsave; });
      var person = {id:old?old.id:"t"+Date.now().toString(36), name:name, adds:el.querySelector("#hh-t-adds").value.trim(), src:"typed", ok:true, got:HH.ymd(new Date()), shared:old?old.shared:true, items:items, form:form};
      if(old) h.people[h.people.indexOf(old)] = person; else h.people.push(person);
      A.save(); mode = ""; render(); A.toast("Saved"); return;
    }
    if(d.hhOpen!==undefined){
      var text = pending() || (el.querySelector("#hh-paste")||{}).value || "", pass = el.querySelector("#hh-pass").value;
      if(!HH.cardText(text)){ msg = "Scan their QR code, open the card file, or paste the card first."; render(); return; }
      if(!HH.normPass(pass)){ msg = "Type the passcode they told you."; render(); return; }
      open(text, pass); return;
    }
    if(d.hhMake!==undefined){
      var its = cardItems(h); if(!its.length && !h.me.adds){ A.toast("Tick at least one line for the card"); return; }
      if(!h.me.name){ A.toast("Add your name for the card"); return; }
      busy = "make"; render();
      var pass = HH.newPass(), days = +h.card.days||0, c = HH.cardFrom(h.me, its, days);
      HH.lock(c, pass).then(function(t){
        var base = A.appUrl && A.appUrl();
        made = {text:t, pass:pass, name:h.me.name, until:c.x, n:its.length, url:base ? base.split("#")[0]+"#hh-card="+t : "", qr:"", wantQr:true};
        h.given.push({date:HH.ymd(new Date()), n:its.length, until:c.x}); A.save(); busy = ""; render();
        var m = el.querySelector(".hh-made"); if(m) m.scrollIntoView({block:"center"});
      }, function(){ busy = ""; A.toast("Couldn't lock the card on this device"); render(); });
      return;
    }
    if(d.hhShare!==undefined && made){
      var name = "food-card-"+(made.name||"me").toLowerCase().replace(/[^a-z0-9]+/g,"-")+".txt", body = cardFile();
      try{ var file = new File([body], name, {type:"text/plain"});
        if(navigator.canShare && navigator.canShare({files:[file]})){ navigator.share({files:[file], title:"Food card"}).catch(function(){}); return; } }catch(err){}
      A.saveFile(name, body); return;
    }
    if(d.hhCopy!==undefined && made){ var txt = made.url || made.text;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ A.toast("Card copied. Send the passcode separately."); }, function(){ prompt("Copy the card:", txt); }); return; }
    if(d.hhCopypending!==undefined){ var pc = pending();
      (navigator.clipboard ? navigator.clipboard.writeText(pc) : Promise.reject()).then(function(){ A.toast("Card copied"); }, function(){ prompt("Copy the card:", pc); }); return; }
    if(d.hhAll!==undefined){ (A.myItems()||[]).forEach(function(it){ h.card.pick[it.key] = d.hhAll==="1"; }); made = null; A.save(); render(); return; }
    if(d.hhDone!==undefined){ made = null; render(); return; }
  }
  function onChange(e){
    var t = e.target, h = H(), d = t.dataset;
    if(d.hhShared!==undefined){ h.people[+d.hhShared].shared = t.checked; A.save(); render(); return; }
    if(d.hhPick!==undefined){ h.card.pick[d.hhPick] = t.checked; made = null; A.save(); render(); return; }
    if(t.id==="hh-days"){ h.card.days = +t.value; made = null; A.save(); render(); return; }
    if(t.id==="hh-me-name" || t.id==="hh-me-adds" || t.id==="hh-me-words"){
      if(t.id==="hh-me-name") h.me.name = t.value.trim(); else if(t.id==="hh-me-adds") h.me.adds = t.value.trim(); else h.card.words = t.value;
      A.save(); var see = el.querySelector("#hh-see"); if(see) see.innerHTML = seeHtml(h);
      if(made){ made = null; var m = el.querySelector(".hh-made"); if(m) m.remove(); var mk = el.querySelector("[data-hh-make]"); if(mk) mk.textContent = "Make my card"; }
      return; }
    if(t.id==="hh-file" && t.files && t.files[0]){ t.files[0].text().then(function(x){ var c = HH.cardText(x); if(c){ setPending(c); msg = ""; } else msg = "That file doesn't hold a food card."; render(); }); }
  }
  var CSS = ".hh .hh-person{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:grid;gap:6px}.hh .hh-ph{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}"
    +".hh label.inline{display:flex;gap:6px;align-items:center;font-weight:400}.hh .hh-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:4px 12px;margin-top:4px}"
    +".hh .hh-ul{margin:0;padding-left:1.2em;display:grid;gap:2px}.hh .hh-made{display:grid;gap:10px;justify-items:start;border-top:1px solid var(--line);padding-top:12px}"
    +".hh .hh-qr{background:#fff;padding:8px;border-radius:8px;width:min(300px,100%)}.hh .hh-qr svg{display:block;width:100%;height:auto}"
    +".hh .hh-pass{display:grid;gap:2px}.hh .hh-pass b{font-size:1.35rem;letter-spacing:.02em;word-break:break-word}.hh summary{cursor:pointer}";
  function mount(adapter){
    A = adapter; HH.style();
    if(!document.getElementById("hh-ui-css")){ var s = document.createElement("style"); s.id = "hh-ui-css"; s.textContent = CSS; document.head.appendChild(s); }
    document.addEventListener("click", function(e){ if(el && el.contains(e.target) && el.querySelector(".hh")) onClick(e); });
    document.addEventListener("change", function(e){ if(el && el.contains(e.target) && el.querySelector(".hh")) onChange(e); });
  }
  return {mount:mount, render:render, takeHash:takeHash};
})();
