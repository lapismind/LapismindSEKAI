# Task C4 Report

## Status

Task C4 is implemented without adding a reports endpoint or recent-reports UI. The Blog profile now presents the C1 achievement catalog and C3 career aggregate directly from Auth through lobby-kit.

## Delivered Contract

- `lobby-kit.getAchievements()` validates the achievement array and then transparently returns the complete Auth response, including `career`, `legacyUnlockedCount`, and existing compatibility fields.
- `buildAchievementSections()` is a pure presentation function. It separates active legendary achievements, unlocked legacy memorials, and API-masked hidden achievements without running checkers or calculating progress.
- `buildCareerRows()` is a pure presentation function. It maps every C3 career field to explicit Chinese labels and canonical spell names without changing the input aggregate.
- The legendary section displays all ten active entries, including locked entries.
- The legacy memorial displays only returned entries whose API unlock state is true.
- Hidden entries render only the masked or revealed values supplied by Auth; the Blog does not infer hidden metadata.
- Achievement stars are labeled `难度`; the profile never calls them `稀有度`.
- The profile does not consume or expose story tier letters.
- Guest copy now states that current-game stories remain visible while recent reports require persistent login.
- The existing glass-card, OKLCH token, typography, responsive layout, keyboard focus, and semantic heading/list patterns are preserved.

## TDD Evidence

- lobby-kit RED failed because `legacyUnlockedCount` was `undefined`; GREEN passed after returning the validated response transparently.
- Blog pure-model RED failed with `ERR_MODULE_NOT_FOUND`; GREEN passed after adding the requested functions.
- Browser RED reached `/profile/` through deterministic route interception and failed because the `传奇成就` section did not exist.
- Browser GREEN passed for both GitHub and guest identities at a 375x812 viewport. It verifies ten active rows, locked state, career labels, legacy-only unlocked display, hidden masking, guest copy, focusability, no horizontal overflow, and no standalone S/A/B/C story tier leak.

## Verification

```text
lobby-kit npm test: passed (7 test files)
blog npm test: passed
blog npm run check: 0 errors, 0 warnings, 2 existing missing-declaration hints
blog npm run lint: passed
blog npm run build: passed (14 pages)
Playwright profile login/guest: passed
git diff --check for C4 paths: passed (line-ending warning only)
```

## Concerns

- `@lapismind/lobby-kit` still has no TypeScript declaration file. Astro reports this as the same non-blocking hint on both login and profile imports.
- The browser test uses intercepted Auth routes by design, so it proves deterministic Blog rendering and privacy behavior rather than production Auth availability.
- Recent reports remain intentionally out of scope; only the guest explanation copy mentions their persistent-login requirement.

## Reviewer Fixes

Commit after the initial C4 delivery addresses all Medium findings and related Low test/semantic gaps:

- Career wording now matches the approved domain: `法师档案`, `完成比赛数`, `冠军数`, `轮胜数`, `成功施法总数`, `击杀数`, `巨龙击杀数`, `死亡次数`, `自爆次数`, `使用过的魔法系别`, `单次行动最长连续成功施法`, `最常用魔法`, both round-win reason counts, and `八系魔法成功次数`.
- Identity, avatar, actions, and guest copy become visible immediately after `/api/me` succeeds. Achievement loading no longer blocks the profile shell.
- The achievement area owns explicit loading, error/retry, empty, and content states. A caller-supplied `AbortSignal` is forwarded by lobby-kit, and the profile aborts achievement loading after two seconds.
- Browser fixtures now use the exact ten C1 active definitions, the real unlocked `first_cast` legacy projection, both locked and revealed hidden projections, the exact empty C3 career, and the exact C3 smaller-spell-ID favorite tie result.
- Browser coverage exercises success, empty, delayed, one-error-then-retry, HTTP error, malformed payload, and hanging request behavior while proving profile isolation.
- Achievement groups now use `ul`/`li`. Each disclosure button has a unique `aria-controls` panel, keyboard activation updates `aria-expanded`, and computed focus visibility is asserted.
- Tier privacy scans visible and hidden DOM text plus `aria-*`, `title`, `alt`, and `value` attributes against adversarial S/A/B/C payload fields and error bodies.
- The 375px viewport has no horizontal overflow, and disclosure/profile/retry actions meet the 44px target floor.

### Reviewer Verification

```text
lobby-kit npm test: passed (7 test files)
blog npm test: passed
blog npm run check: 0 errors, 0 warnings, 2 existing missing-declaration hints
blog npm run lint: passed
blog npm run build: passed (14 pages)
Playwright: 7/7 scenarios passed
git diff --check for reviewer-fix paths: passed
```

### Remaining Concerns

- `@lapismind/lobby-kit` still has no TypeScript declaration file; the two existing Astro hints remain non-blocking.
- The two-second achievement timeout is intentionally page-local policy. Other lobby-kit consumers receive optional signal support but no forced timeout.
- No D reports endpoint or reports UI was added.

## Reviewer Race And Tier Fixes

The follow-up review identified that aborting a request alone did not prevent a stale mock or transport that ignores `AbortSignal` from mutating the page. It also identified that the earlier whitespace-token tier assertion did not detect punctuation- or CJK-adjacent tier letters.

- `profile.astro` now keeps page-level `currentAchievementsController` and a monotonically increasing `requestGeneration`.
- Every new achievement load aborts the previous controller and claims a new generation.
- All asynchronous success, catch, and finally UI mutations require the request to still own the current generation. A superseded abort therefore cannot expose an error or hide a newer loading state.
- `astro:before-swap` and `pagehide` invalidate the generation and abort the current request before page teardown.
- Playwright holds the first request unresolved while a second request succeeds, then makes the stale request resolve or reject despite ignoring its abort signal. In both cases the newer result remains intact.
- The tier scanner now uses non-Latin-letter boundaries, detecting examples such as `等级：S`, `（A）`, `评级/B，`, and `段位C。` while ignoring normal words such as `SEKAI`, `CSS`, `Astro`, and `GitHub`.
- Tier scans cover the Profile shell's visible and hidden rendered DOM plus `aria-*`, `title`, `alt`, and `value` attributes in success, loading, empty, error/retry, locked hidden, revealed hidden, and overlapping-request states. Script, style, template, music-player, and other page-external content are correctly excluded from the C4 privacy surface.
- Correction to the prior report wording: the previous check used whitespace tokenization and did not prove punctuation/CJK-adjacent tier detection. The new boundary-aware scanner is the evidence for that claim.

### Race And Tier Verification

```text
lobby-kit npm test: passed (7 test files)
blog npm test: passed
blog npm run check: 0 errors, 0 warnings, 2 existing missing-declaration hints
blog npm run lint: passed
blog npm run build: passed (14 pages)
Playwright: 10/10 scenarios passed, including stale resolve, stale reject, and teardown invalidation
No D reports endpoint or reports UI added
```
