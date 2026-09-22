"""按规格把"她"的占位剪影接进 /about/ 的卡，截图看构图（亮/暗）。

不是成品素材，只是几何复核：用一个按规格画出来的剪影（2:3、下巴在 50%、中轴 50%、
马尾上扬占右上）验证 ① 头是否落在水面上、② 暗色下沉后是否沉到水面下、
③ 会不会压到左侧文字、④ 右肩/马尾是否真的出血。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-figure-mock.py
输出: docs/agent/scripts/out/oshi-figure-mock/*.png（该目录 gitignore）
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-figure-mock"

# ---- 占位剪影：画布 1024×1536（2:3），下巴 y=768（50%）、头顶 y=420（27%）、胯 y=1536 ----
SIL = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536" width="1024" height="1536">
  <g>
    <!-- 马尾 + 发团（右上） -->
    <path d="M600 430 C700 330 790 250 860 296 C892 318 884 420 828 476"
          fill="none" stroke="#463a55" stroke-width="118" stroke-linecap="round"/>
    <ellipse cx="512" cy="580" rx="152" ry="196" fill="#463a55"/>
    <!-- 躯干：白开衫 + 黑 T -->
    <path d="M257 900 C300 856 400 840 512 840 C624 840 724 856 767 900
             C742 1080 730 1240 734 1536 L290 1536 C294 1240 282 1080 257 900 Z" fill="#eeedf2"/>
    <path d="M420 846 C470 900 554 900 604 846 C592 1000 588 1200 586 1536 L438 1536
             C436 1200 432 1000 420 846 Z" fill="#26232c"/>
    <!-- 脖子 -->
    <rect x="451" y="730" width="122" height="150" fill="#e9c7b6"/>
    <!-- 头 -->
    <ellipse cx="512" cy="594" rx="126" ry="174" fill="#f2d3c1"/>
    <!-- 刘海/眼（只是为了让脸有个朝向） -->
    <path d="M390 520 C420 430 610 420 640 520 C600 470 430 470 390 520 Z" fill="#463a55"/>
    <ellipse cx="462" cy="612" rx="20" ry="13" fill="#5a6ea8"/>
    <ellipse cx="562" cy="612" rx="20" ry="13" fill="#5a6ea8"/>
  </g>
</svg>
"""

GEOM = """
(args) => {
  const {sil, wl, sink, dark} = args;
  const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(sil);
  const card = document.querySelector('.oshi-card');
  const fig = document.querySelector('.oshi-figure');
  fig.style.cssText = 'position:absolute;right:0;top:0;width:0;height:0;z-index:1;pointer-events:none';
  fig.innerHTML = '';
  const W = 376, H = 564;          // 显示尺寸：H = 2 × 水线
  const mk = (name, clip, filter, extra) => {
    const layer = document.createElement('span');
    layer.style.cssText = 'position:absolute;right:-116px;top:0;width:' + W + 'px;height:' + H + 'px;clip-path:' + clip + ';';
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'position:absolute;right:0;top:0;width:' + W + 'px;height:' + H + 'px;filter:' + filter + ';' + (extra || '');
    layer.appendChild(img);
    fig.appendChild(layer);
    return img;
  };
  if (!dark) {
    mk('above', 'inset(0 0 calc(100% - ' + wl + 'px) 0)', 'none', '');
    mk('under', 'inset(' + wl + 'px 0 0 0)', 'saturate(.72) blur(1.5px)', 'opacity:.94');
  } else {
    // 暗色：整张卡在水下，她整体下沉；只留"水下"一层（她整个在水面线以下）
    mk('night', 'none', 'saturate(.7) brightness(.86)', 'transform:translateY(' + sink + 'px);opacity:.96');
  }
  // 水面在她身上那一道（亮色）
  if (!dark) {
    const line = document.createElement('span');
    line.style.cssText = 'position:absolute;right:0;top:' + wl + 'px;width:260px;height:2px;'
      + 'background:linear-gradient(90deg,transparent,oklch(1 0 0/.8) 10%,oklch(1 0 0/.8) 90%,transparent);opacity:.9';
    fig.appendChild(line);
  }
  const cr = card.getBoundingClientRect();
  const b = document.querySelector('.oshi-below').getBoundingClientRect();
  return {waterLine: b.top - cr.top, cardW: cr.width, cardH: cr.height};
}
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for theme in ("light", "dark"):
            ctx = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
            page = ctx.new_page()
            page.goto(URL, wait_until="load")
            page.evaluate("t => { document.documentElement.dataset.theme = t; }", theme)
            page.evaluate("() => document.querySelector('.oshi-card').scrollIntoView({block:'start',behavior:'instant'})")
            page.wait_for_timeout(500)
            info = page.evaluate(
                GEOM,
                {"sil": SIL, "wl": 282, "sink": round(282 * 0.6), "dark": theme == "dark"},
            )
            page.wait_for_timeout(400)
            el = page.query_selector(".oshi-card")
            el.screenshot(path=str(OUT / f"mock-{theme}.png"))
            print(theme, info)
            ctx.close()
        b.close()
    print("->", OUT)


if __name__ == "__main__":
    main()
