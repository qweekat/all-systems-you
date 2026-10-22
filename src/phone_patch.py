"""Adds the phone pieces to the helper page: a Quick tab, ?do= links for iPhone Shortcuts, a Phone shortcuts page,
and backups through the share sheet. The code is phone.js (shared with a personal phone build) plus adapter-phone.js."""
import os

here = os.path.dirname(os.path.abspath(__file__))

QUICK_CSS = """
.qlist{display:grid;gap:8px}
.qrow{font:inherit;display:grid;grid-template-columns:32px 72px 1fr;align-items:center;gap:8px;text-align:left;min-height:56px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);cursor:pointer;touch-action:manipulation}
.qrow .qtick{width:28px;height:28px;border-radius:8px;border:2px solid var(--juniper,#2f6b57);display:grid;place-items:center;font-weight:700;color:var(--surface)}
.qrow.on{background:var(--juniper-soft,#e1eee8)}
.qrow.on .qtick{background:var(--juniper,#2f6b57)}
.qrow.on .qn{color:var(--done,#8a978f);text-decoration:line-through}
.qrow .qt{font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted)}
.qrow .qn{font-weight:700;min-width:0}
</style>"""


def sub1(src, old, new):
    assert src.count(old) == 1, 'phone_patch: expected text once: ' + old[:100]
    return src.replace(old, new)


def patch(src):
    src = sub1(src, '<button role="tab" data-tab="today" aria-selected="true">Today</button>',
               '<button role="tab" data-tab="today" aria-selected="true">Today</button>\n    <button role="tab" data-tab="quick" aria-selected="false">Quick</button>')
    src = sub1(src, 'const TAB_IDS = ["today",', 'const TAB_IDS = ["today","quick","phone",')
    src = sub1(src, 'const navTab = TAB==="today"||TAB==="tomorrow" ? TAB : "more";', 'const navTab = TAB==="today"||TAB==="quick"||TAB==="tomorrow" ? TAB : "more";')
    src = sub1(src, '  if(TAB==="today") renderDay(0);', '  if(TAB==="quick") renderQuick();\n  else if(TAB==="phone") renderPhone();\n  else if(TAB==="today") renderDay(0);')
    src = sub1(src, '["settings","Times & reminders","Times, water, rhythm, backups"]];',
               '["settings","Times & reminders","Times, water, rhythm, backups"],["phone","Phone shortcuts","One-tap buttons, reminders, backups"]];')
    src = sub1(src, 'await load(); dailyBackup();', 'await load(); phoneAfterLoad(); dailyBackup();')
    i = src.rindex('\n(async ()=>{')
    src = src[:i] + '\n' + open(os.path.join(here, 'adapter-phone.js')).read() + open(os.path.join(here, 'phone.js')).read() + src[i:]
    return sub1(src, '</style>', QUICK_CSS) if src.count('</style>') == 1 else src.replace('</style>', QUICK_CSS, 1)
