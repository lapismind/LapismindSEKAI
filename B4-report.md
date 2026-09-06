# Task B4 Report

## Status

Task B4 and its reviewer fixes are implemented. Match completion broadcasts v2 stories immediately, then reports Auth persistence outcomes through report-scoped messages. No story UI rendering or deployment is included.

## Delivered Contract

- V2 `game_over` is broadcast after state persistence and before the Auth promise resolves with `reportId`, `winnerId`, standings, `selectMatchStories(state.matchStats.facts)`, and `reportStatus: 'saving'`.
- A valid Auth success broadcasts `achievements_unlocked` as `{ reportId, achievements }`, then `match_report_status` as `{ reportId, saved: true }`.
- `savedReports: []` is still a successful report transaction.
- Non-2xx responses, invalid JSON, malformed 2xx bodies, mismatched response `reportId`, and thrown fetches log `report match failed:` and broadcast `{ reportId, saved: false, message: '战报暂未保存' }` only while that report remains current.
- Missing `MATCH_REPORT_SECRET` for v2 logs `report match configuration error: MATCH_REPORT_SECRET is missing`, performs no fetch, and broadcasts the same report-scoped failure status. Legacy v1 remains silent when the secret is absent.
- The Store accepts async v2 messages only when their `reportId` matches `lastGameOver.reportId`, merges achievement arrays, preserves legacy v1 array messages during transition, and clears report status on new-match initiation/confirmation without breaking A4 rematch retention.

## Auth Success Validation

A v2 2xx body is successful only when all fields match the B1 contract:

- The body is a non-array object.
- `ok === true`.
- `reportId` equals the submitted v2 `reportId`.
- `matchId` is an integer or a non-empty string.
- `savedReports` is an array.
- `newAchievements` is an array.

Achievement entries are restricted to non-null, non-array objects before broadcasting. No achievement message is broadcast from a malformed response.

B1 evidence in `auth/tests/worker.test.mjs` asserts first and idempotent v2 responses return the submitted `reportId`, the same internal numeric `matchId`, and an array `savedReports`.

## TDD Evidence

- Initial B4 RED: 10 focused failures covered missing immediate fields, status storage, stale filtering, failure states, and legacy compatibility.
- Reviewer RED: 8 initial expected failures covered missing-secret silence, six malformed v2 2xx shapes being treated as saved, and malformed achievement entries reaching the broadcast. Exact-boolean cases were then added separately.
- A separate legacy-late-message regression failed before the Store transition guard was tightened.
- The stale failure test was mutation-checked by disabling the report guard; it failed by broadcasting report A into report B, then passed after restoring the guard.
- Exact `ok === true` validation was mutation-checked with truthy non-boolean `ok: 1`; weakening the predicate to truthiness made that regression fail before strict equality was restored.
- Fixture-only failures caused by new state reads in the missing-secret path were corrected by giving affected Durable Object contexts `storage.get` and awaiting their scheduled report promise.

## Verification

Commands were run serially where required:

```text
abracadawhat: node --test tests/worker-auth.test.mjs tests/game-store.test.mjs
auth: npm test
abracadawhat: npm run build && npm test
```

Final results:

- Focused Worker/Store/match-facts: 62/62 passed.
- Auth full suite, including real isolated local D1: 47/47 passed.
- Abracadawhat production build and emoji postbuild: passed.
- Abracadawhat full suite: 112/112 passed.
- `git diff --check`: passed before final staging.

## Concerns

- `matchId` is numeric in the current D1 implementation. A non-empty string is also accepted at the Worker boundary as explicitly requested, allowing compatible adapters without weakening report identity checks.
- Achievement entries are shape-filtered to plain object-like values but their internal fields are not revalidated by the game Worker. Auth remains the authoritative producer, and the Store receives only object entries from a fully valid top-level response.
- Failure reporting is intentionally best-effort and current-match scoped. If the room has already moved to a new report or phase, stale failure messages are logged but not broadcast.
