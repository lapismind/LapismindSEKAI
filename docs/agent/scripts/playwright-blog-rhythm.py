"""音游元素冒烟：首页迷你谱面在跑、点击特效会出现并自删、板块页眉音符播过、换页后谱面重新初始化。
用法：先在 blog/ 下 `npx astro preview --port 4399`，再 `py -3.13 docs/agent/scripts/playwright-blog-rhythm.py`
截图输出到 docs/agent/scripts/out/rhythm/。"""
import pathlib, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4399"
OUT = pathlib.Path(__file__).parent / "out" / "rhythm"
OUT.mkdir(parents=True, exist_ok=True)
fails = []

def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)

def lane_hash(page):
    return page.evaluate("""() => {
        const c = document.querySelector('.note-lane-canvas');
        if (!c) return null;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let h = 0, ink = 0;
        for (let i = 3; i < d.length; i += 16) { h = (h * 31 + d[i] + d[i-1]) | 0; if (d[i] > 0) ink++; }
        return [h, ink];
    }""")

with sync_playwright() as p:
    b = p.chromium.launch()
    for theme in ("light", "dark"):
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        ctx.add_init_script(f"sessionStorage.setItem('lapismind-intro','1');localStorage.setItem('theme','{theme}')")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/", wait_until="load")
        page.wait_for_timeout(1500)
        page.evaluate("document.getElementById('intro')?.remove()")
        page.locator(".note-lane").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        a = lane_hash(page)
        page.wait_for_timeout(400)
        bb = lane_hash(page)
        check(a is not None and a[1] > 100, f"[{theme}] 谱面画出内容 ink={a and a[1]}")
        check(a != bb, f"[{theme}] 谱面在动")
        page.locator("section.status").screenshot(path=str(OUT / f"status-{theme}.png"))
        # 点击特效
        page.mouse.click(300, 300)
        n1 = page.locator(".tap-fx").count()
        page.wait_for_timeout(700)
        n2 = page.locator(".tap-fx").count()
        check(n1 >= 1 and n2 == 0, f"[{theme}] 点击特效出现({n1})并自删({n2})")
        # 板块页眉音符
        page.locator("#featured .sec-head").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.locator("#featured .sec-head").screenshot(path=str(OUT / f"sechead-mid-{theme}.png"))
        page.wait_for_timeout(1200)
        anim = page.evaluate("getComputedStyle(document.querySelector('#featured .sec-head'),'::before').animationName")
        check(anim == "sec-note", f"[{theme}] 页眉音符动画挂上 ({anim})")
        # 换页往返
        page.click("a[href='/projects/']")
        page.wait_for_timeout(1200)
        page.click("header a[href='/']")
        page.wait_for_timeout(1500)
        page.locator(".note-lane").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        c1 = lane_hash(page); page.wait_for_timeout(400); c2 = lane_hash(page)
        check(c1 is not None and c1 != c2, f"[{theme}] 换页回来谱面仍在动")
        check(not errors, f"[{theme}] 无脚本异常 {errors}")
        ctx.close()
    # 窄屏 + 横向溢出
    ctx = b.new_context(viewport={"width": 360, "height": 780})
    ctx.add_init_script("sessionStorage.setItem('lapismind-intro','1')")
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="load")
    page.wait_for_timeout(1500)
    page.evaluate("document.getElementById('intro')?.remove()")
    page.locator(".note-lane").scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    sw = page.evaluate("document.documentElement.scrollWidth")
    check(sw <= 360, f"[360] 无横向溢出 scrollWidth={sw}")
    page.locator("section.status").screenshot(path=str(OUT / "status-360.png"))
    ctx.close()
    # 减少动效
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="load")
    page.wait_for_timeout(1200)
    page.locator(".note-lane").scroll_into_view_if_needed()
    a = lane_hash(page); page.wait_for_timeout(500); bb = lane_hash(page)
    check(a is not None and a[1] > 100 and a == bb, "[reduce] 静态一帧、不动")
    page.mouse.click(300, 300)
    check(page.locator(".tap-fx").count() == 0, "[reduce] 无点击特效")
    ctx.close()
    b.close()

print("ALL PASS" if not fails else f"{len(fails)} FAIL")
sys.exit(1 if fails else 0)
