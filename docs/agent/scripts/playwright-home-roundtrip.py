"""复现：首页 -> 游戏 -> 首页（ClientRouter 切页）是否黑屏。
用法：python playwright-home-roundtrip.py [base_url] [--skip-intro]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = next((a for a in sys.argv[1:] if a.startswith("http")), "http://127.0.0.1:4321")
SKIP = "--skip-intro" in sys.argv
OUT = Path(__file__).resolve().parent / "out" / "roundtrip"
OUT.mkdir(parents=True, exist_ok=True)

PROBE = """() => {
  const pick = (el) => el && ({cls: el.className, op: getComputedStyle(el).opacity,
    disp: getComputedStyle(el).display, z: getComputedStyle(el).zIndex,
    rect: el.getBoundingClientRect().toJSON()});
  const top = document.elementFromPoint(innerWidth/2, innerHeight/2);
  return {
    url: location.pathname,
    intro: [...document.querySelectorAll('#intro, .intro')].map(pick),
    heroPhoto: pick(document.querySelector('.hero-photo')),
    heroCopy: pick(document.querySelector('.hero-copy')),
    center: top && (top.id + ' ' + top.className),
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    if SKIP:
        pg.add_init_script("sessionStorage.setItem('lapismind-intro','1')")
    pg.goto(BASE + "/", wait_until="load")
    pg.wait_for_timeout(7500 if not SKIP else 1500)
    print("home#1", pg.evaluate(PROBE))
    pg.click("header .internal-links a[href='/projects']")
    pg.wait_for_timeout(2000)
    print("games ", pg.evaluate(PROBE))
    pg.click("header .internal-links a[href='/']")
    for t in (300, 1500, 4000):
        pg.wait_for_timeout(t)
        print(f"home#2 +{t}", pg.evaluate(PROBE))
    pg.screenshot(path=str(OUT / f"home-return{'-skip' if SKIP else ''}.png"))
    b.close()
