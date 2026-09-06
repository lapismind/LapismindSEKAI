import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BLOG_BASE_URL", "http://127.0.0.1:4321")


ACTIVE = [
    {
        "key": f"active-{index}",
        "game": "abracadawhat",
        "name": f"传奇 {index}",
        "desc": f"挑战条件 {index}",
        "difficulty": (index - 1) % 4 + 1,
        "stars": (index - 1) % 4 + 1,
        "status": "active",
        "unlocked": index <= 3,
        "unlockedAt": "2026-09-07 12:00:00" if index <= 3 else None,
    }
    for index in range(1, 11)
]


def install_routes(context, provider):
    user = {
        "provider": provider,
        "nickname": "lapismind" if provider != "guest" else "游客",
        "displayName": "Lapismind" if provider != "guest" else None,
        "avatarUrl": None,
        "avatarId": "0",
        "playerId": "pProfileC4",
        "githubId": "123" if provider == "github" else None,
    }
    payload = {
        "achievements": [
            *ACTIVE,
            {
                "key": "legacy-kept",
                "game": "abracadawhat",
                "name": "旧日奖杯",
                "desc": "已经取得",
                "difficulty": 2,
                "stars": 2,
                "status": "legacy",
                "legacy": True,
                "unlocked": True,
                "unlockedAt": "2026-01-01 00:00:00",
            },
            {
                "key": "hidden-locked",
                "status": "hidden",
                "unlocked": False,
                "name": "？？？",
                "desc": "？？？",
            },
        ],
        "career": {
            "matchesCompleted": 12,
            "championships": 3,
            "roundWins": 18,
            "totalCasts": 96,
            "spellCounts": {"1": 2, "6": 20, "8": 7},
            "kills": 14,
            "dragonKills": 4,
            "deaths": 9,
            "suicides": 2,
            "favoriteSpellId": 6,
            "spellTypesUsed": 3,
            "maxTurnCastCount": 5,
            "roundWinsByReason": {"kill": 11, "all_spells": 7},
        },
        "unlockedCount": 3,
        "total": 10,
        "legacyUnlockedCount": 1,
    }

    def handle(route):
        path = route.request.url
        if path.endswith("/api/me"):
            route.fulfill(status=200, content_type="application/json", json={"user": user})
        elif path.endswith("/api/achievements"):
            route.fulfill(status=200, content_type="application/json", json=payload)
        else:
            route.continue_()

    context.route("**/api/**", handle)


def assert_profile(provider):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 812})
        install_routes(context, provider)
        page = context.new_page()
        page.goto(f"{BASE_URL}/profile/", wait_until="domcontentloaded")
        page.locator("#profile-content").wait_for(state="visible")

        assert page.get_by_role("heading", name="传奇成就").count() == 1
        assert page.locator('[data-achievement-section="active"] .ach-row').count() == 10
        assert page.locator('[data-achievement-section="active"] .ach-row.locked').count() == 7
        assert page.get_by_text("难度 ★★★★", exact=True).count() >= 2
        assert page.get_by_text("稀有度", exact=False).count() == 0

        assert page.get_by_role("heading", name="法师生涯").count() == 1
        assert page.get_by_text("最常用魔法", exact=True).count() == 1
        assert page.get_by_text("暴风雪", exact=True).count() == 1

        assert page.get_by_role("heading", name="旧日纪念").count() == 1
        assert page.get_by_text("旧日奖杯", exact=True).count() == 1
        assert page.get_by_text("不应出现", exact=False).count() == 0

        hidden = page.locator('[data-achievement-section="hidden"]')
        assert hidden.get_by_text("？？？", exact=True).count() == 2
        assert hidden.get_by_text("hidden-locked", exact=False).count() == 0
        assert hidden.get_by_text("秘密条件", exact=False).count() == 0

        body = page.locator("body").inner_text()
        for tier in ("S", "A", "B", "C"):
            assert tier not in body.split(), f"story tier leaked: {tier}"

        assert page.evaluate("document.documentElement.scrollWidth") == 375
        first_toggle = page.locator(".ach-section-toggle").first
        first_toggle.focus()
        assert first_toggle.evaluate("el => el === document.activeElement")

        hint = page.locator(".hint").inner_text()
        assert "当前这局的故事" in hint
        assert "最近战报需要持久登录" in hint
        if provider == "guest":
            assert page.locator("#pf-register-entry").is_visible()
        else:
            assert not page.locator("#pf-register-entry").is_visible()

        browser.close()


if __name__ == "__main__":
    assert_profile("github")
    print("PASS logged-in profile")
    assert_profile("guest")
    print("PASS guest profile")
