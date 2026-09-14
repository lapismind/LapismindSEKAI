"""对局截图（UI 评审用）：三种视口 + 闷牌轮的关键状态。

需要先起服务：
    cd showhand && npx wrangler dev --port 8788 --local

用法：
    py -3.13 tests/ui-screenshot.py [输出目录]

注意：不固定 sleep，而是轮询等待应用真的渲染出来 ——
本地 /api/identity 会先失败一次（未配 IDENTITY_SECRET），
再叠加 auth.init 的 2 秒超时，固定延时很容易截到空白页。
"""
import random
import re
import string
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8788"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "screenshots")
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    ("desktop", 1440, 900, False),
    ("tablet", 820, 1180, False),
    ("mobile", 390, 844, True),
]


def wait_room_ready(page, room, timeout=20000):
    """等到房间页真的渲染出房间号，而不是固定 sleep"""
    page.wait_for_function(
        """(room) => {
            const t = document.body.innerText || '';
            return t.includes('房间 ' + room) || t.includes('房间\\u00a0' + room);
        }""",
        arg=room,
        timeout=timeout,
    )


def shoot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"))
    print("  saved", OUT / f"{name}.png")


def main():
    room = "U" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        pages = {}
        for name, w, h, mobile in VIEWPORTS:
            # reduced_motion 让 base.css 关掉过渡动画：面板每次下注都会重渲染，
            # 有过渡时元素一直"不稳定"，Playwright 点不中
            ctx = browser.new_context(
                viewport={"width": w, "height": h}, is_mobile=mobile, reduced_motion="reduce"
            )
            pg = ctx.new_page()
            pg.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))
            pg.goto(f"{BASE}/room/{room}")
            wait_room_ready(pg, room)
            pages[name] = pg

        host = pages["desktop"]
        # 局数设为 1，好顺手截到"整场结束"面板
        host.get_by_role("button", name="房间设置").click()
        host.wait_for_timeout(400)
        config = host.locator("div.fixed", has_text="房间设置")
        config.locator("input[type=number]").first.fill("1")
        config.get_by_role("button", name="保存").click()
        host.wait_for_timeout(500)

        host.get_by_role("button", name="开始游戏").click()
        host.wait_for_timeout(1500)

        for name, pg in pages.items():
            shoot(pg, f"blind-{name}")

        # 让 mobile 那一位看牌，截"看牌之后"的对比
        mob = pages["mobile"]
        look = mob.get_by_role("button", name=re.compile("看牌"))
        if look.count() and look.first.is_visible():
            look.first.click()
            mob.wait_for_timeout(900)
            shoot(mob, "blind-mobile-after-look")
        else:
            print("  (mobile 本轮不是行动者，跳过看牌截图)")

        # 轮流跟注直到摊牌，截摊牌弹层与整场结束面板
        def try_call(pg):
            btn = pg.get_by_role("button", name=re.compile("跟注"))
            if not btn.count():
                return False
            try:
                btn.first.click(timeout=2500)
                return True
            except Exception:
                # 面板正在重渲染，重试即可
                return False

        for _ in range(120):
            if host.get_by_role("button", name="关闭").count():
                break
            if not any(try_call(pg) for pg in pages.values()):
                host.wait_for_timeout(250)

        shoot(pages["desktop"], "showdown-desktop")
        shoot(pages["mobile"], "showdown-mobile")

        # 关掉摊牌弹层 → 看到整场结束面板
        if host.get_by_role("button", name="关闭").count():
            host.get_by_role("button", name="关闭").first.click()
            host.wait_for_timeout(900)
        shoot(pages["desktop"], "finished-desktop")
        shoot(pages["mobile"], "finished-mobile")

        if errors:
            print("JS ERRORS:", errors)
            browser.close()
            sys.exit(1)
        print("无 JS 报错")
        browser.close()

    print("\nRESULT: PASS")


if __name__ == "__main__":
    main()
