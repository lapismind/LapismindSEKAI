import random, string
from playwright.sync_api import sync_playwright
BASE = 'https://abracadawhat.qmzhj.top'
room = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    c1 = b.new_context(); p1 = c1.new_page()
    errs = []
    p1.on('pageerror', lambda e: errs.append(str(e)[:150]))
    p1.goto(BASE + '/room/' + room); p1.wait_for_timeout(3500)
    c2 = b.new_context(); p2 = c2.new_page()
    p2.goto(BASE + '/room/' + room); p1.wait_for_timeout(2500)
    start = p1.get_by_text('开始游戏')
    if not start.count():
        print('FAIL no start:', p1.inner_text('body')[:120].replace('\n',' | '))
    else:
        start.click(); p1.wait_for_timeout(3000)
        endb = p1.get_by_text('结束回合')
        print('end-turn disabled before cast:', endb.is_disabled() if endb.count() else 'missing')
        dragon = p1.locator('.grid button', has_text='古代巨龙').first
        dragon.click(); p1.wait_for_timeout(2500)
        banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
        row = p1.locator('div.rounded-xl.border', has_text='👑').first
        t = row.locator('[title^=生命]')
        print('banner:', banners[-1][:50] if banners else '?')
        print('host row:', t.get_attribute('title'))
        print('errs:', errs)
    b.close()
