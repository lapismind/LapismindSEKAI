# -*- coding: utf-8 -*-
"""验收 /works/（Projects 板块）：多宽度截图 + 关键断言。

用法（先起 blog 预览：cd blog && npm run preview）：
  python docs/agent/scripts/playwright-verify-works.py

产出：截图存 %TEMP%/sekai-works-shots/，控制台打印断言结果。
注意：.reveal 元素在视口外是 opacity:0（见 blog lessons-learned 第 20 条），
全页截图前必须先滚一遍页面。
"""

import json
import os
import sys
import tempfile

from playwright.sync_api import sync_playwright

BASE = os.environ.get("VERIFY_BASE", "http://localhost:4321")
OUT = os.path.join(tempfile.gettempdir(), "sekai-works-shots")
os.makedirs(OUT, exist_ok=True)

SCROLL_THEN_TOP = """async () => {
  // 站点开了 scroll-behavior: smooth（global.css），scrollTo 会播平滑动画：
  // 连续调用互相打断、永远到不了底部。验证必须 behavior: 'instant'。
  await new Promise((resolve) => {
    let y = 0;
    const step = () => {
      y += 400;
      window.scrollTo({ top: y, behavior: 'instant' });
      // scrollHeight 每步重读：图片加载会让页面变高，固定步数会提前收工
      if (y < document.body.scrollHeight) setTimeout(step, 50);
      else resolve();
    };
    step();
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}"""

ALL_IMAGES_LOADED = """() => Array.from(document.images).every(
  (i) => i.complete && (i.naturalWidth > 0 || !i.src)
)"""

ALL_REVEALED = """() => Array.from(document.querySelectorAll('.reveal')).every(
  (el) => getComputedStyle(el).opacity === '1'
)"""

# (路径, 宽, 高, 名称, 是否全页)
SHOTS = [
    ("/works/", 1440, 900, "works-1440", True),
    ("/works/runestaff/", 1440, 900, "runestaff-1440", True),
    ("/projects/", 1440, 900, "projects-1440", True),
    ("/works/", 390, 844, "works-390", False),
    ("/works/runestaff/", 390, 844, "runestaff-390", True),
    ("/works/", 360, 780, "header-360", False),
    ("/works/", 320, 568, "header-320", False),
]

CHECKS = [
    ("/works/", [
        ("nav has Projects link", "header nav a[href='/works']"),
        ("list card title", ".work-item h2"),
        ("list github link", ".work-item a[href*='github.com/lapismind/mhwilds-rune-staff-release']"),
        ("list download link", ".work-item a[href='/downloads/RuneStaff-v1.0.zip']"),
    ]),
    ("/works/runestaff/", [
        ("download button", "a.btn-primary[href='/downloads/RuneStaff-v1.0.zip']"),
        ("github button", "a.btn-ghost[href*='github.com/lapismind/mhwilds-rune-staff-release']"),
        ("three shots", ".shots figure img"),
        ("troubleshoot table", ".troubleshoot tbody tr"),
    ]),
]


def main():
    results = {}
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for path, width, height, name, full_page in SHOTS:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(BASE + path, wait_until="load")
            page.wait_for_timeout(500)
            # 图片懒加载会让页面高度增长：滚动两轮，中间等图片全部加载完，
            # 最后轮询等 .reveal 全部可见（is-visible 有过渡动画，别只等一次）——
            # 仍不满足就不许截图（否则拍出假空白页）
            for _ in range(3):
                page.evaluate(SCROLL_THEN_TOP)
                try:
                    page.wait_for_function(ALL_REVEALED, timeout=4000)
                    break
                except Exception:
                    continue
            else:
                raise SystemExit(f"{path}: .reveal 元素未全部可见，截图会拍到空白，先查 reveal 触发")
            page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=full_page)
            page.close()

        for path, checks in CHECKS:
            page = browser.new_page(viewport={"width": 1440, "height": 900})
            page.goto(BASE + path, wait_until="load")
            page.wait_for_timeout(400)
            for label, selector in checks:
                count = page.locator(selector).count()
                results[f"{path} {label}"] = count
                if count == 0:
                    failed.append(f"{path} {label} (selector: {selector})")
            page.close()

            # 窄屏断言：≤480px 时 Projects 标签应换成「作品」
            if path == "/works/":
                page = browser.new_page(viewport={"width": 390, "height": 844})
                page.goto(BASE + path, wait_until="load")
                page.wait_for_timeout(300)
                full_visible = page.locator("header .nav-full").is_visible()
                short_visible = page.locator("header .nav-short").is_visible()
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth > document.documentElement.clientWidth"
                )
                results["390px nav-full hidden"] = not full_visible
                results["390px nav-short visible"] = short_visible
                results["390px no horizontal overflow"] = not overflow
                if full_visible or not short_visible or overflow:
                    failed.append(f"390px nav swap broken: full={full_visible} short={short_visible} overflow={overflow}")
                page.close()
        browser.close()

    print(json.dumps(results, ensure_ascii=False, indent=1))
    print("shots dir:", OUT)
    if failed:
        print("FAILED:", *failed, sep="\n  ")
        sys.exit(1)
    print("all_passed: true")


if __name__ == "__main__":
    main()
