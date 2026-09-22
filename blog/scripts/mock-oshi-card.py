#!/usr/bin/env python3
"""把卡片文字画到真图上，看版式——比在脑子里排版靠谱。

渲染成 760x760 的卡片（2x 渲染 = 1520px），亮/暗两套配色对应 day/night 两张图。
只输出到 `_out/oshi-art/`，不碰站点。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "agent" / "scripts" / "out" / "oshi-art"
CARD = 760
S = 2                      # 超采样倍数
PX = CARD * S
KAI = r"C:\Windows\Fonts\simkai.ttf"
MONO = r"C:\Windows\Fonts\consola.ttf"

TEXT = dict(
    unit="25時、ナイトコードで。 · 作詞・混音担当 · 网名「雪」/ OWN",
    name="朝比奈真冬",
    name_en="asahina mafuyu",
    facts=[("生日", "1 月 27 日 · 水瓶座"), ("年龄", "17 岁"), ("身高", "162cm"),
           ("CV", "田辺留依"), ("趣味", "水族箱"), ("擅长", "英语会话")],
    depth=[("喜欢的食物", "妈妈亲手做的菜"), ("不擅长", "表达情绪")],
    tagline="「谢谢你，找到了我。」",
)

WATERLINE = 263 / 1024          # 水面落差最大处 = 0.257
HAIR_LEFT = 0.62                # 空气带里她的头发左缘，文字右侧不超过这里


def f(path, size):
    return ImageFont.truetype(path, size)


def spaced(d, xy, s, font, fill, sp=0):
    """带字距的绘制（PIL 没有 letter-spacing）。sp 是 2x 像素。"""
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + sp
    return x


def air_block(d, ink, dim, faint, hairl):
    """空气带：单位 / 名字 / 日文名 / 细线。返回细线下的 y。"""
    x0 = int(0.048 * PX)
    spaced(d, (x0, int(0.058 * PX)), TEXT["unit"], f(KAI, 27), dim, sp=3)
    spaced(d, (x0, int(0.088 * PX)), TEXT["name"], f(KAI, 62), ink, sp=6)
    spaced(d, (x0, int(0.168 * PX)), TEXT["name_en"], f(MONO, 22), faint, sp=3)
    y = int(0.208 * PX)
    d.rectangle([x0, y, int(HAIR_LEFT * PX), y + S], fill=hairl)
    return y + int(0.016 * PX)


def render(img_path, out_name, dark, water):
    im = Image.open(img_path).convert("RGB").resize((PX, PX), Image.LANCZOS)
    d = ImageDraw.Draw(im, "RGBA")
    ink = (246, 249, 255, 255)
    dim = (206, 220, 244, 225)
    faint = (176, 196, 228, 170)
    hairl = (255, 255, 255, 68)
    x0 = int(0.048 * PX)

    y = air_block(d, ink, dim, faint, hairl)

    # 八项：行内 k+v，自然折行（两行）
    gappx = 26 * S
    for i, (k, v) in enumerate(TEXT["facts"] + TEXT["depth"]):
        w = d.textlength(k, font=f(KAI, 19)) + d.textlength(" ", font=f(KAI, 19)) \
            + d.textlength(v, font=f(KAI, 23))
        if x0 + w > HAIR_LEFT * PX:
            y += int(0.0245 * PX)
            x0 = int(0.048 * PX)
        spaced(d, (x0, y), k, f(KAI, 19), faint, sp=1)
        x0 += d.textlength(k, font=f(KAI, 19)) + 6 * S
        x0 = int(spaced(d, (x0, y + 3 * S), v, f(KAI, 23), ink) + gappx)

    if water == "tagline":
        wink = (10, 42, 60, 235) if not dark else (238, 246, 255, 245)
        spaced(d, (int(0.115 * PX), int(0.408 * PX)), TEXT["tagline"], f(KAI, 32), wink, sp=4)
    elif water == "depth":
        wink = (12, 44, 62, 255) if not dark else (236, 244, 255, 255)
        wfaint = (16, 56, 78, 190) if not dark else (188, 210, 242, 200)
        wy = int(0.392 * PX)
        for k, v in TEXT["depth"]:
            spaced(d, (x0, wy), k, f(KAI, 19), wfaint, sp=1)
            spaced(d, (x0 + 120 * S, wy + 3 * S), v, f(KAI, 23), wink)
            wy += int(0.032 * PX)
        spaced(d, (x0, int(0.492 * PX)), TEXT["tagline"], f(KAI, 32), wink, sp=4)

    im.resize((CARD, CARD), Image.LANCZOS).save(OUT / out_name)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for src, tag, dark in [(r"C:\Projects\image2.5\day.png", "day", False),
                           (r"C:\Projects\image2.5\night.png", "night", True)]:
        for w in ("tagline", "depth"):
            render(src, f"m-{w}-{tag}.png", dark, w)
    print(f"看 {OUT}")
