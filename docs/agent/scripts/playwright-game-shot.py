"""通用：给某个游戏的大厅页落一张截图（设计语言迁移的前后对比用）。

用法：
  python docs/agent/scripts/playwright-game-shot.py <url> <out_name>

前置：目标游戏已 `npm run build`，并另开终端跑 `npx wrangler dev --port <port>`。
说明：本地不跑 auth（localhost:8787）时会有 CORS / net::ERR_FAILED，属预期现象。
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

url, out_name = sys.argv[1], sys.argv[2]
OUT = Path(__file__).resolve().parent / "out" / "design-language"
OUT.mkdir(parents=True, exist_ok=True)

errors: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 1000})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(url, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT / f"{out_name}.png"), full_page=True)
    # 顺手记录实际生效的关键色值，便于前后比对
    probe = page.evaluate(
        """() => {
            const cs = getComputedStyle(document.body);
            return { font: cs.fontFamily, bg: cs.backgroundColor, color: cs.color };
        }"""
    )
    browser.close()

print(f"[shot] {out_name}.png")
print(f"  body font = {probe['font']}")
print(f"  body bg   = {probe['bg']}   color = {probe['color']}")
print(f"  console errors = {len(errors)}")
for e in errors[:5]:
    print("    -", e[:120])
