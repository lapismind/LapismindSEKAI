# -*- coding: utf-8 -*-
"""一次性脚本：M0 修复项的真实浏览器点验（Playwright headless Chromium）。用完移入 _legacy。

覆盖：
  1. 选人 → 开局（4 人，起始格 0/18/35/17 错开）
  2. 掷骰/自动移动 → 行动阶段 → 结束回合（回合轮转）
  3. 交点箭头：推进到交点，验证无全屏弹窗、两个箭头可点、选后继续
  4. toast：行动阶段点战斗牌 → toast 出现
  5. 顶栏 phaseText + x/25
  6. F5 恢复：掷骰后立即刷新 → 继续上局 → 稳定态可继续（不卡死）
  7. KO 压黑 / 25 轮结算：通过页面 console 注入状态验证
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5174/"
results = []

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.goto(BASE)
    page.wait_for_load_state("domcontentloaded")

    def wait_stable(timeout_s=8):
        for _ in range(int(timeout_s / 0.25)):
            ph = page.evaluate("() => window.__game.$state.s.phase")
            pd = page.evaluate("() => window.__game.$state.s.pending?.type ?? null")
            if ph != "moving" and pd is None:
                return ph
            # 自动处理 encounter / 交点选环，避免卡 pending
            if pd == "battleOffer" and page.locator("button", has_text="放过").count() > 0:
                if page.evaluate("() => Math.random()") < 0.5:
                    page.locator("button", has_text="放过").click()
            elif pd == "branch":
                arrows = page.locator("svg g.cursor-pointer")
                if arrows.count() > 0:
                    arrows.first.click()
            page.wait_for_timeout(250)
        return page.evaluate("() => window.__game.$state.s.phase")

    # ── 1. 选人 4 人开局 ──
    page.locator("button", has_text="東雲絵名").first.click()
    page.locator("button", has_text="朝比奈まふゆ（常态）").first.click()
    page.locator("button", has_text="宵崎奏").first.click()
    page.locator("button", has_text="暁山瑞希").first.click()
    page.locator("button", has_text="开始对局（4 人）").click()
    page.wait_for_timeout(200)

    # 等待 dev 探针注入 window.__game
    for _ in range(20):
        if page.evaluate("() => !!window.__game"):
            break
        page.wait_for_timeout(200)
    page.wait_for_timeout(200)
    store_json = page.evaluate("() => JSON.stringify(window.__game.$state.s)")
    st = json.loads(store_json)
    tiles = [p["tile"] for p in st["players"]]
    check("起始格错开 0/18/35/17", tiles == [0, 18, 35, 17], str(tiles))
    check("4 名玩家", len(st["players"]) == 4)
    # ── 5. 顶栏 phaseText ──
    header = page.locator("header").inner_text()
    check("顶栏显示 等待掷骰 + x/25", "等待掷骰" in header and "/25" in header, header.splitlines()[0] if header else "")

    # ── 2. 掷骰 → 自动移动 → 行动阶段 → 结束回合 ──
    page.locator("button", has_text="掷骰移动").click()
    phase_txt = wait_stable()
    check("掷骰后进入稳定阶段（action）", phase_txt == "action", f"phase={phase_txt}")
    # 结束回合（可能在战斗/商店里则先处理——MVP 简化：仅当看到结束回合按钮）
    for _ in range(60):
        if page.evaluate("() => window.__game.$state.s.phase") == "roll":
            break
        if page.locator("button", has_text="结束回合").count() > 0:
            break
        # 处理可能的战斗/遭遇/商店弹窗
        if page.locator("button", has_text="放过").count() > 0:
            page.locator("button", has_text="放过").click()
        elif page.locator("button", has_text="离开商店").count() > 0:
            page.locator("button", has_text="离开商店").click()
        elif page.locator("button", has_text="继续（").count() > 0:
            page.locator("button", has_text="继续（").click()
        elif page.locator("button", has_text="出完了，进攻").count() > 0:
            page.locator("button", has_text="出完了，进攻").click()
        elif page.locator("button", has_text="出完了，准备防守").count() > 0:
            page.locator("button", has_text="出完了，准备防守").click()
        elif page.locator("button", has_text="防御").first.count() > 0 and page.locator("div", has_text="选择应对方式").count() > 0:
            page.locator("button", has_text="防御").first.click()
        page.wait_for_timeout(300)
    if page.locator("button", has_text="结束回合").count() > 0:
        page.locator("button", has_text="结束回合").click()
        page.wait_for_timeout(300)
    phase_txt = page.evaluate("() => window.__game.$state.s.phase")
    check("回合轮转（roll，下一位）", phase_txt == "roll", f"phase={phase_txt}")

    # ── 4. toast：注入战斗牌到当前玩家手牌，行动阶段点击 → toast ──
    page.evaluate("() => { const p = window.__game.$state.s.players[window.__game.$state.s.current]; p.hand.push('atk1'); }")
    page.wait_for_timeout(100)
    # 若当前在 roll 阶段，先掷骰并走完到 action
    for _ in range(20):
        if page.evaluate("() => window.__game.$state.s.phase") == "action":
            break
        if page.locator("button", has_text="掷骰移动").count() > 0:
            page.locator("button", has_text="掷骰移动").click()
        page.wait_for_timeout(400)
    page.locator("button", has_text="攻击·1费").first.click()
    page.wait_for_timeout(200)
    toast_visible = page.locator("div", has_text="战斗牌要在战斗里才能用").count() > 0
    check("toast 弹出（战斗牌误点）", toast_visible)

    # ── 3. 交点箭头：注入到交点前一格并掷骰 ──
    print("stage: branch", flush=True)
    page.evaluate("""() => {
        const g = window.__game.$state.s;
        const p = g.players[g.current];
        p.tile = 3; g.remaining = 0; g.pending = null; g.phase = 'roll';
    }""")
    page.wait_for_timeout(100)
    page.locator("button", has_text="掷骰移动").click()
    page.wait_for_timeout(1500)
    # 步进到交点 4 → 应弹 branch pending（棋盘箭头，无全屏弹窗）
    branch_pending = page.evaluate("() => window.__game.$state.s.pending?.type === 'branch'")
    if not branch_pending:
        # 可能已在交点上等选环，或步数没走到——继续走一步
        page.wait_for_timeout(500)
        branch_pending = page.evaluate("() => window.__game.$state.s.pending?.type === 'branch'")
    check("交点：branch pending 且无全屏弹窗文本（旧弹窗已删）", branch_pending and "交点：选择路线" not in page.locator("body").inner_text())
    arrows = page.locator("svg g.cursor-pointer").count()
    check("棋盘交点出现两个可选箭头", arrows == 2, f"arrows={arrows}")
    # 点内环箭头
    # 连续交点会连续弹箭头（如 4 → 内环 → 27），循环点选直到脱离 branch
    clicked = 0
    for _ in range(8):
        if page.evaluate("() => window.__game.$state.s.pending?.type") != "branch":
            break
        page.locator("svg g.cursor-pointer", has_text="内环").first.click()
        clicked += 1
        page.wait_for_timeout(900)
    st2 = json.loads(page.evaluate("() => JSON.stringify(window.__game.$state.s)"))
    check(f"箭头选环生效（点选 {clicked} 次，脱离 branch）", clicked >= 1 and st2["pending"] is None, f"pending={st2['pending']}")

    print("stage: f5", flush=True)
    # ── 6. F5 恢复：掷骰后立即刷新 ──
    for _ in range(20):
        if not page.evaluate("() => window.__game.moving"):
            break
        page.wait_for_timeout(250)
    phase_before = wait_stable()
    page.evaluate("() => { const g = window.__game.$state.s; g.pending = null; g.phase = 'roll'; g.remaining = 0; }")
    page.wait_for_timeout(150)  # 等稳定态持久化
    page.locator("button", has_text="掷骰移动").click()
    page.wait_for_timeout(120)  # 移动中立即刷新
    page.reload()
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(400)
    has_banner = "继续上局" in page.locator("body").inner_text()
    check("刷新后出现 继续上局 横幅", has_banner)
    if has_banner:
        page.locator("button", has_text="继续上局").click()
        page.wait_for_timeout(400)
        phase_txt = page.evaluate("() => window.__game.$state.s.phase")
        interactive = page.locator("button", has_text="掷骰移动").count() > 0 \
            or page.locator("button", has_text="结束回合").count() > 0 \
            or page.locator("button", has_text="放过").count() > 0
        check("恢复后处于稳定态且可继续操作（不卡死）", phase_txt in ("roll", "action") and interactive, f"phase={phase_txt}")

    print("stage: ko/25", flush=True)
    # ── 7. KO 压黑 / 25 轮结算（console 注入验证）──
    page.evaluate("""() => {
        const g = window.__game.$state.s;
        g.players[1].ko = true;
    }""")
    page.wait_for_timeout(200)
    gray = page.evaluate("""() => {
        const imgs = [...document.querySelectorAll('svg image')];
        return imgs.some(im => (im.getAttribute('style') || '').includes('grayscale'));
    }""")
    check("KO 贴片压黑（grayscale 滤镜）", gray)
    page.evaluate("""() => {
        const g = window.__game.$state.s;
        g.round = 25; g.current = 3; g.phase = 'action'; g.pending = null;
    }""")
    if page.locator("button", has_text="结束回合").count() == 0:
        page.wait_for_timeout(200)
    # 当前座 3，行动阶段结束 → 跨轮触发 25 轮结算
    for _ in range(10):
        if page.evaluate("() => window.__game.$state.s.phase") == "over":
            break
        if page.locator("button", has_text="放过").count() > 0:
            page.locator("button", has_text="放过").click()
        if page.locator("button", has_text="结束回合").count() > 0:
            page.locator("button", has_text="结束回合").click()
        page.wait_for_timeout(250)
    body = page.locator("body").inner_text()
    check("25 轮到点排名结算（over + 第 1 名）", "第 1 名" in body and "已结束" in body)

    # ── 8. 商店售罄显示（console 注入空库存商店）──
    page.evaluate("""() => {
        const g = window.__game.$state.s;
        g.phase = 'action'; g.pending = { type: 'shop', stock: [] }; g.winner = null;
    }""")
    page.wait_for_timeout(300)
    check("商店售罄显示『已售罄』", "已售罄" in page.locator("body").inner_text())

    # ── 截图留档 ──
    page.screenshot(path=r"C:\Projects\AI-game\_out\m0-verify-over.png")
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n=== {len(results) - len(fails)}/{len(results)} PASS ===")
for name, ok, detail in fails:
    print("FAILED:", name, detail)
sys.exit(1 if fails else 0)
