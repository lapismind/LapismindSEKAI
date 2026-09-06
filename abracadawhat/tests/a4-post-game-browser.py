import os

from playwright.sync_api import expect, sync_playwright


base_url = os.environ.get("BASE_URL", "http://127.0.0.1:5174")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(error))
    page.goto(f"{base_url}/tests/fixtures/a4-harness.html")
    page.wait_for_load_state("networkidle")

    target = page.get_by_test_id("target-score")
    expect(target).to_contain_text("先到 8 分")
    expect(target).to_contain_text("房主法师 还差 0 分")
    expect(target).to_contain_text("客人法师 还差 3 分")

    close = page.get_by_role("button", name="关闭比赛结算详情")
    close_box = close.bounding_box()
    assert close_box and close_box["width"] >= 44 and close_box["height"] >= 44, close_box
    close.click()
    expect(close).to_have_count(0)

    actions = page.get_by_test_id("post-game-actions")
    expect(actions).to_be_visible()
    rematch = actions.get_by_role("button", name="再来一局")
    return_lobby = actions.get_by_role("button", name="返回大厅")
    for button in (rematch, return_lobby):
        box = button.bounding_box()
        assert box and box["height"] >= 44, box

    rematch.click()
    assert page.evaluate("window.__a4Sent") == [
        {"type": page.evaluate("window.__a4RematchType"), "payload": {}},
    ]
    expect(actions).to_be_visible()

    page.evaluate("window.__a4SetHost(false)")
    expect(actions.get_by_role("button", name="再来一局")).to_have_count(0)
    expect(actions).to_contain_text("等待房主再来一局")
    expect(actions.get_by_role("button", name="返回大厅")).to_be_visible()
    expect(page.get_by_text("投票", exact=False)).to_have_count(0)

    assert page_errors == [], page_errors
    browser.close()
