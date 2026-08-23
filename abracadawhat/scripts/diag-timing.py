import random, string, time
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
    t1 = row.locator('[title^=生命]').get_attribute('title')
    print('t+2.5s:', t1)
    p1.wait_for_timeout(5000)
    t2 = row.locator('[title^=生命]').get_attribute('title')
    print('t+7.5s:', t2)
    b.close()
