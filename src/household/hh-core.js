/* ---------- Household (source: shared-app/src/household/hh-core.js, copied into each page by the build) ----------
   People you share meals with. Their food rules stay on this device; nothing goes online.
   A food card carries one person's food rules, never conditions, medicines or labs, from phone to phone,
   locked with a passcode. Same code in the Daily Helper, the Pantry and the Checker. */
var HH = (function(){
  "use strict";
  // Starter lists, filled in at build time from the checker: {id:{name, avoid:[...], ok:[...]}}
  var PACKS = /*HH-PACKS*/{};
  // Quick picks for a person's rules: [id, name, pattern, sources]. Patterns are matched whole-word, any case.
  var PRESETS = [
    ["hot","Chili and hot spice","jalape(?:n|ñ)os?|serranos?|habaneros?|poblanos?|anaheims?|cayenne|chipotles?|chil(?:e|i|ies|is|es)(?: powder| flakes| oil| sauce| crisp)?|red pepper flakes|crushed red pepper|pepper flakes|hot sauces?|sriracha|harissa|gochujang|sambal|hot peppers?|hot curry|wasabi|horseradish",[]],
    ["eggs","Eggs","eggs?|omelets?|omelettes?|frittatas?|quiches?|mayonnaise|mayo|aioli|meringues?|custards?|egg noodles?",["fda-allergens"]],
    ["dairy","Milk and dairy","(?<!coconut |almond |oat |soy |rice |cashew |hemp )milk|cheeses?|yogh?urts?|(?<!peanut |almond |nut |seed |sunflower |apple |cocoa )butter|cream|kefir|ghee|whey|casein|buttermilk|ricotta|mozzarella|cheddar|parmesan|feta|labneh",["fda-allergens"]],
    ["wheat","Wheat and gluten","wheat|barley|rye|spelt|farro|semolina|couscous|bulgur|seitan|malt(?:ed)?|durum|(?<!gluten[- ]free )(?:bread|pasta|noodles?|flour tortillas?|crackers?)",["fda-allergens","celiac-sources"]],
    ["soy","Soy","soy|soya|soybeans?|tofu|tempeh|edamame|miso|soy sauce|tamari|natto",["fda-allergens"]],
    ["peanuts","Peanuts","peanuts?|peanut butter|groundnuts?",["fda-allergens"]],
    ["treenuts","Tree nuts","almonds?|walnuts?|cashews?|pecans?|hazelnuts?|filberts?|pistachios?|brazil nuts?|macadamias?|pine nuts?|nut butters?|nuts|marzipan|pralines?|pesto",["fda-allergens"]],
    ["fish","Fish","fish|salmon|tuna|cod|halibut|trout|sardines?|anchov(?:y|ies)|mackerel|tilapia|haddock|snapper|catfish|sablefish|fish sauce",["fda-allergens"]],
    ["shellfish","Shellfish","shellfish|shrimps?|prawns?|crabs?|lobsters?|crawfish|crayfish|scallops?|clams?|mussels?|oysters?",["fda-allergens"]],
    ["sesame","Sesame","sesame|tahini|hummus|halva|za.?atar",["fda-allergens"]]
  ];
  var LEVELS = {avoid:"Avoid", limit:"Limit", ask:"Ask first"};

  function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  var escRe = function(w){ return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+"); };
  // A typed word becomes a pattern that also catches its plural.
  function wordPat(w){ var x = escRe(String(w).trim().toLowerCase()); return x.endsWith("s") ? x+"?" : x+"(?:s|es)?"; }
  function wordsPat(text){ return String(text||"").split(/[,\n]/).map(function(x){ return x.trim(); }).filter(Boolean).map(wordPat).join("|"); }

  /* ---------- Checking food against one person's rules ----------
     A person's items: {label, pack, level, until} for a starter list, {label, pat, level, until, src} for words. */
  function boundary(p, flags){ return new RegExp("(?<![\\p{L}\\p{N}])(?:"+p+")(?![\\p{L}\\p{N}])", flags||"giu"); }
  function compile(person){
    var t = ymd(new Date()), out = [];
    (person.items||[]).forEach(function(it){
      if(it.until && it.until < t) return;
      var level = LEVELS[it.level] ? it.level : "avoid";
      try{
        if(it.pack){ var P = PACKS[it.pack]; if(!P || !P.avoid.length) return;
          out.push({label:it.label||P.name, level:level, ok:P.ok.length? new RegExp("\\b(?:"+P.ok.join("|")+")\\b","gi") : null, re:new RegExp("\\b(?:"+P.avoid.join("|")+")\\b","gi"), src:it.src||[]}); }
        else if(it.pat) out.push({label:it.label, level:level, ok:null, re:boundary(it.pat), src:it.src||[]});
      }catch(e){}
    });
    return out;
  }
  // [{label, level, words:[...]}], worst first.
  function check(text, person, compiled){
    var rules = compiled || compile(person), hits = [];
    text = String(text||"");
    rules.forEach(function(r){
      var t = r.ok ? text.replace(r.ok, function(m){ return " ".repeat(m.length); }) : text, m, words = [];
      r.re.lastIndex = 0;
      while((m = r.re.exec(t))){ if(!m[0]){ r.re.lastIndex++; continue; } var w = m[0].toLowerCase(); if(words.indexOf(w)<0) words.push(w); }
      if(words.length) hits.push({label:r.label, level:r.level, words:words, src:r.src});
    });
    var order = ["avoid","ask","limit"];
    return hits.sort(function(a,b){ return order.indexOf(a.level)-order.indexOf(b.level); });
  }
  function blank(){ return {me:{id:"", name:"", adds:""}, people:[], given:[], card:{days:7, pick:{}}}; }
  function fix(h){
    var b = blank(); h = h && typeof h==="object" ? h : {};
    b.me = Object.assign(b.me, h.me||{}); b.card = Object.assign(b.card, h.card||{});
    b.people = Array.isArray(h.people) ? h.people.filter(function(p){ return p && p.id; }) : [];
    b.given = Array.isArray(h.given) ? h.given.slice(-30) : [];
    if(!b.me.id) b.me.id = "p"+Math.random().toString(36).slice(2,10)+Date.now().toString(36);
    return b;
  }
  // People who eat shared meals, from the Daily Helper's saved data (the Pantry and Checker read it this way).
  function atTable(h){ return (h && h.people || []).filter(function(p){ return p.shared!==false; }); }
  function fromStorage(key){ try{ var s = JSON.parse(localStorage.getItem(key)||"null"); return s && s.household ? fix(s.household) : blank(); }catch(e){ return blank(); } }
  // One line per person for a dish everyone shares: what clashes, and what they add on their own plate.
  function tableLines(text, h){
    return atTable(h).map(function(p){ var hits = check(text, p);
      return {name:p.name, adds:p.adds||"", hits:hits}; });
  }
  function tableHtml(text, h, opts){
    opts = opts || {};
    var rows = tableLines(text, h); if(!rows.length) return "";
    return '<div class="hh-table">'+(opts.title?'<b>'+esc(opts.title)+'</b>':'')+rows.map(function(r){
      return '<div class="hh-row '+(r.hits.length?"hh-bad":"hh-ok")+'"><span>'+(r.hits.length?"⚠":"✓")+'</span><div><b>'+esc(r.name)+'</b>: '
        +(r.hits.length ? r.hits.map(function(x){ var l = x.label.toLowerCase(), all = x.words.every(function(w){ return l.indexOf(w)>=0; });
          return esc(LEVELS[x.level]+" "+l+(all?"":" ("+x.words.join(", ")+")")); }).join("; ")+". Take their share out before adding it, or swap it." : "fine for them.")
        +(r.adds?' <span class="hh-adds">Adds '+esc(r.adds)+' on their plate.</span>':'')+'</div></div>';
    }).join("")+'</div>';
  }
  var CSS = ".hh-table{display:grid;gap:4px;margin-top:6px;font-size:.93rem}.hh-row{display:grid;grid-template-columns:1.2em 1fr;gap:6px;align-items:start}"
    +".hh-bad span:first-child{color:var(--warn,#9a5b00)}.hh-ok span:first-child{color:var(--accent,var(--juniper,#2f6b57))}.hh-adds{color:var(--muted)}";
  function style(){ if(typeof document==="undefined" || document.getElementById("hh-css")) return; var s = document.createElement("style"); s.id = "hh-css"; s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- Locking a card ----------
     Passcode → PBKDF2-HMAC-SHA256 (600,000 rounds, random salt) → 64 bytes: a cipher key and a separate check key.
     The card is scrambled with an HMAC-SHA256 keystream (counter mode) and sealed with an HMAC-SHA256 tag
     (encrypt, then seal). Everything is SHA-256, so it also works on plain-http pages (the laptop over home Wi-Fi),
     where the browser's own crypto is switched off. Sources: NIST SP 800-132, NIST SP 800-108, RFC 2104, OWASP. */
  // Round constants and starting values: fractional parts of the cube and square roots of the first primes (FIPS 180-4).
  var PR = []; for(var n=2; PR.length<64; n++){ if(PR.every(function(q){ return n%q; })) PR.push(n); }
  var K = new Uint32Array(PR.map(function(q){ return (Math.cbrt(q)%1)*4294967296; }));
  var IV0 = PR.slice(0,8).map(function(q){ return ((Math.sqrt(q)%1)*4294967296)|0; });
  var W = new Uint32Array(64);
  function block(st, w16){
    for(var i=0;i<16;i++) W[i]=w16[i];
    for(i=16;i<64;i++){ var a=W[i-15], b=W[i-2];
      W[i]=(((a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3))+W[i-7]+((b>>>17|b<<15)^(b>>>19|b<<13)^(b>>>10))+W[i-16])|0; }
    var A=st[0],B=st[1],C=st[2],D=st[3],E=st[4],F=st[5],G=st[6],H=st[7];
    for(i=0;i<64;i++){
      var t1=(H+((E>>>6|E<<26)^(E>>>11|E<<21)^(E>>>25|E<<7))+((E&F)^(~E&G))+K[i]+W[i])|0;
      var t2=(((A>>>2|A<<30)^(A>>>13|A<<19)^(A>>>22|A<<10))+((A&B)^(A&C)^(B&C)))|0;
      H=G;G=F;F=E;E=(D+t1)|0;D=C;C=B;B=A;A=(t1+t2)|0;
    }
    st[0]=(st[0]+A)|0;st[1]=(st[1]+B)|0;st[2]=(st[2]+C)|0;st[3]=(st[3]+D)|0;st[4]=(st[4]+E)|0;st[5]=(st[5]+F)|0;st[6]=(st[6]+G)|0;st[7]=(st[7]+H)|0;
  }
  function sha256(bytes, state, prefixLen){
    var st = state ? state.slice() : IV0.slice(), n = bytes.length, total = n + (prefixLen||0);
    var padded = new Uint8Array(((n+9+63)>>6)<<6); padded.set(bytes); padded[n]=0x80;
    var bits = total*8, dv = new DataView(padded.buffer);
    dv.setUint32(padded.length-8, Math.floor(bits/4294967296)); dv.setUint32(padded.length-4, bits>>>0);
    var w = new Uint32Array(16);
    for(var o=0;o<padded.length;o+=64){ for(var i=0;i<16;i++) w[i]=dv.getUint32(o+i*4); block(st,w); }
    var out = new Uint8Array(32), ov = new DataView(out.buffer); for(i=0;i<8;i++) ov.setUint32(i*4, st[i]>>>0); return out;
  }
  function cat(){ var n=0,i; for(i=0;i<arguments.length;i++) n+=arguments[i].length; var o=new Uint8Array(n),p=0; for(i=0;i<arguments.length;i++){ o.set(arguments[i],p); p+=arguments[i].length; } return o; }
  function hmacKey(key){
    if(key.length>64) key = sha256(key);
    var k = new Uint8Array(64); k.set(key);
    var ip = new Uint8Array(64), op = new Uint8Array(64); for(var i=0;i<64;i++){ ip[i]=k[i]^0x36; op[i]=k[i]^0x5c; }
    function pre(pad){ var st=IV0.slice(), w=new Uint32Array(16), dv=new DataView(pad.buffer); for(var i=0;i<16;i++) w[i]=dv.getUint32(i*4); block(st,w); return st; }
    return {i:pre(ip), o:pre(op)};
  }
  function hmac(hk, msg){ return sha256(sha256(msg, hk.i, 64), hk.o, 64); }
  async function pbkdf2(pass, salt, rounds, len){
    var pw = new TextEncoder().encode(pass);
    try{ if(typeof crypto!=="undefined" && crypto.subtle){
      var k = await crypto.subtle.importKey("raw", pw, "PBKDF2", false, ["deriveBits"]);
      return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", salt:salt, iterations:rounds}, k, len*8)); } }catch(e){}
    // Same result without the browser's crypto (plain-http pages), on 32-bit words with no copying. A few seconds on a phone.
    var hk = hmacKey(pw), out = new Uint8Array(len), dv = new DataView(out.buffer), wi = new Uint32Array(16), wo = new Uint32Array(16), st = new Int32Array(8);
    wi[8] = wo[8] = 0x80000000; wi[15] = wo[15] = 768;
    for(var b=1, p=0; p<len; b++){
      var u0 = hmac(hk, cat(salt, new Uint8Array([b>>>24,b>>>16&255,b>>>8&255,b&255]))), uv = new DataView(u0.buffer), u = new Uint32Array(8), t = new Uint32Array(8), j;
      for(j=0;j<8;j++) t[j] = u[j] = uv.getUint32(j*4);
      for(var r=1;r<rounds;r++){
        for(j=0;j<8;j++){ wi[j]=u[j]; st[j]=hk.i[j]; } block(st, wi);
        for(j=0;j<8;j++){ wo[j]=st[j]; st[j]=hk.o[j]; } block(st, wo);
        for(j=0;j<8;j++){ u[j]=st[j]; t[j]^=st[j]; }
        if(r%50000===0) await new Promise(function(res){ setTimeout(res,0); });
      }
      for(j=0;j<8 && p<len;j++,p+=4) dv.setUint32(p, t[j]);
    }
    return out;
  }
  function stream(hk, iv, data){
    var out = new Uint8Array(data.length);
    for(var c=0, p=0; p<data.length; c++){ var ks = hmac(hk, cat(iv, new Uint8Array([c>>>24,c>>>16&255,c>>>8&255,c&255])));
      for(var j=0;j<32 && p<data.length;j++,p++) out[p]=data[p]^ks[j]; }
    return out;
  }
  var ROUNDS = 600000, MAGIC = "DHC1.";
  function b64u(bytes){ var s=""; for(var i=0;i<bytes.length;i++) s+=String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
  function unb64u(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; var b=atob(s), o=new Uint8Array(b.length); for(var i=0;i<b.length;i++) o[i]=b.charCodeAt(i); return o; }
  async function squeeze(bytes, back){
    var C = back ? window.DecompressionStream : window.CompressionStream; if(!C) throw new Error("old browser");
    var s = new Blob([bytes]).stream().pipeThrough(new C("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function rand(n){ var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function normPass(p){ return String(p||"").trim().toLowerCase().replace(/[\s_.]+/g,"-"); }
  // Card text: DHC1. + base64url(flags | salt 16 | iv 16 | sealed text | tag 32). flags bit 1 = squeezed (deflate).
  async function lock(obj, pass){
    var plain = new TextEncoder().encode(JSON.stringify(obj)), flags = 0;
    try{ var z = await squeeze(plain); if(z.length < plain.length){ plain = z; flags = 1; } }catch(e){}
    var salt = rand(16), iv = rand(16), keys = await pbkdf2(normPass(pass), salt, ROUNDS, 64);
    var head = cat(new Uint8Array([flags]), salt, iv), ct = stream(hmacKey(keys.subarray(0,32)), iv, plain);
    var tag = hmac(hmacKey(keys.subarray(32)), cat(head, ct));
    return MAGIC + b64u(cat(head, ct, tag));
  }
  function cardText(s){ var m = String(s||"").match(/DHC1\.[A-Za-z0-9_-]+/); return m ? m[0] : ""; }
  async function unlock(text, pass){
    var t = cardText(text); if(!t) throw new Error("notcard");
    var all = unb64u(t.slice(MAGIC.length)); if(all.length < 1+16+16+32+2) throw new Error("notcard");
    var head = all.subarray(0,33), ct = all.subarray(33, all.length-32), tag = all.subarray(all.length-32);
    var keys = await pbkdf2(normPass(pass), head.subarray(1,17), ROUNDS, 64);
    var want = hmac(hmacKey(keys.subarray(32)), cat(head, ct)), diff = 0;
    for(var i=0;i<32;i++) diff |= want[i]^tag[i];
    if(diff) throw new Error("passcode");
    var plain = stream(hmacKey(keys.subarray(0,32)), head.subarray(17,33), ct);
    if(head[0]&1) plain = await squeeze(plain, true);
    return JSON.parse(new TextDecoder().decode(plain));
  }
  // Passcodes: four words and two digits, about 38 bits. Read aloud, never sent with the card.
  var WORDS = ("acorn amber anchor apple arch arrow aspen autumn badge bagel bamboo banjo barn basil basket beacon beaver bell berry birch bison "
    +"blanket bloom blue boat bonnet boulder branch brave breeze brick bridge brook bubble bucket buffalo bugle bunny butter button cabin cactus "
    +"camel candle canoe canyon cape cargo carrot castle cedar cello chalk cherry chess chime cider cinder circle clay cliff clock cloud clover "
    +"cobalt cocoa comet compass coral cotton cougar cove coyote crane crater creek cricket crow crystal cub cypress daisy dawn deer desert dew "
    +"dingo dolphin dove dragon drum dune eagle easel echo elk ember emerald falcon fawn feather fern fiddle field finch fire fjord flame flint "
    +"flute fog forest fossil fox frost garden garnet gecko geyser ginger glacier glade globe goose granite grape grove gull harbor harp hawk "
    +"hazel heron hickory hill honey horizon hornet iris island ivory ivy jade jaguar jasper jelly juniper kayak kettle kite koala lagoon lake "
    +"lantern lark lava lemon lilac lily linen lion lizard llama lotus lynx magnet mango maple marble meadow mesa meteor mint mist moon moose "
    +"moss moth mountain mule nectar nest nickel oak oasis ocean olive onyx opal orbit orchid otter owl panda pebble pecan pelican penny pepper "
    +"piano pine planet plum pond poppy prairie puffin quail quartz quill rabbit radish rain raven reef ribbon ridge river robin rocket rose "
    +"ruby saddle sage salmon sand satin sequoia shell sierra silver sky sparrow spruce star stone storm summit sun swan tulip tundra turtle "
    +"thistle valley velvet violet walnut wave willow wind wren yarrow yucca zebra zinnia").split(" ");
  function newPass(){ var r = rand(6), w = []; for(var i=0;i<4;i++) w.push(WORDS[r[i]%WORDS.length]); return w.join("-")+"-"+String((r[4]*256+r[5])%90+10); }

  /* ---------- What a card holds ----------
     {v:1, id, n:name, a:adds, m:made, x:use-by date or "", i:[[kind "p"|"r", label, pack id or pattern, level, until, sources]]} */
  function cardFrom(me, items, days){
    var t = new Date(), x = days ? ymd(new Date(t.getTime()+days*864e5)) : "";
    return {v:1, id:me.id, n:String(me.name||"").slice(0,40), a:String(me.adds||"").slice(0,200), m:ymd(t), x:x,
      i:items.map(function(it){ return [it.pack?"p":"r", String(it.label||"").slice(0,80), it.pack||it.pat, it.level||"avoid", it.until||"", it.src||[]]; })};
  }
  // Turns an opened card into a person, checking every part (a card is someone else's data).
  function personFrom(c){
    if(!c || c.v!==1 || !Array.isArray(c.i)) throw new Error("notcard");
    if(c.x && c.x < ymd(new Date())) { var e = new Error("expired"); e.until = c.x; throw e; }
    var items = c.i.slice(0,200).map(function(a){
      if(!Array.isArray(a)) return null;
      var level = LEVELS[a[3]] ? a[3] : "avoid", until = /^\d{4}-\d{2}-\d{2}$/.test(a[4]||"") ? a[4] : "", src = Array.isArray(a[5]) ? a[5].filter(function(s){ return typeof s==="string"; }).slice(0,5) : [];
      if(a[0]==="p") return PACKS[a[2]] ? {label:String(a[1]||PACKS[a[2]].name).slice(0,80), pack:a[2], level:level, until:until, src:src} : null;
      var pat = String(a[2]||"").slice(0,3000); try{ boundary(pat); }catch(e){ return null; }
      return pat ? {label:String(a[1]||"").slice(0,80), pat:pat, level:level, until:until, src:src} : null;
    }).filter(Boolean);
    return {id:String(c.id||"").slice(0,40)||("c"+Date.now()), name:String(c.n||"Someone").slice(0,40), adds:String(c.a||"").slice(0,200),
      src:"card", made:c.m||"", got:ymd(new Date()), shared:true, items:items};
  }

  return {PACKS:PACKS, PRESETS:PRESETS, LEVELS:LEVELS, ymd:ymd, esc:esc, wordPat:wordPat, wordsPat:wordsPat,
    compile:compile, check:check, blank:blank, fix:fix, atTable:atTable, fromStorage:fromStorage, tableLines:tableLines, tableHtml:tableHtml, style:style,
    lock:lock, unlock:unlock, cardText:cardText, newPass:newPass, normPass:normPass, cardFrom:cardFrom, personFrom:personFrom,
    _t:{sha256:sha256, hmacKey:hmacKey, hmac:hmac, pbkdf2:pbkdf2}};
})();
