"""生成 design-kit 的令牌封面图（博客文章用）。

封面直接从 `packages/design-kit/tokens.css` 读真值渲染，所以令牌改了重跑一次
即可，不会出现"封面上的色值和实际令牌不一致"这种又一次的分叉。

前置：字体已同步（`npm run predev` 或 `npm run build` 会做，也可单独
      `node ../packages/design-kit/scripts/sync-fonts.mjs`）

用法：
    cd blog && py -3.13 scripts/gen-token-cover.py
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BLOG = Path(__file__).resolve().parent.parent
REPO = BLOG.parent
TOKENS_CSS = REPO / "packages" / "design-kit" / "tokens.css"
FONT_CSS = BLOG / "public" / "fonts" / "lxgwwenkaiscreen.css"
OUT = BLOG / "src" / "assets" / "covers" / "design-kit-tokens.png"

# 2:1，与 BlogPost 布局里 hero 的 1020×510 比例一致
W, H = 1200, 600

BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
# 品牌色阶在 theme.css 里是静态 hex（Tailwind 的 @theme 只吃静态值），
# 所以这里的取值也来自那个文件，而不是再写第二份
THEME_CSS = REPO / "packages" / "design-kit" / "theme.css"

PAGE = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<link rel="stylesheet" href="file://{font_css}" />
<style>
{tokens}
{theme}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; width: {w}px; height: {h}px; padding: 28px 40px;
  background: var(--page-bg); color: var(--ink);
  font-family: var(--font-body);
  display: flex; flex-direction: column; gap: 13px;
}}
.head {{ display: flex; align-items: baseline; gap: 14px; }}
.head h1 {{ margin: 0; font-size: 27px; letter-spacing: -0.02em; }}
.head .sub {{ font-size: 14px; color: var(--muted); }}
.head .pkg {{ margin-left: auto; font-family: var(--font-mono); font-size: 13px; color: var(--primary); }}
.row {{ display: flex; gap: 10px; align-items: stretch; }}
.ramp {{ flex: 1; height: 62px; border-radius: var(--radius-sm); border: 1px solid var(--line);
         display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; }}
.ramp span {{ font-family: var(--font-mono); font-size: 10px; font-variant-numeric: tabular-nums; }}
.section {{ font-size: 12px; color: var(--muted); margin: 2px 0 -12px; letter-spacing: .04em; }}
.cards {{ display: flex; gap: 14px; }}
.card {{ flex: 1; border-radius: var(--radius); border: 1px solid var(--line);
         background: var(--card-bg); padding: 12px 16px; }}
.card .k {{ font-size: 12px; color: var(--muted); }}
.card .v {{ font-size: 15px; margin-top: 6px; font-weight: 700; }}
.card .mono {{ font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 400; }}
.radii {{ display: flex; gap: 14px; }}
.radii div {{ width: 78px; height: 52px; background: var(--primary-soft);
              border: 1px solid var(--primary-ghost); display: flex;
              align-items: center; justify-content: center;
              font-family: var(--font-mono); font-size: 13px; color: var(--primary); }}
.shadows {{ display: flex; gap: 22px; }}
.shadows div {{ flex: 1; height: 50px; background: var(--card-solid);
                border-radius: var(--radius-sm); display: flex; align-items: center;
                justify-content: center; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }}
.fonts {{ display: flex; gap: 14px; }}
.fonts div {{ flex: 1; border: 1px solid var(--line); border-radius: var(--radius-sm);
              padding: 10px 14px; background: var(--card-bg); }}
.fonts .t {{ font-size: 18px; }}
.fonts .d {{ font-size: 11px; color: var(--muted); margin-top: 4px; }}
</style></head><body>
  <div class="head">
    <h1>设计语言 · 令牌</h1>
    <span class="sub">唯一真源，四个项目共用</span>
    <span class="pkg">@lapismind/design-kit</span>
  </div>

  <div class="section">品牌色阶（11 档 · 不随主题变）</div>
  <div class="row">{ramps}</div>

  <div class="section">语义表面（跟着主题走）</div>
  <div class="cards">
    <div class="card"><div class="k">页面底 page-bg</div><div class="v mono">{page_bg}</div></div>
    <div class="card" style="background:var(--card-solid)"><div class="k">卡片 card-solid</div><div class="v mono">{card_solid}</div></div>
    <div class="card"><div class="k">正文 ink</div><div class="v mono">{ink}</div></div>
    <div class="card"><div class="k">辅助 muted</div><div class="v mono">{muted}</div></div>
    <div class="card"><div class="k">描边 line</div><div class="v mono">{line}</div></div>
  </div>

  <div class="cards">
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="k">圆角阶梯</div>
      <div class="radii">
        <div style="border-radius:var(--radius-sm)">10</div>
        <div style="border-radius:var(--radius)">18</div>
        <div style="border-radius:var(--radius-lg)">26</div>
      </div>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="k">阴影阶梯（靠它做层次，不用深色遮罩）</div>
      <div class="shadows">
        <div style="box-shadow:var(--shadow-sm)">sm 面板</div>
        <div style="box-shadow:var(--shadow-md)">md 卡牌</div>
        <div style="box-shadow:var(--shadow-lg)">lg 浮层</div>
      </div>
    </div>
  </div>

  <div class="fonts">
    <div><div class="t">中文正文用霞鹜文楷</div><div class="d">--font-body · 一眼看出是同一个站</div></div>
    <div><div class="t mono">1024 · 房间 SW2D10</div><div class="d">--font-mono + .font-num · 数字要等宽才对齐</div></div>
  </div>
</body></html>
"""


def main():
    if not TOKENS_CSS.exists():
        print(f"FAIL: 找不到 {TOKENS_CSS}")
        sys.exit(1)

    theme_text = THEME_CSS.read_text(encoding="utf-8")
    brand = {}
    for step in BRAND_STEPS:
        marker = f"--color-brand-{step}:"
        for line in theme_text.splitlines():
            if line.strip().startswith(marker):
                brand[step] = line.split(":", 1)[1].strip().rstrip(";")
                break
        if step not in brand:
            print(f"FAIL: theme.css 里没有 --color-brand-{step}")
            sys.exit(1)

    # 浅档（50–400）配深字、深档（500–950）配白字，两头才都读得清
    ramps = "".join(
        f'<div class="ramp" style="background:{brand[s]}">'
        f'<span style="color:{"#333" if s <= 400 else "#fff"}">{s}</span></div>'
        for s in BRAND_STEPS
    )

    def token(name):
        for line in TOKENS_CSS.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(f"{name}:"):
                return line.split(":", 1)[1].strip().rstrip(";")
        return "?"

    html = PAGE.format(
        font_css=FONT_CSS.as_posix(),
        tokens=TOKENS_CSS.read_text(encoding="utf-8"),
        theme=theme_text,
        w=W,
        h=H,
        ramps=ramps,
        page_bg=token("--page-bg"),
        card_solid=token("--card-solid"),
        ink=token("--ink"),
        muted=token("--muted"),
        line=token("--line"),
    )

    tmp = BLOG / "public" / "_token-cover.html"
    tmp.write_text(html, encoding="utf-8")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=2)
        page = ctx.new_page()
        page.goto(f"file://{tmp.as_posix()}")
        page.wait_for_timeout(1200)
        OUT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(OUT))
        ctx.close()
        browser.close()

    tmp.unlink(missing_ok=True)
    print(f"saved {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
