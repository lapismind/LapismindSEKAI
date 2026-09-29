"""niigo-party：2.5D 底图棋盘 + 地图编辑器冒烟验证。

用法：
  py -3.14 docs/agent/scripts/playwright-niigo-board-editor.py [base_url]
前置：niigo-party 下 `npx vite --port 5199`（dev 模式，编辑器与保存接口只在 dev 存在）。

检查：
  1. 游戏：选 2 人开局 → 棋盘底图加载、68 个格子热区、棋子渲染 → 掷骰后棋子移动
  2. 编辑器：#editor 进入 → 68 格 → 刷一格（对称联动改 2 格）→ 撤销 → 保存接口写回同一份布局（内容不变）
  3. 全程无 console error / pageerror
截图落 docs/agent/scripts/out/niigo-board/
"""
import json
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5199"
OUT = Path(__file__).resolve().parent / "out" / "niigo-board"
OUT.mkdir(parents=True, exist_ok=True)
LAYOUT = Path(__file__).resolve().parents[3] / "niigo-party" / "src" / "game" / "maps" / "twin-cross-68.layout.json"

errors, fails = [], []


def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))

    # ── 1. 游戏 ──
    print("[game]")
    page.goto(BASE + "/")
    page.evaluate("localStorage.clear()")
    page.reload()
    cards = page.locator("button:has(img)")
    cards.nth(0).click()
    cards.nth(1).click()
    page.get_by_role("button", name="开始对局").click()
    page.wait_for_selector("svg image")
    bg_ok = page.evaluate("""() => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(0);
                                i.src = document.querySelector('svg image').getAttribute('href'); })""")
    check(bg_ok > 0, f"棋盘底图加载（宽 {bg_ok}）")
    check(page.locator("svg polygon").count() >= 68, f"格子热区 {page.locator('svg polygon').count()} ≥ 68")
    check(page.locator("svg image[href*='chibi_base']").count() == 2, "2 个棋子渲染")
    page.screenshot(path=str(OUT / "game_start.png"))

    # HUD：缩放三挡
    vb = lambda: [float(v) for v in page.locator("svg").first.get_attribute("viewBox").split()]
    check(abs(vb()[2] - 2400) < 1, "默认全图 viewBox 宽 2400")
    page.get_by_role("button", name="特写").click()
    check(abs(vb()[2] - 2400 / 2.6) < 1, f"特写挡 viewBox 宽 {vb()[2]:.0f}")
    page.get_by_role("button", name="全图").click()

    # HUD：点头像定位（第二位玩家）
    p2 = page.evaluate("window.__game.s.players[1]")
    page.get_by_role("button", name=f"在地图上定位 {p2['name']}").click()
    v = vb()
    check(v[2] < 2400, f"定位后已放大（viewBox 宽 {v[2]:.0f}）")
    page.screenshot(path=str(OUT / "game_locate.png"))
    page.get_by_role("button", name="全图").click()

    # 掷骰：右下 d10 → 中央大字
    tile0 = page.evaluate("window.__game.s.players[0].tile")
    page.get_by_role("button", name="掷 d10 移动骰").click()
    page.wait_for_selector(".roll-big", timeout=3000)
    big = page.locator(".roll-big div").first.inner_text().strip()
    rolled = page.evaluate("window.__game.s.lastRoll.value")
    check(big == str(rolled) and 1 <= rolled <= 10, f"中央大字 {big} = 骰点 {rolled}")
    page.screenshot(path=str(OUT / "game_roll_big.png"))
    page.wait_for_function("window.__game.s.phase !== 'moving' || window.__game.s.pending", timeout=12000)
    while page.evaluate("window.__game.s.pending?.type") == "branch":
        page.evaluate("window.__game.chooseBranch(window.__game.s.pending.options[0])")
        page.wait_for_function("window.__game.s.phase !== 'moving' || window.__game.s.pending", timeout=12000)
    tile1 = page.evaluate("window.__game.s.players[0].tile")
    check(tile1 != tile0, f"掷骰后移动 {tile0} → {tile1}")
    page.wait_for_timeout(300)
    page.screenshot(path=str(OUT / "game_after_roll.png"))

    # 十字路口 22：三个方向，点地图上的箭头选路
    page.evaluate("""() => { const g = window.__game, s = g.s;
        if (s.pending?.type === 'shop') g.closeShop();
        if (s.phase === 'action') g.endTurn();
        const p = s.players[s.current]; p.tile = 22; p.prev = 21; p.choice = null;
        s.players.forEach((o) => { if (o !== p) o.tile = 40; });
        s.phase = 'roll'; s.pending = null; }""")
    page.get_by_role("button", name="掷 d10 移动骰").click()
    page.wait_for_function("window.__game.s.pending?.type === 'branch'", timeout=6000)
    opts = page.evaluate("window.__game.s.pending.options")
    check(len(opts) == 3 and 21 not in opts, f"路口 22 给出 3 个方向 {opts}（不含来路 21）")
    labels = sorted(page.locator("svg g.cursor-pointer text").all_text_contents())
    check(sum(1 for t in labels if t in ('直行', '左转', '右转')) == 3, f"地图上 3 个方向箭头 {[t for t in labels if len(t) == 2]}")
    page.wait_for_timeout(1400)  # 等掷骰大字淡出再截图
    page.screenshot(path=str(OUT / "game_crossroad.png"))
    pick = opts[1]
    page.locator(f"svg g[data-branch='{pick}'] circle").click()
    page.wait_for_function("window.__game.s.phase !== 'moving' || window.__game.s.pending", timeout=12000)
    first_step = page.evaluate("window.__game.s.log.map(l => l.text).find(t => t.includes('号路口选择'))")
    check(first_step is not None and f"前往 {pick}" in first_step, f"点箭头选路生效：{first_step}")

    # ── 2. 编辑器 ──
    print("[editor]")
    before = LAYOUT.read_text(encoding="utf-8")
    page.evaluate("localStorage.clear()")
    page.goto(BASE + "/#editor")
    page.wait_for_selector("text=地图编辑器")
    groups = page.locator("main svg g.cursor-pointer")
    check(groups.count() == 68, f"编辑器 68 格（{groups.count()}）")
    check(page.get_by_text("全部通过").count() == 1, "当前布局校验全部通过")
    page.screenshot(path=str(OUT / "editor.png"))

    page.get_by_role("button", name="天降横祸").first.click()
    groups.nth(1).click()  # 1 号格（横财）→ 横祸；对称联动 → 19 号同改
    check(page.get_by_text("未保存改动 2 格").count() == 1, "对称联动：改 1 格 → 2 格变化")
    page.screenshot(path=str(OUT / "editor_painted.png"))
    groups.nth(4).click()  # 交点不可改
    check(page.get_by_text("交点，由拓扑固定").count() == 1, "交点点击被拒并提示")
    page.get_by_role("button", name="撤销").click()
    check(page.get_by_text("与磁盘一致").count() == 1, "撤销后回到磁盘版本")

    # 保存接口：原样写回同一份布局，文件内容应不变
    types = json.loads(before)["types"]
    req = urllib.request.Request(BASE + "/__niigo/layout", data=json.dumps({"types": types}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    resp = json.loads(urllib.request.urlopen(req).read())
    check(resp.get("ok") is True, f"保存接口 200 ok（warnings {resp.get('warnings')}）")
    check(LAYOUT.read_text(encoding="utf-8") == before, "原样保存后文件内容不变")
    bad = dict(types=list(types)); bad["types"][4] = "coin"
    req = urllib.request.Request(BASE + "/__niigo/layout", data=json.dumps(bad).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(req); code = 200
    except urllib.error.HTTPError as e:
        code = e.code
    check(code == 422 and LAYOUT.read_text(encoding="utf-8") == before, f"非法布局被拒（{code}），文件未改")

    browser.close()

print("[console]")
check(not errors, f"无 console error（{len(errors)}）" + ("：" + " | ".join(errors[:3]) if errors else ""))
print("FAIL" if fails else "PASS", f"— 截图在 {OUT}")
sys.exit(1 if fails else 0)
