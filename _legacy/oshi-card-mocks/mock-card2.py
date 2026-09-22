# -*- coding: utf-8 -*-
"""把抠好的人物「融进」卡片：水线压在她身上 + 水下染色 + 接触阴影 + 气泡。

上一版只是把她平贴上去，所以读起来像贴纸。这一版做四件融合的事：
  1. 水线从她身上穿过去（水面亮线画在她之上）
  2. 水下部分叠一层水色（越深越浓），模拟折射/浸没
  3. 箱底加接触阴影
  4. 少量气泡，且水下的气泡画在她之上

卡片配色抄自 blog/src/pages/about.astro，OKLCH→sRGB。水线 y=282 / 559（实测 50.4%）。
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

FIG = Path(r"C:\Tool\ImageGen\ComfyUI\ComfyUI\output\sfw\solo\mfy\test\_alpha_curl2_02.png")
OUT = Path(__file__).resolve().parent / "card-mock2.png"

CW, CH = 760, 559
WATER_Y = 282
# 文字最深墨迹到 x=477，人物从这里往右放，避免压字
SAFE_X = 470


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
             deep=oklch(0.862, 0.08, 212), tint=oklch(0.72, 0.09, 208))
DARK = dict(air=oklch(0.34, 0.055, 283), shallow=oklch(0.21, 0.035, 245),
            deep=oklch(0.15, 0.025, 245), tint=oklch(0.30, 0.07, 230))


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


def bubbles(layer, cx, cy, rng, above):
    d = ImageDraw.Draw(layer)
    for i in range(14):
        t = i / 13
        x = cx + (rng[(i * 3) % len(rng)] - 0.5) * 210
        y = cy - t * (cy - WATER_Y - 30)
        r = 3 + ((i * 7) % 5) * 2
        a = 90 if above else 60
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255, a), width=2)
        d.ellipse([x - r + 1, y - r + 1, x - r + 3, y - r + 3], fill=(255, 255, 255, a))


def panel(p, fig, fig_h):
    im = base_card(p).convert("RGBA")

    # --- 人物：右对齐、被右壁切掉一点，读作"卡在箱里"
    f = fig.resize((max(1, int(fig.width * fig_h / fig.height)), fig_h), Image.LANCZOS)
    fx, fy = CW - f.width + 34, WATER_Y - int(fig_h * 0.30)

    # --- 接触阴影：先在她脚下画一团柔和的暗
    sh = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([fx + f.width * 0.05, CH - 70, fx + f.width * 0.95, CH + 10],
                               fill=(0, 0, 0, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))

    im.alpha_composite(f, (fx, fy))

    # --- 水下染色：只作用在水线以下的人物像素上
    tint = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    tp = tint.load()
    for y in range(WATER_Y, CH):
        t = (y - WATER_Y) / (CH - WATER_Y)
        a = int(28 + 84 * t)
        for x in range(CW):
            tp[x, y] = p["tint"] + (a,)
    masked = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    # 人物 alpha 与"水下"区域的交集
    fig_a = Image.new("L", (CW, CH), 0)
    fig_a.paste(f.getchannel("A"), (fx, fy))
    band = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(band).rectangle([0, WATER_Y, CW, CH], fill=255)
    both = ImageChopsMultiply(fig_a, band)
    masked.paste(tint, (0, 0), both)
    im.alpha_composite(masked)

    # --- 水面：先在她身上画一条亮线，再叠一层半透明水面片，让她"穿过"水面
    surf = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(surf)
    d.rectangle([0, WATER_Y - 3, CW, WATER_Y + 4], fill=(255, 255, 255, 120))
    d.rectangle([0, WATER_Y + 5, CW, WATER_Y + 22],
                fill=tuple(p["shallow"]) + (110,))
    im.alpha_composite(surf.filter(ImageFilter.GaussianBlur(2)))

    # --- 气泡：水下画在她之上（她是浸在水里的），水面附近零星几颗
    bub = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    bubbles(bub, fx + f.width * 0.45, CH - 40, [0.2, 0.5, 0.8, 0.35, 0.65], above=False)
    bubbles(bub, fx + f.width * 0.3, WATER_Y - 6, [0.3, 0.7, 0.45, 0.9, 0.15], above=True)
    im.alpha_composite(bub)

    return im.convert("RGB")


def ImageChopsMultiply(a, b):
    from PIL import ImageChops
    return ImageChops.multiply(a, b)


def main():
    fig = Image.open(FIG).convert("RGBA")
    fig = fig.crop(fig.getchannel("A").getbbox())
    print("人物裁剪后", fig.size, "比例", round(fig.width / fig.height, 3))

    fig_h = int(CH * 1.06)  # 比卡片略高 → 上下自然被切，读作"在箱子里"
    a = panel(LIGHT, fig, fig_h)
    b = panel(DARK, fig, fig_h)
    sheet = Image.new("RGB", (CW * 2 + 24, CH + 36), (250, 250, 250))
    sheet.paste(a, (0, 36))
    sheet.paste(b, (CW + 24, 36))
    sheet.save(OUT)
    print("saved", OUT, sheet.size)


if __name__ == "__main__":
    main()
