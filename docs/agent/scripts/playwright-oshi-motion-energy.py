"""量卡片里的动效：隔 2s 拍一帧，共 11 帧，算每个区域的运动能量，并出"运动包络图"。

运动包络 = 每像素在整段时间里的 (max - min)，放大后输出 —— 一眼看出哪里在动、动多大。
分区域统计（空气带 / 水线 / 水域上 / 水域中 / 水域下 / 她身上）给数字。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-motion-energy.py [theme]
输出: docs/agent/scripts/out/oshi-card/
"""
import pathlib
import sys

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"
N, GAP_MS = 11, 2000

# (名字, x0, y0, x1, y1) 相对卡片
REGIONS = [
    ("空气带（身份+八项）", 0.03, 0.04, 0.62, 0.26),
    ("水线", 0.00, 0.24, 1.00, 0.31),
    ("水域上（她自己写的）", 0.03, 0.34, 0.55, 0.51),
    ("水域中（签名句）", 0.08, 0.50, 0.45, 0.59),
    ("水域下（沉木/砂）", 0.03, 0.60, 0.55, 0.95),
    ("她身上（右半）", 0.62, 0.30, 0.96, 0.95),
]


def main():
    theme = sys.argv[1] if len(sys.argv) > 1 else "dark"
    OUT.mkdir(parents=True, exist_ok=True)
    frames = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1600, "height": 1000},
                            device_scale_factor=1, reduced_motion="no-preference")
        page = ctx.new_page()
        page.goto(URL, wait_until="load")
        # 站点有全站固定的雪花 canvas（Footer.astro 的 .snow-canvas）与 Live2D 挂件，
        # 都是 position:fixed —— element.screenshot() 会把画在卡片之上的它们一起截进来，
        # 于是"卡片在动"的读数里混着雪。量卡片自身动效必须先藏掉。
        page.add_style_tag(content=".snow-canvas, .l2d-particles, #l2d-widget { display: none !important; }")
        page.evaluate("t => { document.documentElement.dataset.theme = t; }", theme)
        page.evaluate("() => document.querySelector('.oshi-card')"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(1200)
        card = page.query_selector(".oshi-card")
        for i in range(N):
            f = OUT / f"frame-{theme}-{i:02d}.png"
            card.screenshot(path=str(f))
            frames.append(f)
            page.wait_for_timeout(GAP_MS)
        ctx.close()
        b.close()

    arr = np.stack([np.asarray(Image.open(f).convert("RGB"), dtype=np.int16) for f in frames])
    h, w = arr.shape[1:3]
    lo, hi = arr.min(axis=0), arr.max(axis=0)
    env = (hi - lo).max(axis=2)                       # 每像素运动包络
    amp = min(255, 255)                               # 包络本身已是 0..255
    Image.fromarray(np.clip(env * 6, 0, 255).astype(np.uint8)).save(OUT / f"motion-envelope-{theme}.png")

    print(f"# 主题={theme}  {N} 帧 × {GAP_MS}ms = {N * GAP_MS / 1000:.0f}s   卡片 {w}x{h}")
    print(f"{'区域':24s} {'均值':>7s} {'p99':>6s} {'最大':>6s} {'>6 的像素占比':>12s}")
    for name, x0, y0, x1, y1 in REGIONS:
        r = env[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
        print(f"{name:24s} {r.mean():7.2f} {np.percentile(r, 99):6.1f} {r.max():6d} "
              f"{(r > 6).mean():12.2%}")
    r = env
    print(f"{'整卡':24s} {r.mean():7.2f} {np.percentile(r, 99):6.1f} {r.max():6d} "
          f"{(r > 6).mean():12.2%}")
    print("->", OUT / f"motion-envelope-{theme}.png")


if __name__ == "__main__":
    main()
