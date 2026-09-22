"""验证两条层叠/裁切假设（决定她能不能被看见、水下那层怎么切）。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-zindex-probe.py

A) .oshi-figure 不加 z-index（现状）时，她在水线以下是否被 .oshi-below 的水色渐变盖住。
B) clip-path 与 transform 写在同一元素上时，裁切会不会跟着 transform 一起移动
   （决定"水下平移"要写在里层还是外层）。
"""
import io

from PIL import Image
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"

INJECT = r"""
() => {
  const fig = document.querySelector('.oshi-figure');
  const probe = document.createElement('div');
  probe.id = '__probe';
  probe.style.cssText = 'position:absolute;right:0;top:0;width:260px;height:559px;background:rgb(255,0,0);';
  fig.appendChild(probe);
  // 把卡滚到视口顶，再量
  document.querySelector('.oshi-card').scrollIntoView({ block: 'start', behavior: 'instant' });
  const card = document.querySelector('.oshi-card').getBoundingClientRect();
  const below = document.querySelector('.oshi-below').getBoundingClientRect();
  return { cardTop: card.top, cardLeft: card.left, cardW: card.width, waterLine: below.top - card.top };
}
"""


def sample(page, points):
    """points: [(x, y)] 视口坐标 -> 返回该点 RGB"""
    shot = page.screenshot(full_page=False)
    img = Image.open(io.BytesIO(shot)).convert("RGB")
    return [img.getpixel(p) for p in points]


def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(URL, wait_until="load")
        page.evaluate("() => window.scrollTo({top: 0, behavior: 'instant'})")
        page.wait_for_timeout(300)

        info = page.evaluate(INJECT)
        page.wait_for_timeout(400)
        info = page.evaluate(
            "() => { const c = document.querySelector('.oshi-card').getBoundingClientRect();"
            " const b = document.querySelector('.oshi-below').getBoundingClientRect();"
            " return { cardTop: c.top, cardLeft: c.left, cardW: c.width, waterLine: b.top - c.top }; }"
        )
        card_top = info["cardTop"]
        wl = info["waterLine"]
        card = {"x": info["cardLeft"], "w": info["cardW"]}
        x = int(card["x"] + card["w"] - 130)  # 她那一列（右 34% 内）
        y_above = int(card_top + 150)
        y_below = int(card_top + 400)

        pts = [(x, y_above), (x, y_below)]
        print(f"card_left={card['x']:.0f} card_w={card['w']:.0f} waterLine_y={wl:.1f} probe_x={x}")
        px = sample(page, pts)
        print(f"[A 现状 z-index:auto] 水线上 y={y_above} -> {px[0]}   水线下 y={y_below} -> {px[1]}")

        page.evaluate("() => { document.querySelector('.oshi-figure').style.zIndex = '1'; }")
        page.wait_for_timeout(150)
        px = sample(page, pts)
        print(f"[A' 加 z-index:1     ] 水线上 y={y_above} -> {px[0]}   水线下 y={y_below} -> {px[1]}")

        # B) clip-path + transform 同一元素
        page.evaluate("() => { document.querySelector('#__probe').remove(); }")
        page.evaluate(
            """() => {
              const box = document.createElement('div');
              box.id = '__clipbox';
              box.style.cssText = 'position:absolute;left:0;top:0;width:60px;height:100px;background:rgb(0,0,255);'
                + 'clip-path:inset(0 0 50% 0);transform:translateY(120px);';
              document.querySelector('.oshi-card').appendChild(box);
            }"""
        )
        page.wait_for_timeout(150)
        page.evaluate("() => document.querySelector('.oshi-card').scrollIntoView({block:'start', behavior:'instant'})")
        page.wait_for_timeout(300)
        card2 = page.evaluate("() => { const r = document.querySelector('.oshi-card').getBoundingClientRect(); return {x: r.left, y: r.top}; }")
        bx = int(card2["x"] + 20)
        rows = [int(card2["y"] + dy) for dy in (20, 70, 110, 140, 190)]
        px = sample(page, [(bx, ry) for ry in rows])
        for ry, c in zip(rows, px):
            print(f"[B clip+transform] y=+{ry - int(card2['y'])} -> {c}")
        print("  (蓝 = 可见。若蓝只出现在 +120~+170 的上半段，说明裁切跟着 transform 走了)")
        b.close()


if __name__ == "__main__":
    main()
