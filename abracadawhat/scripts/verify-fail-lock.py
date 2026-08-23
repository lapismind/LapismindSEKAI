import random, string
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:5174'
room = 'T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, channel='msedge')
    c1 = b.new_context(); p1 = c1.new_page()
    errs = []
    p1.on('pageerror', lambda e: errs.append(str(e)[:150]))
    p1.goto(BASE + '/room/' + room); p1.wait_for_timeout(2000)
    c2 = b.new_context(); p2 = c2.new_page()
    p2.goto(BASE + '/room/' + room); p1.wait_for_timeout(1500)
    p1.get_by_text('开始游戏').click(); p1.wait_for_timeout(2500)
    dragon = p1.locator('.grid button', has_text='古代巨龙').first
    dragon.click(); p1.wait_for_timeout(2200)
    banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
    print('cast:', banners[-1][:40] if banners else '?')
    # 施法按钮应全部禁用，结束回合可用
    disabled_count = 0
    for name in ['魔法药水','火球','暴风雪','猫头鹰']:
        btn = p1.locator('.grid button', has_text=name).first
        if btn.count(): disabled_count += btn.is_disabled()
    print('spell buttons disabled after fail:', disabled_count, '/4')
    endb = p1.get_by_text('结束回合')
    print('end-turn enabled:', endb.is_enabled())
    endb.click(); p1.wait_for_timeout(2000)
    body = p1.inner_text('body')
    print('turn passed:', any('等待' in l for l in body.splitlines()))
    print('still my turn?', any('轮到你' in l for l in body.splitlines()))
    print('errs:', errs)
    b.close()
