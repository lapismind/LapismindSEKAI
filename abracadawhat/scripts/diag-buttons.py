import random, string
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5174'
room = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    c1 = b.new_context(); p1 = c1.new_page()
    errs = []
    p1.on('pageerror', lambda e: errs.append(str(e)[:200]))
    p1.goto(BASE + '/room/' + room); p1.wait_for_timeout(2000)
    c2 = b.new_context(); p2 = c2.new_page()
    p2.goto(BASE + '/room/' + room); p1.wait_for_timeout(1500)
    p1.get_by_text('开始游戏').click(); p1.wait_for_timeout(2500)
    body = p1.inner_text('body')
    print('BODY:', body[:400].replace('\n',' | '))
    print('BTNS:', [t[:20] for t in p1.locator('button').all_inner_texts()][:30])
    print('ERRS:', errs)
    b.close()
