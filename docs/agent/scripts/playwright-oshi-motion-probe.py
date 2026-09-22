"""验证水区特效层真的在动：量层盒子 + 隔 1.5s 拍两张做像素差 + reduced-motion 必须静止。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-motion-probe.py
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"

BOXES = """
() => {
  const card = document.querySelector('.oshi-card');
  const cr = card.getBoundingClientRect();
  const out = {};
  for (const sel of ['.oshi-water', '.oshi-waterline', '.caustic-a', '.caustic-b', '.caustic-c',
                     '.bubble.b1', '.bubble.b5']) {
    const el = card.querySelector(sel);
    if (!el) { out[sel] = 'MISSING'; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[sel] = {w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                top: +(r.top - cr.top).toFixed(1),
                opacity: cs.opacity, anim: cs.animationName, dur: cs.animationDuration};
  }
  out['_cardTop'] = cr.top + window.scrollY;
  return out;
}
"""


def shoot(page, path):
    page.query_selector(".oshi-card").screenshot(path=str(path))


def diff(a, b):
    from PIL import Image, ImageChops
    import numpy as np
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    d = np.asarray(ImageChops.difference(ia, ib), dtype=np.int16).max(axis=2)
    return (d > 6).mean()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, reduce in (("normal", "no-preference"), ("reduced", "reduce")):
            ctx = b.new_context(viewport={"width": 1600, "height": 1000},
                                reduced_motion=reduce, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(URL, wait_until="load")
            page.evaluate("() => document.querySelector('.oshi-card')"
                          ".scrollIntoView({block:'center',behavior:'instant'})")
            page.wait_for_timeout(500)
            info = page.evaluate(BOXES)
            a, c = OUT / f"motion-{label}-a.png", OUT / f"motion-{label}-b.png"
            shoot(page, a)
            page.wait_for_timeout(1500)
            shoot(page, c)
            print(f"--- {label} (prefers-reduced-motion: {reduce}) ---")
            for k, v in info.items():
                if k != "_cardTop":
                    print(f"  {k:18s} {v}")
            print(f"  1.5s 后变化像素占比: {diff(a, c):.4%}")
            ctx.close()
        b.close()
    print("->", OUT)


if __name__ == "__main__":
    main()
