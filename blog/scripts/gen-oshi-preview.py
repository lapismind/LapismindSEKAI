#!/usr/bin/env python3
"""生成单推卡的**自包含**预览 html（双击就能开，不联网、不起服务器）。

原则：**只做装配，不写第二份。**任何一处真源改了，重跑本脚本预览就跟着变。
  · 卡片 markup ← 构建产物 blog/dist/about/index.html 里 .oshi-card 的真实 DOM
  · 卡片 CSS    ← blog/src/pages/about.astro 里卡片那一段
  · 卡片脚本    ← 同一文件末尾那段 <script>（滚动弹簧）
  · 设计令牌    ← packages/design-kit/tokens.css 整份
  · 字体        ← 按卡片**实际用到的字**，从 97 个 woff2 子集里挑命中的，data URI 内联
  · 图片        ← 构建产物里 760 宽那两张 webp（从 srcset 里读出来，别猜文件名），data URI 内联

主题作用域改写（同页要同时显示亮/暗两张卡）：
  :root[data-theme='dark']        → [data-theme='dark']
  :root:not([data-theme='dark'])  → [data-theme='light']
  剩下的裸 :root                   → [data-theme]
**顺序不能反**：先换带方括号的，最后才换裸 :root，否则先把 :root 换掉会拆坏前面那些。
（上一版预览页就是漏了 :not() 那条，把"亮色专用"规则漏进了暗色面板 —— lessons #35。）

用法：python blog/scripts/gen-oshi-preview.py
输出：docs/agent/scripts/out/oshi-preview/index.html（该目录 gitignore）
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = ROOT / "blog" / "dist"
OUT = ROOT / "docs" / "agent" / "scripts" / "out" / "oshi-preview"

CARD_CSS_START = "/* ---------- 单推角色卡"
CARD_CSS_END = "\t\t\t@media (max-width: 640px) {"


def theme_scope(css: str) -> str:
    # Astro 的 :global(...) 是构建期语法，浏览器不认 —— 源码里那句
    # `:global(.oshi-pop) { position: absolute }` 原样内联的话整条规则失效
    # （点击气泡会变成 static / height 0，根本不成形）。构建产物里它是被拆掉的，这里照做。
    # 用 lambda 取捕获组，不写 r"" —— 那个反斜杠在"写脚本的脚本"里会被吃掉一层，
    # 结果替换串变成控制字符 ，选择器被整条抹掉（症状是 `.oshi-pop {` 变成 ` {`）
    css = re.sub(r":global\(([^)]*)\)", lambda m: m.group(1), css)
    css = css.replace(":root[data-theme='dark']", "[data-theme='dark']")
    css = css.replace(":root:not([data-theme='dark'])", "[data-theme='light']")
    css = css.replace(":root", "[data-theme]")
    return css


def card_markup_and_images() -> tuple[str, dict[str, str]]:
    """从构建产物里取真实 DOM；顺带把两张图的 760 宽版本读成 data URI。"""
    html = (DIST / "about" / "index.html").read_text(encoding="utf-8")
    i = html.index('class="oshi-card"')
    i = html.rindex("<div", 0, i)
    # 从 .oshi-card 开始做括号配平，切出整个卡片
    depth, j = 0, i
    for m in re.finditer(r"<div\b|</div>", html[i:]):
        depth += 1 if m.group(0) == "<div" else -1
        if depth == 0:
            j = i + m.end()
            break
    seg = html[i:j]

    uris: dict[str, str] = {}
    for cls in ("oshi-shot-day", "oshi-shot-night"):
        m = re.search(r'<img[^>]*class="%s"[^>]*>' % cls, seg)
        assert m, f"构建产物里找不到 {cls}"
        tag = m.group(0)
        srcset = re.search(r'srcset="([^"]+)"', tag)
        assert srcset, f"{cls} 没有 srcset"
        pick = None
        for part in srcset.group(1).split(","):
            bits = part.strip().split()
            if len(bits) == 2 and bits[1] == "760w":
                pick = bits[0]
        assert pick, f"{cls} 的 srcset 里没有 760w"
        data = (DIST / pick.lstrip("/")).read_bytes()
        uri = "data:image/webp;base64," + base64.b64encode(data).decode()
        uris[cls] = uri
        # 预览页是本地文件：换掉 src、去掉 srcset（否则浏览器还会去取 /_astro/…）
        new = re.sub(r'\ssrc="[^"]*"', f' src="{uri}"', tag)
        new = re.sub(r'\ssrcset="[^"]*"', "", new)
        new = re.sub(r'\ssizes="[^"]*"', "", new)
        new = new.replace('loading="lazy"', 'loading="eager"')
        seg = seg.replace(tag, new)
    return seg, uris


def shrink(raw: bytes, cps: set[int]) -> bytes:
    """把一份子集再裁到只剩用得着的字。

    站点的 woff2 是按 unicode-range 切成 97 份的，每份约 56KB、覆盖一大片码位 ——
    卡片只用到其中几个字。不裁的话 14 份要内联 786KB；裁完约 50KB。
    注意：**不合并**成一份。合并多个子集要处理字形序号冲突，风险大收益小；
    各自裁小、各自保留原来的 unicode-range，浏览器照样按码位挑，行为与线上一致。
    """
    from io import BytesIO

    from fontTools import subset as ftsubset
    from fontTools.ttLib import TTFont

    font = TTFont(BytesIO(raw))
    keep = cps & set(font.getBestCmap())
    if not keep:
        return raw
    opts = ftsubset.Options()
    opts.notdef_outline = True
    opts.recalc_bounds = False
    # FFTM/feat/morx 是 FontForge 时间戳与 AAT 表，浏览器渲染用不到；
    # 不显式 drop 的话 fontTools 会为每份子集刷三行 "NOT subset; dropped" 噪音。
    opts.drop_tables += ["DSIG", "FFTM", "feat", "morx"]
    sub = ftsubset.Subsetter(options=opts)
    sub.populate(unicodes=keep)
    sub.subset(font)
    font.flavor = "woff2"
    out = BytesIO()
    font.save(out)
    return out.getvalue()


def font_css(card_text: str) -> tuple[str, int, int, int]:
    """只内联卡片用得到的 woff2 子集（unicode-range 命中才收），并各自裁到最小。"""
    css = (ROOT / "blog" / "public" / "fonts" / "lxgwwenkaiscreen.css").read_text(encoding="utf-8")
    need = {ord(c) for c in card_text}
    out, hit, before, after = [], 0, 0, 0
    for blk in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        # unicode-range 是每块的最后一条声明，**没有结尾分号** —— 写成 [^;]+; 会 97 块全不命中
        ur = re.search(r"unicode-range:\s*([^;}]+)", blk)
        src = re.search(r"url\('\./files/([^']+)'\)", blk)
        if not ur or not src:
            continue
        cps: set[int] = set()
        for part in ur.group(1).split(","):
            part = part.strip().lower().removeprefix("u+")
            if "-" in part:
                a, b = part.split("-")
                cps.update(range(int(a, 16), int(b, 16) + 1))
            else:
                cps.add(int(part, 16))
        if not (cps & need):
            continue
        raw = (ROOT / "blog" / "public" / "fonts" / "files" / src.group(1)).read_bytes()
        small = shrink(raw, need)
        hit += 1
        before += len(raw)
        after += len(small)
        body = blk.replace(f"url('./files/{src.group(1)}')",
                           "url(data:font/woff2;base64," + base64.b64encode(small).decode() + ")")
        out.append("@font-face {" + body + "}")
    return "\n".join(out), hit, before, after


def sr_only_css() -> str:
    """从构建产物里取 .sr-only 的真定义。

    卡片标记里有一个给读屏用的 `.sr-only` 副本（签名句），线上靠全局 CSS 藏起来。
    预览页只内联了 tokens + 卡片 CSS，漏了它的话那句签名会**显示两遍** ——
    第一版就是这样，截图里一眼看到。不手抄，从 dist 里捞。
    """
    for css_file in sorted((DIST / "_astro").glob("*.css")):
        m = re.search(r"\.sr-only\{[^}]*\}", css_file.read_text(encoding="utf-8"))
        if m:
            return m.group(0)
    raise SystemExit("构建产物里找不到 .sr-only 定义")


def main() -> int:
    if not (DIST / "about" / "index.html").exists():
        print("先 `cd blog && npm run build`", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)

    markup, _ = card_markup_and_images()
    text = re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", markup))
    fonts, nf, f_before, f_after = font_css(text)

    astro = (ROOT / "blog" / "src" / "pages" / "about.astro").read_text(encoding="utf-8")
    a = astro.index(CARD_CSS_START)
    b = astro.index(CARD_CSS_END)
    card_css = theme_scope(astro[a:b])
    si = astro.rindex("<script>")
    sj = astro.index("</script>", si)
    card_js = astro[si + len("<script>"):sj]

    tokens = theme_scope((ROOT / "packages" / "design-kit" / "tokens.css").read_text(encoding="utf-8"))
    sr_only = sr_only_css()

    html = f"""<!doctype html>
<!-- has-js 必须手工打上：站点的"水面之下只在夜里显形"是挂在 .has-js 下的
     （BaseHead 的内联脚本负责加），预览页没有那段脚本，漏了它亮色卡里那两块就不会藏。 -->
<html lang="zh-CN" class="has-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>单推卡预览 · 朝比奈真冬</title>
<style>
{fonts}

{tokens}

/* 预览页自己的脚手架。卡片 CSS 从 about.astro 原样切来，不含下面这些。 */
[data-theme] {{
	--col: min(760px, 100% - 2.5rem);
	background: var(--page-bg);
	color: var(--ink);
	font-family: var(--font-body);
	transition: background var(--dur-slow) var(--ease-soft);
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: oklch(0.99 0.004 250); }}
[data-theme='dark'] {{ background: oklch(0.16 0.02 250); }}
.pv-band {{ padding: 4.5rem 0; display: grid; place-items: center; }}
.pv-band + .pv-band {{ border-top: 1px solid color-mix(in oklab, currentColor 12%, transparent); }}
.pv-label {{
	width: var(--col); margin: 0 0 1.1rem; display: flex; align-items: baseline;
	gap: 1rem; font-size: 0.8rem; letter-spacing: 0.18em; color: var(--muted);
}}
.pv-label b {{ font-weight: 400; letter-spacing: 0.02em; font-size: 0.95rem; color: var(--ink); }}
.pv-slopewrap {{ height: 46vh; display: grid; place-items: center; color: var(--muted);
	font-size: 0.78rem; letter-spacing: 0.22em; }}
.pv-note {{
	width: var(--col); margin: 0 auto; padding: 3.5rem 0 6rem;
	font-size: 0.92rem; line-height: 1.85; color: var(--ink-soft);
}}
.pv-note h2 {{ font-size: 1rem; letter-spacing: 0.1em; color: var(--ink); margin: 0 0 0.8rem; }}
.pv-note ul {{ margin: 0; padding-left: 1.2em; }}
.pv-note li {{ margin: 0.3rem 0; }}
.pv-note code {{ font-family: ui-monospace, Consolas, monospace; font-size: 0.86em;
	background: color-mix(in oklab, currentColor 9%, transparent); padding: 0.1em 0.35em; border-radius: 3px; }}
.pv-hud {{
	position: fixed; right: 1.1rem; bottom: 1.1rem; z-index: 99;
	font-family: ui-monospace, Consolas, monospace; font-size: 0.75rem;
	padding: 0.5rem 0.8rem; border-radius: 8px; letter-spacing: 0.06em;
	background: oklch(0.2 0.02 250 / 0.9); color: oklch(0.95 0.01 250);
	display: grid; gap: 0.15rem; min-width: 11rem;
}}
.pv-hud span {{ opacity: 0.65; }}
.pv-hud b {{ font-weight: 400; }}
.pv-bar {{ height: 4px; border-radius: 999px; background: oklch(1 0 0 / 0.16); overflow: hidden; position: relative; }}
.pv-bar i {{ position: absolute; top: 0; bottom: 0; left: 50%; width: 2px; background: oklch(0.8 0.12 220); }}

/* 卡片标记里那个给读屏用的副本靠它隐藏（真源，从 dist 捞） */
{sr_only}

/* 卡片 CSS（真源，原样） */
{card_css}
</style>
</head>
<body>

<section class="pv-band" data-theme="light">
	<p class="pv-label"><span>01</span><b>亮色 · 白天</b><span>水区是纯图 —— 水面之下那两块只在夜里出现</span></p>
	<div style="width:var(--col)">{markup}</div>
</section>

<div class="pv-slopewrap" data-theme="light">上下滚动 ↓</div>

<section class="pv-band" data-theme="dark">
	<p class="pv-label"><span>02</span><b>暗色 · 夜里</b><span>她自己写的那三条 + 签名句浮出来，字在水里悬着</span></p>
	<div style="width:var(--col)">{markup}</div>
</section>

<div class="pv-note" data-theme="dark">
	<h2>该看什么</h2>
	<ul>
		<li><b>上下滚动这张页面</b> —— 水面那条正弦会跟着推、跟着起伏，松手后自己荡回来。
		    右下角 HUD 是驱动它的 <code>--slosh</code> 值（阻尼弹簧，不是把滚动量直接映射）。</li>
		<li><b>水面之上是静止的</b> —— 身份三行与八项资料一个像素都不动（那是水面之上）。</li>
		<li><b>水在动</b> —— 散光缓慢漂移、一道斜光柱五十多秒扫一个来回、气泡上浮。</li>
		<li><b>字悬在水里</b> —— 夜里那两块以 13s / 17s 的椭圆缓慢漂移，三行各自再错开一点。</li>
		<li><b>切到深色再回来</b>，看水面之下那两块是淡入淡出的，不是突然出现。</li>
		<li>系统开了「减少动态效果」时整套动效全停 —— 这是刻意做的。</li>
	</ul>
</section>

<div class="pv-hud" id="hud">
	<span>--slosh（滚动驱动）</span>
	<b id="hud-v">+0.000</b>
	<div class="pv-bar"><i id="hud-i"></i></div>
</div>

<script>
{card_js}

/* 预览页专属：把每张卡的 --slosh 显到 HUD 上（真源脚本只管写变量，不管显示）。
   取"离视口中线最近的那张卡"，所以滚到哪张就看哪张。 */
(() => {{
	const cards = [...document.querySelectorAll('.oshi-card')];
	const v = document.getElementById('hud-v');
	const bar = document.getElementById('hud-i');
	if (!cards.length || !v) return;
	const tick = () => {{
		const mid = innerHeight / 2;
		let best = cards[0], bd = Infinity;
		for (const c of cards) {{
			const r = c.getBoundingClientRect();
			const d = Math.abs(r.top + r.height / 2 - mid);
			if (d < bd) {{ bd = d; best = c; }}
		}}
		const s = +(getComputedStyle(best).getPropertyValue('--slosh') || 0);
		v.textContent = (s >= 0 ? '+' : '') + s.toFixed(3);
		bar.style.left = `calc(50% + ${{s * 50}}% - 1px)`;
		requestAnimationFrame(tick);
	}};
	requestAnimationFrame(tick);
}})();
</script>
</body>
</html>
"""
    (OUT / "index.html").write_text(html, encoding="utf-8")
    size = (OUT / "index.html").stat().st_size
    print(f"→ {OUT / 'index.html'}")
    print(f"   卡片字符 {len(set(text))} 个 → 命中字体子集 {nf} 个，"
          f"裁字后 {f_before/1024:.0f} KB → {f_after/1024:.0f} KB")
    print(f"   总大小 {size/1024:.0f} KB（图 + 字体已内联，可脱网双击打开）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
