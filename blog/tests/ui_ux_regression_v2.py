import os
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BLOG_BASE_URL", "https://blog.qmzhj.top/")


def open_page(page, path="", ready="#main-content"):
    page.goto(urljoin(BASE_URL, path), wait_until="domcontentloaded")
    page.locator(ready).first.wait_for(state="attached")


def test_home(page):
    page.set_viewport_size({"width": 320, "height": 568})
    open_page(page)
    page.wait_for_timeout(500)

    assert page.evaluate("document.documentElement.scrollWidth") == 320
    assert page.locator('a[href="#main-content"]').count() == 1

    for selector in (".avatar-btn", ".theme-toggle", "#md-open-chip"):
        box = page.locator(selector).bounding_box()
        assert box is not None
        assert box["width"] >= 44 and box["height"] >= 44, (selector, box)


def test_article(page):
    page.set_viewport_size({"width": 375, "height": 812})
    open_page(page, "blog/personal-site-polish/", ".prose")
    page.wait_for_timeout(500)

    toc = page.locator(".toc").bounding_box()
    prose = page.locator(".prose").bounding_box()
    assert toc is not None and prose is not None
    assert toc["y"] < prose["y"], (toc, prose)

    page.keyboard.press("Tab")
    focused = page.evaluate("""
        () => {
          const style = getComputedStyle(document.activeElement);
          return {
            href: document.activeElement.getAttribute('href'),
            outlineWidth: parseFloat(style.outlineWidth),
          };
        }
    """)
    assert focused["href"] == "#main-content"
    assert focused["outlineWidth"] >= 2

    toc_toggle = page.locator(".toc-mobile-toggle").bounding_box()
    assert toc_toggle is not None
    assert toc_toggle["width"] >= 44 and toc_toggle["height"] >= 44, toc_toggle

    page.locator(".toc-nav a").first.wait_for(state="attached")
    page.locator(".toc-mobile-toggle").click()
    page.wait_for_function(
        "document.querySelector('.toc-nav')?.classList.contains('open')"
    )
    page.locator(".toc-nav a").first.wait_for(state="visible")
    for box in page.locator(".toc-nav a").evaluate_all(
        """els => els.map(el => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            width: rect.width,
            height: rect.height,
            display: style.display,
            minHeight: style.minHeight,
            tapMin: style.getPropertyValue('--tap-min'),
          };
        })"""
    ):
        assert box["width"] >= 44 and box["height"] >= 44, box

    page.locator(".toc-nav a").first.click()
    assert page.locator(".toc-nav").evaluate("el => !el.classList.contains('open')")
    assert page.locator(".toc-mobile-toggle").get_attribute("aria-expanded") == "false"
    assert page.locator(".toc-mobile-toggle").evaluate(
        "el => el === document.activeElement"
    )


def test_music_controls_have_touch_targets(page):
    page.set_viewport_size({"width": 375, "height": 812})
    open_page(page)
    page.locator("#md-toggle").click()
    page.locator("#md-panel").wait_for(state="visible")
    page.wait_for_function(
        "getComputedStyle(document.querySelector('#md-panel')).transform === 'none'"
    )
    for selector in ("#md-lyricbtn", "#md-play"):
        box = page.locator(selector).bounding_box()
        assert box is not None
        assert box["width"] >= 44 and box["height"] >= 44, (selector, box)


def test_blog_cover_alt(page):
    page.set_viewport_size({"width": 375, "height": 812})
    open_page(page, "blog/", ".featured-media img")
    alts = page.locator(".featured-media img, .post-card .media img").evaluate_all(
        "els => els.map(el => el.getAttribute('alt'))"
    )
    assert alts
    assert all(alt and alt.strip() for alt in alts), alts


def test_skip_link_targets_exist_on_all_pages(page):
    paths = [
        "",
        "about/",
        "blog/",
        "blog/personal-site-polish/",
        "login/",
        "profile/",
        "projects/",
        "projects/abracadawhat/",
        "projects/showhand/",
        "projects/turtle-soup/",
        "404.html",
    ]
    for path in paths:
        open_page(page, path)
        assert page.locator("#main-content").count() == 1, path
        skip_link = page.locator('a.skip-link[href="#main-content"]')
        assert skip_link.count() == 1, path
        page.keyboard.press("Tab")
        assert skip_link.evaluate("el => el === document.activeElement"), (
            path,
            "skip link did not receive initial focus",
        )
        page.keyboard.press("Enter")
        assert page.locator("#main-content").evaluate(
            "el => el === document.activeElement"
        ), (path, "skip link activation did not focus main content")


def test_login_input_has_visible_keyboard_focus(page):
    open_page(page, "login/", "input")
    field = page.locator("input").first
    field.focus()
    outline = field.evaluate("""el => {
      const style = getComputedStyle(el);
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        color: style.outlineColor,
      };
    }""")
    assert outline["width"] >= 2 and outline["style"] != "none", outline


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        tests = [
            test_home,
            test_article,
            test_music_controls_have_touch_targets,
            test_blog_cover_alt,
            test_skip_link_targets_exist_on_all_pages,
            test_login_input_has_visible_keyboard_focus,
        ]
        failures = []

        for test in tests:
            try:
                test(page)
                print(f"PASS {test.__name__}")
            except Exception as error:
                failures.append((test.__name__, error))
                print(f"FAIL {test.__name__}: {error}")

        browser.close()

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
