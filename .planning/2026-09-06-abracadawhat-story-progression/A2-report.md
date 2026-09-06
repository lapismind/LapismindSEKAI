# Task A2 Report

## Status

Complete. Task A2 was implemented with strict RED-GREEN TDD and committed locally. No push or deployment was performed.

## Commit

- SHA: `400e5b3`
- Message: `fix(achievements): retire impossible and harmful triggers`

## Changes

- Added an explicit `status` to every current achievement definition.
- Marked only `dragon_clown` and `egg_social_death` as `legacy`; all other definitions remain explicitly `active`.
- Updated `evaluateAchievements()` to skip legacy definitions while retaining their definitions and existing persisted unlock rows.
- Added one new-match reset for `newAchievements`, `roundEndSummary`, `roundScoreDeltas`, and `lastGameOver`.
- Applied the reset before `startRound()` and `rematch()` send their actions, and idempotently on a round 1 `playing` room state.
- Did not introduce A4 display-state separation or change `clearGameOver()` behavior.

## TDD Evidence

RED was observed before implementation:

- `node --test auth/tests/achievements.test.mjs`: 14 passed, 3 failed. Failures proved missing statuses and both legacy achievements still triggered.
- `node --test abracadawhat/tests/game-store.test.mjs`: 2 passed, 3 failed. Failures proved stale achievements/report/game-over state survived all required new-match boundaries.

Focused GREEN after implementation:

- `node --test auth/tests/achievements.test.mjs`: 17/17 passed.
- `node --test abracadawhat/tests/game-store.test.mjs`: 5/5 passed.

## Required Verification

Run serially in the requested order:

1. `auth/npm test`: 25/25 passed.
2. `abracadawhat/npm run build`: passed; Vite transformed 101 modules and postbuild copied enabled emoji assets.
3. `abracadawhat/npm test`: 30/30 passed.

## Scope And Persistence

The commit contains only the four planned A2 files:

- `auth/tests/achievements.test.mjs`
- `auth/src/achievements.js`
- `abracadawhat/tests/game-store.test.mjs`
- `abracadawhat/src/stores/gameStore.js`

No D1 migration, delete, or persistence code was changed, so previously unlocked rows remain intact.

## Concerns

- `progressFromCareer()` and `ACHIEVEMENT_TARGETS` still contain `dragon_clown`. This is intentional for preserving legacy definition/progress compatibility until the later profile migration work.
- `clearGameOver()` still clears `lastGameOver`. This is intentionally unchanged because separating display state belongs to A4.
- The report and pre-existing planning changes remain outside the A2 commit by request.

## Reviewer Follow-up

The original client reset behavior above was corrected after review. Commit `400e5b3` was not amended.

### Correctness Fixes

- `startRound()` and `rematch()` now clear only transient `newAchievements`, `roundEndSummary`, and `roundScoreDeltas` before sending.
- `lastGameOver` remains available if a send is disconnected/dropped or the server rejects the action, preserving the only current retry-capable rematch state.
- `lastGameOver` is cleared only after the server confirms a new match with `room_state { phase: 'playing', round: 1 }`.
- Match reporting captures the submitted match's existing authoritative `matchStats.startAt` identity.
- A delayed Auth response broadcasts achievements only while the room is still `game_over` for that same `startAt`; responses from an old match are suppressed after rematch/new-match state begins.
- No schema v2, D1 `reportId`, story engine, or A4 UI display-state separation was added.

### Corrective TDD Evidence

RED was observed before the corrective production changes:

- `node --test abracadawhat/tests/game-store.test.mjs`: 3 passed, 2 failed. Both failures were `lastGameOver` becoming `null` during `startRound()`/`rematch()` initiation.
- `node --test abracadawhat/tests/worker-auth.test.mjs`: 0 passed, 1 failed. The delayed match A Auth response broadcast `achievements_unlocked` after match B reached round 1.

Focused GREEN after the corrective changes:

- `node --test abracadawhat/tests/game-store.test.mjs`: 6/6 passed, including dropped send, rejected rematch, and confirmed round 1 clearing.
- `node --test abracadawhat/tests/worker-auth.test.mjs`: 1/1 passed, including delayed Auth response plus real `hostRematch()`/new match suppression.

### Corrective Required Verification

Run serially in the requested order:

1. `auth/npm test`: 25/25 passed, 0 failed.
2. `abracadawhat/npm run build`: passed; Vite 8.2.2 transformed 101 modules and postbuild copied enabled emoji assets.
3. `abracadawhat/npm test`: 31/31 passed, 0 failed.

### Corrective Scope And Concerns

- The follow-up uses `matchStats.startAt`, already created by the Worker at match start, as an in-room async response guard. It does not add an Auth-visible stable report ID; that remains later schema work.
- `clearGameOver()` remains unchanged. A4's display/data separation is still intentionally deferred.
- Existing unlocked D1 rows and achievement persistence remain untouched.
