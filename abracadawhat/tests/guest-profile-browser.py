import os

from playwright.sync_api import sync_playwright

base_url = os.environ.get("BASE_URL", "http://127.0.0.1:5174")

def handle_auth(route):
    if route.request.url.endswith("/api/me"):
        route.fulfill(status=401, json={})
        return
    if route.request.url.endswith("/api/guest"):
        route.fulfill(
            status=200,
            json={
                "user": {
                    "provider": "guest",
                    "nickname": "游客",
                    "avatarId": "0",
                    "playerId": "p-browser-guest",
                }
            },
        )
        return
    route.continue_()


def assert_profile(page):
    assert page.get_by_placeholder("给自己取个名字").input_value() == "重返魔法师"
    selected_avatar = page.locator("button.lk-avatar.is-active img").get_attribute("alt")
    saved_avatar = page.evaluate("localStorage.getItem('guestAvatarId')")
    assert selected_avatar == "头像12", {
        "selected_avatar": selected_avatar,
        "saved_avatar": saved_avatar,
    }


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    context.route("http://localhost:8787/api/**", handle_auth)
    context.route("https://auth.qmzhj.top/api/**", handle_auth)
    page = context.new_page()
    page.goto(base_url + "/")
    page.wait_for_load_state("networkidle")

    page.get_by_placeholder("给自己取个名字").fill("重返魔法师")
    page.get_by_role("button", name="头像12").click()
    page.get_by_role("button", name="创建房间").click()
    page.wait_for_url("**/room/**")
    page.get_by_role("button", name="退出").click()
    page.wait_for_url(base_url + "/")
    assert_profile(page)

    page.close()
    returning_page = context.new_page()
    returning_page.goto(base_url + "/")
    returning_page.wait_for_load_state("networkidle")
    assert_profile(returning_page)
    browser.close()
