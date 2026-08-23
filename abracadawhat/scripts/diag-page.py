"""诊断：页面加载后等待更久，输出网络与控制台日志。"""
import random, string, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5174"
room = "T" + "".join(random.choices(string.ascii_uppercase + string.digits, k=5))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    page = browser.new_page()
    page.on("console", lambda m: print("CONSOLE:", m.type, m.text[:120]))
    page.on("websocket", lambda ws: print("WS-OPEN:", ws.url))
    page.on("requestfailed", lambda r: print("REQ-FAIL:", r.url[:100], r.failure))
    page.goto(BASE + "/room/" + room)
    page.wait_for_timeout(6000)
    print("BODY:", page.inner_text("body")[:200].replace("\n", " | "))
    browser.close()

