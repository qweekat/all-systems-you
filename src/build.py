"""Builds the shared all systems you web app into one folder that works offline once opened.
Usage: python3 build.py <out_dir>
- index.html    all systems you (from helper.html)
- pantry.html   Pantry Meal Planner (pantry.template.html + the checker's starter lists and food table)
- checker.html  Meal Plan Checker
- manifest.webmanifest, sw.js, icons/  so phones and computers can install it and use it offline."""
import os, shutil, sys
here = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
os.makedirs(os.path.join(out, 'icons'), exist_ok=True)
APP_NAME = 'all systems you'
TAGLINE = "Your health is complicated. Managing it shouldn't be."

def brand(s):
    """Shared code (phone.js, household/) also goes into a personal copy of the app, so its old name is swapped here, at build time."""
    return s.replace("the Daily Helper's", "the app's").replace('the Daily Helper', 'the app').replace('Daily Helper', APP_NAME)


HEAD = ('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#2f6b57">\n'
        '<link rel="icon" href="icons/daily-helper.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="icons/icon-180.png">\n')
SW = ('<script>if ("serviceWorker" in navigator && location.protocol.startsWith("http")) '
      'navigator.serviceWorker.register("sw.js").catch(()=>{});</script>\n')

# Bottom bar on every page: an iPhone home-screen app has no back button, so there is always a way around.
NAV = """<nav class="botnav" aria-label="App">
<a href="index.html#today" data-nav="today"><span aria-hidden="true">☀</span>Today</a>
<a href="pantry.html#grocery" data-nav="grocery"><span aria-hidden="true">🛒</span>Grocery</a>
<a href="pantry.html" data-nav="pantry"><span aria-hidden="true">🥫</span>Pantry</a>
<a href="checker.html" data-nav="checker"><span aria-hidden="true">✓</span>Checker</a>
<a href="index.html#more" data-nav="more"><span aria-hidden="true">☰</span>More</a>
</nav>
<style>
.botnav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface,#fff);border-top:1px solid var(--line,#d9dfd8);padding-bottom:env(safe-area-inset-bottom,0px)}
.botnav a{min-height:56px;display:grid;place-items:center;align-content:center;gap:2px;font-size:.78rem;color:var(--muted,#5b6b62);text-decoration:none}
.botnav a span{font-size:1.2rem;line-height:1}
.botnav a[aria-current="page"]{color:var(--accent,#2f6b57);font-weight:700;box-shadow:inset 0 3px 0 var(--accent,#2f6b57)}
body{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}
@media print{.botnav{display:none!important} body{padding-bottom:0}}
</style>
<script>
(function(){
  function mark(){
    var f = location.pathname.split("/").pop() || "index.html", h = location.hash.slice(1), cur;
    if (f.indexOf("pantry") === 0) cur = h === "grocery" || /[?&]grocery/.test(location.search) ? "grocery" : "pantry";
    else if (f.indexOf("checker") === 0) cur = "checker";
    else if (f.indexOf("sources") === 0) cur = "more";
    else cur = h === "today" || h === "quick" || h === "tomorrow" || h === "" ? "today" : "more";
    document.querySelectorAll(".botnav a").forEach(function(a){ if (a.dataset.nav === cur) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  }
  mark(); window.addEventListener("hashchange", mark); window.addEventListener("dh-nav", mark);
})();
</script>
"""
SW = SW + NAV

def wrap_body_page(src):
    """helper.html and checker.html are written as page bodies: head bits, then <style>, then markup."""
    e = src.index('</style>') + len('</style>')
    return '<!doctype html>\n<html lang="en">\n<head>\n' + HEAD + src[:e] + '\n</head>\n<body>\n' + src[e:] + '\n' + SW + '</body>\n</html>\n'

def add_to_full_page(src):
    src = src.replace('<head>\n', '<head>\n' + HEAD.replace('<meta charset="utf-8">\n', '').replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', ''), 1)
    return src.replace('</body>', SW + '</body>', 1)

import json, html
CHANGELOG = json.load(open(os.path.join(here, 'changelog.json')))['changes']
VERSION = CHANGELOG[0]['v']   # the newest changelog entry is the app's version
SOURCES = json.load(open(os.path.join(here, 'sources.json')))['sources']
chk = open(os.path.join(here, 'checker.html')).read()
assert '/*SOURCES*/{}' in chk
def short(x):
    # Books and articles go by title (italic in print); websites by who publishes them.
    return x['title'].split(':')[0] if x['kind'] in ('Book', 'Journal article') else x['org'].split(' (')[0]
chk = chk.replace('/*SOURCES*/{}', json.dumps({x['id']: {'short': short(x), 'url': x.get('url', ''), 'status': x['status']} for x in SOURCES}))
tpl = open(os.path.join(here, 'pantry.template.html')).read()
i = chk.index('  // ---------- Starter lists.'); j = chk.index('  // Your own rules go first:', i)
packs = chk[i:j].rstrip('\n')
foods_end = "].map(([id, name, unit, c, f, gi, o]) => { const { s: _s, w: _w, ...rest } = o; return { id, name, unit, c, f, gi, ...rest }; });"
i = chk.index('const FOODS = ') + len('const FOODS = '); j = chk.index(foods_end, i)
foods = chk[i:j] + foods_end[:-1]
assert '/*PACKS*/' in tpl and '/*FOODS*/' in tpl
pantry = tpl.replace('/*PACKS*/', packs).replace('/*FOODS*/', foods)

import re
def pack_pats(js):
    """Starter list patterns for the helper's food breaks: {id: {name, avoid: [...], ok: [...]}}. Reads the checker's STARTER_PACKS."""
    out = {}
    for m in re.finditer(r"^    (\w+): \{ name: '([^']*)', rules: \[(.*?)^    \] \},", js, re.S | re.M):
        rules = re.findall(r"\['(\w+)', '((?:[^'\\]|\\.)*)'", m.group(3))
        un = lambda x: x.replace("\\'", "'").replace('\\\\', '\\')
        out[m.group(1)] = {'name': m.group(2).replace(' (draft)', ''), 'avoid': [un(p) for l, p in rules if l == 'avoid'], 'ok': [un(p) for l, p in rules if l == 'ok']}
    return out
helper = open(os.path.join(here, 'helper.html')).read()
assert '/*PACKPATS*/{}' in helper
helper = helper.replace('/*PACKPATS*/{}', json.dumps(pack_pats(packs)))
assert '/*APPVERSION*/"dev"' in helper and '/*CHANGES*/[]' in helper
helper = helper.replace('/*APPVERSION*/"dev"', json.dumps(VERSION)).replace('/*CHANGES*/[]', json.dumps(CHANGELOG))
helper = helper.replace('</footer>', ' <span class="appver">Version ' + VERSION + '.</span></footer>', 1)
# Household (people you share meals with, food cards): one copy of the code in household/, shared with a personal copy of the app.
HH_CORE = open(os.path.join(here, 'household', 'hh-core.js')).read().replace('/*HH-PACKS*/{}', json.dumps(pack_pats(packs)))
HH_UI = open(os.path.join(here, 'household', 'hh-ui.js')).read()
assert '/*HOUSEHOLD*/' in helper
helper = helper.replace('/*HOUSEHOLD*/', HH_CORE + HH_UI)
assert '/*HOUSEHOLD*/' in chk and '/*HOUSEHOLD*/' in pantry
chk = chk.replace('/*HOUSEHOLD*/', HH_CORE)
pantry = pantry.replace('/*HOUSEHOLD*/', HH_CORE)
shutil.copy(os.path.join(here, 'household', 'qrcode.js'), os.path.join(out, 'qrcode.js'))
import phone_patch
helper = brand(phone_patch.patch(helper))
chk, pantry = brand(chk), brand(pantry)
open(os.path.join(out, 'index.html'), 'w').write(wrap_body_page(helper))
open(os.path.join(out, 'checker.html'), 'w').write(wrap_body_page(chk))
open(os.path.join(out, 'pantry.html'), 'w').write(add_to_full_page(pantry))
def sources_page():
    """One page listing every source, grouped by what it supports."""
    e = html.escape
    topics = {}
    for x in SOURCES:
        for t in x['topics']: topics.setdefault(t, []).append(x)
    def item(x):
        name = f'<a href="{e(x["url"])}" target="_blank" rel="noopener">{e(x["title"])}</a>' if x['url'] else e(x['title'])
        tag = ' <span class="tag">to be added</span>' if x['status'] == 'pending' else ' <span class="tag ref">background reading</span>' if x['status'] == 'reference' else ''
        note = f'<p class="note">{e(x["note"])}</p>' if x.get('note') else ''
        return f'<li id="{e(x["id"])}"><div>{name}{tag}</div><div class="meta">{e(x["org"])} · {e(x["kind"])}</div>{note}</li>'
    body = ''.join(f'<section><h2>{e(t)}</h2><ol>{"".join(item(x) for x in xs)}</ol></section>' for t, xs in sorted(topics.items()))
    return f"""<!doctype html>
<html lang="en">
<head>
{HEAD}<title>{APP_NAME}: Sources</title>
<style>
/* One reading column; each topic is a short numbered list of the sources behind it. */
:root{{ --bg:#f3f5f2; --surface:#ffffff; --line:#d9dfd8; --ink:#1d2a24; --muted:#5b6b62; --accent:#2f6b57; --warn:#9a5b00; --warn-soft:#fbf0dc;
  --body:"Atkinson Hyperlegible","Ubuntu","Segoe UI",system-ui,sans-serif; }}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{ --bg:#141a17; --surface:#1c2420; --line:#2f3a34; --ink:#e4ebe6; --muted:#9fb0a6; --accent:#7cc4a7; --warn:#f0b75c; --warn-soft:#3a2d16; color-scheme:dark }}}}
:root[data-theme="dark"]{{ --bg:#141a17; --surface:#1c2420; --line:#2f3a34; --ink:#e4ebe6; --muted:#9fb0a6; --accent:#7cc4a7; --warn:#f0b75c; --warn-soft:#3a2d16; color-scheme:dark }}
body{{ margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 var(--body); }}
.wrap{{ max-width:44rem; margin:0 auto; padding-block:24px 48px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); display:grid; gap:20px; }}
h1{{ margin:0; font-size:1.6rem; text-wrap:balance }} h2{{ margin:0 0 8px; font-size:1.05rem; letter-spacing:.02em }}
nav a, a{{ color:var(--accent) }} p{{ margin:0 }}
section{{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }}
ol{{ margin:0; padding-left:1.3rem; display:grid; gap:10px }} .meta,.lede{{ color:var(--muted) }} .meta{{ font-size:.9rem }}
.note{{ font-size:.9rem; color:var(--muted); margin-top:2px }}
.tag.ref{{ background:var(--line); color:var(--muted) }}
.tag{{ font-size:.75rem; background:var(--warn-soft); color:var(--warn); border-radius:999px; padding:1px 8px; margin-left:6px; white-space:nowrap }}
</style>
</head>
<body>
<div class="wrap">
<nav><a href="index.html">{APP_NAME}</a> · <a href="pantry.html">Pantry Meal Planner</a> · <a href="checker.html">Meal Plan Checker</a></nav>
<h1>Sources</h1>
<p class="lede">Every outside resource the app's starter lists, food numbers and warnings come from. Starter lists are drafts until a clinician reviews them. This app is not medical advice.</p>
{body}
</div>
{SW}</body>
</html>
"""
open(os.path.join(out, 'sources.html'), 'w').write(sources_page())
for f in os.listdir(os.path.join(here, 'icons')):
    shutil.copy(os.path.join(here, 'icons', f), os.path.join(out, 'icons', f))
open(os.path.join(out, 'manifest.webmanifest'), 'w').write('''{
  "name": "%s",
  "short_name": "%s",
  "description": "%s Open-source, whole-life health planning for real humans with real complexity. Your data stays on your device.",
  "start_url": "index.html",
  "display": "standalone",
  "background_color": "#f3f5f2",
  "theme_color": "#2f6b57",
  "icons": [
    {"src": "icons/icon-180.png", "sizes": "180x180", "type": "image/png"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "icons/daily-helper.svg", "sizes": "any", "type": "image/svg+xml"}
  ]
}
''' % (APP_NAME, APP_NAME, TAGLINE))
# The cache name carries a hash of the built files, so installed phones pick up each new build.
import hashlib
_h = hashlib.sha256()
for _f in ['index.html', 'pantry.html', 'checker.html', 'sources.html', 'manifest.webmanifest', 'qrcode.js']:
    _h.update(open(os.path.join(out, _f), 'rb').read())
import datetime
BUILD = VERSION + '-' + datetime.date.today().isoformat() + '-' + _h.hexdigest()[:8]
# The build id goes in after hashing, so it can name the hash.
_ix = os.path.join(out, 'index.html'); _t = open(_ix).read()
if '/*APPBUILD*/""' in _t: open(_ix, 'w').write(_t.replace('/*APPBUILD*/""', json.dumps(BUILD)))
open(os.path.join(out, 'VERSION.txt'), 'w').write('all systems you ' + VERSION + '\nbuild ' + BUILD + '\n')
open(os.path.join(out, 'sw.js'), 'w').write('''// Keeps the app's own files on the device so it opens with no internet. Health data is never sent anywhere.
const CACHE = "all-systems-you-%s";
const FILES = ["./", "index.html", "pantry.html", "checker.html", "sources.html", "manifest.webmanifest", "qrcode.js", "icons/icon-180.png", "icons/icon-512.png", "icons/daily-helper.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and anything else outside the app: browser default
  if (url.pathname.includes("/api/")) return; // a computer host's live data, never cached
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  })));
});
''' % BUILD)
print('built', out, BUILD)
