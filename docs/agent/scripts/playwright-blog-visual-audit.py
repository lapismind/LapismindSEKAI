"""博客全页截图：桌面/手机 × 亮/暗，用于视觉审阅前后对比。

用法：python playwright-blog-visual-audit.py <base_url> <输出子目录名>
输出：docs/agent/scripts/out/<子目录>/<页面>-<视口>-<主题>.png
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4321"
TAG = sys.argv[2] if len(sys.argv) > 2 else "before"
OUT = Path(__file__).resolve().parent / "out" / TAG
OUT.mkdir(parents=True, exist_ok=True)

PAGES = {
    "home": "/",
    "blog": "/blog/",
    "post": "/blog/design-kit/",
    "projects": "/projects/",
    "works": "/works/",
    "about": "/about/",
    "404": "/nope-404/",
    "game": "/projects/turtle-soup/",
}
VIEWPORTS = {"desk": (1440, 900), "mob": (390, 844)}
only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None

with sync_playwright() as p:
    browser = p.chromium.launch()
    for vname, (w, h) in VIEWPORTS.items():
        for theme in ("light", "dark"):
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1,
                                      reduced_motion="reduce")
            ctx.add_init_script(
                f"try{{sessionStorage.setItem('lapismind-intro','1');localStorage.setItem('theme','{theme}')}}catch(e){{}}"
            )
            page = ctx.new_page()
            for name, path in PAGES.items():
                if only and name not in only:
                    continue
                page.goto(BASE + path, wait_until="load")
                page.wait_for_timeout(1200)
                # 触发滚动显现动画
                page.evaluate("""async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0)}""")
                page.add_style_tag(content="#l2d-widget,.l2d-card{display:none!important} *{animation-delay:0s!important}")
                page.wait_for_timeout(400)
                page.screenshot(path=str(OUT / f"{name}-{vname}-{theme}.png"), full_page=True)
                print("shot", name, vname, theme)
            ctx.close()
    browser.close()
