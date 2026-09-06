# Task A1 Implementation Report

## Status

DONE_WITH_CONCERNS

Task A1 was implemented and committed as `5bc6979` with the exact planned message:

`fix(abracadawhat): preserve match facts and count dragon kills`

No push or deployment was performed. No later task or v2 schema implementation was added.

## Files In Commit

- `auth/tests/match-reports.test.mjs` (new): focused v1 sanitizer whitelist and validation tests.
- `auth/tests/worker.test.mjs`: route-level proof that `POST /api/matches` uses the shared 2-5 player sanitizer.
- `auth/package.json`: changed `npm test` to run all `tests/*.test.mjs` through `node --test`.
- `auth/src/matchReports.js` (new): pure `sanitizeMatchReport(body)` v1 implementation.
- `auth/src/index.js`: `postMatch()` now consumes the sanitizer result for persistence and achievement evaluation.
- `abracadawhat/tests/rules.test.mjs`: locks that one dragon cast reports each affected target once.
- `abracadawhat/tests/worker-auth.test.mjs`: real `AbracaRoom.doCast()` dragon triple-kill regression.
- `abracadawhat/src/worker/abracaRoom.js`: total `kills` now increments for all kills; `dragonKills` remains the dragon subset.

## Files Outside Commit

- `.planning/2026-09-06-abracadawhat-story-progression/task_plan.md`: records the contaminated route RED and correction.
- `docs/lessons-learned.md`: records the fake-D1 RED discipline lesson.
- `.planning/2026-09-06-abracadawhat-story-progression/A1-report.md`: this requested report.

These files were intentionally excluded because the user required committing only the planned A1 files.

## RED Evidence

### Auth sanitizer RED

Command:

`node --test auth/tests/match-reports.test.mjs`

Observed result before production implementation:

- 3 tests run, 0 passed, 3 failed.
- Each failure was an assertion failure: `sanitizeMatchReport must be implemented`.
- The test converted the absent module/export into a behavioral assertion, avoiding an import/loader RED.

### Abracadawhat kill-accounting RED

Command:

`node --test abracadawhat/tests/worker-auth.test.mjs`

Observed result before production implementation:

- Failed with `0 !== 3` for `state.matchStats.players.caster.kills`.
- The same real `AbracaRoom.doCast()` call already produced `dragonKills === 3`, proving the missing behavior was specifically total kill accounting.

### Auth route integration RED

Command:

`node --test auth/tests/worker.test.mjs`

First attempt was invalid RED evidence because the old route reached a fake-D1 branch that did not support `INSERT INTO matches`, producing HTTP 500. This was recorded immediately in `docs/lessons-learned.md` and the planning error table.

After extending only the test fake to support the complete old route, the rerun produced the correct behavioral RED:

- Expected HTTP 400 for six players.
- Actual HTTP 200 from the old inline sanitizer.
- Assertion failure: `200 !== 400`.

### Self-review follow-up RED

After the first GREEN, comparison against the exact Worker match-stat object found two additional currently sent fields, `currentTurnIndex` and `lowHpSeen`, plus acceptance of unsupported `schemaVersion: 3`.

Command:

`node --test auth/tests/match-reports.test.mjs`

Observed result:

- 3 tests run, 1 passed, 2 failed.
- Complete-field deep equality showed `currentTurnIndex` and `lowHpSeen` missing.
- Unsupported-version assertion showed `true !== false` for schema version 3.

The sanitizer was then minimally corrected.

## GREEN Evidence

### Focused GREEN

- `node --test auth/tests/match-reports.test.mjs`: 3/3 passed.
- `node --test abracadawhat/tests/worker-auth.test.mjs`: 1/1 file passed, including dragon `kills === 3` and `dragonKills === 3`.
- `node --test auth/tests/worker.test.mjs`: route integration passed, including six-player rejection.

### Required Full Gates

The required commands were run serially, both before commit and again after commit.

1. `cd auth && npm test`
   Result: PASS, 19 tests, 19 passed, 0 failed.
2. `cd abracadawhat && npm run build`
   Result: PASS, Vite production build completed and postbuild emoji copy completed.
3. `cd abracadawhat && npm test`
   Result: PASS, 27 tests, 27 passed, 0 failed.

Fresh post-commit results:

- Auth full tests: 19/19 passed in approximately 494 ms.
- Abracadawhat build: exit 0, 101 modules transformed, postbuild completed.
- Abracadawhat full tests: 27/27 passed in approximately 381 ms.

## Implementation Notes

- `sanitizeMatchReport(body)` returns `{ ok: true, version: 1, report }` or `{ ok: false, error }`.
- Missing `schemaVersion` and explicit `schemaVersion: 1` are accepted as v1; all other versions are rejected in A1.
- Only `game: 'abracadawhat'` v1 reports are accepted.
- Player count is restricted to 2-5.
- `playerId` must start with `p` and be at most 64 characters; nickname is at most 64 characters.
- Spell ids are restricted to 1-8 in `spellsCast`, `roundSpellCasts`, `castStreaks`, and `turnSpellSets`.
- Numeric counters are non-negative integers capped at `1_000_000`.
- Nested objects and arrays are copied into whitelist structures; arbitrary keys are not passed to achievement evaluation.
- All currently sent v1 player fields from `buildMatchReport()` are preserved, including the nine fields named by A1 and the current internal fields `currentTurnIndex` and `lowHpSeen`.
- `ms.kills` increments exactly once by `killsThisCast` for every spell. Dragon kills additionally increment `ms.dragonKills`, so consumers must continue treating `dragonKills` as a subset, not an additive total.

## Commit Boundary Review

Before commit:

- `git diff --cached --check` passed.
- Staged diff contained exactly the eight files listed in Task A1.
- `.planning` and `docs/lessons-learned.md` changes were not staged.
- Secret-pattern review found only existing or newly added obvious test placeholder secrets such as `test-secret` and `match-report-secret`; no production credential was added.
- The staged diff contained no v2 report schema, report id, standings, facts, stories, migration, query endpoint, or later-task implementation.

## Self-review

- Correctness: the sanitizer is now the sole source of the report object used by D1 writes and achievement evaluation.
- Scope: no achievement retirement, Store cleanup, UI work, v2 schema, migration, report persistence redesign, or story logic was touched.
- Double counting: `kills` and `dragonKills` are both 3 after a dragon triple kill, not 6 in either field; no code sums the two during this task.
- Compatibility: currently emitted v1 fields are retained, while malformed nested values are rejected instead of silently passed through.
- Test coverage: direct pure-function behavior, real Worker cast behavior, rule target uniqueness, route use of sanitizer, Auth full suite, production build, and Abracadawhat full suite all pass.
- Review limitation: no subagent/code-review tool was available in this environment, so review was performed manually against the exact A1 requirements and staged diff.

## Concerns

- The v1 numeric ceiling is a new explicit constant of `1_000_000` because the plan requires a non-negative integer upper bound but does not prescribe the value. It is safely above plausible match values, but a later specification may choose a tighter per-field limit.
- The first route RED attempt was contaminated by incomplete fake-D1 support. It was not used as valid RED evidence; the harness was corrected and the test was rerun to obtain the required clean `200 !== 400` assertion failure.
- Planning and lessons files remain modified/untracked outside the A1 commit by design, including this report.

---

## A1 Review Remediation

### Scope

This follow-up fixes all Critical/High/Medium findings supplied after commit `5bc6979`. It remains v1-only and does not add the v2 schema, migrations, report ids, standings, facts, stories, query endpoints, or later Stage A tasks.

### Review Findings Addressed

1. Replaced the shared `1_000_000` allowance with domain-specific scalar, collection, and aggregate limits.
2. Bounded `roomId` to 64 characters in Auth and the Abracadawhat WebSocket entry path.
3. Made the actual sender path enforce `playerId` compatibility without truncating identity and normalize nicknames to 64 characters.
4. Rejected duplicate v1 `playerId` values.
5. Required canonical spell object keys exactly `'1'` through `'8'`.
6. Added ordinary-versus-dragon kill semantics coverage and a real `buildMatchReport()` to `sanitizeMatchReport()` compatibility test.

### Limit Model

- Players: 2-5.
- `roomId`: 64 characters.
- `playerId`: starts with `p`, maximum 64 characters.
- Nickname: maximum 64 characters; the game sender trims and truncates display nicknames rather than rejecting a completed match.
- Rounds: maximum 100.
- Score: maximum 1,500, covering the theoretical two-player 100-round maximum of 3 round-win points plus 12 secrets per round.
- Final HP: 0-6.
- Per-match cast/event count: maximum 3,600, derived from 36 cards times 100 rounds.
- Turn indexes: 0-3,599.
- Successful spells recorded in one turn: maximum 36.
- One-cast kills: maximum 4, the maximum number of opponents in a five-player room.
- Total kills: maximum 400, or four opponents across 100 rounds.
- Deaths/suicides/rounds survived: maximum 100.
- Secrets held at a round end: maximum 12; secrets taken over a match: maximum 1,200.
- Each duplicated telemetry representation (`spellsCast`, `roundSpellCasts`, `castStreaks`, `turnSpellSets`) is also aggregated across all players and capped at 3,600. This prevents several individually legal arrays from combining into an oversized Worker payload.

### Identity And Sender Compatibility

- `/api/identity` now refuses to sign an invalid or overlong `playerId`, whether it came from the fallback request parameter or a verified session.
- A verified but invalid session identity is rejected; it is not silently replaced by the request parameter and is never truncated, preserving identity security.
- The Durable Object checks the token-derived/fallback `playerId` again before adding or reconnecting a player.
- WebSocket `roomId` is rejected above 64 characters before `idFromName()`.
- Nicknames are trimmed, defaulted, and capped at 64 at the Durable Object join/reconnect boundary and again in `buildMatchReport()`, so legacy room state also produces an Auth-compatible report.
- The Durable Object's report `roomId` snapshot is capped at 64 as a final compatibility guard for legacy/test contexts.

### TDD RED Evidence

Command: `node --test auth/tests/match-reports.test.mjs`

Initial review-fix RED:

- 6 tests run, 3 passed, 3 failed.
- Overlong room ID was accepted: `true !== false`.
- Duplicate `playerId` was accepted: `true !== false`.
- Spell alias key `'01'` was accepted: `true !== false`.

Command: `node --test abracadawhat/tests/worker-auth.test.mjs`

Initial sender RED:

- Failed because an overlong fallback identity was signed.
- Expected HTTP 400, actual HTTP 200.

After the first implementation pass, focused Auth tests had one failure caused by a bad test fixture: the assertion described a per-turn limit but supplied 36 casts in one turn and one cast in another. The implementation correctly accepted it. The fixture was corrected to 37 casts in one turn and the error was recorded in `task_plan.md` and `docs/lessons-learned.md`.

Self-review added two more assertions before the final limit implementation:

- A legal 100-round boundary payload with score 1,500 was rejected by the provisional 1,000 score cap: `false !== true`.
- Multiple individually legal telemetry collections could combine into an oversized whole report: `true !== false`.

These REDs led to the rule-derived 1,500 score cap and cross-player aggregate telemetry limits.

### Focused GREEN Evidence

- `node --test auth/tests/match-reports.test.mjs`: 7/7 passed.
- `node --test abracadawhat/tests/worker-auth.test.mjs`: passed, including identity rejection, room ID bound, ordinary kill semantics, dragon kill subset semantics, nickname normalization, and real sender-to-sanitizer compatibility.

### Full Verification

Required serial sequence after the initial GREEN:

1. `cd auth && npm test`: PASS, 23/23.
2. `cd abracadawhat && npm run build`: PASS, 101 modules transformed and emoji postbuild completed.
3. `cd abracadawhat && npm test`: PASS, 27/27.

A final fresh serial run after the last rule-based aggregate-limit refactor:

1. `cd auth && npm test`: PASS, 23 tests, 23 passed, 0 failed, approximately 459 ms.
2. `cd abracadawhat && npm run build`: PASS, 101 modules transformed, build completed in approximately 431 ms, emoji postbuild completed.
3. `cd abracadawhat && npm test`: PASS, 27 tests, 27 passed, 0 failed, approximately 353 ms.

### Files In Remediation

- `auth/src/matchReports.js`
- `auth/tests/match-reports.test.mjs`
- `abracadawhat/src/worker/index.js`
- `abracadawhat/src/worker/abracaRoom.js`
- `abracadawhat/tests/worker-auth.test.mjs`
- `.planning/2026-09-06-abracadawhat-story-progression/A1-report.md`
- `.planning/2026-09-06-abracadawhat-story-progression/task_plan.md`
- `docs/lessons-learned.md`

The planning and lesson files directly document A1 TDD errors and this remediation, so they are included in the new commit as explicitly allowed.

### Remaining Concerns

- The v1 format lacks a serialized-byte-size check before `request.json()`. The new collection and string bounds prevent oversized retained structures after parsing, but the platform still parses the incoming JSON body before sanitization. Adding a transport-level body limit would be broader endpoint hardening and is not part of the supplied A1 findings.
- The 100-round ceiling is deliberately generous to avoid rejecting plausible long games while still bounding Worker work. It is not a gameplay timeout or match-ending rule.
