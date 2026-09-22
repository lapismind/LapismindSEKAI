# -*- coding: utf-8 -*-
"""把 GPT 出的白天/夜间图适配进卡片。

两张的人物形状不同（白天 0.92 近方、夜间 0.51 瘦高），所以**不能按外框对齐**，
要分别给高度和水平偏移：让她的身体落在右侧槽位，马尾溢出右边被卡片切掉。

用法：
    & $PY mock-gpt.py [白天高度] [白天右溢] [夜间高度] [夜间下移]
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
DAY = HERE / "gpt" / "gpt-day.png"
NIGHT = HERE / "gpt" / "gpt-night.png"
OUT = HERE / "card-gpt.png"

CW, CH = 760, 559
WATER_Y = 282


def oklch(L, C, H):
    h = math.radians(H)
    a, b = C * math.cos(h), C * math.sin(h)
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    lin = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)

    def enc(v):
        v = max(0.0, min(1.0, v))
        v = 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
        return int(round(v * 255))

    return tuple(enc(v) for v in lin)


LIGHT = dict(air=oklch(0.985, 0.006, 252), shallow=oklch(0.935, 0.05, 202),
             deep=oklch(0.862, 0.08, 212), tint=oklch(0.70, 0.10, 208),
             ink=oklch(0.30, 0.02, 250))
DARK = dict(air=oklch(0.34, 0.055, 283), shallow=oklch(0.21, 0.035, 245),
            deep=oklch(0.15, 0.025, 245), tint=oklch(0.24, 0.09, 235),
            ink=oklch(0.90, 0.01, 250))


def base_card(p):
    im = Image.new("RGB", (CW, CH))
    px = im.load()
    for y in range(CH):
        for x in range(CW):
            if y < WATER_Y:
                px[x, y] = p["air"]
            else:
                t = (y - WATER_Y) / (CH - WATER_Y)
                px[x, y] = tuple(int(p["shallow"][i] + (p["deep"][i] - p["shallow"][i]) * t)
                                 for i in range(3))
    return im


def wave(amp, period, phase):
    m = Image.new("L", (CW, CH), 0)
    pts = [(x, WATER_Y + amp * math.sin(2 * math.pi * x / period + phase)) for x in range(CW)]
    ImageDraw.Draw(m).line(pts, fill=255, width=9, joint="curve")
    return m.filter(ImageFilter.GaussianBlur(2))


def bubbles(layer, cx, top, bot, seeds, alpha=70):
    d = ImageDraw.Draw(layer)
    for i, s in enumerate(seeds):
        t = i / max(1, len(seeds) - 1)
        x = cx + (s - 0.5) * 190
        y = bot - t * (bot - top)
        r = 2 + ((i * 5) % 4) * 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))
        d.ellipse([x - r, y - r, x - r + 2, y - r + 2], fill=(255, 255, 255, alpha + 80))


def text_blocks(im, p):
    lay = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    c = p["ink"] + (58,)
    d.rounded_rectangle([30, 30, 250, 60], 6, fill=c)
    d.rounded_rectangle([30, 70, 170, 84], 5, fill=c)
    for i in range(6):
        d.rounded_rectangle([30, 130 + i * 26, 430, 142 + i * 26], 4, fill=c)
    for i in range(2):
        d.rounded_rectangle([30, 320 + i * 52, 400, 336 + i * 52], 4, fill=c)
    im.alpha_composite(lay)


def panel(p, fig, fig_h, fy, over, tint_max, bub_n):
    """fig_h 人物高度；fy 头顶 y；over 右侧溢出卡片多少像素（马尾被切）"""
    im = base_card(p).convert("RGBA")
    f = fig.resize((max(1, int(fig.width * fig_h / fig.height)), fig_h), Image.LANCZOS)
    fx = CW - f.width + over

    fig_a = Image.new("L", (CW, CH), 0)
    fig_a.paste(f.getchannel("A"), (fx, fy))

    sh = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx + f.width * 0.15, CH - 78, fx + f.width * 0.85, CH + 14],
                               fill=(0, 0, 0, 62))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24)))

    im.alpha_composite(f, (fx, fy))

    tint = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    tp = tint.load()
    for y in range(WATER_Y, CH):
        a = int(24 + tint_max * (y - WATER_Y) / (CH - WATER_Y))
        for x in range(CW):
            tp[x, y] = p["tint"] + (a,)
    band = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(band).rectangle([0, WATER_Y, CW, CH], fill=255)
    cut = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    cut.paste(tint, (0, 0), ImageChops.multiply(fig_a, band))
    im.alpha_composite(cut)

    surf = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    surf.paste(Image.new("RGBA", (CW, CH), (255, 255, 255, 150)), (0, 0), wave(5, 150, 0))
    surf.paste(Image.new("RGBA", (CW, CH), tuple(p["shallow"]) + (135,)), (0, 0),
               wave(6, 210, 1.1).filter(ImageFilter.GaussianBlur(4)))
    im.alpha_composite(surf)

    bub = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    seeds = [0.18, 0.55, 0.82, 0.33, 0.70, 0.44, 0.90, 0.27, 0.62, 0.75][:bub_n]
    bubbles(bub, fx + f.width * 0.42, WATER_Y + 18, CH - 30, seeds)
    im.alpha_composite(bub)

    text_blocks(im, p)
    return im.convert("RGB"), (fx, fy, f.width, f.height)


def main():
    dh = int(sys.argv[1]) if len(sys.argv) > 1 else 469
    dfy = int(sys.argv[2]) if len(sys.argv) > 2 else 118
    dov = int(sys.argv[3]) if len(sys.argv) > 3 else 130
    nh = int(sys.argv[4]) if len(sys.argv) > 4 else 500
    nfy = int(sys.argv[5]) if len(sys.argv) > 5 else 120

    day = Image.open(DAY).convert("RGBA")
    night = Image.open(NIGHT).convert("RGBA")
    day = day.crop(day.getchannel("A").getbbox())
    night = night.crop(night.getchannel("A").getbbox())
    print("白天人物", day.size, round(day.width / day.height, 3))
    print("夜间人物", night.size, round(night.width / night.height, 3))

    a, ra = panel(LIGHT, day, dh, dfy, dov, 80, 7)
    b, rb = panel(DARK, night, nh, nfy, 40, 130, 10)
    print("白天贴入", ra, "  夜间贴入", rb)

    sheet = Image.new("RGB", (CW * 2 + 24, CH + 34), (250, 250, 250))
    sheet.paste(a, (0, 34))
    sheet.paste(b, (CW + 24, 34))
    sheet.save(OUT)
    print("saved", OUT, sheet.size)


if __name__ == "__main__":
    main()
