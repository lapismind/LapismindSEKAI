# Task C1 Progress

## 2026-09-07

- Loaded project/user guidance and required workflow skills.
- Read the approved design and Task C1 plan, current Auth catalog/evaluator/API, achievement tests, Worker tests, B1 isolation tests, git status/history, and lessons learned.
- Confirmed unrelated modified planning files and `.superpowers/` are pre-existing and will not be touched or committed.
- Focused RED: `node --test auth/tests/achievements.test.mjs auth/tests/worker.test.mjs` failed 8/8 top-level tests for the expected old catalog/API behavior.
- Corrected the hidden evaluator fixture before implementation: it now temporarily marks existing `last_breath` hidden instead of inventing a test key with no checker.
- First production patch accidentally used `await` inside synchronous `flatMap()`. Logged the error in `docs/lessons-learned.md` and removed C1 API target/progress generation rather than adding unnecessary async complexity.
- Focused GREEN: 8/8 top-level tests passed for `auth/tests/achievements.test.mjs` and `auth/tests/worker.test.mjs`.
- Full Auth GREEN: `npm test` passed 37/37, including the real isolated local D1 persistence suite.
- Syntax/diff verification: both production files passed `node --check`; `git diff --check` passed with only the existing CRLF normalization warning for `worker.test.mjs`.
- Scope review: no C2 checker logic, UI, migration, schema change, D1 deletion, or pending-match isolation regression.
- Committed only the four Task C1 files as `78fa221 feat(auth): define legendary achievement catalog`.
- Began reviewer-fix cycle. Verified separate projection paths cause postMatch to omit `stars`, and current count semantics can be inflated by legacy/unknown rows.
- Reviewer RED: Auth route test failed because `legacyUnlockedCount` was absent; Abracadawhat producer-consumer fixture already passed and proved the consumer preserves a canonical payload unchanged.
- Reviewer focused GREEN: 18/18 tests passed across `auth/tests/worker.test.mjs` and `abracadawhat/tests/worker-auth.test.mjs`.
- Added shared `projectAchievement()` for GET and v1 postMatch responses. Counts now derive only from known active definitions; known unlocked legacy has a separate count; hidden is documented as excluded from active counts.
- Added a shared Auth/Abracadawhat response fixture and pending-active route coverage; focused bridge tests remained GREEN at 18/18.
- Abracadawhat production build, emoji postbuild, and full suite passed 120/120 without game production changes.
- Added `C1-report.md` with the delivered contract, TDD evidence, verification, and remaining C2 boundary.
- Final fresh Auth suite passed 37/37; syntax and diff checks passed. Scope review confirmed only shared projection/count production code, tests/fixture, and the C1 report are intended for the reviewer-fix commit.
