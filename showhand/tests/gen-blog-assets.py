"""生成博客用的 showhand 配图（就地覆盖同名文件，博客模板无需改动）。

前置：先起服务
    cd showhand && npx wrangler dev --port 8788 --local &

产出：
    blog/src/assets/showhand-table.png          项目详情页 hero（对局中，明牌可见）
    blog/src/assets/covers/showhand-cover.jpg   文章封面 / 作品列表封面（另一时刻）

两张都是真实对局截图 —— 之前用的是绿毡木框的贴图，与站点香芋紫画风冲突；
现在直接从线上界面截，观感与游戏里完全一致，也不会再出现"配图跟实际不一样"。

用法：
    py -3.13 tests/gen-blog-assets.py
"""
import random
import re
import string
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8788"
REPO = Path(__file__).resolve().parent.parent.parent
HERO_OUT = REPO / "blog" / "src" / "assets" / "showhand-table.png"
COVER_OUT = REPO / "blog" / "src" / "assets" / "covers" / "showhand-cover.jpg"

SHOT_W, SHOT_H = 1600, 900
SUITS = "♠♥♦♣"


def visible_face_up_cards(page):
    """明牌数量：点数与花色只出现在牌正面，用它判断打到哪一步了"""
    text = page.inner_text("body")
    return sum(text.count(s) for s in SUITS)


def drive(pages, max_actions=60):
    """轮流行动，直到桌面上出现明牌（进入 flop 之后）。

    必须遍历所有页面：跟注按钮只在"轮到自己"的那一页出现，
    只点一页的话其他座位会一直等 30 秒超时自动弃牌。
    """
    ref = pages[0]

    def has_face_up():
        return visible_face_up_cards(ref) >= 2

    for _ in range(max_actions):
        if has_face_up():
            return True
        for pg in pages:
            btn = pg.get_by_role("button", name=re.compile("跟注"))
            if btn.count() and btn.first.is_visible():
                try:
                    btn.first.click(timeout=2500)
                except Exception:
                    pass
                break
        ref.wait_for_timeout(300)
    return has_face_up()


def main():
    room = "B" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        # reduced_motion 让 base.css 关掉过渡：面板每次下注都重渲染，有动画时点不中
        ctx = browser.new_context(
            viewport={"width": SHOT_W, "height": SHOT_H}, reduced_motion="reduce"
        )
        pages = []
        for _ in range(4):
            pg = ctx.new_page()
            pg.goto(f"{BASE}/room/{room}")
            pg.wait_for_function(
                "(r) => (document.body.innerText || '').includes('房间 ' + r)",
                arg=room,
                timeout=20000,
            )
            pages.append(pg)

        host = pages[0]
        host.get_by_role("button", name="开始游戏").click()
        host.wait_for_timeout(1200)

        if not drive(pages):
            print("FAIL: 没能推进到有明牌的阶段，看看是不是对局卡住了")
            sys.exit(1)

        HERO_OUT.parent.mkdir(parents=True, exist_ok=True)
        host.screenshot(path=str(HERO_OUT))
        print(f"saved {HERO_OUT.name} ({HERO_OUT.stat().st_size // 1024} KB)")

        # 再打几手让底池和各座位投入涨起来，封面信息量更足
        for _ in range(8):
            for pg in pages:
                btn = pg.get_by_role("button", name=re.compile("跟注"))
                if btn.count() and btn.first.is_visible():
                    try:
                        btn.first.click(timeout=2000)
                    except Exception:
                        pass
                    break
            host.wait_for_timeout(300)
            if host.get_by_role("button", name="关闭").count():
                host.get_by_role("button", name="关闭").first.click()
                host.wait_for_timeout(500)

        COVER_OUT.parent.mkdir(parents=True, exist_ok=True)
        host.screenshot(path=str(COVER_OUT), type="jpeg", quality=84)
        print(f"saved {COVER_OUT.name} ({COVER_OUT.stat().st_size // 1024} KB)")

        ctx.close()
        browser.close()

    print("\nRESULT: PASS")


if __name__ == "__main__":
    main()
