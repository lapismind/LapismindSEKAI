"""验水线的三条不变量：

① 三条的中心都压在图上那条水位线上（实测白天 30.3%）；
② svg 比容器宽出的部分 ≥ 一个周期 —— 否则漂移到位移末端时，容器左右会露出没有线的空档；
③ 每条 svg 的位移量正好等于它的一个周期（100%/n），所以循环点上图案接得回原样。

用法: cd blog/dist && python -m http.server 8777
      python docs/agent/scripts/playwright-oshi-wave-probe.py
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"

# 每条线：n = 横跨 viewBox 的周期数（写在 about.astro 的 waves 里）
LINES = {"w1": 5, "w2": 4, "w3": 7, "w4": 6, "w5": 9}

PROBE = """
() => {
  const water = document.querySelector('.oshi-water');
  const wr = water.getBoundingClientRect();
  const cr = document.querySelector('.oshi-card').getBoundingClientRect();
  const out = [];
  for (const el of water.querySelectorAll('.oshi-wave')) {
    const svg = el.querySelector('svg');
    const er = el.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // 位移量：把 transform 里那个 translateX 读出来（现在是 matrix 形式）
    out.push({
      cls: el.className.split(' ').pop(),
      // 两个都要报：top 的百分比基准是**水域层**，但"水位在哪"是相对**卡片**说的。
      // 只报一个、标签还写错，就会把 30% 的水域层坐标读成 30% 的卡片坐标（本轮就这么栽的）。
      centerCard: +(((er.top + er.height / 2) - cr.top) / cr.height * 100).toFixed(2),
      centerWater: +(((er.top + er.height / 2) - wr.top) / wr.height * 100).toFixed(2),
      containerW: +wr.width.toFixed(2),
      svgW: +sr.width.toFixed(2),
      // 相对**水线元素自身**量，不相对 .oshi-water —— 后者会被 --slosh 整体推移，
      // 而 scrollIntoView 触发的弹簧还没停，量出来会带一个假偏移（第一版就这样误判了 w3 露空）
      svgLeft: +(sr.left - er.left).toFixed(2),
      elW: +er.width.toFixed(2),
      anim: cs.animationName,
      svgAnim: getComputedStyle(svg).animationName,
      dur: getComputedStyle(svg).animationDuration,
    });
  }
  return {cardH: +cr.height.toFixed(2),
          waterTopCard: +(((wr.top - cr.top) / cr.height) * 100).toFixed(2),
          waterHPct: +((wr.height / cr.height) * 100).toFixed(2),
          lines: out};
}
"""

# 把 svg 的动画冻结在指定相位（animation-delay = -phase × duration）
FREEZE = """
([cls, phase]) => {
  const svg = document.querySelector(`.oshi-wave.${cls} svg`);
  const dur = parseFloat(getComputedStyle(svg).animationDuration);
  svg.style.animationPlayState = 'paused';
  svg.style.animationDelay = `${-phase * dur}s`;
}
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(URL, wait_until="load")
        page.add_style_tag(content=".snow-canvas, .l2d-particles, #l2d-widget { display: none !important; }")
        page.evaluate("() => { document.documentElement.dataset.theme = 'dark'; }")
        page.evaluate("() => document.querySelector('.oshi-card')"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(600)

        info = page.evaluate(PROBE)
        print(f"卡片高 {info['cardH']}px；水域层从卡高 {info['waterTopCard']}% 起、占 {info['waterHPct']}%"
              f" —— 所以 .oshi-wave 的 top 百分比基准是水域层，不是卡片")
        print(f"{'线':4s} {'中心(占卡高)':>13s} {'中心(占水域)':>13s} {'svg宽/容器宽':>14s} "
              f"{'多出一个周期?':>16s} {'位移量':>10s}")
        bad = []
        for ln in info["lines"]:
            cls = ln["cls"]
            n = LINES[cls]
            over = ln["svgW"] - ln["containerW"]          # svg 比容器宽出多少
            period = ln["svgW"] / n                        # 一个周期 = svg 宽 / n
            ok = over >= period - 0.5
            # 位移量（px）= 一个周期
            print(f"{cls:4s} {ln['centerCard']:12.2f}% {ln['centerWater']:12.2f}% "
                  f"{ln['svgW']:7.1f}/{ln['containerW']:.1f} "
                  f"{('✓ 富余 ' if ok else '✗ 差 ') + f'{over - period:+.1f}px':>16s} "
                  f"{period:8.1f}px")
            if not ok:
                bad.append(f"{cls}: svg 只比容器宽 {over:.1f}px，小于一个周期 {period:.1f}px —— 漂移末端会露空")

        # 三条的中心必须压在实测水位线上 —— 这条断言就是用来防"位置漂到水下去了还看不出来"
        # 五条从水位线（30.3%）往下铺到 ~36.5%，覆盖图里那条亮水带；
        # 低于 26% 就进了空气层，高于 38% 就掉出亮水带 —— 两头都不许。
        for ln in info["lines"]:
            c = ln["centerCard"]
            if not (26.0 <= c <= 38.0):
                bad.append(f"{ln['cls']}: 中心在卡高 {c:.1f}%，不在水位线一带（26–38%）"
                           f"—— 高于 26% 是空气层，低于 38% 掉出亮水带")

        # 冻结在 0 / 0.5 / 0.999 三个相位，看 svg 是否始终盖住容器
        print("\n相位覆盖（svg 相对容器的左右边界，必须始终包住 0…容器宽）：")
        for cls in LINES:
            spans = []
            for phase in (0.0, 0.5, 0.999):
                page.evaluate(FREEZE, [cls, phase])
                page.wait_for_timeout(60)
                r = page.evaluate(
                    """c => { const el = document.querySelector(`.oshi-wave.${c}`);
                       const er = el.getBoundingClientRect();
                       const sr = el.querySelector('svg').getBoundingClientRect();
                       return [sr.left - er.left, sr.right - er.left, er.width]; }""", cls)
                spans.append((phase, round(r[0], 1), round(r[1], 1), round(r[2], 1)))
            worst = min(spans, key=lambda s: min(s[1], s[3] - s[2]))
            covers = all(s[1] <= 0.5 and s[2] >= s[3] - 0.5 for s in spans)
            print(f"  {cls}: " + "  ".join(f"φ={p} → [{l}, {r}]" for p, l, r, _ in spans)
                  + f"   {'✓ 全程盖住' if covers else '✗ 露空'}")
            if not covers:
                bad.append(f"{cls}: 相位 {worst[0]} 时露出空档")
        ctx.close()
        b.close()
    if bad:
        print("\n❌ " + "\n   ".join(bad))
        raise SystemExit(1)
    print(f"\n✅ {len(LINES)} 条中心都落在水位线一带，且漂移全程无缝（svg 富余量都 ≥ 一个周期）")


if __name__ == "__main__":
    main()
