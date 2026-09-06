# Task C3 Report

## Status

Task C3 is implemented locally and committed without any remote database, deployment, Blog UI, or recent-report work. Migration 006 copies only the six approved provable aliases, and `GET /api/achievements` now returns the exact C3 `career` aggregate from complete matches.

## Migration 006

- Copies only `elemental -> magic_staircase`, `comeback -> weak_over_strong`, `double_kill -> pincer_finish`, `dragon_triple_one -> dragon_sweep`, `not_approved -> refuse_ending`, and `secret_rich -> secret_investor`.
- Uses six `INSERT OR IGNORE ... SELECT` statements, preserving `player_id`, `match_id`, and `unlocked_at`.
- Keeps every old key row for audit history.
- Does not copy `last_breath`, because its key is already canonical.
- Does not infer `spell_collector -> eight_facets` or backfill `one_breath`/`different_paths`.
- Contains no `DELETE`, `UPDATE`, `REPLACE`, `DROP`, or `ALTER` statement.
- Is idempotent: the isolated local D1 test executes 006 twice and finds one row per `(player_id, achievement_key)`.

## Career Contract

`GET /api/achievements` now includes exactly:

```js
career: {
  matchesCompleted,
  championships,
  roundWins,
  totalCasts,
  spellCounts,
  kills,
  dragonKills,
  deaths,
  suicides,
  favoriteSpellId,
  spellTypesUsed,
  maxTurnCastCount,
  roundWinsByReason,
}
```

- Every aggregate reads all historical `match_players` rows joined to matches with `report_status = 'complete'`.
- Pending rows are excluded from counts, sums, maxima, spell totals, favorite selection, and round-win reasons.
- `kills` sums `mp.kills` only. It never adds `dragon_kills`, because dragon kills are already a subset of kills.
- `dragonKills`, deaths, suicides, championships, match count, and round wins are summed independently.
- `maxTurnCastCount` is the maximum across rows, not a sum.
- `roundWinsByReason` always returns canonical `{ kill, all_spells }` totals.
- `favoriteSpellId` chooses the smaller numeric spell ID when totals tie and returns `null` for empty history.
- `spellTypesUsed` counts spell IDs with positive aggregate casts; persisted zero-count keys are ignored for both type count and favorite selection.
- Rows created before migration 005 work through the 005 defaults: new numeric fields contribute zero and `round_wins_by_reason` contributes `{}` while their original matches, casts, kills, deaths, suicides, and championships remain countable.

## B1 Governance And D4 Boundary

- Tests use a dedicated pre-005 fixture and isolated temporary `--persist-to` directory, then explicitly execute 005 and 006. They do not rely on Wrangler migration tracking.
- Existing databases remain unbaselined because historical 001-004 execution did not populate `d1_migrations`.
- `auth/migrations/README.md` keeps D4 explicit: confirm backup/recovery, run the 005 duplicate preflight read-only, establish and review the baseline, then explicitly apply 005, 006, and 007 to the approved target.
- No remote command was run in C3.

## TDD Evidence

- Migration RED: isolated setup reached the intentionally missing `006_legendary_achievement_aliases.sql` and failed because that file did not exist.
- Career RED: the achievements route returned `career: undefined` instead of the required empty aggregate.
- Migration GREEN: both migration tests passed after adding only the approved additive SQL.
- Career GREEN: the route test passed with two complete v2 rows, one v1-style complete row, one persisted zero-count spell key, and one high-value pending row. It proves exact fields, v1 defaults, pending exclusion, positive spell usage, maxima, canonical reasons, favorite tie-break, and no dragon-kill double count.

## Verification

```text
migration 006 focused: 2/2 passed
worker route focused: passed
Auth full suite: 63/63 passed
Auth production syntax check: passed
git diff --check: passed (line-ending warnings only)
```

The Auth rollback test intentionally logs `forced player failure`; it passes and continues to prove B1 pending-row safety.

## Concerns

- Production migration remains blocked on the explicit D4 backup, duplicate preflight, and migration-baseline review. C3 does not authorize `wrangler d1 migrations apply` on the existing unbaselined database.
- The career endpoint currently performs two complete-history queries per request: one scalar aggregate and one spell grouping query. This is correct for C3; performance should be measured before introducing summary tables or caches.
