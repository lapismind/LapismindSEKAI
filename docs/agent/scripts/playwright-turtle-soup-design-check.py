"""turtle-soup 设计语言迁移的视觉验证（design-kit 语义令牌接入后）。

用途：跑通大厅 → 房间 → 开一局单人 AI 主持 → 棋盘/抽屉/汤面卡，落截图，
并收集控制台报错与失败请求。迁移只动了 CSS 类，所以看的是
"有没有文字读不出来、表面看不见、样式没生效"。

前置：
  1. cd turtle-soup && npm run build
  2. cd turtle-soup && npx wrangler dev --port 8788   （房间需要 Worker/DO，Vite dev 不带代理）

用法：
  python docs/agent/scripts/playwright-turtle-soup-design-check.py [base_url]

截图落在 docs/agent/scripts/out/turtle-soup-design/。
说明：本地不跑 auth 服务（localhost:8787）时会出现 CORS / net::ERR_FAILED，
这是仓库文档记录的预期现象，不是回归。
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788"
OUT = Path(__file__).resolve().parent / "out" / "turtle-soup-design"
OUT.mkdir(parents=True, exist_ok=True)

console_errors: list[str] = []
failed_requests: list[str] = []
shots: list[str] = []


def shot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    shots.append(name)
    print(f"  [shot] {name}.png")


def click_btn(page, *names, exact=True):
    """按可见文本点按钮；返回是否点到。"""
    for n in names:
        try:
            loc = page.get_by_role("button", name=n, exact=exact).first
            if loc.count() and loc.is_visible():
                loc.click(timeout=2500)
                print(f"  [act] 点击按钮 {n!r}")
                return True
        except Exception:
            continue
    return False


def click_any(page, *candidates):
    """多策略点击：role / text / css，带失败诊断。candidate 为 (kind, value)。"""
    for kind, val in candidates:
        try:
            if kind == "role":
                loc = page.get_by_role("button", name=val).first
            elif kind == "text":
                loc = page.get_by_text(val).first
            elif kind == "css":
                loc = page.locator(val).first
            n = loc.count()
            if n and loc.is_visible():
                loc.click(timeout=3000)
                print(f"  [act] 点击 {kind}:{val!r}")
                return True
            print(f"  [miss] {kind}:{val!r} count={n}")
        except Exception as e:
            print(f"  [err ] {kind}:{val!r} {type(e).__name__}: {str(e)[:90]}")
    return False


def click_text(page, *texts):
    for t in texts:
        try:
            loc = page.get_by_text(t, exact=False).first
            if loc.count() and loc.is_visible():
                loc.click(timeout=2500)
                print(f"  [act] 点击文本 {t!r}")
                return True
        except Exception:
            continue
    return False


def inventory(page, label):
    print(f"  [dom] {label} 可见按钮：")
    for el in page.locator("button:visible").all()[:26]:
        try:
            txt = (el.inner_text() or "").strip().replace("\n", " ")[:30]
            print(f"        {txt!r}")
        except Exception:
            pass


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("requestfailed", lambda r: failed_requests.append(f"{r.method} {r.url} — {r.failure}"))

    print("== 1. 大厅 ==")
    page.goto(BASE, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1200)
    shot(page, "01-lobby")
    print("  [font]  body font-family =", page.evaluate("getComputedStyle(document.body).fontFamily"))
    print("  [theme] html data-theme  =", page.evaluate("document.documentElement.dataset.theme"))
    for tok in ("--card-bg", "--field-bg", "--ink", "--line", "--font-body"):
        v = page.evaluate(f"getComputedStyle(document.documentElement).getPropertyValue('{tok}').trim()")
        print(f"  [token] {tok:12} = {v}")

    print("\n== 2. 创建房间 ==")
    if not click_btn(page, "创建房间"):
        print("  [warn] 找不到「创建房间」，终止")
        browser.close()
        sys.exit(1)
    page.wait_for_timeout(2500)
    shot(page, "02-room-waiting")
    inventory(page, "room")

    print("\n== 3. 选谜题 + 开一局单人 AI 主持 ==")
    if click_btn(page, "1"):  # 本局人数 = 1
        page.wait_for_timeout(1500)
        shot(page, "03-room-1player")
    # 开局按钮 :disabled="waitingForPlayers || !game.puzzle"，所以必须先把谜题选上
    if click_any(page, ("css", "button:has-text('更换')")):
        page.wait_for_timeout(1200)
        shot(page, "03b-puzzle-picker")
        # PuzzleCard 根是 <button>，正文含「难度 X」，用它定位第一张
        if click_any(page, ("css", "button:has-text('难度')")):
            page.wait_for_timeout(1200)
            shot(page, "03c-puzzle-selected")
    print("  [dom] 当前按钮：", page.evaluate(
        "() => [...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.innerText.trim()).slice(0,24)"
    ))
    if click_any(page, ("css", "button:has-text('开始游戏')"), ("role", "开始游戏")):
        page.wait_for_timeout(3500)
        shot(page, "04-board")
        print("  [dom] 棋盘按钮：", page.evaluate(
            "() => [...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.innerText.trim()).slice(0,24)"
        ))

    print("\n== 4. 汤面卡（浅琥珀纸质面板，唯一保留 slate 的地方）==")
    if click_any(
        page,
        ("css", "button:has-text('点击展开汤面')"),
        ("css", "button:has-text('🍲')"),
        ("text", "点击展开汤面"),
    ):
        page.wait_for_timeout(900)
        shot(page, "05-story-card")
        click_any(page, ("css", "button:has-text('✕')"), ("role", "✕"))

    print("\n== 5. 抽屉面板（记录/复盘，含表单字段）==")
    if click_any(
        page,
        ("css", "button:has-text('记录')"),
        ("css", "button:has-text('复盘')"),
        ("css", "button:has-text('☰')"),
    ):
        page.wait_for_timeout(1000)
        shot(page, "06-drawer")
        click_any(page, ("css", "button:has-text('✕')"), ("css", "button:has-text('收起')"))
        page.wait_for_timeout(400)

    print("\n== 6. 帮助 ==")
    if click_any(page, ("role", "❓"), ("css", "button:has-text('❓')")):
        page.wait_for_timeout(1000)
        shot(page, "07-help")

    browser.close()

print("\n== 结果 ==")
print(f"截图 {len(shots)} 张：{', '.join(shots)}")
print(f"控制台 error：{len(console_errors)}")
for e in console_errors[:10]:
    print("   -", e[:140])
print(f"失败请求：{len(failed_requests)}")
for r in failed_requests[:10]:
    print("   -", r[:140])
print(f"目录：{OUT}")
