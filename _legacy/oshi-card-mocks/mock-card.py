# -*- coding: utf-8 -*-
"""把抠好的人物贴到「卡片真实配色」上，验收白天/夜间两套底色。

卡片配色从 blog/src/pages/about.astro 抄来（OKLCH），这里做 OKLCH→sRGB 转换。
水线在卡片高度的 50.4%（实测 y=282 / 559）。
"""
import math
from pathlib import Path
from PIL import Image

FIG = Path(r"C:\Tool\ImageGen\ComfyUI\ComfyUI\output\sfw\solo\mfy\test\_alpha_pastel01.png")
OUT = Path(__file__).resolve().parent / "card-mock.png"

CW, CH = 760, 559
WATER_Y = 282


def oklch(L, C, H, alpha=1.0):
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

    return tuple(enc(v) for v in lin) + (alpha,)


# 浅色主题（about.astro 默认）
LIGHT = dict(surface=oklch(0.985, 0.006, 252, 0.94),
             shallow=oklch(0.935, 0.05, 202, 0.96),
             deep=oklch(0.862, 0.08, 212, 0.96))
# 深色主题
DARK = dict(surface=oklch(0.34, 0.055, 283, 0.55),
            shallow=oklch(0.21, 0.035, 245, 0.92),
            deep=oklch(0.15, 0.025, 245, 0.96))


def panel(palette, figure, fig_h):
    """卡片底：上半空气（surface），下半水（shallow→deep 渐变）+ 水面亮线"""
    im = Image.new("RGB", (CW, CH), (0, 0, 0))
    px = im.load()
    air = palette["surface"]
    sh, dp = palette["shallow"], palette["deep"]
    for y in range(CH):
        for x in range(CW):
            if y < WATER_Y:
                px[x, y] = air[:3]
            else:
                t = (y - WATER_Y) / max(1, CH - WATER_Y)
                px[x, y] = tuple(int(sh[i] + (dp[i] - sh[i]) * t) for i in range(3))
    # 水面一条亮线
    for x in range(CW):
        px[x, WATER_Y] = tuple(min(255, c + 38) for c in px[x, WATER_Y])
    # 贴人物：右对齐，脚踩水底
    f = figure.resize((int(figure.width * fig_h / figure.height), fig_h), Image.LANCZOS)
    im.paste(f, (CW - f.width + 26, WATER_Y - int(fig_h * 0.50)), f)
    return im


def main():
    fig = Image.open(FIG).convert("RGBA")
    bbox = fig.getchannel("A").getbbox()
    fig = fig.crop(bbox)
    print("人物裁剪后", fig.size)

    a = panel(LIGHT, fig, int(CH * 0.98))
    b = panel(DARK, fig, int(CH * 0.98))
    sheet = Image.new("RGB", (CW * 2 + 24, CH + 40), (245, 245, 245))
    sheet.paste(a, (0, 40))
    sheet.paste(b, (CW + 24, 40))
    sheet.save(OUT)
    print("saved", OUT, sheet.size)


if __name__ == "__main__":
    main()
