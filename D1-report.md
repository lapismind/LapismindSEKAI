# Task D1 Report

## Status

Task D1 is implemented on the current B1-C2 persistence path. Auth now stores private per-player match reports after achievement insertion, without adding a reports query endpoint or changing remote D1 state.

## Storage Contract

- Migration `007_player_match_reports.sql` creates the approved `player_match_reports` table, the unique `(match_id, player_id)` constraint, and `idx_player_match_reports_recent(player_id, game, finished_at DESC, id DESC)`.
- `auth/schema.sql` contains the same final table and index.
- Only standing `playerId` values present in `users.player_id` are eligible. Guests remain in match/career rows but receive no personal report.
- Each report stores `match_id`, `player_id`, `game`, own `rank`/`score`, `rounds`, `player_count`, `finished_at`, the full final `{ playerId, nickname, rank, score }` standings snapshot, at most three stories owned by that player, and achievement keys first attributed to that match/player.
- It does not store chats, emojis, IP addresses, device data, hands, or step-by-step actions.

## Idempotence And Retention

- `UNIQUE(match_id, player_id)` plus an upsert prevents duplicate reports for the same match/player.
- Retry reloads unlock keys from `achievements.match_id`, so an achievement can commit before a failed report write and still appear when the report is repaired.
- A valid nonempty existing `unlocked_keys_json` is preserved on retry. Empty or malformed stored unlock JSON is repaired from the match-linked achievement rows.
- Other report fields are repaired from the canonical sanitized report, including corrupted rank, score, standings, and stories.
- Each player's upsert and same-game retention delete run in one D1 batch.
- Retention keeps the latest ten by `finished_at DESC, id DESC`. Other games are independent.
- `savedReports` contains only registered player IDs whose exact row still exists after retention. Retrying an already-evicted old match therefore does not falsely report it as saved.

## Failure Semantics

- Match/player completion remains the existing B1 atomic batch and is verified before achievements.
- Achievement insertion remains before personal-report storage.
- Personal-report lookup or per-player storage failure is logged and does not roll back a complete match or inserted achievements.
- One player's report failure does not prevent another registered player's report from saving.
- The Auth response remains HTTP 200 for the completed match. `newAchievements` reports only inserts from that request; `savedReports` reports exact successful personal-report IDs. An identical retry repairs missing reports without duplicate matches, achievements, or reports.

## TDD Evidence

- Migration RED failed because migration 007 did not exist.
- Route RED reached the production persistence helper and failed because `savedReports` was still empty.
- Retention accuracy RED showed an evicted old retry incorrectly returned `savedReports: ['p1']`; GREEN added a post-retention existence check.
- Real isolated D1 coverage executes migrations 005, 006, and 007 and exercises initial storage, guest skip, exact JSON, forbidden top-level fields, malformed-row repair, identical retry, 11-match retention, another game, per-player forced failure, achievement preservation, and retry repair.

## Verification

```text
Auth full suite: 66/66 passed
Real isolated D1 persistence route: passed
Migration 007 local execution twice: passed
Auth production/test syntax checks: passed
Production report-storage forbidden-field scan: no matches
Scoped git diff --check: passed (line-ending warnings only)
```

The existing B1 rollback test intentionally logs `forced player failure`; it passes and verifies pending-match isolation.

## Migration Governance

- Migration 007 was executed only against temporary isolated local D1 state.
- No `--remote`, deployment, push, migration-baseline mutation, or production database command was run.
- Existing databases still require the documented D4 backup, 005 duplicate preflight, explicit baseline review, and approved 005 -> 006 -> 007 production sequence.

## Concerns

- Personal-report storage is intentionally best-effort. A transient failure can leave a completed match and achievements without one or more reports until the producer retries the identical payload.
- `savedReports` is the D1 persistence status required by the approved D1 contract; no additional response status field was added.
- No query endpoint exists yet. Reading and corrupt-row skipping remain Task D2.

## Reviewer P2/P3 Fixes

### Authoritative unlock-key recomputation (finding 1)

- `unlocked_keys_json` is now treated as a cache, never as a source of truth.
- On every hash-identical retry it is recomputed from `achievements` rows for the same `(match_id, player_id)`, intersected with known achievement definition keys, deduplicated, and sorted deterministically.
- The upsert always overwrites the stored cache with the recomputed value; the previous "preserve any valid nonempty array" `CASE` was removed.
- This repairs valid-JSON semantic corruption: unknown keys, numbers, duplicates, and keys belonging to another player/match are all filtered out.
- Legitimate first-save keys are preserved even when the retry's own `newAchievements` is empty, because the authoritative `achievements` rows persist across retries.
- Real-D1 coverage seeds `["bogus",123,"different_paths","different_paths","eight_facets","last_breath"]` on the stored report and asserts a retry restores `["different_paths"]` (the only key actually attributed to p1 for that match).

### Concurrent report writes and retention tie (finding 2 + 4)

- The real isolated D1 test now issues two identical concurrent posts for a fresh match and asserts: both succeed, same `matchId`, `savedReports` `['p1','p2']`, the union of `newAchievements` is exactly one `weak_over_strong`, and the stored report is a single row per player with the exact `unlocked_keys_json`.
- Real D1 concurrency proved stable, so this is primary coverage rather than a fake fallback.
- An equal-`finished_at` retention test posts 11 matches with the identical `finished_at` and asserts retention keeps the 10 highest ids, evicting only the first-written match. `savedReports` for each of the 10 newest is `['p1','p2']`.

### Real D1 startup hardening (finding 3)

- The integration test now binds a dynamic port via a reserved ephemeral listener instead of a fixed `19731`.
- Readiness uses bounded ~60s condition polling with per-attempt `AbortSignal.timeout(1000)`, no arbitrary 1.5s sleeps, and no unbounded loops.
- The gate detects process early exit and throws with the captured child stdout/stderr so a crash is reported as infrastructure, not a silent hang.
- Cleanup remains `taskkill /t /f` for the whole local process tree plus temporary directory removal.
- Honest flake/retry record: no readiness retries were needed in any full run; the real-D1 integration passed on the first attempt in all serial full runs.

## Verification (reviewer round)

```text
Auth full suite run 1: 66/66 passed
Auth full suite run 2: 66/66 passed
Auth full suite run 3: 66/66 passed
Real isolated D1 (concurrency + tie + corruption): passed in all three runs
Migration 005/006/007 local execution: passed in both runs
Auth production/test syntax checks: passed
git diff --check for staged D1 paths: passed
```

The existing B1 rollback test intentionally logs `forced player failure`; it passes and verifies pending-match isolation.
