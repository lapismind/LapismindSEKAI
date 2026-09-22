"""查单推卡里每个文字元素**实际**用的是哪个字体（CDP 的 getPlatformFontsForNode），
并出 2x 放大裁片供人眼复核。

用法:
  cd blog/dist && python -m http.server 8777
  python docs/agent/scripts/playwright-oshi-font-probe.py
"""
import pathlib

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8777/about/"
OUT = pathlib.Path(__file__).parent / "out" / "oshi-card"

TARGETS = [
    (".oshi-unit", "单位行（日文+中文）"),
    (".oshi-head h3", "名字 朝比奈真冬"),
    (".oshi-head .jp", "日文名"),
    (".oshi-facts .oshi-fact:nth-child(1) .k", "官方标签 生日"),
    (".oshi-facts .oshi-fact:nth-child(1) .v", "官方值 1月27日"),
    (".oshi-facts .oshi-fact:nth-child(5) .v", "官方值 水族箱"),
    (".oshi-inner-title", "她自己写的"),
    (".oshi-inner .oshi-fact:nth-child(1) .v", "水里值 一缸水草和沙子"),
    (".oshi-tagline", "签名句"),
]

CDP = """
async (targets) => {
  const out = [];
  for (const [sel, label] of targets) {
    const el = document.querySelector(sel);
    if (!el) { out.push([label, sel, 'MISSING']); continue; }
    out.push([label, sel, el]);
  }
  return out;
}
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
        page = ctx.new_page()
        cdp = ctx.new_cdp_session(page)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        page.goto(URL, wait_until="load")
        page.evaluate("() => document.documentElement.dataset.theme = 'dark'")
        page.evaluate("() => document.querySelector('.oshi-card')"
                      ".scrollIntoView({block:'center',behavior:'instant'})")
        page.wait_for_timeout(700)

        print(f"{'元素':22s} {'声明族':28s} 实际渲染字体")
        print("-" * 96)
        for sel, label in TARGETS:
            node = cdp.send("DOM.querySelector", {
                "nodeId": cdp.send("DOM.getDocument")["root"]["nodeId"], "selector": sel})
            nid = node.get("nodeId")
            if not nid:
                print(f"{label:22s} —— 页面上找不到 {sel}")
                continue
            fam = page.evaluate(
                "s => { const e=document.querySelector(s); return e ? getComputedStyle(e).fontFamily : ''; }",
                sel)
            pf = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})
            fonts = ", ".join(f"{f['familyName']}×{f['glyphCount']}" for f in pf["fonts"])
            print(f"{label:22s} {fam.split(',')[0][:28]:28s} {fonts}")

        page.query_selector(".oshi-card").screenshot(path=str(OUT / "font-2x-dark.png"))
        page.evaluate("() => document.documentElement.dataset.theme = 'light'")
        page.wait_for_timeout(400)
        page.query_selector(".oshi-card").screenshot(path=str(OUT / "font-2x-light.png"))
        ctx.close()
        b.close()
    print("->", OUT)


if __name__ == "__main__":
    main()
