import random, string, re
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
    def hearts(pg):
        return pg.locator('.text-red-500').count()
    print('hearts before:', hearts(p1))
    # 点击施法区的古代巨龙（第二个，第一个在公共区不是按钮）
    dragon = p1.locator('.grid button', has_text='古代巨龙').first
    print('dragon found:', dragon.count())
    if dragon.count():
        dragon.click(); p1.wait_for_timeout(2500)
    body = p1.inner_text('body')
    m = [l for l in body.splitlines() if ('✨' in l or '💥' in l)]
    print('banner:', m)
    print('hearts after:', hearts(p1))
    # 找到“我”那一行的血量文本
    rows = p1.locator('.rounded-xl.border').all_inner_texts()
    for r_ in rows[:4]:
        if '❤️' in r_:
            print('ROW:', r_[:80].replace('\n',' | '))
    print('ERRS:', errs)
    b.close()
