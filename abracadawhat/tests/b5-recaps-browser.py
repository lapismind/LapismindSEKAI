import os
import re

from playwright.sync_api import expect, sync_playwright


base_url = os.environ.get("BASE_URL", "http://127.0.0.1:5174")
tier_pattern = re.compile(r"(?<![A-Za-zＡ-Ｚａ-ｚ])[SABCＳＡＢＣ](?![A-Za-zＡ-Ｚａ-ｚ])")


def exposed_strings(page):
    return page.locator("body *").evaluate_all(
        """elements => elements.flatMap(element => {
          const values = []
          if (element.children.length === 0 && element.innerText?.trim()) values.push(element.innerText.trim())
          for (const name of ['aria-label', 'aria-labelledby', 'aria-describedby', 'title', 'alt']) {
            const value = element.getAttribute(name)
            if (value) values.push(value)
          }
          return values
        })"""
    )


def assert_no_tiers(page):
    leaks = [value for value in exposed_strings(page) if tier_pattern.search(value)]
    assert leaks == [], leaks


def assert_no_horizontal_overflow(page):
    dimensions = page.evaluate(
        "({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })"
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"], dimensions


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for viewport in ({"width": 1280, "height": 900}, {"width": 390, "height": 844}):
        page = browser.new_page(viewport=viewport)
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(error))
        page.goto(f"{base_url}/tests/fixtures/b5-harness.html")
        page.wait_for_load_state("networkidle")

        recap = page.get_by_test_id("round-recap")
        expect(recap).to_contain_text("青羽")
        expect(recap).to_contain_text("决定性魔法：火球")
        expect(recap).to_contain_text("击杀结束")
        expect(recap).to_contain_text("轮胜分")
        expect(recap).to_contain_text("幸存分")
        expect(recap).to_contain_text("秘密牌分")
        expect(recap).to_contain_text("你手里原来有")
        expect(recap).to_contain_text("猫头鹰 × 2")
        expect(recap).to_contain_text("青羽 7 分，还差 1 分")
        next_round = recap.get_by_role("button", name="开启下一轮")
        next_box = next_round.bounding_box()
        assert next_box and next_box["height"] >= 44, next_box

        page.evaluate("window.__b5SetRound('all_spells')")
        expect(recap).to_contain_text("决定性魔法：魔法药水")
        expect(recap).to_contain_text("清空手牌结束")
        page.evaluate("window.__b5SetRound('self_destruct')")
        expect(recap).to_contain_text("本轮无人获胜")
        expect(recap).to_contain_text("决定性魔法：古代巨龙")
        expect(recap).to_contain_text("施法失败自爆结束")
        assert_no_tiers(page)
        assert_no_horizontal_overflow(page)

        page.evaluate("window.__b5SetMatch()")
        dialog = page.get_by_role("dialog", name="青羽 获胜！")
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text("轮胜 2")
        expect(dialog).to_contain_text("击杀 3")
        expect(dialog).to_contain_text("最长连放 4")
        story_section = dialog.get_by_role("region", name="本局故事")
        stories = story_section.locator("article")
        expect(stories).to_have_count(3)
        assert stories.locator("div").all_inner_texts() == ["★★★★", "★★★", "★★"]
        highlighted = dialog.locator(".border-amber-400")
        expect(highlighted).to_have_count(2)
        expect(highlighted.nth(0)).to_contain_text("第一项")
        expect(highlighted.nth(1)).to_contain_text("第二项")
        collapsed = dialog.locator("details").filter(has_text="其余 1 个成就")
        expect(collapsed).to_be_visible()
        expect(collapsed).not_to_have_attribute("open", "")
        expect(collapsed.locator("div.space-y-2")).not_to_be_visible()
        expect(dialog).to_contain_text("战报暂未保存，不影响继续游戏")
        expect(dialog.get_by_text("查看完整统计", exact=True)).to_be_visible()

        close = page.get_by_role("button", name="关闭比赛结算详情")
        expect(close).to_be_focused()
        page.keyboard.press("Shift+Tab")
        assert dialog.evaluate("element => element.contains(document.activeElement)")
        page.keyboard.press("Escape")
        actions = page.get_by_test_id("post-game-actions")
        expect(actions.get_by_role("button", name="再来一局")).to_be_visible()
        expect(actions.get_by_role("button", name="返回大厅")).to_be_visible()
        expect(actions.get_by_role("button", name="查看结算详情")).to_be_focused()
        assert_no_tiers(page)
        assert_no_horizontal_overflow(page)

        page.evaluate("window.__b5SetLegacy()")
        legacy_dialog = page.get_by_role("dialog", name="青羽 获胜！")
        expect(legacy_dialog).to_be_visible()
        expect(legacy_dialog.get_by_role("region", name="本局故事")).to_have_count(0)
        expect(legacy_dialog).not_to_contain_text("undefined")
        assert_no_tiers(page)
        assert_no_horizontal_overflow(page)
        assert page_errors == [], page_errors
        page.close()

    browser.close()
