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
    def hearts(pg): return pg.locator('.text-red-500').count()
    # 连续宣告古代巨龙直到失败（手里最多1张，失败概率高）
    for i in range(6):
        dragon = p1.locator('.grid button', has_text='古代巨龙').first
        if not dragon.count(): break
        if dragon.is_disabled(): break
        dragon.click(); p1.wait_for_timeout(2200)
        banners = [l for l in p1.inner_text('body').splitlines() if ('✨' in l or '💥' in l)]
        print(f'cast {i+1}:', banners[-1] if banners else '?', '| hearts:', hearts(p1))
        rows = p1.locator('div.rounded-xl.border').all_inner_texts()
        for r_ in rows[:2]:
            if '❤️' in r_ and '👑' in r_:
                import re
                m = len(re.findall('❤️', r_))
                red = len(p1.locator('div.rounded-xl.border', has_text='👑').filter(has=p1.locator('.text-red-500')).first.locator('.text-red-500').all())
                print('  my row hearts total:', m)
        if any('💥' in x for x in banners):
            print('FAILED CAST - my row now:')
            row = p1.locator('div.rounded-xl.border', has_text='👑').first.inner_text()
            print(' ', row[:70].replace('\n',' | '))
            red_in_row = p1.locator('div.rounded-xl.border', has_text='👑').first.locator('.text-red-500').count()
            print('  red hearts in my row:', red_in_row)
            break
    b.close()
