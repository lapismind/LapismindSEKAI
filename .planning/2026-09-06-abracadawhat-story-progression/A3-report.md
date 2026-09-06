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

A deterministic test-only Vite harness now mounts the real `SpellCard`, `PublicArea`, and `CastFeedback` components without a WebSocket room. The harness lives under `tests/fixtures/`, is not imported by production source, and is not a Vite build input, so it is absent from `dist`.

Python 3.13 Playwright runs at a 390x844 viewport and verifies:

- click, Enter, and Space expansion behavior;
- `aria-expanded` changes and a persistent `aria-controls` target;
- at least 44x44px geometry for card and public-area controls;
- opening a second card closes the first disclosure;
- changing an open card to `faceDown` removes its button/effect text, then restores it collapsed when face-up again;
- dark cards remain noninteractive;
- empty-pile owl feedback omits “获得秘密牌”, while a real draw includes it;
- no browser `pageerror` events occur.

## Scope And Concerns

- Reviewer follow-up found that an owl cast against an empty pile leaked the caster's previously held last secret into `secretTaken`. `applyCast()` now captures only the card shifted from the pile during the current cast.
- The disclosure UI intentionally does not redesign the cast panel, add story/recap behavior, or change game protocol/state.
- SpellCard disclosures are inline rather than viewport-fixed, and opening one card closes other open SpellCard disclosures to prevent stacked mobile panels.
- Implementation commit SHA: use the commit containing this report; the exact SHA is reported in the task response because a commit cannot embed its own hash.

## Reviewer Follow-up Evidence

### RED

- `node --test tests/rules.test.mjs`: 17 passed, 1 failed. The new pre-existing-secret case reported `2 !== null`, proving `secretTaken` leaked inventory state.
- `node --test tests/ui-regressions.test.mjs`: 5 passed, 2 failed. Failures identified the contradictory “必须先成功施法一次” help text and missing face-down disclosure reset/DOM guarantees.
- Python Playwright reached the intended overlap RED after the harness was corrected: opening fireball with Enter left owl at `aria-expanded="true"` instead of closing it.

### GREEN

- Focused Node: `node --test tests/rules.test.mjs tests/ui-regressions.test.mjs` passed 25/25.
- Production build: `npm run build` passed, built 101 modules, then copied enabled emoji assets.
- Full Abracadawhat suite: `npm test` passed 37/37 with 0 failures, run after the build.
- Browser: `python C:\Users\lapismind\.agents\skills\webapp-testing\scripts\with_server.py --server "npm run dev -- --host 127.0.0.1" --port 5174 -- python tests/a3-components-browser.py` exited 0.
