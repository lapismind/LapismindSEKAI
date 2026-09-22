"""生成 about 页的独立预览页（给用户看效果用，不参与构建）。

样式与结构都从仓库读真源，所以预览和线上是同一份：
  - 令牌       ← packages/design-kit/tokens.css + theme.css + base.css
  - 卡片样式   ← blog/src/pages/about.astro 的 <style> 里 .oshi-* 那一段
  - 卡片结构   ← blog/src/pages/about.astro 里那棵 .oshi-card 的子树
  - 卡片文案   ← blog/src/data/profile.ts 的 oshiCard

**结构不要手抄**：手抄一份模板会漏掉后来加进卡片的节点（水层就这么漏过一次），
所以这里从 about.astro 抽出来、只把 {oshiCard.xxx} 换成 profile.ts 里的真值。

和上一版的区别：**按真实页面宽度铺开**。站点的内容栏是 `min(760px, 100% - 2.5rem)`，
在 1920 上左右各空 580px——那一大片现在什么都没放。所以预览页把两侧空档
量出来画成虚线区，并可以把人物放进右侧空档看"艺术在两侧、不在卡片上"的方向。

用法：cd blog && python scripts/gen-oshi-preview.py
输出：docs/agent/scripts/out/oshi-preview/index.html（该目录被 gitignore）
"""
import re

from pathlib import Path

BLOG = Path(__file__).resolve().parent.parent
REPO = BLOG.parent
TOKENS = REPO / 'packages' / 'design-kit' / 'tokens.css'
THEME = REPO / 'packages' / 'design-kit' / 'theme.css'
BASE = REPO / 'packages' / 'design-kit' / 'base.css'
FONTS = BLOG / 'public' / 'fonts' / 'lxgwwenkaiscreen.css'
ABOUT = BLOG / 'src' / 'pages' / 'about.astro'
PROFILE = BLOG / 'src' / 'data' / 'profile.ts'
OUTDIR = REPO / 'docs' / 'agent' / 'scripts' / 'out' / 'oshi-preview'
OUT = OUTDIR / 'index.html'
# 抠好的试位图（bg_remove.py 的产物）；不在就跳过人物层
FIG_DAY = REPO / '_tmpfig' / 'gpt' / 'gpt-day.png'
FIG_NIGHT = REPO / '_tmpfig' / 'gpt' / 'gpt-night.png'

NL = chr(10)   # 换行：写成 chr(10) 免得脚本里出现裸换行
TAB = chr(9)


def read(p):
    return p.read_text(encoding='utf-8')


def oshi_data():
    """从 profile.ts 取 oshiCard 的字段（预览页只读，不写第二份数据）"""
    s = read(PROFILE)
    block = s[s.index('oshiCard'):]
    block = block[: block.index('} as const')]
    return dict(re.findall(r"(\w+):\s*'([^']*)'", block))


def oshi_css():
    """从 about.astro 抽卡片那一段 CSS（到 @media (max-width: 640px) 之前为止）"""
    s = read(ABOUT)
    return s[s.index('/* 单推角色卡'): s.index('@media (max-width: 640px) {')]


def card_markup(d):
    """从 about.astro 抽 .oshi-card 子树，把 {oshiCard.xxx} 换成真值"""
    s = read(ABOUT)
    start = s.index('<div class="oshi-card">')
    end = s.index('</section>', start)
    block = s[start:end]
    block = re.sub(r'\{/\*.*?\*/\}', '', block, flags=re.S)                 # 去 Astro 注释
    block = re.sub(r'=\{\s*oshiCard\.(\w+)\s*\}',
                   lambda m: '="%s"' % d.get(m.group(1), ''), block)        # 属性里的表达式
    block = re.sub(r'\{\s*oshiCard\.(\w+)\s*\}',
                   lambda m: d.get(m.group(1), ''), block)                  # 正文里的表达式
    out = []
    for ln in block.split(NL):
        body = ln.lstrip(TAB).rstrip()
        if body:
            out.append('        ' + body)
    text = NL.join(out)
    # 她进卡片的 .oshi-figure 槽位（线上那张是空的，等出图到货）
    return text.replace(
        '<div class="oshi-figure" aria-hidden="true"></div>',
        '<div class="oshi-figure" aria-hidden="true">'
        '<img class="fig fig-day" src="figure-day.png" alt="" />'
        '<img class="fig fig-night" src="figure-night.png" alt="" />'
        '</div>')


def stage_markup(card, theme):
    """一个"真实页面宽度"的舞台：左侧空档 / 760px 内容栏 / 右侧空档。

    人物**在卡片里**（.oshi-figure 槽位，由 card_markup 注入）；
    两侧虚线区是留给**另外的**图与艺术效果的，不是她。"""
    return f'''      <div class="stage" data-theme="{theme}">
        <div class="rail rail-left"><span>左侧空档 · 约 420px<br>（留给别的图 / 艺术效果）</span></div>
        <div class="col">
          <p class="eyebrow">oshi · 单推</p>
{card}
        </div>
        <div class="rail rail-right"><span>右侧空档 · 约 420px<br>（留给别的图 / 艺术效果）</span></div>
      </div>'''


def main():
    d = oshi_data()
    for p in (TOKENS, THEME, BASE, FONTS, ABOUT, PROFILE):
        if not p.exists():
            raise SystemExit('FAIL: 找不到 %s' % p)

    # 主题选择器改写：预览页的 data-theme 在舞台 div 上、不在 :root 上，
    # 所以 `:root[data-theme='dark']` 与 `:root:not([data-theme='dark'])` 两种写法都要改写，
    # 否则"亮色专用"的规则会漏进暗色舞台（踩过一次：水下 k 标签在预览里变成 2.55:1 的假故障）。
    def theme_scope(text):
        return (text.replace(":root:not([data-theme='dark'])", ":not([data-theme='dark'])")
                    .replace(":root[data-theme='dark']", "[data-theme='dark']"))

    tok = theme_scope(read(TOKENS))
    thm = theme_scope(read(THEME))
    base = theme_scope(read(BASE))
    css = theme_scope(oshi_css())
    card = card_markup(d)

    has_fig = FIG_DAY.exists() and FIG_NIGHT.exists()
    if has_fig:
        # 必须裁到人物框再复制：带透明边的话，CSS 里的 height 是"画布高"不是"人物高"，
        # 定位会飘（第一次就是这么飘的）。
        from PIL import Image
        OUTDIR.mkdir(parents=True, exist_ok=True)
        for src, dst in ((FIG_DAY, 'figure-day.png'), (FIG_NIGHT, 'figure-night.png')):
            im = Image.open(src).convert('RGBA')
            im.crop(im.getchannel('A').getbbox()).save(OUTDIR / dst)
            print('  人物 %s -> %s' % (src.name, (OUTDIR / dst).name))

    html = '''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>about 页 · 卡片与两侧空档（样式预览）</title>
<link rel="stylesheet" href="file://__FONTS__" />
<style>
__TOKENS__
__THEME__
__BASE__
* { box-sizing: border-box; }
/* 注意：base.css 给 body 设了 background: var(--page-bg)，而 body 在 [data-theme]
   作用域之外 → 解析成**亮色**，所以这一页的底色是浅的。页面框架的文字必须写深色，
   不能靠 var(--ink)/#fff 这类跟着主题走的令牌（写错过一次：近白标题在浅底上等于消失）。 */
html { background: oklch(0.972 0.014 249); }
body {
  margin: 0; font-family: var(--font-body); color: #1b1d27;
  /* 照抄 global.css:56 —— 站内 body 是 18px / 行高 1.85。
     写成浏览器默认的 16px/normal 会让整张卡矮 13%，比例全错（踩过一次）。 */
  font-size: 18px; line-height: 1.85;
  padding: 36px 24px 80px;
}
.page-head { max-width: 1000px; margin: 0 auto 22px; }
.page-head h1 { font-size: 1.45rem; margin: 0 0 0.6rem; color: #14161f; }
.page-head p { margin: 0.35rem 0; font-size: 0.9rem; color: #4b4f60; line-height: 1.75; }
.page-head code { font-family: var(--font-mono); font-size: 0.85em; color: #6b4fa8; }
.switches {
  max-width: 1000px; margin: 0 auto 24px; display: flex; flex-wrap: wrap; gap: 10px 22px;
  padding: 12px 16px; border: 1px dashed #c3c6d4; border-radius: 12px;
  font-size: 0.86rem; color: #33364a;
}
.switches label { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.stage-label {
  max-width: 1000px; margin: 26px auto 10px; font-family: var(--font-mono);
  font-size: 0.76rem; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6f80;
}

/* ---------- 舞台：真实页面宽度 ----------
   站点内容栏 = min(760px, 100% - 2.5rem)（global.css:211）。
   这里固定 1600px 画布来演示：左右各 420px 空档，就是现在什么都没放的地方。 */
.stage {
  width: 1600px; margin: 0 auto; padding: 30px 0 34px;
  display: grid; grid-template-columns: 420px 760px 420px;
  background: var(--page-bg); color: var(--ink);
  border-radius: 22px; border: 1px solid oklch(0.5 0.02 260 / 0.25);
  position: relative; overflow: hidden;
}
.rail {
  position: relative; border: 1px dashed oklch(0.62 0.06 var(--hue-accent) / 0.45);
  border-radius: 14px; margin: 0 14px;
  display: flex; align-items: flex-start; justify-content: center;
}
.rail span {
  margin-top: 14px; font-family: var(--font-mono); font-size: 0.7rem; line-height: 1.7;
  letter-spacing: 0.05em; text-align: center; color: var(--muted); opacity: 0.85;
}
.rail-right { overflow: visible; }
.rail-note { position: relative; z-index: 3; }
.col { padding: 0 4px; }
.col .eyebrow { display: inline-flex; align-items: center; gap: 0.6em;
  font-family: var(--font-mono); font-size: 0.72rem; font-weight: 500;
  letter-spacing: 0.22em; text-transform: uppercase; color: var(--primary); margin: 0 0 0.8rem; }
.col .eyebrow::before { content: ''; width: 1.6em; height: 1px; background: currentColor; opacity: 0.75; }

/* ---------- 仅预览页：卡片里的她 ----------
   槽位 .oshi-figure 是 0×0 的定位锚（right:0 / top:0 贴在卡片右上角），
   所以这里的 right/top 是相对**卡片右上角**量的：right 为负＝往右溢出卡片。
   亮色舞台出白天图、暗色舞台出夜间图（和卡片主题是同一套叙事）。 */
.oshi-figure img {
  position: absolute; width: auto; display: none; z-index: 1;
  pointer-events: none;
  filter: drop-shadow(0 18px 40px oklch(0.3 0.1 280 / 0.3));
}
.fig-day { right: -110px; top: 100px; height: 520px; }
.fig-night { right: 22px; top: 120px; height: 520px; }
body:has(#fig:checked) .fig-day { display: block; }
body:has(#fig:checked) [data-theme='dark'] .fig-day { display: none; }
body:has(#fig:checked) [data-theme='dark'] .fig-night { display: block; }

/* 预览页补站内 global.css 的几条（不补就会比线上矮/高，比例失真）。
   来源：global.css:56（body 18px / 1.85）、global.css:80（标题 1.25 / margin）、global.css:106（p 的下边距）。 */
h3 { line-height: 1.25; font-weight: 700; letter-spacing: -0.015em; margin: 0 0 0.6em; }
p { margin: 0 0 1.1em; }
.sr-only {
  border: 0; padding: 0; margin: 0; position: absolute !important;
  height: 1px; width: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* ↓↓ 来自 about.astro 的卡片样式（同一份） ↓↓ */
__CSS__
</style>
</head>
<body>
<div class="page-head">
  <h1>about 页 · 卡片与两侧空档</h1>
  <p>卡片样式与结构直接从 <code>about.astro</code>、<code>tokens.css</code>、<code>profile.ts</code> 读出来内联，所以和线上是同一份。</p>
  <p><strong>这个页面的重点是那两条虚线。</strong>站点的内容栏写死在 <code>min(760px, 100% - 2.5rem)</code>，
     所以屏幕越宽、两侧空得越多——1600 宽时左右各 420px，1920 宽时各 580px，而现在那里什么都没有。
     舞台按真实宽度铺开，就是为了让你看见这块地有多大。</p>
</div>

<div class="switches">
  <label><input type="checkbox" id="fig" checked /> 把她放进右侧空档（试位图：亮色白天 / 暗色夜间）</label>
</div>

<div class="stage-label">亮色 · 白天的水族馆 —— 签名句不在这里</div>
__STAGE_LIGHT__

<div class="stage-label">暗色 · 你就在水里 —— 签名句浮上来了</div>
__STAGE_DARK__

<div class="page-head" style="margin-top:34px">
  <h1 style="font-size:1.05rem">看这几处</h1>
  <p>① <strong>卡片本身</strong>：水面线以上是六项可扫读的资料，以下是两件心事（喜欢的食物 / 不擅长 表达情绪）。
     水的分层、波光、气泡都在卡内。</p>
  <p>② <strong>签名句</strong>：亮色下那个位置只有一道会呼吸的涟漪、<strong>不显示字形</strong>；切到暗色才浮上来。
     读屏始终能读到（<code>.sr-only</code> 里有一份）。</p>
  <p>③ <strong>卡片里的她</strong>：试位图就放在卡片的 <code>.oshi-figure</code> 槽位里，
     亮色舞台出白天图、暗色舞台出夜间图。两边的虚线区是留给<strong>另外的</strong>图与艺术效果的。</p>
  <p style="color:#8f93ab">窄屏请把窗口拉到 390 与 320 各看一遍；<strong>两侧空档在窄屏不存在</strong>，
     所以放在那里的东西必须有降级方案（隐藏或缩小），不能是信息载体。</p>
</div>
</body>
</html>
'''

    html = (html.replace('__FONTS__', FONTS.as_posix())
                .replace('__TOKENS__', tok)
                .replace('__THEME__', thm)
                .replace('__BASE__', base)
                .replace('__CSS__', css)
                .replace('__STAGE_LIGHT__', stage_markup(card, 'light'))
                .replace('__STAGE_DARK__', stage_markup(card, 'dark')))

    OUTDIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print('saved %s (%d KB)  人物试位图: %s' % (OUT, OUT.stat().st_size // 1024,
                                                '有' if has_fig else '无'))


if __name__ == '__main__':
    main()
