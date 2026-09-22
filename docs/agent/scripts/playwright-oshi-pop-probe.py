"""验点击冒泡：

① 水面之下点一下 → 冒出一组气泡；
② 它们真的在往上走（y 递减），且**停在水面之下**（不会被 .oshi-water 硬切）；
③ 动画结束后节点被回收（不留垃圾）；
④ 水面之上点一下 → 什么都不冒（那里是身份与八项资料）；
⑤ 连点有上限（BURST_MAX）；
⑥ reduced-motion 下完全不冒。

用法: cd blog/dist && python -m http.server 8777
      python docs/agent/scripts/playwright-oshi-pop-probe.py
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"

COUNT = "() => document.querySelectorAll('.oshi-pop').length"
# 每个气泡相对水域层的 top（px）与不透明度
POSITIONS = """
() => {
  const w = document.querySelector('.oshi-water-inner').getBoundingClientRect();
  return [...document.querySelectorAll('.oshi-pop')].map(el => {
    const r = el.getBoundingClientRect();
    return {y: +(r.top + r.height / 2 - w.top).toFixed(1),
            o: +getComputedStyle(el).opacity};
  });
}
"""


def card_box(page):
    return page.evaluate("""() => {
      const c = document.querySelector('.oshi-card').getBoundingClientRect();
      const w = document.querySelector('.oshi-water-inner').getBoundingClientRect();
      return {card: [c.left, c.top, c.width, c.height],
              waterTop: w.top, waterH: w.height, waterLeft: w.left, waterW: w.width};
    }""")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, reduce in (("normal", "no-preference"), ("reduced", "reduce")):
            ctx = b.new_context(viewport={"width": 1600, "height": 1000},
                                device_scale_factor=1, reduced_motion=reduce)
            page = ctx.new_page()
            page.goto(URL, wait_until="load")
            page.add_style_tag(content=".snow-canvas, .l2d-particles, #l2d-widget { display: none !important; }")
            page.evaluate("() => { document.documentElement.dataset.theme = 'dark'; }")
            page.evaluate("() => document.querySelector('.oshi-card')"
                          ".scrollIntoView({block:'center',behavior:'instant'})")
            page.wait_for_timeout(900)
            g = card_box(page)
            print(f"--- {label}（reduced-motion={reduce}）---")
            print(f"  卡片 {g['card'][2]:.0f}×{g['card'][3]:.0f}  水域层 top={g['waterTop']:.0f} 高={g['waterH']:.0f}")

            # 水面之下点一下（水域层中点偏下）
            wx = g["waterLeft"] + g["waterW"] * 0.30
            wy = g["waterTop"] + g["waterH"] * 0.55
            page.mouse.click(wx, wy)
            page.wait_for_timeout(120)
            n0 = page.evaluate(COUNT)
            trace = []
            for _ in range(10):
                page.wait_for_timeout(160)
                trace.append(page.evaluate(POSITIONS))
            ys = [min(x["y"] for x in t) for t in trace if t]
            print(f"  水面之下点击 → 冒出 {n0} 颗；最靠上那颗的 y 轨迹 {ys[:6]}")
            if label == "normal":
                page.query_selector(".oshi-card").screenshot(path=str(OUT / "pop-burst.png"))
                if n0 < 5:
                    bad.append(f"点击后只冒出 {n0} 颗，太少")
                if not (len(ys) >= 2 and ys[-1] < ys[0] - 20):
                    bad.append(f"气泡没有明显上浮（{ys[0]} → {ys[-1]}）")
                if ys[-1] < 6:
                    bad.append(f"最靠上的气泡到了水域层 y={ys[-1]}，已经贴到水面（会被 overflow 硬切）")
            else:
                if n0 != 0:
                    bad.append(f"reduced-motion 下不该冒泡，却冒出 {n0} 颗")
                print("  ✓ reduced-motion 下不冒泡")

            # 回收
            page.wait_for_timeout(3200)
            left = page.evaluate(COUNT)
            print(f"  3.2s 后残留 {left} 颗")
            if left != 0:
                bad.append(f"气泡没回收干净，残留 {left} 颗")

            # 水面之上点一下（身份三行那一带）
            ay = g["card"][1] + g["card"][3] * 0.10
            page.mouse.click(g["card"][0] + g["card"][2] * 0.5, ay)
            page.wait_for_timeout(150)
            n_air = page.evaluate(COUNT)
            print(f"  水面之上点击 → 冒出 {n_air} 颗")
            if n_air != 0:
                bad.append(f"水面之上点击不该冒泡，却冒出 {n_air} 颗")

            # 连点上限
            for _ in range(12):
                page.mouse.click(wx, wy)
                page.wait_for_timeout(30)
            page.wait_for_timeout(120)
            n_spam = page.evaluate(COUNT)
            print(f"  连点 12 次 → 共 {n_spam} 颗（上限 6 组 × 7–11 颗 = 42–66）")
            if label == "normal" and n_spam > 70:
                bad.append(f"连点没被限流，堆了 {n_spam} 颗")
            ctx.close()
        b.close()
    if bad:
        print("\n❌ " + "\n   ".join(bad))
        raise SystemExit(1)
    print("\n✅ 点击冒泡：水面之下冒、会上升、会回收；水面之上与 reduced-motion 都不冒；连点有限流")


if __name__ == "__main__":
    main()
