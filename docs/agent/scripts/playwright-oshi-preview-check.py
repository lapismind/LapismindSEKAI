"""验证自包含预览页：字体真的对、主题作用域没串、滚动弹簧还在跑。

关键：用 file:// 打开 —— 这正是"双击打开"的路径，能顺带证明它真的脱网自包含
（若还有任何资源指向 /_astro/… 或本地文件，这里会露出来）。

用法：python docs/agent/scripts/playwright-oshi-preview-check.py
输出：docs/agent/scripts/out/oshi-preview/*.png
"""
import pathlib

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

PREVIEW = pathlib.Path(__file__).resolve().parents[3] / "docs" / "agent" / "scripts" / "out" / "oshi-preview" / "index.html"
URL = PREVIEW.as_uri()

FONTS = """
() => {
  const out = [];
  for (const [sel, label] of [
    ['.oshi-head h3', '名字'],
    ['.oshi-unit', '单位行'],
    ['.oshi-facts .oshi-fact:nth-child(1) .k', '标签 生日'],
    ['.oshi-inner-title', '她自己写的'],
  ]) {
    const el = document.querySelector(sel);
    out.push([label, el ? getComputedStyle(el).fontFamily.split(',')[0] : 'MISSING']);
  }
  return out;
}
"""


def ruler(shot: pathlib.Path, out: pathlib.Path, top=0.24, bottom=0.40, until=0.62):
    """把水线那一段裁出来放大 2x，每 2% 画一条标尺 —— 用来核对"波形有没有压在图上那条水位线上"。"""
    im = Image.open(shot).convert("RGB")
    h = im.height
    crop = im.crop((0, int(h * top), int(im.width * until), int(h * bottom)))
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    d = ImageDraw.Draw(crop)
    for pct in range(int(top * 100), int(bottom * 100) + 1, 2):
        y = int((pct / 100 * h - h * top) * 2)
        d.line([(0, y), (24, y)], fill=(255, 80, 80), width=2)
        d.text((28, y - 7), f"{pct}%", fill=(255, 140, 140))
    crop.save(out)


def main():
    missing = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        page = ctx.new_page()
        page.on("requestfailed", lambda r: missing.append(r.url))
        page.on("response", lambda r: missing.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(1200)

        # 1) 外部请求：自包含的话，除 file:// 自身外不该有别的
        external = [u for u in missing if not u.startswith("file:")]
        print(f"外部/失败请求：{external if external else '无 ✓'}")

        # 2) 字体：两个主题作用域里各查一遍
        for theme in ("light", "dark"):
            sec = page.query_selector(f"section[data-theme='{theme}'] .oshi-card")
            if not sec:
                print(f"  {theme}: 找不到卡片 ✗")
                continue
            sec.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            print(f"  [{theme}] " + "  ".join(f"{k}={v}" for k, v in page.evaluate(FONTS)))

        # 3) 主题作用域没串：亮色卡里的图必须是白天那张，暗色卡里必须是夜里那张
        for theme, want in (("light", "day"), ("dark", "night")):
            vis = page.evaluate(
                """t => {
                  const c = document.querySelector(`section[data-theme='${t}'] .oshi-card`);
                  return [...c.querySelectorAll('img')]
                    .filter(i => getComputedStyle(i).display !== 'none')
                    .map(i => i.className);
                }""", theme)
            ok = len(vis) == 1 and want in vis[0]
            print(f"  [{theme}] 可见图 = {vis}  {'✓' if ok else '✗ 应为 ' + want}")

        # 4) 水面之下：亮色不显、暗色显
        for theme, want in (("light", 0.0), ("dark", 1.0)):
            page.evaluate("t => document.querySelector(`section[data-theme='${t}'] .oshi-card`)"
                          ".scrollIntoView({block:'center',behavior:'instant'})", theme)
            page.wait_for_function(
                "([t,w]) => { const e=document.querySelector(`section[data-theme='${t}'] .oshi-inner`);"
                " return e && Math.abs(parseFloat(getComputedStyle(e).opacity)-w)<0.01; }",
                arg=[theme, want], timeout=4000)
            got = page.evaluate("t => parseFloat(getComputedStyle("
                                "document.querySelector(`section[data-theme='${t}'] .oshi-inner`)).opacity)", theme)
            print(f"  [{theme}] 水面之下 opacity = {got}  {'✓' if abs(got - want) < 0.01 else '✗'}")

        # 5) 滚动弹簧：在预览页里也真的跑
        page.evaluate("() => document.querySelector(\"section[data-theme='dark'] .oshi-card\")"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(1500)
        vals = []
        for _ in range(14):
            page.mouse.wheel(0, 45)
            page.wait_for_timeout(70)
            vals.append(page.evaluate("() => +getComputedStyle("
                                      "document.querySelector(\"section[data-theme='dark'] .oshi-card\"))"
                                      ".getPropertyValue('--slosh')"))
        for _ in range(14):
            page.wait_for_timeout(70)
            vals.append(page.evaluate("() => +getComputedStyle("
                                      "document.querySelector(\"section[data-theme='dark'] .oshi-card\"))"
                                      ".getPropertyValue('--slosh')"))
        peak = max(vals, key=abs)
        tail = max(abs(v) for v in vals[len(vals) // 2:])
        print(f"  --slosh 峰值 {peak:+.3f}，后半段最大 |v| {tail:.3f}  "
              f"{'✓ 有冲量且荡平' if abs(peak) > 0.05 and tail < abs(peak) else '✗'}")

        # 5b) 点击冒泡在预览页里也得能用（预览内联的是源码 CSS，:global() 要靠生成器拆掉）
        page.evaluate("() => document.querySelector(\"section[data-theme='dark'] .oshi-card\")"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(500)
        wb = page.evaluate("""() => {
          const w = document.querySelector(\"section[data-theme='dark'] .oshi-water-inner\").getBoundingClientRect();
          return [w.left + w.width * 0.3, w.top + w.height * 0.55];
        }""")
        page.mouse.click(wb[0], wb[1])
        page.wait_for_timeout(200)
        npop = page.evaluate("() => document.querySelectorAll('.oshi-pop').length")
        pos = page.evaluate("""() => { const w = document.querySelector(\"section[data-theme='dark'] .oshi-water-inner\").getBoundingClientRect();
          return [...document.querySelectorAll('.oshi-pop')].map(e => getComputedStyle(e).position); }""")
        print(f"  预览页点击冒泡：{npop} 颗，position 全为 absolute？{set(pos) == {'absolute'}}")
        if npop < 5 or set(pos) != {"absolute"}:
            print("  ✗ 预览页的点击冒泡没生效（多半是 :global() 没拆掉）")
        page.wait_for_timeout(3200)

        # 6) 出图
        for theme in ("light", "dark"):
            page.evaluate("t => document.querySelector(`section[data-theme='${t}'] .oshi-card`)"
                          ".scrollIntoView({block:'center',behavior:'instant'})", theme)
            page.wait_for_timeout(900)
            shot = PREVIEW.parent / f"preview-{theme}.png"
            page.query_selector(f"section[data-theme='{theme}'] .oshi-card").screenshot(path=str(shot))
            ruler(shot, PREVIEW.parent / f"ruler-{theme}.png")
        ctx.close()

        # 7) 保真度：预览页的卡片 vs 线上真实渲染，逐像素比。
        #    两边都关动效（reduced_motion）、都藏固定图层 —— 否则差的是雪和动画相位，不是版式。
        #    **不能直接比**：两张卡在各自布局里纵向差 0.36px（实测线上 y=119.828 / 预览 y=120.188），
        #    元素截图按整数取整后整体错开一行 → "每条边缘都不同"，看着像版式坏了。
        #    真实保真度要扫一遍整数位移取最小值：只留图片时对齐后差 **0.00**（逐像素一致）。
        print("\n保真度（预览 vs 线上，均关动效、均吸附整数像素）：")
        snap = ("s => { const c = document.querySelector(s);"
                " const r = c.getBoundingClientRect();"
                " window.scrollBy(0, Math.round(r.top) - r.top); }")
        live = PREVIEW.parent / "_live"
        live.mkdir(exist_ok=True)
        for theme in ("light", "dark"):
            c2 = b.new_context(viewport={"width": 1600, "height": 1000},
                               device_scale_factor=1, reduced_motion="reduce")
            pg2 = c2.new_page()
            pg2.goto("http://127.0.0.1:8777/about/", wait_until="load")
            pg2.add_style_tag(content=".snow-canvas,.l2d-particles,#l2d-widget{display:none!important}")
            pg2.evaluate("t => { document.documentElement.dataset.theme = t; }", theme)
            pg2.evaluate("() => document.querySelector('.oshi-card')"
                         ".scrollIntoView({block:'center',behavior:'instant'})")
            pg2.wait_for_timeout(400)
            pg2.evaluate(snap, ".oshi-card")
            pg2.wait_for_timeout(500)
            pg2.query_selector(".oshi-card").screenshot(path=str(live / f"live-{theme}.png"))
            c2.close()

            # 视口必须与线上那张**一样宽**：卡片在视口里的横向位置不同 → 亚像素对齐不同
            # → 所有边缘的反锯齿都不同，比出来全是"边缘轮廓"，看着像版式坏了其实不是。
            c3 = b.new_context(viewport={"width": 1600, "height": 1000},
                               device_scale_factor=1, reduced_motion="reduce")
            pg3 = c3.new_page()
            pg3.goto(URL, wait_until="load")
            pg3.evaluate("t => document.querySelector(`section[data-theme='${t}'] .oshi-card`)"
                         ".scrollIntoView({block:'center',behavior:'instant'})", theme)
            pg3.wait_for_timeout(400)
            pg3.evaluate(snap, f"section[data-theme='{theme}'] .oshi-card")
            pg3.wait_for_timeout(500)
            pg3.query_selector(f"section[data-theme='{theme}'] .oshi-card").screenshot(
                path=str(live / f"prev-{theme}.png"))
            c3.close()

            a = Image.open(live / f"live-{theme}.png").convert("RGB")
            d = Image.open(live / f"prev-{theme}.png").convert("RGB")
            if a.size != d.size:
                d = d.resize(a.size, Image.LANCZOS)
            na, nd = np.asarray(a, dtype=np.int16), np.asarray(d, dtype=np.int16)
            raw = np.abs(na - nd).mean()
            # 直接比会被 1px 取整偏移吃掉：两张卡在各自布局里的纵向位置差 0.36px，
            # 元素截图按整数取整后整体错开一行，于是"每条边缘都不同"。
            # 扫一遍整数位移取最小 —— 那才是真实保真度。
            best = min(
                (np.abs(
                    na[max(0, dy):na.shape[0] + min(0, dy), max(0, dx):na.shape[1] + min(0, dx)]
                    - nd[max(0, -dy):nd.shape[0] + min(0, -dy), max(0, -dx):nd.shape[1] + min(0, -dx)]
                ).mean(), dx, dy)
                for dy in range(-3, 4) for dx in range(-3, 4)
            )
            print(f"  [{theme}] 对齐后平均差 {best[0]:5.2f}（位移 dx={best[1]} dy={best[2]}）"
                  f"   未对齐 {raw:5.2f}")
        b.close()
    print("->", PREVIEW.parent)


if __name__ == "__main__":
    main()
