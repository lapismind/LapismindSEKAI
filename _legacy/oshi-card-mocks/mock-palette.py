# -*- coding: utf-8 -*-
"""对比：卡片调色板「现状」vs「按图取色」。

图的色相构成（实测）：蓝紫 225~255° 占七成，辅色品红/粉 300~330°。
卡片现状的水色是 202~212°（青），差 30~40 度——这就是"撞"的来源。

上排＝现状；下排＝按图取色（水色挪到蓝紫、强调色挪到品红）。
"""
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("m", HERE / "mock-gpt.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ok = m.oklch

# 现状（沿用 about.astro 的 --oshi-* 取值）
CUR_L = m.LIGHT
CUR_D = m.DARK

# 按图取色：核心 240°，辅色 320°
NEW_L = dict(air=ok(0.985, 0.008, 265),      # 空气：极淡蓝紫，去掉原来的青
             shallow=ok(0.930, 0.055, 240),  # 浅水：蓝紫
             deep=ok(0.848, 0.092, 252),     # 深水
             tint=ok(0.68, 0.115, 248),      # 浸没染色
             ink=ok(0.30, 0.030, 265))
NEW_D = dict(air=ok(0.300, 0.062, 272),
             shallow=ok(0.200, 0.052, 252),
             deep=ok(0.128, 0.042, 258),
             tint=ok(0.22, 0.105, 255),
             ink=ok(0.90, 0.020, 270))

# 白天 h/fy/over、夜间 h/fy/over（沿用扫描里挑的那档）
DAY_P = (480, 115, 130)
NIGHT_P = (620, 106, -18)


def main():
    day = Image.open(m.DAY).convert("RGBA")
    night = Image.open(m.NIGHT).convert("RGBA")
    day = day.crop(day.getchannel("A").getbbox())
    night = night.crop(night.getchannel("A").getbbox())

    dh, dfy, dov = DAY_P
    nh, nfy, nov = NIGHT_P
    cur_l, _ = m.panel(CUR_L, day, dh, dfy, dov, 80, 7)
    cur_d, _ = m.panel(CUR_D, night, nh, nfy, nov, 130, 10)
    new_l, _ = m.panel(NEW_L, day, dh, dfy, dov, 80, 7)
    new_d, _ = m.panel(NEW_D, night, nh, nfy, nov, 130, 10)

    CW, CH = m.CW, m.CH
    S = Image.new("RGB", (CW * 2 + 24, (CH + 30) * 2 + 10), (250, 250, 250))
    d = ImageDraw.Draw(S)
    for r, (label, lt, dk) in enumerate([("现状：水色青 202°", cur_l, cur_d),
                                         ("按图取色：水色蓝紫 240~252° / 强调品红", new_l, new_d)]):
        y = r * (CH + 30)
        d.text((6, y + 8), label, fill=(25, 25, 25))
        S.paste(lt, (0, y + 30))
        S.paste(dk, (CW + 24, y + 30))
    S.save(HERE / "card-palette.png")
    print("saved", HERE / "card-palette.png", S.size)


if __name__ == "__main__":
    main()
