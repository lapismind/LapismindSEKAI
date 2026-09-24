"""Capture the current /about/ character card for visual review.

Usage: python docs/agent/scripts/playwright-oshi-flat-review.py [base URL]
The default base URL is http://127.0.0.1:8765.
"""

from pathlib import Path
import argparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "docs" / "agent" / "scripts" / "out" / "oshi-flat-2026-09-24"


def capture(page, theme: str, width: int) -> None:
    page.set_viewport_size({"width": width, "height": 900})
    page.evaluate("theme => document.documentElement.dataset.theme = theme", theme)
    card = page.locator(".oshi-card")
    card.scroll_into_view_if_needed()
    page.wait_for_function(
        """() => [...document.querySelectorAll('.oshi-shot-day, .oshi-shot-night')]
          .filter(image => getComputedStyle(image).display !== 'none')
          .every(image => image.complete && image.naturalWidth > 0)"""
    )
    page.wait_for_timeout(700)
    result = page.evaluate(
        """() => {
          const card = document.querySelector('.oshi-card');
          const bounds = card.getBoundingClientRect();
          const rect = selector => {
            const el = document.querySelector(selector);
            const r = el.getBoundingClientRect();
            return [r.left - bounds.left, r.top - bounds.top, r.width, r.height]
              .map(x => Math.round(x));
          };
          return {
            theme: document.documentElement.dataset.theme,
            card: [Math.round(bounds.width), Math.round(bounds.height)],
            facts: rect('.oshi-facts'),
            factsOpacity: getComputedStyle(document.querySelector('.oshi-facts')).opacity,
            inner: rect('.oshi-inner'),
            innerOpacity: getComputedStyle(document.querySelector('.oshi-inner')).opacity,
            waterline: rect('.oshi-waterline'),
          };
        }"""
    )
    target = OUT / f"{theme}-{width}.png"
    card.screenshot(path=str(target))
    print(target, result)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url", nargs="?", default="http://127.0.0.1:8765")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1200, "height": 900}, device_scale_factor=1)
        page = context.new_page()
        page.goto(f"{args.base_url.rstrip('/')}/about/", wait_until="domcontentloaded")
        for width in (1200, 390, 320):
            for theme in ("light", "dark"):
                capture(page, theme, width)
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
