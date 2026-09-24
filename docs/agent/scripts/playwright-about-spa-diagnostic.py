"""Read-only browser diagnostic for theme, aquarium, and footer after Astro navigation.

Usage: python docs/agent/scripts/playwright-about-spa-diagnostic.py [base-url]
"""

import json
import sys

from playwright.sync_api import sync_playwright


base_url = (sys.argv[1] if len(sys.argv) > 1 else "https://blog.qmzhj.top").rstrip("/")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900}, color_scheme="light")
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.add_init_script(
        'document.addEventListener("astro:page-load", () => {'
        ' window.__aboutSpaPageLoads = (window.__aboutSpaPageLoads || 0) + 1; });'
    )

    def snapshot(step: str) -> dict:
        return {
            "step": step,
            "url": page.url,
            "theme": page.locator("html").get_attribute("data-theme"),
            "saved_theme": page.evaluate('localStorage.getItem("theme")'),
            "runtime": page.locator("#site-runtime").inner_text(),
        }

    page.goto(f"{base_url}/about/", wait_until="domcontentloaded")
    page.wait_for_function("window.__aboutSpaPageLoads >= 1")
    events = [snapshot("initial")]

    page.locator(".theme-toggle").click()
    events.append(snapshot("dark-enabled"))
    card = page.locator(".oshi-card")
    card.scroll_into_view_if_needed()
    card.click(position={"x": 280, "y": 450})
    events[-1]["bubbles"] = page.locator(".oshi-pop").count()

    page.locator('.internal-links a[href="/blog"]').click()
    page.wait_for_url("**/blog/")
    page.wait_for_function("window.__aboutSpaPageLoads >= 2")
    events.append(snapshot("blog"))

    page.locator('.internal-links a[href="/about"]').click()
    page.wait_for_url("**/about/")
    page.wait_for_function("window.__aboutSpaPageLoads >= 3")
    events.append(snapshot("back-about"))
    card = page.locator(".oshi-card")
    card.scroll_into_view_if_needed()
    card.click(position={"x": 280, "y": 450})
    events[-1]["bubbles"] = page.locator(".oshi-pop").count()

    print(json.dumps({"events": events, "page_errors": page_errors}, ensure_ascii=False, indent=2))
    browser.close()
