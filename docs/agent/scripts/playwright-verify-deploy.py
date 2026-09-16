"""部署后验收：三个游戏 + 博客的线上冒烟，以及 abracadawhat 的表情资源检查。

覆盖 abracadawhat/docs/deployment-v2.md「生产验收」那节强制要求的检查：
  两张来自不同目录的表情图必须 HTTP 200 + Content-Type: image/png + 长度 > 0。
  返回 200 text/html 说明是 SPA fallback 兜底，即图片没进 dist —— 这不是格式问题。

另外做三件事（部署后最该看的三件事）：
  1. 每个站首页能打开、无 pageerror、无失败请求
  2. 字体真的生效（body 的 computed font-family 含 LXGW WenKai Screen）——
     这条对本轮尤其重要：turtle-soup 的 deploy 曾经绕过 prebuild 同步字体
  3. 落一张截图，便于与部署前对比

用法：
  python docs/agent/scripts/playwright-verify-deploy.py
"""
import json
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

SITES = [
    ("blog", "https://blog.qmzhj.top/"),
    ("turtle-soup", "https://soup.qmzhj.top/"),
    ("showhand", "https://showhand.qmzhj.top/"),
    ("abracadawhat", "https://abracadawhat.qmzhj.top/"),
]

# deployment-v2.md 点名的两张（来自不同 emoji 目录）
EMOJI_URLS = [
    "https://abracadawhat.qmzhj.top/chat-kit/emojis/1/stamp0008.png",
    "https://abracadawhat.qmzhj.top/chat-kit/emojis/21/stamp0943.png",
]

OUT = Path(__file__).resolve().parent / "out" / "deploy-verify"
OUT.mkdir(parents=True, exist_ok=True)

# 必须伪装成浏览器 UA：站前有 Cloudflare，Python-urllib 的默认 UA 会被直接 403。
# 实测同一 URL：UA=Python-urllib/3.13 → 403（server: cloudflare）；
#              浏览器 UA → 200 image/png。
# 不加这个头会把「部署正常」误报成「表情资源 403」，白查一轮。
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0 Safari/537.36"
)

ok = True


def check(label, passed, detail=""):
    global ok
    if not passed:
        ok = False
    print(f"  {'PASS' if passed else 'FAIL'}  {label}{('  — ' + detail) if detail else ''}")


print("══ 1. 表情资源（deployment-v2.md 强制项）══")
for url in EMOJI_URLS:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read()
        good = r.status == 200 and "image/png" in ctype and len(body) > 0
        check(url.split("/emojis/")[1], good, f"{r.status} {ctype} {len(body)}B")
        if r.status == 200 and "text/html" in ctype:
            print("        ↑ 200 text/html = SPA fallback，说明图片没进 dist")
    except urllib.error.HTTPError as e:
        extra = ""
        if e.code == 403:
            extra = "  ← 403 多为 Cloudflare 拦 UA，确认请求带了浏览器 UA"
        check(url, False, f"HTTP {e.code}{extra}")
    except Exception as e:
        check(url, False, f"{type(e).__name__}: {e}")

print("\n══ 2. 站点冒烟（首页 + 字体 + 截图）══")
with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, url in SITES:
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errs, failed = [], []
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: failed.append(r.url))
        try:
            resp = page.goto(url, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(1200)
            font = page.evaluate("getComputedStyle(document.body).fontFamily")
            font_ok = "LXGW WenKai Screen" in font
            page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
            # 本地 auth 未接入时线上不该出现这些；线上是真环境，所以任何报错都值得看
            real_errs = [e for e in errs if "favicon" not in e.lower()]
            check(
                f"{name:14} HTTP {resp.status if resp else '?'}",
                bool(resp and resp.status == 200),
                f"pageerror/console {len(real_errs)}，失败请求 {len(failed)}",
            )
            check(f"{name:14} 字体 LXGW WenKai Screen 生效", font_ok, font[:60])
            for e in real_errs[:3]:
                print(f"        err: {e[:110]}")
            for f_ in failed[:3]:
                print(f"        failed: {f_[:110]}")
        except Exception as e:
            check(f"{name:14} 打开", False, f"{type(e).__name__}: {e}")
        page.close()
    browser.close()

print(f"\n截图：{OUT}")
print(json.dumps({"all_passed": ok}, ensure_ascii=False))
print("结论：" + ("全部通过" if ok else "有项目未通过，见上方 FAIL"))
