"""实机复核单推卡：亮/暗 × 六档宽度，截图 + 量几何。

量的四件事（对应 blog/scripts/measure-oshi-art.py 定下的几条规矩）：
  ① 资料块底边必须在水线（卡高 25.7%）以上 —— 压到水线的亮带上就糊
  ② 空气带文字右界必须 < 卡宽 62% —— 再往右是她的头发
  ③ 水里的两块（她自己写的三条 / 签名句）必须落在量出来的两块空地内
  ④ 水面之下只在夜间显形 —— 白天 opacity 必须是 0，夜里必须是 1

注意 ④ 要用 wait_for_function 轮询：那两块带 --dur-slow 的 opacity 过渡，
固定 sleep 会在暗色下量到 0.98 这种中间值，看起来像断言坏了。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-card-check.py
输出: docs/agent/scripts/out/oshi-card/（该目录 gitignore）
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"
WATERLINE = 0.257
HAIR_LEFT = 0.62

GEOM = """
() => {
  const card = document.querySelector('.oshi-card');
  const cr = card.getBoundingClientRect();
  const box = (sel) => {
    const el = card.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {t: r.top - cr.top, b: r.bottom - cr.top, l: r.left - cr.left, r: r.right - cr.left};
  };
  const air = card.querySelector('.oshi-air');
  // 空气带文字的实际右界（取块内所有行盒的右缘）
  let airRight = 0;
  for (const el of (air ? air.querySelectorAll('*') : [])) {
    const r = el.getBoundingClientRect();
    if (r.width) airRight = Math.max(airRight, r.right - cr.left);
  }
  return {
    card: {w: cr.width, h: cr.height},
    air: box('.oshi-air'),
    airRight,
    facts: box('.oshi-facts'),
    inner: box('.oshi-inner'),
    tagline: box('.oshi-tagline-slot'),
    photo: box('.oshi-photo'),
    bodyStatic: getComputedStyle(card.querySelector('.oshi-body')).position === 'static',
    innerOpacity: +getComputedStyle(card.querySelector('.oshi-inner')).opacity,
    taglineOpacity: +getComputedStyle(card.querySelector('.oshi-tagline-slot')).opacity,
    line: cr.height * 0.257,
  };
}
"""

# 水区两块空地（相对卡片），来自 probe-oshi-boxes.py 实测：这两块是水区唯一没有细节的地方。
# 数字取"放宽"那一档（昼深字 7.96:1 / 夜白字 9.73:1；签名 6.56:1 / 10.84:1）。
POCKET_INNER = (0.05, 0.355, 0.54, 0.505)     # 她自己写的三条
POCKET_TAGLINE = (0.08, 0.505, 0.45, 0.580)   # 签名句

WIDTHS = [1600, 1280, 1024, 900, 760, 560, 360]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in WIDTHS:
            for theme in ("light", "dark"):
                ctx = b.new_context(viewport={"width": w, "height": 1000}, device_scale_factor=1)
                page = ctx.new_page()
                page.goto(URL, wait_until="load")
                page.evaluate("t => { document.documentElement.dataset.theme = t; }", theme)
                page.evaluate("() => document.querySelector('.oshi-card')"
                              ".scrollIntoView({block:'center',behavior:'instant'})")
                # 水面之下有 opacity 过渡（--dur-slow），必须等它走完再量 —— 固定 sleep
                # 会在暗色下量到 0.98 这种中间值，看起来像断言坏了
                want = 1.0 if theme == "dark" else 0.0
                page.wait_for_function(
                    "w => { const e = document.querySelector('.oshi-inner');"
                    " return e && Math.abs(parseFloat(getComputedStyle(e).opacity) - w) < 0.005; }",
                    arg=want, timeout=4000)
                page.wait_for_timeout(120)
                g = page.evaluate(GEOM)
                page.query_selector(".oshi-card").screenshot(path=str(OUT / f"{w}-{theme}.png"))
                cw, ch = g["card"]["w"], g["card"]["h"]
                notes = []
                # 水面之下只在夜里显形（白天水区是纯图）
                for nm, got in (("水里的三条", g["innerOpacity"]), ("签名句", g["taglineOpacity"])):
                    if abs(got - want) > 0.01:
                        notes.append(f"{nm}透明度 {got}（{theme} 应为 {want}）")
                if not g["bodyStatic"]:
                    if g["facts"]["b"] > g["line"]:
                        notes.append(f"资料压到水线 {g['facts']['b']:.0f}>{g['line']:.0f}")
                    if g["airRight"] > HAIR_LEFT * cw:
                        notes.append(f"文字右界 {g['airRight']:.0f}>{HAIR_LEFT*cw:.0f}")
                    for name, bx, pk in (("水里的三条", g["inner"], POCKET_INNER),
                                         ("签名句", g["tagline"], POCKET_TAGLINE)):
                        x0, y0, x1, y1 = pk[0] * cw, pk[1] * ch, pk[2] * cw, pk[3] * ch
                        if bx["l"] < x0 - 2 or bx["r"] > x1 + 2 or bx["t"] < y0 - 2 or bx["b"] > y1 + 2:
                            notes.append(f"{name}出了量好的空地 "
                                         f"[{bx['l']:.0f},{bx['t']:.0f},{bx['r']:.0f},{bx['b']:.0f}]"
                                         f" ⊄ [{x0:.0f},{y0:.0f},{x1:.0f},{y1:.0f}]")
                elif g["facts"]["t"] < g["photo"]["b"] - 1:
                    notes.append(f"窄屏资料没落到图下 {g['facts']['t']:.0f}<{g['photo']['b']:.0f}")
                flag = ("  ⚠ " + "；".join(notes)) if notes else ""
                if notes:
                    bad.append((w, theme, notes))
                print(f"{w:5d} {theme:5s} card={cw:6.1f}x{ch:6.1f} 水线={g['line']:5.1f} "
                      f"资料底={g['facts']['b']:6.1f} 文字右={g['airRight']:6.1f} "
                      f"{'窄屏落图下' if g['bodyStatic'] else '压在水里'}{flag}")
                ctx.close()
        b.close()
    print("->", OUT)
    if bad:
        print(f"\n❌ {len(bad)} 处不合规")
        raise SystemExit(1)
    print("\n✅ 全部合规")


if __name__ == "__main__":
    main()
