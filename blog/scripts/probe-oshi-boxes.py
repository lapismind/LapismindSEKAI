#!/usr/bin/env python3
"""在候选矩形上探"能不能压字"：亮度均值/局部标准差/细节密度 + 裁图供人眼复核。

用法：直接跑，输出表格并把裁片写到 `_out/oshi-art/crop-*.png`。
候选框用相对坐标（0-1），因为图一换尺寸就变。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "agent" / "scripts" / "out" / "oshi-art"

# (名字, x0, y0, x1, y1) —— 相对坐标
BOXES = [
    ("空气带·全部",   0.03, 0.06, 0.72, 0.28),
    ("空气带·标题位", 0.04, 0.07, 0.72, 0.17),
    ("空气带·事实位", 0.04, 0.17, 0.72, 0.28),
    # 水面之下：找"里"的资料能压在哪。按行切，看哪几行真的空。
    ("水下·行1",      0.06, 0.370, 0.52, 0.412),
    ("水下·行2",      0.06, 0.412, 0.52, 0.454),
    ("水下·行3",      0.06, 0.454, 0.52, 0.496),
    ("水下·行4",      0.06, 0.496, 0.52, 0.538),
    ("水下·整块",     0.06, 0.370, 0.52, 0.496),
    ("水下·窄块",     0.06, 0.375, 0.40, 0.470),
    ("水下·更左",     0.03, 0.370, 0.46, 0.490),
    ("签名位·原",     0.10, 0.375, 0.40, 0.420),
    ("签名位·下移1",  0.10, 0.520, 0.42, 0.565),
    ("签名位·下移2",  0.10, 0.600, 0.42, 0.645),
    # 放宽一档：确认 CSS 里用的两块空地还有多少余量（断言用的就是这两个框）
    ("水下·放宽上",   0.05, 0.355, 0.54, 0.505),
    ("签名·放宽",     0.08, 0.505, 0.45, 0.580),
    ("签名·再放宽",   0.06, 0.500, 0.48, 0.600),
    ("水中·左中",     0.02, 0.36, 0.55, 0.56),
    ("水中·左下",     0.02, 0.56, 0.40, 0.72),
    ("底部沙地",      0.03, 0.88, 0.45, 0.99),
    ("右墙条",        0.90, 0.06, 0.99, 0.60),
]


def rel_lum(rgb):
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[:, :, 0] + 0.7152 * c[:, :, 1] + 0.0722 * c[:, :, 2]


def contrast(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def main(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"{'框':14s} {'宽x高':>11s} {'均值L':>7s} {'标准差':>7s} {'p90|grad|':>9s} "
          f"{'白字对比':>8s} {'深字对比':>8s}  判定")
    for p in paths:
        p = Path(p)
        rgb = np.array(Image.open(p).convert("RGB"))
        h, w = rgb.shape[:2]
        L = rel_lum(rgb)
        gy, gx = np.gradient(L)
        g = np.hypot(gx, gy)
        print(f"\n### {p.name} {w}x{h}")
        for name, x0, y0, x1, y1 in BOXES:
            b = rgb[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
            bl = L[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
            bg = g[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
            m = bl.mean()
            cw, cd = contrast(1.0, m), contrast(m, 0.02)
            verdict = "白字" if cw >= 4.5 else ("深字" if cd >= 4.5 else "都不行")
            print(f"{name:14s} {b.shape[1]:5d}x{b.shape[0]:<5d} {m:7.3f} {bl.std():7.3f} "
                  f"{np.percentile(bg, 90):9.4f} {cw:8.2f} {cd:8.2f}  {verdict}")
            Image.fromarray(b).save(OUT / f"crop-{p.stem}-{name.replace('·', '_')}.png")
    print(f"\n裁片 → {OUT}")


if __name__ == "__main__":
    a = sys.argv[1:] or [r"C:\Projects\image2.5\day.png", r"C:\Projects\image2.5\night.png"]
    main(a)
