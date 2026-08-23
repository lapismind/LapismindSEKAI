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
    # 依次尝试每个魔法，找到手里有的（成功后按钮仍可用且横幅为 ✨）
    for name in ['魔法药水','火球','暴风雪','闪电暴风雨','猫头鹰','甜蜜的梦','黑暗幽灵']:
        btn = p1.locator('.grid button', has_text=name).first
        if not btn.count() or btn.is_disabled(): continue
        btn.click(); p1.wait_for_timeout(2000)
        banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
        last = banners[-1] if banners else '?'
        print(name, '->', last[:50])
        if '✨' in last:
            # 成功了，现在试结束回合（应该允许）和再点一个更罕见的（应该禁用）
            endbtn = p1.get_by_text('结束回合')
            print('end-turn button enabled:', endbtn.is_enabled() if endbtn.count() else 'missing')
            rarer = p1.locator('.grid button', has_text='古代巨龙').first
            print('dragon disabled after success:', rarer.is_disabled())
            break
        else:
            # 失败换人了，等对方（机器人不动作），直接失败回不到我方——跳出
            break
    b.close()
