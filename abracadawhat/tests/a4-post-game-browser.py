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

    dialog = page.get_by_role("dialog", name="房主法师 获胜！")
    expect(dialog).to_be_visible()
    close = page.get_by_role("button", name="关闭比赛结算详情")
    expect(close).to_be_focused()
    close_box = close.bounding_box()
    assert close_box and close_box["width"] >= 44 and close_box["height"] >= 44, close_box
    close.click()
    expect(close).to_have_count(0)

    actions = page.get_by_test_id("post-game-actions")
    expect(actions).to_be_visible()
    reopen = actions.get_by_role("button", name="查看结算详情")
    expect(reopen).to_be_focused()
    reopen_box = reopen.bounding_box()
    assert reopen_box and reopen_box["height"] >= 44, reopen_box

    reopen.click()
    expect(dialog).to_be_visible()
    expect(close).to_be_focused()
    dialog_actions = dialog.get_by_test_id("game-over-dialog-actions")
    dialog_rematch = dialog_actions.get_by_role("button", name="结算详情内再来一局")
    dialog_return = dialog_actions.get_by_role("button", name="结算详情内返回大厅")
    page.keyboard.press("Tab")
    expect(dialog_rematch).to_be_focused()
    page.keyboard.press("Tab")
    expect(dialog_return).to_be_focused()
    page.keyboard.press("Tab")
    expect(close).to_be_focused()
    page.keyboard.press("Shift+Tab")
    expect(dialog_return).to_be_focused()
    for button in (dialog_rematch, dialog_return):
        box = button.bounding_box()
        assert box and box["height"] >= 44, box
    page.keyboard.press("Escape")
    expect(dialog).to_have_count(0)
    expect(reopen).to_be_focused()

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

    sent_before_leave = page.evaluate("window.__a4Sent.length")
    actions.get_by_role("button", name="返回大厅").click()
    expect(page.get_by_role("heading", name="A4 测试大厅")).to_be_visible()
    expect(page.get_by_test_id("post-game-actions")).to_have_count(0)
    page.evaluate("window.__a4EmitLateRoomA()")
    expect(page.get_by_test_id("post-game-actions")).to_have_count(0)
    assert page.evaluate("window.__a4Sent.length") == sent_before_leave

    page.get_by_role("button", name="进入房间 B").click()
    expect(page).to_have_url(f"{base_url}/tests/fixtures/a4-harness.html#/room/ROOMB")
    expect(page.get_by_text("等待玩家加入（0/5）")).to_be_visible()
    expect(page.get_by_test_id("post-game-actions")).to_have_count(0)
    expect(page.get_by_role("button", name="再来一局")).to_have_count(0)
    assert page.evaluate("window.__a4Sent.length") == sent_before_leave
    page.evaluate("window.__a4EmitRoomB()")
    expect(page.get_by_text("等待玩家加入（1/5）")).to_be_visible()
    expect(page.get_by_text("房间 B 法师")).to_be_visible()
    expect(page.get_by_text("房主法师 获胜！")).to_have_count(0)
    expect(page.get_by_test_id("post-game-actions")).to_have_count(0)

    page.go_back()
    expect(page.get_by_role("heading", name="A4 测试大厅")).to_be_visible()
    page.evaluate("window.__a4ResolveIdentity()")
    page.wait_for_timeout(50)
    assert page.evaluate("window.__a4Connections") == []
    assert page.evaluate("window.__a4Sent.length") == sent_before_leave
    page.evaluate("window.__a4EmitLateRoomA()")
    expect(page.get_by_test_id("post-game-actions")).to_have_count(0)
    expect(page.get_by_text("房主法师 获胜！")).to_have_count(0)

    assert page_errors == [], page_errors
    browser.close()
