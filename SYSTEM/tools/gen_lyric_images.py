#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render lirik lagu (jadwal aktif Flow) jadi gambar PNG gaya panel Flow:
dark background, judul salmon, label VERSE/CHORUS/BRIDGE/ENDING berwarna, kartu rounded."""
import json, os, re, textwrap, urllib.request
from PIL import Image, ImageDraw, ImageFont

BASE = "http://127.0.0.1:7080"
OUT = r"C:\webdev\flow\DATA\preview\png"
os.makedirs(OUT, exist_ok=True)

F_REG = r"C:\Windows\Fonts\segoeui.ttf"
F_BLD = r"C:\Windows\Fonts\segoeuib.ttf"

W, PAD = 900, 28
CARD_PX, CARD_PY = 24, 20
BG, CARD, BORDER, ACTIVE = (20,20,20), (30,30,30), (43,43,43), (255,138,128)
TXT, TITLE, META = (245,245,245), (255,138,128), (111,126,114)
LBL = {"v":"VERSE","c":"CHORUS","b":"BRIDGE","e":"ENDING","i":"INTRO"}
CLR = {"v":(126,231,135),"c":(242,204,96),"b":(255,158,205),"e":(102,217,232),"i":(199,146,234)}

f_title = ImageFont.truetype(F_BLD, 30)
f_lbl   = ImageFont.truetype(F_BLD, 15)
f_lyr   = ImageFont.truetype(F_REG, 24)
f_meta  = ImageFont.truetype(F_BLD, 14)

LH = 38          # line height lirik
LBL_H = 24       # tinggi label section
GAP_CARD = 14

def wrap(draw, text, font, maxw):
    out = []
    for raw in text.split("\n"):
        if not raw.strip():
            out.append("")
            continue
        words, line = raw.split(), ""
        for w in words:
            t = (line + " " + w).strip()
            if draw.textlength(t, font=font) <= maxw:
                line = t
            else:
                if line: out.append(line)
                line = w
        out.append(line)
    return out

def groups(lyrics):
    res, i = [], 0
    while i < len(lyrics):
        typ = lyrics[i].get("type","v"); grp=[]; j=i
        while j < len(lyrics):
            grp.append(lyrics[j]); j += 1
            if j < len(lyrics) and lyrics[j].get("newGroup"): break
        res.append((typ, grp)); i = j
    return res

def render(title, lyrics, path):
    tmp = ImageDraw.Draw(Image.new("RGB",(10,10)))
    inner = W - 2*PAD - 2*CARD_PX

    # header
    title_lines = wrap(tmp, title, f_title, inner - 160)
    head_h = max(74, len(title_lines)*40 + 30)

    # 1 KARTU PER BAIT — label hanya di AWAL SEKSI (newGroup=True)
    cards = []
    for sl in lyrics:
        typ = sl.get("type", "v")
        show_lbl = bool(sl.get("newGroup"))
        lines = wrap(tmp, sl.get("text",""), f_lyr, inner)
        h = CARD_PY*2 + len(lines)*LH + ((LBL_H + 8) if show_lbl else 0)
        cards.append((typ, lines, h, show_lbl))

    total = PAD + head_h + 18 + sum(c[2] for c in cards) + GAP_CARD*(len(cards)-1) + PAD
    img = Image.new("RGB", (W, total), BG)
    d = ImageDraw.Draw(img)

    # header card
    d.rounded_rectangle([PAD, PAD, W-PAD, PAD+head_h], radius=16, fill=CARD)
    y = PAD + 15
    for tl in title_lines:
        d.text((PAD+24, y), tl, font=f_title, fill=TITLE); y += 40
    meta = f"{len(cards)} bait"
    d.text((W-PAD-24-d.textlength(meta, font=f_meta), PAD+head_h/2-9), meta, font=f_meta, fill=META)

    y = PAD + head_h + 18
    for typ, lines, h, show_lbl in cards:
        d.rounded_rectangle([PAD, y, W-PAD, y+h], radius=14, fill=CARD,
                            outline=BORDER, width=1)
        ty = y + CARD_PY
        if show_lbl:
            d.text((PAD+CARD_PX, ty), LBL.get(typ,"VERSE"), font=f_lbl, fill=CLR.get(typ,(126,231,135)))
            ty += LBL_H + 8
        for ln in lines:
            if ln:
                d.text((PAD+CARD_PX, ty), ln, font=f_lyr, fill=TXT)
            ty += LH
        y += h + GAP_CARD

    img.save(path, "PNG")
    return path

def slug(t):
    return (re.sub(r"[^A-Za-z0-9]+","-",t).strip("-")[:80] or "lagu")

def main():
    with urllib.request.urlopen(BASE + "/api/schedule", timeout=20) as r:
        sched = json.loads(r.read().decode("utf-8"))
    n = 0
    for it in sched:
        if str(it.get("type","")).upper() != "SONG": continue
        title = str(it.get("title") or "")
        if "Pengumuman" in title: continue
        lyr = it.get("data",{}).get("lyrics") or []
        if not lyr: continue
        p = os.path.join(OUT, slug(title) + ".png")
        print("OK", render(title, lyr, p))
        n += 1
    print("TOTAL:", n)

if __name__ == "__main__":
    main()
