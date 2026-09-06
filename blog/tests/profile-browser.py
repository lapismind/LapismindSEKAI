import os
import json

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("BLOG_BASE_URL", "http://127.0.0.1:3000")

ACTIVE = [
    {"key": "magic_staircase", "game": "abracadawhat", "name": "魔法阶梯", "desc": "同一次行动连续成功施放至少 3 种不同魔法", "difficulty": 1, "stars": 1, "status": "active"},
    {"key": "one_breath", "game": "abracadawhat", "name": "一气呵成", "desc": "同一次行动连续成功至少 4 次，并以清空手牌结束该轮", "difficulty": 3, "stars": 3, "status": "active"},
    {"key": "eight_facets", "game": "abracadawhat", "name": "八面玲珑", "desc": "一场完整比赛成功使用全部 8 种魔法", "difficulty": 2, "stars": 2, "status": "active"},
    {"key": "last_breath", "game": "abracadawhat", "name": "一线生机", "desc": "只剩 1 点生命时赢下一轮", "difficulty": 3, "stars": 3, "status": "active"},
    {"key": "weak_over_strong", "game": "abracadawhat", "name": "以弱胜强", "desc": "自己 1 血时，击杀受击前至少 3 血的玩家", "difficulty": 3, "stars": 3, "status": "active"},
    {"key": "pincer_finish", "game": "abracadawhat", "name": "夹击收网", "desc": "一次非巨龙法术同时击杀两名玩家", "difficulty": 3, "stars": 3, "status": "active"},
    {"key": "dragon_sweep", "game": "abracadawhat", "name": "龙息清场", "desc": "一次古代巨龙成功击杀至少 3 名玩家", "difficulty": 4, "stars": 4, "status": "active"},
    {"key": "refuse_ending", "game": "abracadawhat", "name": "拒绝结局", "desc": "曾在自己不超过 3 分、对手至少 7 分时落后，最终夺冠", "difficulty": 4, "stars": 4, "status": "active"},
    {"key": "secret_investor", "game": "abracadawhat", "name": "秘密投资人", "desc": "任意玩家持有至少 3 张秘密牌并活到轮末", "difficulty": 2, "stars": 2, "status": "active"},
    {"key": "different_paths", "game": "abracadawhat", "name": "殊途同归", "desc": "同一场至少一次靠击杀赢轮、一次靠清空手牌赢轮", "difficulty": 2, "stars": 2, "status": "active"},
]

LEGACY = {
    "key": "first_cast", "game": "abracadawhat", "name": "初试啼声",
    "desc": "累计施法达到 1 次（完成首次成功施法即解锁）", "difficulty": 1,
    "stars": 1, "status": "legacy", "legacy": True, "unlocked": True,
    "unlockedAt": "2026-08-27 10:00:00",
}

HIDDEN_LOCKED = {"key": "test_hidden_locked", "status": "hidden", "unlocked": False, "name": "？？？", "desc": "？？？"}
HIDDEN_REVEALED = {
    "key": "test_hidden_revealed", "game": "abracadawhat", "name": "隐藏真名",
    "desc": "隐藏真描述", "difficulty": 4, "stars": 4, "status": "hidden",
    "unlocked": True, "unlockedAt": "2026-08-27 10:15:00",
}

CAREER_TIE = {
    "matchesCompleted": 3, "championships": 1, "roundWins": 3, "totalCasts": 12,
    "spellCounts": {"1": 4, "2": 4, "3": 4}, "kills": 7, "dragonKills": 3,
    "deaths": 4, "suicides": 1, "favoriteSpellId": 1, "spellTypesUsed": 3,
    "maxTurnCastCount": 4, "roundWinsByReason": {"kill": 2, "all_spells": 1},
}

CAREER_EMPTY = {
    "matchesCompleted": 0, "championships": 0, "roundWins": 0, "totalCasts": 0,
    "spellCounts": {}, "kills": 0, "dragonKills": 0, "deaths": 0, "suicides": 0,
    "favoriteSpellId": None, "spellTypesUsed": 0, "maxTurnCastCount": 0,
    "roundWinsByReason": {"kill": 0, "all_spells": 0},
}


def payload(career=CAREER_TIE):
    active = [{**item, "unlocked": index < 3, "unlockedAt": "2026-09-07 12:00:00" if index < 3 else None} for index, item in enumerate(ACTIVE)]
    return {
        "achievements": [*active, LEGACY, HIDDEN_LOCKED, HIDDEN_REVEALED],
        "career": career,
        "unlockedCount": 3,
        "total": 10,
        "legacyUnlockedCount": 1,
        "storyTier": "S",
        "internal": {"tier": "A", "rank": "B", "grade": "C"},
    }


def install_routes(context, provider="github", mode="success", career=CAREER_TIE):
    user = {
        "provider": provider,
        "nickname": "lapismind" if provider != "guest" else "游客",
        "displayName": "Lapismind" if provider != "guest" else None,
        "avatarUrl": None,
        "avatarId": "0",
        "playerId": "pProfileC4",
        "githubId": "123" if provider == "github" else None,
    }

    if mode == "empty":
        achievement_body = {"achievements": [], "career": career, "unlockedCount": 0, "total": 0, "legacyUnlockedCount": 0}
    elif mode == "malformed":
        achievement_body = {"achievements": None, "career": {"tier": "S"}}
    else:
        achievement_body = payload(career)
    context.add_init_script(script=f"""
      (() => {{
        const nativeFetch = window.fetch.bind(window);
        const mode = {json.dumps(mode)};
        const body = {json.dumps(achievement_body, ensure_ascii=False)};
        let achievementCalls = 0;
        window.fetch = (input, options = {{}}) => {{
          const url = String(input);
          if (!url.endsWith('/api/achievements')) return nativeFetch(input, options);
          achievementCalls += 1;
          const response = () => new Response(JSON.stringify(body), {{
            status: mode === 'http_error' || (mode === 'error_once' && achievementCalls === 1) ? 503 : 200,
            headers: {{'content-type': 'application/json'}},
          }});
          if (mode !== 'delayed' && mode !== 'hanging') return Promise.resolve(response());
          return new Promise((resolve, reject) => {{
            const timer = mode === 'delayed' ? setTimeout(() => resolve(response()), 700) : null;
            options.signal?.addEventListener('abort', () => {{
              if (timer) clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            }}, {{once: true}});
          }});
        }};
      }})();
    """)

    def handle(route):
        url = route.request.url
        if url.endswith("/api/me"):
            route.fulfill(status=200, content_type="application/json", json={"user": user})
            return
        route.continue_()

    context.route("**/api/**", handle)


def open_profile(browser, provider="github", mode="success", career=CAREER_TIE):
    context = browser.new_context(viewport={"width": 375, "height": 812})
    install_routes(context, provider, mode, career)
    page = context.new_page()
    page.goto(f"{BASE_URL}/profile/", wait_until="domcontentloaded")
    return context, page


def assert_identity_isolated(browser, mode):
    context, page = open_profile(browser, provider="guest", mode=mode)
    page.locator("#profile-content").wait_for(state="visible", timeout=1000)
    assert page.get_by_text("游客 · 未登录", exact=True).is_visible()
    assert page.locator("#pf-avatar").is_visible()
    assert page.locator("#pf-register-entry").is_visible()
    assert page.locator(".hint").is_visible()
    assert page.locator("#ach-section").is_visible()
    if mode in ("http_error", "malformed", "hanging"):
        page.locator("#ach-error").wait_for(state="visible", timeout=3500)
        assert page.locator("#ach-retry").is_visible()
        retry_box = page.locator("#ach-retry").bounding_box()
        assert retry_box and retry_box["width"] >= 44 and retry_box["height"] >= 44, retry_box
    entry_box = page.locator("#pf-register-entry").bounding_box()
    assert entry_box and entry_box["width"] >= 44 and entry_box["height"] >= 44, entry_box
    context.close()


def assert_success(browser):
    context, page = open_profile(browser)
    page.locator("#ach-content").wait_for(state="visible")
    assert page.get_by_role("heading", name="法师档案").count() == 1
    assert page.get_by_text("自爆次数", exact=True).count() == 1
    assert page.get_by_text("单次行动最长连续成功施法", exact=True).count() == 1
    assert page.get_by_text("古代巨龙", exact=True).count() >= 1

    active = page.locator('[data-achievement-section="active"]')
    assert active.get_by_role("list").count() == 1
    assert active.get_by_role("listitem").count() == 10
    assert active.locator(".ach-row.locked").count() == 7
    assert page.get_by_text("初试啼声", exact=True).count() == 1
    assert page.get_by_text("隐藏真名", exact=True).count() == 1
    locked_hidden = page.locator('[data-achievement-key="test_hidden_locked"]')
    assert locked_hidden.get_by_text("？？？", exact=True).count() == 2
    assert locked_hidden.get_by_text("test_hidden_locked", exact=False).count() == 0

    toggles = page.locator(".ach-section-toggle")
    for index in range(toggles.count()):
        toggle = toggles.nth(index)
        panel_id = toggle.get_attribute("aria-controls")
        assert panel_id and page.locator(f"#{panel_id}").count() == 1
        box = toggle.bounding_box()
        assert box and box["height"] >= 44

    first = toggles.first
    page.locator("#ach-title").evaluate("el => { el.tabIndex = 0; el.focus(); }")
    page.keyboard.press("Tab")
    focus = first.evaluate("""el => {
      const style = getComputedStyle(el);
      return {active: el === document.activeElement, width: parseFloat(style.outlineWidth), style: style.outlineStyle};
    }""")
    assert focus["active"] and focus["width"] >= 2 and focus["style"] != "none", focus
    page.keyboard.press("Enter")
    assert first.get_attribute("aria-expanded") == "false"
    page.keyboard.press("Enter")
    assert first.get_attribute("aria-expanded") == "true"
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement !== document.body")

    leak_surface = page.locator("body").evaluate("""root => {
      const attrs = ['aria-label', 'aria-labelledby', 'aria-describedby', 'title', 'alt', 'value'];
      const values = [root.innerText, root.textContent];
      for (const node of root.querySelectorAll('*')) for (const attr of attrs) {
        if (node.hasAttribute(attr)) values.push(node.getAttribute(attr));
      }
      return values.filter(Boolean).join('\\n');
    }""")
    for tier in ("S", "A", "B", "C"):
        assert tier not in leak_surface.split(), f"story tier leaked through DOM or attributes: {tier}"
    assert page.evaluate("document.documentElement.scrollWidth") == 375
    context.close()


def assert_retry(browser):
    context, page = open_profile(browser, provider="guest", mode="error_once")
    page.locator("#ach-error").wait_for(state="visible")
    page.locator("#ach-retry").click()
    page.locator("#ach-content").wait_for(state="visible")
    assert page.get_by_text("魔法阶梯", exact=True).count() == 1
    assert not page.locator("#ach-error").is_visible()
    context.close()


def assert_empty(browser):
    context, page = open_profile(browser, mode="empty", career=CAREER_EMPTY)
    page.locator("#ach-empty").wait_for(state="visible")
    assert page.get_by_role("heading", name="法师档案").count() == 1
    assert page.get_by_text("暂无", exact=True).count() >= 2
    context.close()


def assert_delayed(browser):
    context, page = open_profile(browser, provider="guest", mode="delayed")
    page.locator("#profile-content").wait_for(state="visible", timeout=1000)
    assert page.locator("#ach-loading").is_visible()
    page.locator("#ach-content").wait_for(state="visible", timeout=2500)
    context.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        assert_success(browser)
        print("PASS canonical success and semantics")
        assert_empty(browser)
        print("PASS empty career and achievements")
        assert_delayed(browser)
        print("PASS delayed achievements isolation")
        assert_retry(browser)
        print("PASS achievements retry recovery")
        for failure_mode in ("http_error", "malformed", "hanging"):
            assert_identity_isolated(browser, failure_mode)
            print(f"PASS {failure_mode} isolation")
        browser.close()
