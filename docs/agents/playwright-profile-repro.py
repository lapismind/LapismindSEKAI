"""无头复现 / 诊断 blog.qmzhj.top/profile。

用法:
  python docs/agents/playwright-profile-repro.py

依赖: 本机只有 Python 3.13 的 playwright (C:\Program Files\Python313)，没有 node 版。
  浏览器二进制缺失时先装:  python -m playwright install chromium
  （下载超时换镜像:  set PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright）

说明: 用全新无 cookie 上下文 = 等同无痕模式，可复现游客态加载问题。
"""
from playwright.sync_api import sync_playwright

URL = "https://blog.qmzhj.top/profile"


def main():
    logs, bad = [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context()  # 全新上下文 = 无痕，无 cookie
        page = ctx.new_page()
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        page.on("response", lambda r: bad.append(f"{r.status} {r.request.method} {r.url}") if r.status >= 400 else None)
        try:
            page.goto(URL, wait_until="networkidle", timeout=30000)
        except Exception as e:
            logs.append(f"[goto-error] {e}")
        page.wait_for_timeout(2500)

        err_hidden = page.eval_on_selector("#profile-error", "el => el.hidden")
        content_hidden = page.eval_on_selector("#profile-content", "el => el.hidden")
        entry = page.eval_on_selector("#pf-register-entry", "el => el ? (el.hidden ? 'hidden' : 'visible') : 'MISSING'")

        print("=== CONSOLE / ERRORS ===")
        print("\n".join(logs) or "(none)")
        print("=== >=400 RESPONSES ===")
        print("\n".join(bad) or "(none)")
        print(f"[state] profile-error.hidden={err_hidden}  profile-content.hidden={content_hidden}  pf-register-entry={entry}")
        b.close()


if __name__ == "__main__":
    main()
