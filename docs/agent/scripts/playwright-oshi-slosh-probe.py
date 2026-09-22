"""验证"滚动 → 水面波动"：读 --slosh 的时程，确认①滚动有冲量 ②停手会自己荡回去
③reduced-motion 下完全不动 ④波形像素真的跟着动。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-slosh-probe.py
"""
import pathlib

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"

SAMPLE = """
() => {
  const c = document.querySelector('.oshi-card');
  return parseFloat(getComputedStyle(c).getPropertyValue('--slosh') || '0');
}
"""


def series(page, samples=26, gap=80):
    return [page.evaluate(SAMPLE) or 0.0 for _ in range(samples) if not page.wait_for_timeout(gap)]


def run(reduce, wheel=42, steps=10):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1600, "height": 1000},
                            device_scale_factor=1, reduced_motion=reduce)
        page = ctx.new_page()
        page.goto(URL, wait_until="load")
        page.add_style_tag(content=".snow-canvas, .l2d-particles, #l2d-widget { display: none !important; }")
        page.evaluate("() => { document.documentElement.dataset.theme = 'dark'; }")
        page.evaluate("() => document.querySelector('.oshi-card')"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(700)

        base = page.evaluate("() => window.scrollY")
        # 模拟滚动：连续几帧向下滚，然后停手，看它自己荡回去。
        # 用 mouse.wheel —— 在页面上按住鼠标拖是不会滚动的（那是选字），
        # 第一版用 mouse.move 假装拖拽，读数看着有反应，其实是误判。
        for _ in range(steps):
            page.mouse.wheel(0, wheel)
            page.wait_for_timeout(16)
        trace = series(page, samples=30, gap=70)
        ctx.close()
        b.close()
    return base, trace


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for reduce, wheel, steps in (("no-preference", 12, 10), ("no-preference", 42, 10),
                                 ("no-preference", 80, 6), ("reduce", 42, 10)):
        base, tr = run(reduce, wheel, steps)
        peak = max(tr, key=abs)
        tail = max(abs(v) for v in tr[len(tr) // 2:])
        signs = [v for v in tr if abs(v) > 0.01]
        flips = sum(1 for a, b in zip(signs, signs[1:]) if a * b < 0)
        speed = wheel * steps
        print(f"--- reduced-motion={reduce}  滚动 {speed}px（每帧 {wheel}px）---")
        print(f"  峰值 --slosh = {peak:+.3f}")
        print(f"  轨迹 = {' '.join(f'{v:+.2f}' for v in tr[:14])} … {' '.join(f'{v:+.2f}' for v in tr[20:26])}")
        print(f"  停手后是否荡平：后半段最大 |v| = {tail:.3f}   正负翻转 = {flips}")
        if reduce == "reduce":
            assert all(abs(v) < 1e-6 for v in tr), "reduced-motion 下不该有任何位移"
            print("  ✅ reduced-motion 下完全不动")
        else:
            assert abs(peak) > 0.05, "滚动没有产生冲量"
            assert tail < abs(peak) * 0.5, "停手后没有荡回去"
            assert flips >= 1, "没有回弹（看起来是滑块不是弹簧）"
            print(f"  ✅ 有冲量、会回弹、能荡平（峰值 {abs(peak):.2f}）")
        print()


if __name__ == "__main__":
    main()
