# Task D1 Plan

## Goal

Implement the approved D1 personal match-report persistence contract on the current B1-C2 Auth flow: migration 007, schema parity, registered-player-only storage, idempotent retries, per-game retention, and best-effort post-achievement failure isolation.

## Reviewer Fix Round (P2/P3)

- Make `unlocked_keys_json` a cache derived from authoritative `achievements` rows on every hash-identical retry: filter to known definition keys, deduplicate, deterministic sort, always overwrite. Repair valid-JSON semantic corruption.
- Add real isolated D1 concurrent report writes and equal-`finished_at` retention tie coverage.
- Harden real D1 startup: dynamic port, bounded ~60s condition polling, early-exit detection, captured logs, cleanup.
- Run migration + Auth full at least two serial passes; append report; commit D1 files only. No D2 endpoint.

## Scope

- Add migration `007_player_match_reports.sql` and synchronize `auth/schema.sql`.
- Add strict RED-GREEN tests for exact stored fields, registered/guest filtering, retry preservation, retention, privacy, corruption repair, and partial report-storage failure.
- Integrate report storage only after match completion and achievement insertion.
- Update migration governance and add `D1-report.md`.
- Run the full Auth suite and commit only D1 scope/report.
- No query endpoint, Blog UI, remote D1 command, deployment, or unrelated refactor.

## Failure Policy

- Match completion and achievement insertion remain authoritative and are not rolled back by later personal-report storage failures.
- Each registered player's report upsert plus retention cleanup is one D1 batch; one player's failure does not prevent other registered players from being saved.
- The route returns HTTP 200 for an already completed match, with `savedReports` containing exactly the player IDs whose report batch was confirmed successful. Failures are logged and repaired by an identical retry.

## Phases

- [complete] Phase 1: Add migration/storage/route acceptance tests and verify focused RED.
- [complete] Phase 2: Add migration 007, schema parity, and verify migration GREEN.
- [complete] Phase 3: Implement minimal personal-report helper after achievements and verify focused GREEN.
- [complete] Phase 4: Run real isolated D1 coverage, Auth full, syntax/diff/privacy review, and adversarial self-review.
- [in_progress] Phase 5: Write D1 report, inspect staged scope/secrets, commit, and return SHA/tests/concerns.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Focused RED could not execute migration 007 because the file did not exist | 1 | Expected feature-missing RED; add the approved migration before rerunning. |
| Real-D1 route RED was stopped by an impossible three-kill story in a two-player match | 1 | Replaced it with a valid `voluntary_stop` own-story fixture and reran to reach the persistence assertion. |
| Auth syntax command ran from the repository root with `src/matchPersistence.js` | 1 | Rerun from `auth/`, where that relative production path exists. |
| Existing fake D1 suites logged caught unsupported personal-report queries | 1 | Extend only the fakes with users/achievement lookup and report write branches so successful tests remain clean. |
| `personalReports` fake state was declared in an earlier worker test block | 1 | Move the declaration into the v2 persistence block that owns the new SQL branches and assertions. |
| Expanded real-D1 coverage hit the old 60-second node:test timeout | 1 | Raise only this isolated process-heavy test to 120 seconds; all readiness/fetch operations remain individually bounded. |
| Final retry assertion expected one row after both registered players saved | 1 | Query/group by player and assert p1 preserves its unlock while p2 has an empty own unlock list. |
| Retrying an evicted old match returned `savedReports: ['p1']` although retention immediately deleted it | 1 | Confirm the exact report row still exists after the batch before adding the player ID to `savedReports`. |
| Reviewer: valid-JSON semantic corruption (unknown/numbers/duplicates/other-player keys) survived retries | 1 | Recompute unlocked_keys_json authoritatively from achievements rows for (match_id,player_id) each retry; always overwrite the cache. |
| Concurrent savedReports assertions expected only p1 but p2 was already registered | 2 | Assert `['p1','p2']` at the concurrent/tie stages; the fixture registers p2 earlier. |
| Real D1 concurrent identical posts could contend on the same match row | 1 | Real isolated D1 concurrency proved stable and passed; kept it as primary coverage. |
