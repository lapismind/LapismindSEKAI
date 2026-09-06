import os

from playwright.sync_api import expect, sync_playwright


base_url = os.environ.get("BASE_URL", "http://127.0.0.1:5174")


def controlled_region(page, button):
    region_id = button.get_attribute("aria-controls")
    assert region_id
    region = page.locator(f"#{region_id}")
    assert region.count() == 1
    return region


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(error))
    page.goto(f"{base_url}/tests/fixtures/a3-harness.html")
    page.wait_for_load_state("networkidle")
    page.locator("section[aria-label='SpellCard fixtures']").wait_for()

    owl = page.get_by_test_id("spell-one").get_by_role("button", name="猫头鹰效果说明")
    fireball = page.get_by_test_id("spell-two").get_by_role("button", name="火球效果说明")
    owl_region = controlled_region(page, owl)
    fireball_region = controlled_region(page, fireball)

    expect(owl).to_have_attribute("aria-expanded", "false")
    expect(owl_region).to_be_hidden()
    owl_box = owl.bounding_box()
    assert owl_box and owl_box["width"] >= 44 and owl_box["height"] >= 44, owl_box

    owl.click()
    expect(owl).to_have_attribute("aria-expanded", "true")
    expect(owl_region).to_be_visible()
    expect(owl_region).to_contain_text("获取一张秘密牌")

    fireball.focus()
    page.keyboard.press("Enter")
    expect(fireball).to_have_attribute("aria-expanded", "true")
    expect(fireball_region).to_be_visible()
    expect(owl).to_have_attribute("aria-expanded", "false")
    expect(owl_region).to_be_hidden()

    owl.click()
    expect(owl).to_have_attribute("aria-expanded", "true")
    expect(owl_region).to_be_visible()
    page.get_by_test_id("toggle-facedown").click()
    expect(page.get_by_test_id("spell-one").get_by_role("button")).to_have_count(0)
    expect(page.get_by_test_id("spell-one")).not_to_contain_text("获取一张秘密牌")
    assert page.get_by_test_id("spell-one").locator("[aria-expanded]").count() == 0

    page.get_by_test_id("toggle-facedown").click()
    owl = page.get_by_test_id("spell-one").get_by_role("button", name="猫头鹰效果说明")
    expect(owl).to_have_attribute("aria-expanded", "false")
    expect(controlled_region(page, owl)).to_be_hidden()
    owl.focus()
    page.keyboard.press("Space")
    expect(owl).to_have_attribute("aria-expanded", "true")

    public_owl = page.locator("section[aria-label='PublicArea fixture']").get_by_role(
        "button", name="猫头鹰效果说明"
    )
    public_box = public_owl.bounding_box()
    assert public_box and public_box["width"] >= 44 and public_box["height"] >= 44, public_box
    public_region = controlled_region(page, public_owl)
    expect(public_region).to_be_hidden()
    public_owl.click()
    expect(public_owl).to_have_attribute("aria-expanded", "true")
    expect(public_region).to_be_visible()

    page.get_by_test_id("owl-empty").click()
    feedback = page.locator(".fixed.inset-x-0.z-40")
    expect(feedback).to_be_visible()
    expect(feedback).not_to_contain_text("获得秘密牌")
    page.get_by_test_id("owl-drawn").click()
    expect(feedback).to_contain_text("获得秘密牌")

    assert page_errors == [], page_errors

    browser.close()
