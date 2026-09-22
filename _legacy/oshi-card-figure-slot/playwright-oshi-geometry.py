"""量 /about/ 单推卡的几何（水线、文字右边界、她的空位）。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-geometry.py

依赖: 本机 Python 3.13 的 playwright（浏览器二进制缺失时 python -m playwright install chromium）。
一次性脚本，量完即归档进 _legacy/。
"""
import json

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
WIDTHS = [1440, 1280, 1200, 1024, 900, 800, 768, 701, 700, 390]

JS = r"""
() => {
  const card = document.querySelector('.oshi-card');
  if (!card) return { error: 'no .oshi-card' };
  const cr = card.getBoundingClientRect();
  const rel = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: +(r.left - cr.left).toFixed(1),
      y: +(r.top - cr.top).toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      right: +(r.right - cr.left).toFixed(1),
      bottom: +(r.bottom - cr.top).toFixed(1),
    };
  };
  const above = document.querySelector('.oshi-above');
  const below = document.querySelector('.oshi-below');
  const cs = getComputedStyle(card);
  const csAbove = above ? getComputedStyle(above) : null;
  const facts = document.querySelector('.oshi-facts');
  const csFacts = facts ? getComputedStyle(facts) : null;
  return {
    card: { w: +cr.width.toFixed(1), h: +cr.height.toFixed(1) },
    padding: cs.padding,
    fontSizeCard: cs.fontSize,
    above: rel(above),
    aboveFontSize: csAbove ? csAbove.fontSize : null,
    aboveMaxWidth: csAbove ? csAbove.maxWidth : null,
    below: rel(below),
    waterLineY: below ? +(below.getBoundingClientRect().top - cr.top).toFixed(1) : null,
    facts: rel(facts),
    factsCols: csFacts ? csFacts.gridTemplateColumns : null,
    depth: rel(document.querySelector('.oshi-depth')),
    theme: rel(document.querySelector('.oshi-theme')),
    tagline: rel(document.querySelector('.oshi-tagline-slot')),
    sand: rel(document.querySelector('.hs-sand')),
    surface: rel(document.querySelector('.oshi-surface')),
    figure: rel(document.querySelector('.oshi-figure')),
    docScrollW: document.documentElement.scrollWidth,
  };
}
"""


def main():
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for width in WIDTHS:
            for theme in ("light", "dark"):
                ctx = b.new_context(viewport={"width": width, "height": 1000}, device_scale_factor=1)
                page = ctx.new_page()
                page.goto(URL, wait_until="load")
                page.evaluate(
                    "t => { document.documentElement.dataset.theme = t; }", theme
                )
                page.evaluate("() => window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})")
                page.wait_for_timeout(400)
                page.evaluate("() => window.scrollTo({top: 0, behavior: 'instant'})")
                page.wait_for_timeout(300)
                data = page.evaluate(JS)
                out[f"{width}-{theme}"] = data
                ctx.close()
        b.close()
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
