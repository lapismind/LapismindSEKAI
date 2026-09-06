# Task A3 Report

## Status

Complete. Task A3 was implemented with strict TDD and kept within the planned rules/help/feedback/effect-disclosure scope.

## Changes

- Locked the existing server contract that a successful owl cast against an empty secret pile returns `secretTaken: null` and adds no secret card.
- Changed owl success feedback so “获得秘密牌” appears only when `secretTaken != null`.
- Corrected the help copy: a failed declaration loses health, remains in the current action, blocks further casting, and requires ending the action to refill and pass play.
- Changed visible `SpellCard` instances into native effect-disclosure buttons with `aria-expanded`, `aria-controls`, keyboard activation, visible focus treatment, and minimum 44px touch targets. Face-down cards remain non-interactive.
- Changed public spell counters into native effect-disclosure buttons with the same accessibility and touch-target guarantees, revealing one effect description below the existing row.
- Retained `title` only as optional desktop supplementary text; effect details are now present in normal rendered content.

## TDD Evidence

1. Added the empty-secret-pile owl contract test and ran `node --test tests/rules.test.mjs`: 17/17 passed, confirming the existing server behavior before UI edits.
2. Added four UI source/component regression tests and ran `node --test tests/ui-regressions.test.mjs`: 3 passed and 4 failed for the intended missing behaviors.
3. Applied the minimal component changes and ran `node --test tests/rules.test.mjs tests/ui-regressions.test.mjs`: 24/24 passed.

## Final Verification

- `npm run build`: passed; Vite built 101 modules and the emoji postbuild copy completed.
- `npm test`: passed; 36 tests, 0 failures, run after the build as required.
- `git diff --check` on A3 source/test files: passed; only the existing Git CRLF normalization warning for `PublicArea.vue` was emitted.

## Playwright

No Python Playwright test was added. The current local routes do not provide a deterministic component/story fixture that renders `SpellCard`, `PublicArea`, or an empty-pile owl result without joining and driving a live WebSocket room. The existing browser tests either inspect always-rendered room chrome or require room/network behavior. Adding a test-only route, component mount framework, or fake game-state injection would create a new production/test seam beyond A3's smallest-UX scope.

The deterministic coverage for this task is therefore the rule contract test, UI source/component structure tests, and production build. Runtime browser verification remains a limitation until a stable local game-state fixture exists.

## Scope And Concerns

- `rules.js` required no production change because its `secretTaken: null` behavior already matched A3; the new test locks it against regression.
- The disclosure UI intentionally does not redesign the cast panel, add story/recap behavior, or change game protocol/state.
- Multiple individual `SpellCard` disclosures can be open at once because each card owns its state. This is acceptable for the current small disclosure and avoids introducing shared panel state outside A3.
- Implementation commit SHA: use the commit containing this report; the exact SHA is reported in the task response because a commit cannot embed its own hash.
