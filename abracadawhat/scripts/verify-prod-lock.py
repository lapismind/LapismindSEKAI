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
        print('FAIL no start'); b.close(); exit(1)
    start.click(); p1.wait_for_timeout(3000)
    dragon = p1.locator('.grid button', has_text='古代巨龙').first
    dragon.click(); p1.wait_for_timeout(2500)
    banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
    print('cast:', banners[-1][:40] if banners else '?')
    if '💥' not in ''.join(banners):
        print('(猜对了，跳过锁定验证)'); b.close(); exit(0)
    disabled = 0; total = 0
    for name in ['魔法药水','火球','暴风雪','猫头鹰','黑暗幽灵']:
        btn = p1.locator('.grid button', has_text=name).first
        if btn.count(): total += 1; disabled += btn.is_disabled()
    print(f'spell buttons locked: {disabled}/{total}')
    endb = p1.get_by_text('结束回合')
    print('end-turn enabled:', endb.is_enabled())
    endb.click(); p1.wait_for_timeout(2500)
    body = p1.inner_text('body')
    print('turn passed to other:', any('等待' in l for l in body.splitlines()))
    row = p1.locator('div.rounded-xl.border', has_text='👑').first
    print('my health:', row.locator('[title^=生命]').get_attribute('title'))
    print('errs:', errs)
    b.close()
