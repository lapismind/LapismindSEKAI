# Task C4 Progress

## 2026-09-07

- Read root/blog instructions, profile UI, C1/C3 reports, lobby-kit auth client/tests, and lessons learned.
- Established C4 scope and began strict TDD at phase 1.
- RED: lobby-kit omitted compatibility/career fields; Blog presentation module was absent.
- GREEN: lobby-kit transparently returns the validated payload; pure achievement/career model tests pass.
- Browser harness attempt 1 did not reach application assertions because the helper could not detect Astro on port 4321; logged for diagnosis.
- Confirmed Astro's managed dev server was already on port 3000. Browser RED then reached the page and failed at the missing `传奇成就` heading as intended.
- Replaced raw achievement rendering with pure-model sections and added API-derived career rows.
- Deterministic Playwright passes for GitHub and guest identities at 375px, including hidden/legacy privacy, 10 active rows, focus, copy, and no standalone story tier letters.
- Serial gate passed: lobby-kit tests, Blog test/check/lint/build. Astro check reported only two existing missing-declaration hints.
- Wrote C4-report.md and completed the implementation plan.

## 2026-09-07 Reviewer Fixes

- Verified all requested Medium findings against committed C4 code and reopened the plan at phase 6.
- RED confirmed missing lobby-kit signal forwarding and incorrect career labels. Initial GREEN rerun found one stale old-label lookup in the test; corrected before continuing.
- Browser state/semantic implementation reached the tier-surface probe; fixed a cross-language newline escaping error before evaluating page behavior.
- Added independent achievement loading/error/retry/empty/content states; identity now becomes visible before the achievement promise settles.
- Added a 2-second page timeout through lobby-kit AbortSignal forwarding.
- Browser coverage now uses exact C1 active metadata, real `first_cast` legacy projection, locked/revealed hidden shapes, exact C3 empty/tie career outcomes, and success/error/malformed/delayed/hanging/retry scenarios.
- Added ul/li semantics, unique aria-controls panels, keyboard activation/focus checks, full DOM/attribute tier scanning, 375px overflow and 44px target checks.
- Serial lobby-kit and Blog test/check/lint/build gate passed; Astro check retained only two existing declaration hints.
- Playwright passed all seven deterministic scenarios; appended reviewer results and concerns to C4-report.md.

## 2026-09-07 Reviewer Race Fixes

- Verified the committed C4 loader lacks cross-request cancellation ownership and generation guards; reopened the plan at phase 10.
- RED reproduced a stale first resolve overwriting the second successful response even though a new load had begun.
- GREEN added page-level controller ownership, monotonic request generations, guarded success/catch/finally writes, and teardown invalidation.
- Playwright passes stale resolve, stale reject, and teardown cases where the first mock deliberately ignores AbortSignal.
- Fresh serial gate passed: lobby-kit full, Blog test/check/lint/build; check retained only two existing declaration hints.
- Fresh Playwright passed all 10 scenarios; report wording corrected to distinguish the old whitespace scan from the new boundary-aware evidence.
