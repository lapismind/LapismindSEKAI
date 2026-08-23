"""真实浏览器验证：两个玩家加入房间、开局、施法失败，检查血条是否更新。"""
import random
import string
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5174"

def main():
    room = "T" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        ctx1 = browser.new_context(viewport={"width": 1280, "height": 900})
        page1 = ctx1.new_page()
        errors = []
        page1.on("pageerror", lambda e: errors.append("page1: " + str(e)))
        page1.goto(BASE + "/room/" + room)
        page1.wait_for_timeout(2500)

        ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
        page2 = ctx2.new_page()
        page2.on("pageerror", lambda e: errors.append("page2: " + str(e)))
        page2.goto(BASE + "/room/" + room)
        page1.wait_for_timeout(2000)

        start = page1.get_by_text("开始游戏")
        if start.count() == 0:
            print("FAIL: no start button. body:", page1.inner_text("body")[:150].replace("\n", " | "))
            sys.exit(1)
        start.click()
        page1.wait_for_timeout(2000)

        def hearts_of(page):
            return page.locator(".text-red-500").count()

        before = hearts_of(page1)
        print("red hearts before:", before)

        btn = page1.locator('.grid button', has_text="古代巨龙")
        if btn.count() == 0:
            print("FAIL: no dragon button")
            sys.exit(1)
        btn.first.click()
        page1.wait_for_timeout(2500)

        banner = ""
        for line in page1.inner_text("body").splitlines():
            if ("✨" in line or "💥" in line):
                banner = line.strip()
                break
        print("banner:", banner[:90])

        after = hearts_of(page1)
        print("red hearts after:", after)
        if errors:
            print("JS-ERRORS:", errors)

        ok = (before != after) and banner
        print("RESULT:", "PASS" if ok else "FAIL - health unchanged or no banner")
        browser.close()
        sys.exit(0 if ok else 1)

main()
