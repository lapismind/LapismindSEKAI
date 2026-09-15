"""两个玩家进同一房间 → 截对局中的牌桌界面，并在该状态跑一次旧调色板探针。

为什么需要它：设计语言迁移改得最集中的组件（PokerTable / PlayerSeat / PublicArea /
SpellCard / CastPanel）只在"对局中"才渲染，单人跑不到。本轮只验证过大堂。

做法：两个独立 browser context = 两个玩家（cookie/身份隔离）。A 建房拿房间号
（路由是 /room/:code），B 直接开同一 URL 加入，A 作为房主开局，然后两张都截图 + 探针。

用法：
  python docs/agent/scripts/playwright-two-player-table.py <base_url> <label>
前置：目标游戏 npm run build 过，且 npx wrangler dev --port <port> 在跑。
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

BASE, LABEL = sys.argv[1], sys.argv[2]
OUT = Path(__file__).resolve().parent / "out" / "design-language"
OUT.mkdir(parents=True, exist_ok=True)

OLD = {
    "#8a8299", "#333333", "#5f586b", "#d8d0e4",
    "#a29bb5", "#f7eff8", "#2a2a48", "#e6e1f0", "#55506b", "#ddd5e7",
}
PROBE = """
() => {
  const out = { old: {}, colors: {} };
  const hex = (rgb) => {
    if (!rgb || !rgb.startsWith('rgb')) return null;
    const n = rgb.slice(rgb.indexOf('(') + 1, rgb.indexOf(')')).split(',').map(Number);
    if (n.length === 4 && n[3] === 0) return null;
    return '#' + n.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
  };
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const vals = [cs.color, cs.backgroundColor,
                  cs.borderTopColor, cs.borderLeftColor];
    for (const v of vals) {
      const h = hex(v);
      if (!h) continue;
      out.colors[h] = (out.colors[h] || 0) + 1;
    }
  }
  return out;
}
"""


def shot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    print(f"  [shot] {name}.png")


def click(page, *labels, timeout=4000):
    for lb in labels:
        try:
            loc = page.locator(f"button:has-text('{lb}')").first
            if loc.count() and loc.is_visible():
                loc.click(timeout=timeout)
                print(f"  [act] 点击 {lb!r}")
                return True
        except Exception as e:
            print(f"  [err] {lb!r} {type(e).__name__}")
    print(f"  [miss] 没点到任何一个：{labels}")
    return False


def buttons(page):
    return page.evaluate(
        "() => [...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.innerText.trim()).slice(0,20)"
    )


errors = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx_a, ctx_b = browser.new_context(viewport={"width": 1280, "height": 900}), browser.new_context(viewport={"width": 1280, "height": 900})
    A, B = ctx_a.new_page(), ctx_b.new_page()
    for pg in (A, B):
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    print("== A 建房 ==")
    A.goto(BASE, wait_until="networkidle", timeout=30000)
    A.wait_for_timeout(1200)
    try:
        A.locator("input[placeholder='给自己取个名字']").first.fill("阿A")
    except Exception:
        pass
    if not click(A, "创建房间"):
        browser.close()
        sys.exit(1)
    A.wait_for_timeout(2500)
    room_url = A.url
    print(f"  [url] 房间地址 {room_url}")
    shot(A, f"{LABEL}-table-A-waiting")

    print("== B 加入同一房间 ==")
    B.goto(room_url, wait_until="networkidle", timeout=30000)
    B.wait_for_timeout(1200)
    try:
        B.locator("input[placeholder='给自己取个名字']").first.fill("阿B")
    except Exception:
        pass
    B.wait_for_timeout(2000)
    shot(B, f"{LABEL}-table-B-joined")
    print(f"  [dom] A 可见按钮：{buttons(A)}")

    print("== A 开局 ==")
    click(A, "开始游戏", "开始本局", "开始", "发牌", "开局")
    A.wait_for_timeout(3500)
    shot(A, f"{LABEL}-table-A-ingame")
    shot(B, f"{LABEL}-table-B-ingame")

    print("== 对局中状态探针 ==")
    for tag, pg in (("A", A), ("B", B)):
        data = pg.evaluate(PROBE)
        hits = {h: n for h, n in data["colors"].items() if h in OLD}
        print(f"  玩家{tag}: 旧调色板残留 {sum(hits.values())} 处 {hits if hits else ''}")
        top = sorted(data["colors"].items(), key=lambda kv: -kv[1])[:5]
        print(f"         主要色值 {[(h, n) for h, n in top]}")

    browser.close()

print(f"\n控制台 error：{len(errors)}")
for e in errors[:6]:
    print("   -", e[:130])
print(f"截图目录：{OUT}")
