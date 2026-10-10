#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate HTML lirik gaya panel Flow (dark, label section berwarna) untuk lagu-lagu
yang ada di jadwal aktif. Output: DATA/preview/<slug>.html  (siap di-screenshot)."""
import json, os, re, urllib.request, html

BASE = "http://127.0.0.1:7080"
OUT  = r"C:\webdev\flow\DATA\preview"
os.makedirs(OUT, exist_ok=True)

LBL = {"v": "VERSE", "c": "CHORUS", "b": "BRIDGE", "e": "ENDING", "i": "INTRO"}
CLR = {"v": "#7ee787", "c": "#f2cc60", "b": "#ff9ecd", "e": "#66d9e8", "i": "#c792ea"}

TPL = """<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<title>{title}</title>
<style>
  * {{ box-sizing: border-box; margin:0; padding:0; }}
  body {{ background:#141414; font-family: 'Inter','Segoe UI',system-ui,sans-serif; padding:28px; }}
  .wrap {{ max-width: 880px; margin:0 auto; }}
  .head {{ background:#1e1e1e; border-radius:16px; padding:20px 24px; margin-bottom:18px;
           display:flex; align-items:center; justify-content:space-between; }}
  .title {{ color:#ff8a80; font-size:26px; font-weight:700; letter-spacing:.2px; }}
  .meta {{ color:#6f7e72; font-size:13px; font-weight:600; }}
  .card {{ background:#1e1e1e; border:1px solid #2b2b2b; border-radius:14px; padding:18px 22px;
           margin-bottom:14px; }}
  .card.active {{ border-color:#ff8a80; }}
  .lbl {{ font-size:12px; font-weight:800; letter-spacing:1.4px; margin-bottom:12px; }}
  .lyr {{ color:#f5f5f5; font-size:21px; line-height:1.55; white-space:pre-wrap; }}
  .stanza {{ margin-bottom:14px; }}
  .stanza:last-child {{ margin-bottom:0; }}
</style></head>
<body><div class="wrap">
  <div class="head"><div class="title">{title}</div><div class="meta">{count} bagian</div></div>
  {cards}
</div></body></html>"""

def get_schedule():
    with urllib.request.urlopen(BASE + "/api/schedule", timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

def slug(t):
    s = re.sub(r"[^A-Za-z0-9]+", "-", t).strip("-")
    return s[:80] or "lagu"

def render(title, lyrics):
    cards, first = [], True
    i = 0
    while i < len(lyrics):
        typ = lyrics[i].get("type", "v")
        # kumpulkan slide sampai ada newGroup berikutnya
        group = []
        j = i
        while j < len(lyrics):
            group.append(lyrics[j])
            j += 1
            if j < len(lyrics) and lyrics[j].get("newGroup"):
                break
        stanzas = "\n".join(
            '<div class="stanza">%s</div>' % html.escape(sl.get("text", "")).replace("\n", "\n")
            for sl in group
        )
        cards.append(
            '<div class="card%s"><div class="lbl" style="color:%s">%s</div><div class="lyr">%s</div></div>'
            % (" active" if first else "", CLR.get(typ, "#7ee787"), LBL.get(typ, "VERSE"), stanzas)
        )
        first = False
        i = j
    return TPL.format(title=html.escape(title), count=len(cards), cards="\n".join(cards))

def main():
    sched = get_schedule()
    out = []
    for it in sched:
        if str(it.get("type", "")).upper() != "SONG":
            continue
        title = str(it.get("title") or "")
        lyrics = it.get("data", {}).get("lyrics") or []
        if not lyrics:
            continue
        p = os.path.join(OUT, slug(title) + ".html")
        with open(p, "w", encoding="utf-8") as f:
            f.write(render(title, lyrics))
        out.append(p)
        print("OK", p)
    print("TOTAL:", len(out))

if __name__ == "__main__":
    main()
