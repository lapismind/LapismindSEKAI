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
    # 读取对方手牌（第二行玩家区可见），挑一个我方也有的？不行，看不到自己的。
    # 策略：读对方牌面，宣告对方有的种类（36张里26张在两人手里+对方5张可见，命中率高）
    opp_row = p1.locator('div.rounded-xl.border').nth(1)
    opp_cards = []
    for card in opp_row.locator('.w-12').all():
        t = card.get_attribute('title') or ''
        if '：' in t: opp_cards.append(t.split('：')[0])
    print('opp cards:', opp_cards)
    target = None
    for name in ['魔法药水','火球','暴风雪','闪电暴风雨','猫头鹰','甜蜜的梦','黑暗幽灵']:
        if name in opp_cards: target = name; break
    if not target: target = opp_cards[0] if opp_cards else None
    print('declaring:', target)
    btn = p1.locator('.grid button', has_text=target).first
    btn.click(); p1.wait_for_timeout(2200)
    banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
    print('result:', banners[-1][:60] if banners else '?')
    if banners and '✨' in banners[-1]:
        endb = p1.get_by_text('结束回合')
        print('end-turn enabled:', endb.is_enabled() if endb.count() else 'missing')
        endb.click(); p1.wait_for_timeout(2000)
        body = p1.inner_text('body')
        print('after end turn, waiting text:', [l for l in body.splitlines() if '等待' in l][:1])
    b.close()
