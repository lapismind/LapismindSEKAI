# Task C4 Plan

## Goal

Implement the approved C4 profile presentation against the existing C1/C3 Auth contract without adding reports UI or recomputing achievements.

## Phases

- [complete] 1. Capture lobby-kit and pure Blog presentation contracts with failing tests.
- [complete] 2. Implement transparent lobby-kit response and pure presentation model.
- [complete] 3. Integrate profile sections, guest copy, responsive semantics, and privacy-safe rendering.
- [complete] 4. Add deterministic Playwright coverage for logged-in and guest states.
- [complete] 5. Run serial verification, review diff/lessons, write C4 report, and commit only C4 files.
- [complete] 6. Add reviewer RED tests for exact labels, canonical fixtures, request isolation, timeout, semantics, and tier privacy.
- [complete] 7. Implement lobby-kit signal support and independent profile achievement states.
- [complete] 8. Pass deterministic Playwright scenarios and accessibility/privacy assertions.
- [complete] 9. Run serial full verification, append the C4 report, and create a separate reviewer-fix commit.
- [complete] 10. Add RED coverage for overlapping achievement loads, stale resolve/reject, teardown invalidation, and boundary-aware tier scans.
- [complete] 11. Implement generation-gated achievement state mutations and teardown cleanup.
- [complete] 12. Run all serial gates and Playwright, correct report wording, and commit a new C4 fix.

## Scope Guard

- No D reports endpoint or recent-reports UI.
- No achievement checker, progress, star, or career recomputation in Blog/lobby-kit.
- Preserve unrelated dirty worktree changes.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| with_server could not detect Astro on 4321 | 1 | Inspect direct dev startup and use the actual stable server command before counting browser RED. |
| Career label test retained one old lookup string after rename | 1 | Updated the remaining lookup and logged the test-maintenance lesson. |
| Python unescaped JS newline broke tier-surface probe | 1 | Escaped the backslash for the embedded JavaScript string. |
| Synchronous route delay hid the loading intermediate state | 1 | Replaced handler sleep with browser-side delayed/hanging fetch promises that honor AbortSignal. |
| Tier scanner included inline script source | 1 | Clone DOM and exclude script/style/template while retaining visible and hidden rendered nodes. |
