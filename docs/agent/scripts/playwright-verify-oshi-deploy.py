"""生产验证：blog.qmzhj.top/about/ 的单推卡。

本地全绿不等于线上全绿 —— 这套东西依赖三样线上才成立的前提：构建产物的哈希资源、
站点全局 CSS（.sr-only / 主题脚本）、以及真实网络下的图片加载。所以部署后必须回生产量一遍。

用法：python docs/agent/scripts/playwright-verify-oshi-deploy.py [版本号]
"""
import sys
import urllib.request

from playwright.sync_api import sync_playwright

URL = "https://blog.qmzhj.top/about/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"}


def head(url):
    req = urllib.request.Request(url, headers=UA, method="GET")
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.status, r.headers.get("content-type"), len(r.read())


def main():
    ver = sys.argv[1] if len(sys.argv) > 1 else "(未给版本)"
    bad = []
    print(f"生产验证 /about/  期望版本 {ver}\n")

    st, ct, n = head(URL)
    print(f"  /about/  {st}  {ct}  {n/1024:.0f} KB")
    if st != 200:
        bad.append(f"/about/ 返回 {st}")

    html = urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=25).read().decode()
    # **不要在 HTML 文本里数字符串**：`oshi-inner-title` / `oshi-inner-rows` 都含 `oshi-inner`，
    # 内联脚本里还有一堆选择器字符串 —— 数出来全是假数（第一版就这么白报了三条错）。
    # 要数就在浏览器里数 DOM 节点，那才是权威。
    import re
    for m in re.finditer(r'src="(/_astro/oshi-(?:day|night)[^"]+)"', html):
        st, ct, n = head("https://blog.qmzhj.top" + m.group(1))
        print(f"  {m.group(1)[:52]:54s} {st} {ct} {n/1024:.0f} KB")
        if st != 200 or "image" not in (ct or ""):
            bad.append(f"{m.group(1)} → {st} {ct}")

    # 真浏览器：无报错、五条水线在、水面之下亮 0 暗 1、点击冒泡、卡片尺寸
    with sync_playwright() as p:
        b = p.chromium.launch()
        errs = []
        ctx = b.new_context(viewport={"width": 1600, "height": 1000})
        page = ctx.new_page()
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(1200)
        page.evaluate("() => document.querySelector('.oshi-card')"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(900)
        g = page.evaluate("""() => {
          const c = document.querySelector('.oshi-card');
          const r = c.getBoundingClientRect();
          const q = (s) => document.querySelectorAll(s).length;
          return {w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                  waves: q('.oshi-wave'),
                  counts: {
                    '.oshi-card': q('.oshi-card'),
                    '.oshi-photo': q('.oshi-photo'),
                    '.oshi-water-inner': q('.oshi-water-inner'),
                    '.oshi-inner': q('.oshi-inner'),
                    '.oshi-tagline-slot': q('.oshi-tagline-slot'),
                    'img.oshi-shot-day': q('img.oshi-shot-day'),
                    'img.oshi-shot-night': q('img.oshi-shot-night'),
                  },
                  fonts: getComputedStyle(c.querySelector('.oshi-head h3')).fontFamily.split(',')[0]};
        }""")
        print(f"\n  真浏览器：卡片 {g['w']}×{g['h']}  水线 {g['waves']} 条  名字字体 {g['fonts']}")
        print("  DOM 节点数：" + "  ".join(f"{k}={v}" for k, v in g["counts"].items()))
        # 线上只有一张卡（亮暗并排那个布局只存在于预览页）
        for key, want in ((".oshi-card", 1), (".oshi-photo", 1), (".oshi-water-inner", 1),
                          (".oshi-inner", 1), (".oshi-tagline-slot", 1),
                          ("img.oshi-shot-day", 1), ("img.oshi-shot-night", 1)):
            if g["counts"][key] != want:
                bad.append(f"{key} 应有 {want} 个，实际 {g['counts'][key]}")
        if g["waves"] != 5:
            bad.append(f"水线应为 5 条，实际 {g['waves']}")
        if g["fonts"] != '"LXGW WenKai Screen"':
            bad.append(f"名字字体是 {g['fonts']}，不是 LXGW WenKai Screen（又掉回宋体？）")
        if abs(g["w"] - 760) > 1:
            bad.append(f"卡片宽 {g['w']}，应为 760")

        for theme, want in (("light", 0.0), ("dark", 1.0)):
            page.evaluate("t => { document.documentElement.dataset.theme = t; }", theme)
            page.wait_for_function(
                "w => { const e = document.querySelector('.oshi-inner');"
                " return e && Math.abs(parseFloat(getComputedStyle(e).opacity) - w) < 0.004; }",
                arg=want, timeout=4000)
            got = page.evaluate("() => +getComputedStyle(document.querySelector('.oshi-inner')).opacity")
            print(f"  水面之下 opacity（{theme}）= {got}")
            if abs(got - want) > 0.01:
                bad.append(f"{theme} 下水面之下 opacity 是 {got}，应为 {want}")

        page.evaluate("() => { document.documentElement.dataset.theme = 'dark'; }")
        page.wait_for_timeout(400)
        wb = page.evaluate("""() => {
          const w = document.querySelector('.oshi-water-inner').getBoundingClientRect();
          return [w.left + w.width * 0.3, w.top + w.height * 0.55];
        }""")
        page.mouse.click(wb[0], wb[1])
        page.wait_for_timeout(250)
        pop = page.evaluate("() => document.querySelectorAll('.oshi-pop').length")
        pos = page.evaluate("() => [...document.querySelectorAll('.oshi-pop')]"
                            ".map(e => getComputedStyle(e).position)")
        print(f"  点击水面 → {pop} 颗气泡，position={set(pos) or '—'}")
        if pop < 5 or set(pos) != {"absolute"}:
            bad.append(f"线上点击冒泡没生效（{pop} 颗，position={set(pos)}）")
        if errs:
            bad.append("页面报错：" + " | ".join(errs[:3]))
        print(f"  页面报错：{errs if errs else '无 ✓'}")
        ctx.close()
        b.close()

    if bad:
        print("\n❌ 生产验证不通过：")
        for x in bad:
            print("   -", x)
        raise SystemExit(1)
    print("\n✅ 生产验证通过")


if __name__ == "__main__":
    main()
