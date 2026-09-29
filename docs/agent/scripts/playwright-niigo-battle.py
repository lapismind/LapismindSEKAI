"""niigo-party：战斗大窗口流程冒烟验证。

用法：
  py -3.14 docs/agent/scripts/playwright-niigo-battle.py [base_url]
前置：niigo-party 下 `npx vite --port 5199`。

走两场战斗（防御、躲避），每一步截图，检查：
  遭遇窗口只有受击插画 → 发起进攻后进攻插画入场、出现 VS → 战位层
  选牌互相可见、选定即消耗 → 攻骰出红圈（骰点）→ 守方选应对 → 防骰出蓝圈
  防御：掷牌后圈增长为 基础 + 骰 + 牌，伤害 = max(1, 红 − 蓝)
  躲避：圈只显示骰点
截图落 docs/agent/scripts/out/niigo-battle/
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5199"
OUT = Path(__file__).resolve().parent / "out" / "niigo-battle"
OUT.mkdir(parents=True, exist_ok=True)
errors, fails = [], []


def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond:
        fails.append(msg)


SETUP = """(mode) => { const g = window.__game, s = g.s;
  g.popups = []; s.battle = null; s.pending = null;
  const A = s.players[s.current], D = s.players.find((p) => p !== A);
  A.hp = A.maxHp; D.hp = D.maxHp; A.ko = D.ko = false; D.immune = false;
  A.tile = 0; A.prev = 35; D.tile = 2; A.choice = null;
  A.hand = ['atk1', 'atk2', 'def1']; D.hand = ['def1', 'def2', 'atk1'];
  s.phase = 'roll';
}"""


def ring(page, cls):
    loc = page.locator(f".stage .{cls}.ring-pop")
    return int(loc.first.inner_text()) if loc.count() else None


def run_battle(page, tag, mode):
    print(f"[{tag}]")
    page.evaluate(SETUP, mode)
    page.evaluate("() => { const r = Math.random; Math.random = () => 0.15; window.__game.roll(); Math.random = r; }")  # d10 → 2
    page.wait_for_function("window.__game.s.pending?.type === 'battleOffer'", timeout=8000)
    page.wait_for_timeout(350)
    check(page.get_by_role("button", name="⚔ 发起进攻").count() == 1, "遭遇窗口：发起进攻 / 放过")
    check(page.locator(".illu-atk.split").count() == 0, "遭遇时只有受击插画")
    page.screenshot(path=str(OUT / f"{tag}_1_offer.png"))

    page.get_by_role("button", name="⚔ 发起进攻").click()
    page.wait_for_timeout(700)
    check(page.locator(".illu-atk.split").count() == 1 and page.locator(".vs-badge").count() == 1, "进攻插画入场 + VS")
    page.screenshot(path=str(OUT / f"{tag}_2_intro.png"))
    page.wait_for_selector("text=双方同时选战斗牌", timeout=4000)

    # 选牌：攻方 atk1，守方 def1；互相可见
    page.locator("section").filter(has_text="进攻 ·").get_by_role("button", name="攻击·1费").click()
    page.locator("section").filter(has_text="防守 ·").get_by_role("button", name="防御·1费").click()
    hands = page.evaluate("() => { const s = window.__game.s; return s.players.map((p) => p.hand.join(',')); }")
    check(page.locator("section").filter(has_text="进攻 ·").get_by_text("攻击·1费（1~4）").count() == 1
          and page.locator("section").filter(has_text="防守 ·").get_by_text("防御·1费（1~4）").count() == 1, "双方已选牌互相可见")
    check("atk1" not in hands[page.evaluate("window.__game.s.current")], f"选定即从手牌扣除 {hands}")
    check(ring(page, "bg-red-500") is None, "选牌阶段不出现圈")
    page.screenshot(path=str(OUT / f"{tag}_3_select.png"))
    # 攻方还能再选（atk2 需 2 费，1+2=3）→ 点「就这些」；守方同理
    page.get_by_role("button", name="就这些").first.click()
    page.get_by_role("button", name="就这些").first.click()
    check(page.get_by_role("button", name="🎲 掷攻骰 D6").count() == 0, "没有手动掷骰按钮")

    page.wait_for_function("window.__game.s.battle?.atk.d6 != null", timeout=6000)  # 攻骰自动掷
    page.wait_for_timeout(450)
    dA = page.evaluate("window.__game.s.battle.atk.d6")
    check(ring(page, "bg-red-500") == dA, f"攻骰后红圈 = 骰点 {dA}")
    check(ring(page, "bg-sky-500") is None, "蓝圈尚未出现")
    page.screenshot(path=str(OUT / f"{tag}_4_atk_d6.png"))

    page.get_by_role("button", name="🛡 防御" if mode == "defend" else "💨 躲避").click()
    page.wait_for_function("window.__game.s.battle?.def.d6 != null", timeout=6000)  # 防骰自动掷
    page.wait_for_timeout(450)
    b = page.evaluate("window.__game.s.battle")
    check(ring(page, "bg-sky-500") == b["def"]["d6"], f"防骰后蓝圈 = 骰点 {b['def']['d6']}")
    page.screenshot(path=str(OUT / f"{tag}_5_def_d6.png"))

    page.wait_for_function("window.__game.s.battle?.phase === 'done'", timeout=8000)  # 掷牌 + 结算自动
    page.wait_for_timeout(500)
    b = page.evaluate("window.__game.s.battle")
    A, D = page.evaluate("""() => { const s = window.__game.s, b = s.battle;
        return [s.players.find(p => p.id === b.attackerId), s.players.find(p => p.id === b.defenderId)]; }""")
    red, blue = ring(page, "bg-red-500"), ring(page, "bg-sky-500")
    o = b["outcome"]
    if mode == "defend":
        exp_red = A["atk"] + b["atk"]["d6"] + sum(c["value"] for c in b["atk"]["cards"])
        exp_blue = D["def"] + b["def"]["d6"] + sum(c["value"] for c in b["def"]["cards"])
        check(red == exp_red and blue == exp_blue, f"防御：红圈 {red} = ATK+骰+牌 {exp_red}，蓝圈 {blue} = DEF+骰+牌 {exp_blue}")
        check(o["dmg"] == max(1, exp_red - exp_blue), f"伤害 {o['dmg']} = max(1, {exp_red}−{exp_blue})")
    else:
        check(blue == b["def"]["d6"], f"躲避：蓝圈只显示骰点 {blue}")
        if o["dodged"]:
            check(red == b["atk"]["d6"] and o["dmg"] == 0, f"躲开：红圈仍是骰点 {red}，无伤害")
        else:
            exp = A["atk"] + b["atk"]["d6"] + sum(c["value"] for c in b["atk"]["cards"])
            check(red == exp and o["dmg"] == exp, f"没躲开：吃满 ATK+骰+牌 = {exp}")
    page.screenshot(path=str(OUT / f"{tag}_6_done.png"))
    check(page.get_by_role("button", name="继续").count() == 0, "没有「继续」按钮")
    page.wait_for_function("!window.__game.s.battle", timeout=6000)  # 自动收尾回地图
    check(True, "战斗结束后自动回到地图")


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/")
    page.evaluate("localStorage.clear()")
    page.reload()
    cards = page.locator("button:has(img)")
    cards.nth(0).click()
    cards.nth(1).click()
    page.get_by_role("button", name="开始对局").click()
    page.wait_for_selector("svg image")

    run_battle(page, "defend", "defend")
    page.evaluate("() => { const g = window.__game; g.popups = []; if (g.s.pending?.type === 'shop') g.closeShop(); }")
    run_battle(page, "dodge", "dodge")
    browser.close()

print("[console]")
check(not errors, f"无 console error（{len(errors)}）" + ("：" + " | ".join(errors[:3]) if errors else ""))
print("FAIL" if fails else "PASS", f"— 截图在 {OUT}")
sys.exit(1 if fails else 0)
