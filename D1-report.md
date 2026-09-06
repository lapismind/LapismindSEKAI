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
