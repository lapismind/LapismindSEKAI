"""线上统一登录冒烟：无痕打开 turtle-soup，验证游客自动登录 + 登录入口出现。

用法：python docs/agents/playwright-auth-smoke.py [url]
默认 https://soup.qmzhj.top/，可传 showhand / abracadawhat 域名。
"""
import asyncio
import sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://soup.qmzhj.top/"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()
        hits = []

        def on_response(r):
            try:
                u = r.url
                if "auth.qmzhj.top" in u or "/api/" in u:
                    hits.append((r.request.method, u, r.status))
            except Exception:
                pass

        page.on("response", on_response)
        await page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(5000)
        body = await page.inner_text("body")
        print("AUTH_API_CALLS:")
        for h in hits:
            print(" ", h)
        print("SHOWS_GUEST_BADGE:", "游客" in body)
        print("HAS_GITHUB_LOGIN_BTN:", "GitHub 登录" in body)
        print("HAS_ACCOUNT_LOGIN_ENTRY:", "注册/登录" in body)
        await browser.close()


asyncio.run(main())
