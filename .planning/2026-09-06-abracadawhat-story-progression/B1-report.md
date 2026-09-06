# Task B1 Report

## Status

Complete. Task B1 was implemented with strict RED-GREEN TDD and local-only D1 verification. No remote D1 command, deployment, push, or secret change was performed.

## Commit

- SHA: `e950641`
- Message: `feat(auth): accept idempotent abracadawhat v2 reports`

## Changes

- Added migration `005_abracadawhat_match_v2.sql` and synchronized `auth/schema.sql`.
- Added nullable unique `matches.report_id` for new v2 reports while leaving legacy rows `NULL`.
- Added the eight B1 match-player columns with non-null migration defaults and a unique `(match_id, player_id)` index.
- Added a separate strict schema v2 sanitizer with exact canonical keys, 2-5 contiguous unique standings ranks, conservative lengths/counts, canonical spell keys, fixed fact/story envelopes, valid story tiers, timestamp ordering, and `dragonKills <= kills`.
- Preserved schema v1 behavior and its existing achievement path.
- Added one stable `abracadawhat:<uuid>` report ID per `hostStart()`; reconnect/hibernate state preserves it and rematch generates a new one.
- Added Auth v2 persistence using `report_id` lookup plus `INSERT OR IGNORE` player rows. Retrying the same report returns the same internal `matchId` without adding career rows.
- B1 v2 returns `savedReports: []` and `newAchievements: []`; no fact generation, story generation/UI, v2 achievement evaluation, or recent-report persistence was added.

## TDD Evidence

Initial RED before production changes:

- `node --test tests/match-reports.test.mjs tests/worker.test.mjs` in `auth/`: 9 passed, 2 failed. The valid v2 sanitizer assertion returned `false`, and `/api/matches` returned 400 instead of accepting/reusing the v2 report.
- `node --test tests/worker-auth.test.mjs` in `abracadawhat/`: failed because `buildMatchReport()` had no `schemaVersion: 2` or stable `reportId`.

Additional adversarial RED after the first GREEN:

- `node --test tests/match-reports.test.mjs` in `auth/`: 11 passed, 1 failed because structured fact/story values such as `spellId`, HP, reason, and referenced player IDs were not yet constrained tightly enough.

Final focused GREEN:

- Auth focused: 13/13 passed.
- Abracadawhat Worker focused: 1/1 passed.

## Local D1 Migration

Exact command, run from `auth/`:

```powershell
npx wrangler d1 execute sekai-db --local --file=./migrations/005_abracadawhat_match_v2.sql
```

Exact output:

```text
 ⛅️ wrangler 4.125.0
────────────────────
Resource location: local

Use --remote if you want to access the remote instance.

🌀 Executing on local database sekai-db (93010df2-58d0-4858-ac1c-f3e9f07343ac) from .wrangler\state\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 11 commands executed successfully.
[
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 1
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 1
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  }
]
```

Serial local introspection then confirmed:

- `matches.report_id` exists and remains nullable with default `NULL`.
- All eight new `match_players` columns exist; integer defaults are `0`, and `round_wins_by_reason` defaults to `'{}'`.
- `idx_matches_report_id` is a partial unique index for non-null report IDs.
- `idx_match_players_match_player` is unique on `(match_id, player_id)`.

## Required Verification

Run serially in the requested order after the final production change:

1. `auth/npm test`: 30/30 passed, 0 failed.
2. `abracadawhat/npm run build`: passed; Vite transformed 101 modules and postbuild copied enabled emoji assets.
3. `abracadawhat/npm test`: 51/51 passed, 0 failed.

## Concerns

- Migration 005 is intentionally one-shot because SQLite/D1 does not support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; it must be applied exactly once per database through migration tracking.
- The new unique `(match_id, player_id)` index requires the target database to have no historical duplicate pairs. Local migration succeeded; remote data was intentionally not inspected or changed in B1, so production migration must preflight duplicates before applying 005.
- D1 writes are not wrapped in one explicit application transaction. The unique indexes plus `INSERT OR IGNORE` make retries repair a partial player-row write without duplicating rows, but a persistent failure can leave a match temporarily incomplete until retried.
- Reusing a valid `reportId` with a materially different payload is not hash-checked in B1. The endpoint is Worker-secret protected, and canonical `reportId` generation is server-side, but payload immutability is not cryptographically enforced.
- V2 achievements are deliberately empty in B1 to avoid running legacy player-shaped checks against v2 standings before the planned fact-driven achievement task.
- Facts/stories are accepted only as fixed structured envelopes and are currently emitted empty by the game Worker. Their generation and story selection remain B2/B3 work.
- Running local D1 introspection commands concurrently on Windows caused one `SQLITE_BUSY_RECOVERY`; rerunning the same checks serially succeeded. The migration command itself succeeded before that inspection-only tooling error.
- Pre-existing planning-file changes and `.superpowers/` remain uncommitted and untouched by the B1 commit.

## Reviewer High/Medium Correction

### Status

All requested B1 reviewer High/Medium findings were corrected after `e950641`. The corrective work remains B1-only: no story generation/UI, achievement checker v2, recent reports, remote D1 command, deployment, or secret change was added.

### Corrective Changes

- Added read-only duplicate preflight SQL, a local-only wrapper, abort-and-review policy, and isolated pre-005 duplicate/clean fixtures.
- Added `report_hash`, `report_status`, and `expected_players` to migration 005 and `schema.sql`.
- Canonical sanitized reports sort standings by rank, spell maps by numeric spell ID, and spell-id sets numerically before SHA-256 hashing.
- Reusing a `reportId` with a different canonical payload now returns HTTP 409 before player writes.
- New matches begin `pending`; all player upserts and the transition to `complete` run in one D1 `batch()` transaction. Exact stored rows are compared before success.
- Hash-identical pending or incomplete rows are repairable on retry. Pending matches are excluded from all career aggregates.
- Persisted pre-deploy rooms without `matchStats.reportId` emit the existing v1 report shape; new matches with an ID emit v2.
- Invalid calendar timestamps return sanitizer errors without throwing.
- Every allowed fact/story key now has an exact schema, required fields, canonical output, standings references, and key-specific semantic bounds. Empty arrays remain valid; generic bags do not.

### Corrective RED Evidence

- Initial focused Auth RED: 13 passed, 6 failed. Failures covered per-key schemas, same-ID persistence, changed-payload conflict, batch rollback, and missing preflight.
- Initial Abracadawhat RED: old persisted room emitted `schemaVersion: 2` instead of v1.
- Invalid month timestamp reproduced the sanitizer throw path before the timestamp fix.
- Additional RED cycles covered canonical standings/spell-map ordering, pending career visibility, impossible player-count multi-kills, incomplete `complete` row repair, and report-relative round/stat bounds.

### Cloudflare D1 Basis

- `https://developers.cloudflare.com/d1/worker-api/d1-database/` states that `D1Database.batch()` executes statements as a SQL transaction and rolls back the entire sequence if a statement fails.
- `https://developers.cloudflare.com/d1/reference/migrations/` states that Wrangler migrations record applied files in `d1_migrations`.
- Local `npx wrangler d1 migrations list sekai-db --local` listed 001-005 as pending. Therefore the existing directly executed migration history is not claimed as tracked, and no synthetic baseline was inserted.

### Exact Corrective Local Migration Verification

Run from `auth/` against a new isolated local persistence directory:

```powershell
$persist = Join-Path $env:TEMP ('sekai-b1-review-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $persist | Out-Null; & node .\node_modules\wrangler\bin\wrangler.js d1 execute sekai-db --local --persist-to $persist --file=./tests/fixtures/pre-005-clean.sql; if ($LASTEXITCODE -eq 0) { & node .\scripts\preflight-005.mjs --local --persist-to $persist }; if ($LASTEXITCODE -eq 0) { & node .\node_modules\wrangler\bin\wrangler.js d1 execute sekai-db --local --persist-to $persist --file=./migrations/005_abracadawhat_match_v2.sql }; $code = $LASTEXITCODE; Remove-Item -LiteralPath $persist -Recurse -Force; exit $code
```

Exact output (the isolated temporary directory was deleted after the command):

```text

 ⛅️ wrangler 4.125.0 (update available 4.129.0)
───────────────────────────────────────────────
Resource location: local

Use --remote if you want to access the remote instance.

🌀 Executing on local database sekai-db (93010df2-58d0-4858-ac1c-f3e9f07343ac) from ./C:\Users\LAPISM~1\AppData\Local\Temp\sekai-b1-review-8a728dba31dc4488909025a453624848\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 5 commands executed successfully.
[
  {
    "results": [],
    "success": true,
    "meta": { "duration": 1 }
  },
  {
    "results": [],
    "success": true,
    "meta": { "duration": 0 }
  },
  {
    "results": [],
    "success": true,
    "meta": { "duration": 0 }
  },
  {
    "results": [],
    "success": true,
    "meta": { "duration": 0 }
  },
  {
    "results": [],
    "success": true,
    "meta": { "duration": 0 }
  }
]
PASS: no historical duplicate (match_id, player_id) rows found. Migration 005 may be reviewed for application.

 ⛅️ wrangler 4.125.0 (update available 4.129.0)
───────────────────────────────────────────────
Resource location: local

Use --remote if you want to access the remote instance.

🌀 Executing on local database sekai-db (93010df2-58d0-4858-ac1c-f3e9f07343ac) from ./C:\Users\LAPISM~1\AppData\Local\Temp\sekai-b1-review-8a728dba31dc4488909025a453624848\v3\d1:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
🚣 14 commands executed successfully.
[
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 1
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 1
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  },
  {
    "results": [],
    "success": true,
    "meta": {
      "duration": 0
    }
  }
]
```

### Final Corrective Verification

Run serially after the final production change:

1. Focused Auth B1: 26/26 passed.
2. Focused Abracadawhat Worker: 1/1 passed.
3. Auth full: 43/43 passed.
4. Abracadawhat build: passed; 101 modules transformed and emoji postbuild completed.
5. Abracadawhat full: 51/51 passed.

### Residual Concerns

- Match-row creation and the player batch cannot be one D1 binding transaction because the generated integer `matchId` must be looked up first. The explicit `pending` state is the boundary: pending rows are invisible to career queries and are repaired only by a hash-identical retry.
- Existing databases still need an explicitly reviewed Wrangler migration baseline before `d1 migrations apply` can be used safely. This corrective task does not write migration tracking rows.
- The preflight wrapper intentionally refuses `--remote`; the repository SQL is the approved read-only query for a separately authorized remote preflight.
