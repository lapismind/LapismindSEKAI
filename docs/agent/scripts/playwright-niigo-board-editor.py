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
    tile0 = page.evaluate("window.__game.s.players[0].tile")
    page.screenshot(path=str(OUT / "game_start.png"))
    page.get_by_role("button", name="掷骰移动").click()
    page.wait_for_function("window.__game.s.phase !== 'moving' || window.__game.s.pending", timeout=8000)
    if page.evaluate("window.__game.s.pending?.type") == "branch":
        page.screenshot(path=str(OUT / "game_branch.png"))
        page.evaluate("window.__game.chooseBranch('A')")
        page.wait_for_function("window.__game.s.phase !== 'moving' || window.__game.s.pending", timeout=8000)
    tile1 = page.evaluate("window.__game.s.players[0].tile")
    check(tile1 != tile0, f"掷骰后移动 {tile0} → {tile1}")
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT / "game_after_roll.png"))

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
