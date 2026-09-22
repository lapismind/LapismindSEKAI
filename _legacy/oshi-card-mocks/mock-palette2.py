# -*- coding: utf-8 -*-
"""卡片调色板与背光：现状 vs 按图取色 + 轮廓背光。

「像贴图」的根子不只是色相冲突，还有**她没有光**——直接贴在背景上，
和环境的照明没有任何关系。这里补一层轮廓背光：
水线以上偏品红（水面反光），水线以下偏蓝紫（水体散射）。

上排＝现状（青水 + 无背光）；下排＝按图取色 + 背光。
"""
import importlib.util
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("m", HERE / "mock-gpt.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ok = m.oklch
CW, CH, WATER_Y = m.CW, m.CH, m.WATER_Y

CUR_L, CUR_D = m.LIGHT, m.DARK

NEW_L = dict(air=ok(0.985, 0.008, 265),
             shallow=ok(0.930, 0.055, 240),
             deep=ok(0.848, 0.092, 252),
             tint=ok(0.68, 0.115, 248),
             ink=ok(0.30, 0.030, 265))
NEW_D = dict(air=ok(0.300, 0.062, 272),
             shallow=ok(0.200, 0.052, 252),
             deep=ok(0.128, 0.042, 258),
             tint=ok(0.22, 0.105, 255),
             ink=ok(0.90, 0.020, 270))

# 背光两色：水面之上 / 之下
GLOW_ABOVE = ok(0.78, 0.17, 325)   # 品红
GLOW_BELOW = ok(0.62, 0.16, 252)   # 蓝紫

DAY_P = (480, 115, 130)
NIGHT_P = (620, 106, -18)


def add_glow(im, fig, fig_h, fy, over, strength=118, spread=26):
    """在人物背后铺一层轮廓背光：上品红、下蓝紫，中间在水线处过渡。"""
    f = fig.resize((max(1, int(fig.width * fig_h / fig.height)), fig_h), Image.LANCZOS)
    fx = CW - f.width + over

    a = Image.new("L", (CW, CH), 0)
    a.paste(f.getchannel("A"), (fx, fy))
    halo = a.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(spread))

    grad = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    gp = grad.load()
    for y in range(CH):
        t = min(1.0, max(0.0, (y - (WATER_Y - 40)) / 110.0))
        col = tuple(int(GLOW_ABOVE[i] + (GLOW_BELOW[i] - GLOW_ABOVE[i]) * t) for i in range(3))
        for x in range(CW):
            gp[x, y] = col + (255,)

    layer = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    layer.paste(grad, (0, 0), ImageChops.multiply(halo, Image.new("L", (CW, CH), strength)))
    im.alpha_composite(layer)
    return f, fx


def render(pal, fig, fig_h, fy, over, tint_max, bub_n, glow):
    im = m.base_card(pal).convert("RGBA")
    if glow:
        f, fx = add_glow(im, fig, fig_h, fy, over)
    else:
        f = fig.resize((max(1, int(fig.width * fig_h / fig.height)), fig_h), Image.LANCZOS)
        fx = CW - f.width + over

    fig_a = Image.new("L", (CW, CH), 0)
    fig_a.paste(f.getchannel("A"), (fx, fy))
    im.alpha_composite(f, (fx, fy))

    # 水下染色
    tint = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    tp = tint.load()
    for y in range(WATER_Y, CH):
        aa = int(24 + tint_max * (y - WATER_Y) / (CH - WATER_Y))
        for x in range(CW):
            tp[x, y] = pal["tint"] + (aa,)
    band = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(band).rectangle([0, WATER_Y, CW, CH], fill=255)
    cut = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    cut.paste(tint, (0, 0), ImageChops.multiply(fig_a, band))
    im.alpha_composite(cut)

    # 水面
    surf = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    surf.paste(Image.new("RGBA", (CW, CH), (255, 255, 255, 150)), (0, 0), m.wave(5, 150, 0))
    surf.paste(Image.new("RGBA", (CW, CH), tuple(pal["shallow"]) + (135,)), (0, 0),
               m.wave(6, 210, 1.1).filter(ImageFilter.GaussianBlur(4)))
    im.alpha_composite(surf)

    bub = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    seeds = [0.18, 0.55, 0.82, 0.33, 0.70, 0.44, 0.90, 0.27, 0.62, 0.75][:bub_n]
    m.bubbles(bub, fx + f.width * 0.42, WATER_Y + 18, CH - 30, seeds)
    im.alpha_composite(bub)

    m.text_blocks(im, pal)
    return im.convert("RGB")


def main():
    day = Image.open(m.DAY).convert("RGBA")
    night = Image.open(m.NIGHT).convert("RGBA")
    day = day.crop(day.getchannel("A").getbbox())
    night = night.crop(night.getchannel("A").getbbox())

    rows = [
        ("现状：青水 202° / 无背光",
         render(CUR_L, day, *DAY_P, 80, 7, False),
         render(CUR_D, night, *NIGHT_P, 130, 10, False)),
        ("按图取色 + 轮廓背光：水色蓝紫 240~252° / 背光品红→蓝紫",
         render(NEW_L, day, *DAY_P, 80, 7, True),
         render(NEW_D, night, *NIGHT_P, 130, 10, True)),
    ]

    S = Image.new("RGB", (CW * 2 + 24, (CH + 30) * len(rows) + 10), (250, 250, 250))
    d = ImageDraw.Draw(S)
    for r, (label, lt, dk) in enumerate(rows):
        y = r * (CH + 30)
        d.text((6, y + 8), label, fill=(25, 25, 25))
        S.paste(lt, (0, y + 30))
        S.paste(dk, (CW + 24, y + 30))
    S.save(HERE / "card-palette2.png")
    print("saved", HERE / "card-palette2.png", S.size)


if __name__ == "__main__":
    main()
