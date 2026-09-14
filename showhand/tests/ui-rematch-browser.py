"""真实浏览器验证：房间内两局流程 + 整场结束后再来一局。

需要先在本机跑起服务：
    cd showhand && npx wrangler dev --port 8788 --local

覆盖本次改动的前端部分：
  - 房间 UI 能正常渲染，两个浏览器上下文都无 JS 报错
  - 下注面板只在轮到自己时出现，跟注能推进整局到摊牌
  - 整场结束后右侧出现最终排名与「再来一局」，房主点击后房间回到等待状态
"""
import random
import re
import string
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8788"


def main():
    room = "U" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        p1 = browser.new_context(viewport={"width": 1280, "height": 900})
        p2 = browser.new_context(viewport={"width": 1280, "height": 900})
        page1, page2 = p1.new_page(), p2.new_page()
        for name, pg in (("page1", page1), ("page2", page2)):
            pg.on("pageerror", lambda e, n=name: errors.append(f"{n}: {e}"))

        # 两个玩家进入同一房间
        page1.goto(f"{BASE}/room/{room}")
        page1.wait_for_timeout(1500)
        page2.goto(f"{BASE}/room/{room}")
        page1.wait_for_timeout(1500)

        if page1.get_by_text(f"房间 {room}").count() == 0:
            print("FAIL: 房间未渲染。body:", page1.inner_text("body")[:200].replace("\n", " | "))
            sys.exit(1)
        print("OK 房间渲染正常，房间号", room)

        # 房主设置局数为 1，便于打满整场后验证「再来一局」
        page1.get_by_role("button", name="房间设置").click()
        page1.wait_for_timeout(400)
        config = page1.locator("div.fixed", has_text="房间设置")
        config.locator("input[type=number]").first.fill("1")
        config.get_by_role("button", name="保存").click()
        page1.wait_for_timeout(500)
        print("OK 房主已设置局数 = 1")

        page1.get_by_role("button", name="开始游戏").click()
        page1.wait_for_timeout(1500)

        for name, pg in (("page1", page1), ("page2", page2)):
            if pg.get_by_text(re.compile("第 1 / 1 局")).count() == 0:
                print(f"FAIL: {name} 未进入对局。body:", pg.inner_text("body")[:200].replace("\n", " | "))
                sys.exit(1)
        print("OK 双方进入第 1 / 1 局")

        # 轮到谁，谁就跟注，直到摊牌
        call_btn = lambda pg: pg.get_by_role("button", name=re.compile(r"^跟注"))
        showed = False
        for step in range(80):
            for name, pg in (("page1", page1), ("page2", page2)):
                btn = call_btn(pg)
                if btn.count() and btn.first.is_visible():
                    btn.first.click()
                    print(f"   - {name} 跟注（第 {step} 步）")
                    break
            if page1.get_by_role("button", name="关闭").count():
                showed = True
                break
            page1.wait_for_timeout(300)

        if not showed:
            print("FAIL: 未能推进到摊牌。body:", page1.inner_text("body")[:300].replace("\n", " | "))
            sys.exit(1)
        print("OK 下注流程推进到摊牌")

        # 关掉摊牌弹层，整场结束面板在右下角
        page1.get_by_role("button", name="关闭").first.click()
        page1.wait_for_timeout(800)
        body1 = page1.inner_text("body")
        if "整场结束" not in body1 and "夺冠" not in body1:
            print("FAIL: 未出现整场结束面板。body:", body1[:400].replace("\n", " | "))
            sys.exit(1)
        if "再来一局" not in body1:
            print("FAIL: 房主未看到「再来一局」。body:", body1[:400].replace("\n", " | "))
            sys.exit(1)
        print("OK 整场结束面板出现，含最终排名与「再来一局」")

        # 非房主不应看到「再来一局」按钮，只看到等待提示
        body2 = page2.inner_text("body")
        if page2.get_by_role("button", name=re.compile("再来一局")).count():
            print("FAIL: 非房主不应看到「再来一局」按钮")
            sys.exit(1)
        if "等待房主再来一局" not in body2:
            print("FAIL: 非房主未看到等待提示。body:", body2[:400].replace("\n", " | "))
            sys.exit(1)
        print("OK 非房主只看到等待提示")

        # 房主再来一局 → 房间回到等待状态，可以重新开局
        page1.get_by_role("button", name="再来一局").first.click()
        page1.wait_for_timeout(1500)
        body1 = page1.inner_text("body")
        if "再来一局" in body1 and "夺冠" in body1:
            print("FAIL: 再来一局后仍停留在结束面板。body:", body1[:400].replace("\n", " | "))
            sys.exit(1)
        if page1.get_by_role("button", name="开始游戏").count() == 0:
            print("FAIL: 再来一局后房主未看到「开始游戏」。body:", body1[:400].replace("\n", " | "))
            sys.exit(1)
        if page2.get_by_text(re.compile("第 0 / 1 局")).count() == 0:
            print("WARN: 非房主局数显示未归零。body:", page2.inner_text("body")[:300].replace("\n", " | "))
        print("OK 再来一局后回到等待状态，房主可重新开局")

        if errors:
            print("FAIL: JS 报错:", errors)
            sys.exit(1)
        print("OK 全程无 JS 报错")
        browser.close()

    print("\nRESULT: PASS")


if __name__ == "__main__":
    main()
