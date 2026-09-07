# Task C4 Findings

- C1 response exposes active/legacy/hidden status, canonical difficulty, temporary stars alias, active total/unlockedCount, and legacyUnlockedCount.
- C3 adds the complete career object to GET /api/achievements.
- Current lobby-kit drops career and legacyUnlockedCount by rebuilding a partial response.
- Current Blog profile groups raw achievements, hides stars=0 for non-admin, calls stars a bare glyph, and recomputes progress bars from target/progress.
- C4 must replace that behavior with a pure presentation model and API-trusting sections.
- Blog uses Astro static output, site-wide glass/OKLCH tokens, and Python Playwright.
- Reviewer verification: `loadProfile()` currently awaits `loadAchievements()` before revealing `#profile-content`, so a slow/hanging achievement request hides identity, avatar, actions, and guest copy.
- Approved domain wording calls the section `法师档案` and describes counts as 完成比赛数、冠军数、轮胜数、成功施法总数、八系成功次数、击杀/巨龙击杀/死亡/自爆、最常用魔法、最长连续成功施法数、轮胜方式。
- Current disclosure panels lack `aria-controls`; achievement rows are generic divs rather than list semantics.
- lobby-kit currently validates only the top-level achievements array and does not accept a caller signal; C4 can add optional signal forwarding without changing response compatibility.
- Current `loadAchievements()` creates a local controller per call but does not retain/abort the previous controller and has no request generation. A superseded request that ignores AbortSignal can still run success, catch, and finally mutations after a newer request completes.
- Current tier assertion uses whitespace tokenization, so `等级：S` and `（A）` evade detection. The intended boundary is “not adjacent to ASCII/Latin letters,” which catches punctuation/CJK adjacency without flagging letters inside normal words such as SEKAI.
