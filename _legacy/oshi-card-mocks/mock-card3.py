# -*- coding: utf-8 -*-
"""把抠好的人物「融进」卡片（第二版）。

相对上一版的修正：
  - 构图：头浮在水面之上、脚踩箱底、整身撑满卡片高度（用户要求"人要大"）
  - 水线：改成波浪（真实卡片是 .oshi-surface 的 SVG 浪，不是硬横条）
  - 气泡：改成柔和的实心小圆，去掉"圆环"观感
  - 叠压：画出文字区占位，让"人物压字、文字在上"的关系可见

卡片配色抄自 blog/src/pages/about.astro，OKLCH→sRGB。水线 y=282 / 559（实测 50.4%）。
"""
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

FIG = Path(r"C:\Tool\ImageGen\ComfyUI\ComfyUI\output\sfw\solo\mfy\test\_alpha_curl2_02.png")
OUT = Path(__file__).resolve().parent / "card-mock3.png"

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
            deep=oklch(0.15, 0.025, 245), tint=oklch(0.28, 0.08, 232),
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


def wave_mask(amp=5, period=150, phase=0.0):
    """波浪带 mask：0 在 WATER_Y 附近的正弦带上"""
    m = Image.new("L", (CW, CH), 0)
    d = ImageDraw.Draw(m)
    pts = [(x, WATER_Y + amp * math.sin(2 * math.pi * x / period + phase)) for x in range(CW)]
    d.line(pts, fill=255, width=9, joint="curve")
    return m.filter(ImageFilter.GaussianBlur(2))


def bubbles(layer, cx, top, bot, seeds):
    d = ImageDraw.Draw(layer)
    for i, s in enumerate(seeds):
        t = i / max(1, len(seeds) - 1)
        x = cx + (s - 0.5) * 190
        y = bot - t * (bot - top)
        r = 2 + ((i * 5) % 4) * 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 70))
        d.ellipse([x - r, y - r, x - r + 2, y - r + 2], fill=(255, 255, 255, 150))


def text_blocks(im, p):
    """文字区占位：让人物与文字的关系可见（真实卡片上文字在上层）"""
    lay = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    c = p["ink"] + (58,)
    d.rounded_rectangle([30, 30, 250, 60], 6, fill=c)          # 名字
    d.rounded_rectangle([30, 70, 170, 84], 5, fill=c)          # 罗马音
    for i in range(6):                                          # 6 条设定
        d.rounded_rectangle([30, 130 + i * 26, 430, 142 + i * 26], 4, fill=c)
    for i in range(2):                                          # 水下两条
        d.rounded_rectangle([30, 320 + i * 52, 400, 336 + i * 52], 4, fill=c)
    im.alpha_composite(lay)


def panel(p, fig, fig_h):
    im = base_card(p).convert("RGBA")
    f = fig.resize((max(1, int(fig.width * fig_h / fig.height)), fig_h), Image.LANCZOS)
    fx = CW - f.width + 18
    fy = 14                                  # 头顶留一点，脚落到卡片底
    fig_a = Image.new("L", (CW, CH), 0)
    fig_a.paste(f.getchannel("A"), (fx, fy))

    # 接触阴影
    sh = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx + f.width * 0.10, CH - 78, fx + f.width * 0.92, CH + 14],
                               fill=(0, 0, 0, 62))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24)))

    im.alpha_composite(f, (fx, fy))

    # 水下染色（只作用在人物身上，越深越浓）
    tint = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    tp = tint.load()
    for y in range(WATER_Y, CH):
        a = int(24 + 80 * (y - WATER_Y) / (CH - WATER_Y))
        for x in range(CW):
            tp[x, y] = p["tint"] + (a,)
    band = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(band).rectangle([0, WATER_Y, CW, CH], fill=255)
    cut = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    cut.paste(tint, (0, 0), ImageChops.multiply(fig_a, band))
    im.alpha_composite(cut)

    # 波浪水面：压在她身上，读作"她穿过水面"
    surf = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    m = wave_mask()
    surf.paste(Image.new("RGBA", (CW, CH), (255, 255, 255, 150)), (0, 0), m)
    m2 = wave_mask(amp=6, period=210, phase=1.1).filter(ImageFilter.GaussianBlur(4))
    surf.paste(Image.new("RGBA", (CW, CH), tuple(p["shallow"]) + (135,)), (0, 0), m2)
    im.alpha_composite(surf)

    bub = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    bubbles(bub, fx + f.width * 0.42, WATER_Y + 18, CH - 30,
            [0.18, 0.55, 0.82, 0.33, 0.70, 0.44, 0.90])
    im.alpha_composite(bub)

    text_blocks(im, p)
    return im.convert("RGB")


def main():
    fig = Image.open(FIG).convert("RGBA")
    fig = fig.crop(fig.getchannel("A").getbbox())
    print("人物裁剪后", fig.size, "比例", round(fig.width / fig.height, 3))

    fig_h = 540
    print("贴入尺寸", int(fig.width * fig_h / fig.height), "x", fig_h)
    a = panel(LIGHT, fig, fig_h)
    b = panel(DARK, fig, fig_h)
    sheet = Image.new("RGB", (CW * 2 + 24, CH + 34), (250, 250, 250))
    sheet.paste(a, (0, 34))
    sheet.paste(b, (CW + 24, 34))
    sheet.save(OUT)
    print("saved", OUT, sheet.size)


if __name__ == "__main__":
    main()
