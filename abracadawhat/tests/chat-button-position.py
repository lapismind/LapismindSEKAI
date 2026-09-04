import os

from playwright.sync_api import sync_playwright

base_url = os.environ.get("BASE_URL", "http://127.0.0.1:5174")

def assert_button_position(page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{base_url}/room/UITEST")
    page.wait_for_load_state("networkidle")
    button = page.get_by_role("button", name="打开聊天室")
    button.wait_for(state="visible")
    box = button.bounding_box()
    assert box is not None
    assert abs((width - (box["x"] + box["width"])) - 16) <= 1, box
    assert abs((height - (box["y"] + box["height"])) - 80) <= 1, box


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    assert_button_position(page, 1280, 720)
    assert_button_position(page, 390, 844)
    browser.close()
