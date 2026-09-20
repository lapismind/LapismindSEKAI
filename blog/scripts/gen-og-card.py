"""生成全站 OGP 分享卡（1200×630）。

这张图是 `BaseHead.astro` 里 `og:image` 的兜底：分享任何页面时抓取器拿到的第一印象。
在它之前，兜底是 `soup-lobby.png`——一张海龟汤大厅截图（227KB PNG，还铺满 26 张官方
头像），所以分享 `/about/`、`/works/` 或任何文章，预览图都是错的。

文案与配色都读真源，避免和站内分叉：
  - 字标与说明 ← `src/consts.ts` 的 `SITE_TITLE` / `SITE_DESCRIPTION`
  - 域名      ← `astro.config.mjs` 的 `site`
  - 颜色/字体 ← `packages/design-kit/`
  - 拉丁字体  ← `src/assets/fonts/atkinson-*.woff`（与站内 `--font-atkinson` 同一份）

**不要给 OGP 用 WebP**（部分抓取器不认），所以这里直接出 jpeg，且必须与
`BaseHead` 里声明的 1200×630 一致——`ImageMetadata.width/height` 会被写进
`og:image:width/height`，尺寸不符就是给抓取器发错信息。

前置：字体已同步（`npm run build` / `npm run predev` 会做，也可单独
      `node ../packages/design-kit/scripts/sync-fonts.mjs`）

用法：
    cd blog && python scripts/gen-og-card.py
"""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BLOG = Path(__file__).resolve().parent.parent
REPO = BLOG.parent
TOKENS_CSS = REPO / "packages" / "design-kit" / "tokens.css"
THEME_CSS = REPO / "packages" / "design-kit" / "theme.css"
FONT_CSS = BLOG / "public" / "fonts" / "lxgwwenkaiscreen.css"
CONSTS_TS = BLOG / "src" / "consts.ts"
ASTRO_CONFIG = BLOG / "astro.config.mjs"
ATKINSON_BOLD = BLOG / "src" / "assets" / "fonts" / "atkinson-bold.woff"
OUT = BLOG / "src" / "assets" / "site" / "og-card.jpg"

W, H = 1200, 630

# 固定的雪点（不随机：重跑必须得到同一张图，否则每次构建都在改素材）
SNOW = [
    (8, 22, 5), (17, 61, 3), (26, 13, 4), (38, 78, 5), (47, 34, 3),
    (58, 68, 4), (66, 19, 6), (74, 52, 3), (86, 30, 5), (92, 71, 4),
]

PAGE = """<!doctype html>
<html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8" />
<link rel="stylesheet" href="file://{font_css}" />
<style>
@font-face {{
  font-family: 'Atkinson';
  font-weight: 700;
  font-style: normal;
  src: url('file://{atkinson}') format('woff');
}}
{tokens}
{theme}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; }}
body {{
  width: {w}px; height: {h}px; padding: 62px 74px;
  background: var(--page-bg); color: var(--ink);
  font-family: var(--font-body);
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}}
/* 右上角品牌光晕：与首页 .now-card::after 同一套语言（只留一处发光） */
.glow {{
  position: absolute; top: -240px; right: -180px; width: 780px; height: 780px;
  border-radius: 50%;
  background: radial-gradient(circle, oklch(0.72 0.14 var(--hue-accent) / 0.30) 0%, transparent 66%);
}}
.snow {{ position: absolute; inset: 0; }}
.snow i {{
  position: absolute; border-radius: 50%;
  background: oklch(1 0 0 / 0.4);
}}
.eyebrow {{
  position: relative; display: flex; align-items: center; gap: 15px;
  font-family: var(--font-mono); font-size: 18px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--primary);
}}
.badge {{
  width: 42px; height: 42px; border-radius: 13px; background: var(--gradient);
  color: #fff; font-size: 23px; font-weight: 700; letter-spacing: 0;
  display: grid; place-items: center;
}}
.name {{
  position: relative; margin-top: 44px;
  font-family: 'Atkinson', var(--font-body);
  font-size: 124px; font-weight: 700; line-height: 0.98; letter-spacing: -0.03em;
}}
.name .b {{
  background: var(--gradient);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}}
.rule {{
  position: relative; width: 152px; height: 5px; margin-top: 34px;
  border-radius: 3px; background: var(--gradient);
}}
.desc {{
  position: relative; margin-top: 26px;
  font-size: 34px; color: var(--ink-soft);
}}
.foot {{
  position: relative; margin-top: auto; display: flex; align-items: baseline;
  font-family: var(--font-mono); font-size: 21px; color: var(--muted);
}}
.foot .gh {{ margin-left: auto; color: var(--primary); }}
</style></head><body>
<div class="glow"></div>
<div class="snow">{snow}</div>
<div class="eyebrow"><span class="badge">L</span>Lapismind · Sekai</div>
<div class="name">{name}</div>
<div class="rule"></div>
<div class="desc">{description}</div>
<div class="foot"><span>{domain}</span><span class="gh">github.com/lapismind</span></div>
</body></html>
"""


def main():
    for path in (TOKENS_CSS, THEME_CSS, FONT_CSS, CONSTS_TS, ASTRO_CONFIG, ATKINSON_BOLD):
        if not path.exists():
            print(f"FAIL: 找不到 {path}")
            sys.exit(1)

    m = re.search(r"SITE_DESCRIPTION\s*=\s*'([^']+)'", CONSTS_TS.read_text(encoding="utf-8"))
    if not m:
        print("FAIL: consts.ts 里没有 SITE_DESCRIPTION")
        sys.exit(1)
    description = m.group(1)

    m = re.search(r"SITE_TITLE\s*=\s*'([^']+)'", CONSTS_TS.read_text(encoding="utf-8"))
    if not m:
        print("FAIL: consts.ts 里没有 SITE_TITLE")
        sys.exit(1)
    # 站点名按第一个空格拆成两行做字标，第二行走品牌渐变；只有一个词时就是单行。
    parts = m.group(1).split(" ", 1)
    line1 = parts[0].upper()
    line2 = parts[1].upper() if len(parts) > 1 else ""
    name = line1 + (f'<br /><span class="b">{line2}</span>' if line2 else "")

    m = re.search(r"site:\s*'https?://([^'/]+)", ASTRO_CONFIG.read_text(encoding="utf-8"))
    if not m:
        print("FAIL: astro.config.mjs 里没有 site")
        sys.exit(1)
    domain = m.group(1)

    snow = "".join(
        f'<i style="left:{x}%;top:{y}%;width:{s}px;height:{s}px"></i>' for x, y, s in SNOW
    )

    html = PAGE.format(
        font_css=FONT_CSS.as_posix(),
        atkinson=ATKINSON_BOLD.as_posix(),
        tokens=TOKENS_CSS.read_text(encoding="utf-8"),
        theme=THEME_CSS.read_text(encoding="utf-8"),
        w=W,
        h=H,
        snow=snow,
        name=name,
        description=description,
        domain=domain,
    )

    tmp = BLOG / "public" / "_og-card.html"
    tmp.write_text(html, encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # device_scale_factor 必须为 1：og:image 就是这张文件本身，尺寸要对得上
        ctx = browser.new_context(viewport={"width": W, "height": H})
        page = ctx.new_page()
        page.goto(f"file://{tmp.as_posix()}")
        page.wait_for_timeout(1200)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT), type="jpeg", quality=92)
        ctx.close()
        browser.close()

    tmp.unlink(missing_ok=True)
    print(f"saved {OUT} ({OUT.stat().st_size // 1024} KB, {W}x{H})")


if __name__ == "__main__":
    main()
