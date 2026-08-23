import random, string
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5174'
room = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    c1 = b.new_context(); p1 = c1.new_page()
    p1.goto(BASE + '/room/' + room); p1.wait_for_timeout(2000)
    c2 = b.new_context(); p2 = c2.new_page()
    p2.goto(BASE + '/room/' + room); p1.wait_for_timeout(1500)
    p1.get_by_text('开始游戏').click(); p1.wait_for_timeout(2500)
    dragon = p1.locator('.grid button', has_text='古代巨龙').first
    dragon.click(); p1.wait_for_timeout(2500)
    row = p1.locator('div.rounded-xl.border', has_text='👑').first
    print('p1 sees me at 生命:', row.locator('[title^=生命]').get_attribute('title'))
    row2 = p2.locator('div.rounded-xl.border', has_text='👑').first
    print('p2 sees host at 生命:', row2.locator('[title^=生命]').get_attribute('title'))
    # p2 现在施法失败一次，看 p1 视角的对方血条
    d2 = p2.locator('.grid button', has_text='古代巨龙').first
    if d2.count() and not d2.is_disabled():
        d2.click(); p1.wait_for_timeout(2500)
        rows = p1.locator('div.rounded-xl.border')
        for i in range(rows.count()):
            t = rows.nth(i).locator('[title^=生命]')
            if t.count(): print(f'p1 view row{i}:', t.get_attribute('title'))
    b.close()
