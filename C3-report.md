# Task C3 Report

## Status

The original Task C3 implementation was committed as `3214e43` without any remote database, deployment, Blog UI, or recent-report work. Migration 006 copies only the six approved provable aliases, and `GET /api/achievements` returns the exact C3 `career` aggregate from complete matches.

Reviewer High/Medium fixes after the original C3 commit harden the production aggregate against malformed historical JSON, restrict spell/reason inputs to the canonical contract, and add a real isolated D1 route integration test.

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
- Malformed or null JSON is replaced with a safe `'{}'` inside production SQL before `json_each`, `json_type`, or `json_extract` is evaluated, so one corrupt historical row cannot fail the endpoint.
- Only canonical JSON keys `'1'` through `'8'` with positive integer values enter `spellCounts`, favorite selection, and `spellTypesUsed`. Aliases, unknown keys, strings, fractions, zeroes, and negatives are ignored.
- Round reasons accept only nonnegative JSON integers at canonical `kill` and `all_spells` keys. Malformed JSON, missing keys, negative values, fractions, strings, and unrelated keys contribute zero.
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
- Initial career GREEN: the fake route test passed with two complete v2 rows, one v1-style complete row, one persisted zero-count spell key, and one high-value pending row.
- Reviewer RED: a real isolated D1 invocation of the production Auth route returned HTTP 500 when one complete historical row contained malformed `spells_cast` and `round_wins_by_reason` JSON.
- Reviewer GREEN: the same production route returned HTTP 200 and the exact career object after SQL hardening. Its isolated database contains migrated pre-005 valid and null rows, a canonical v2 row, a pending row, malformed JSON, aliases, unknown spell/reason keys, zeroes, negatives, fractions, and numeric strings.
- `computeCareer` now lives in exported internal module `auth/src/career.js`; the route imports that exact function, so integration coverage cannot drift to duplicated test SQL or JavaScript aggregation.

## Verification

```text
migration 005/006 focused: 5/5 passed
real D1 career route + worker focused: 2/2 passed
Auth full suite: 64/64 passed
Auth production syntax checks: passed
git diff --check: passed (line-ending warnings only)
```

The Auth rollback test intentionally logs `forced player failure`; it passes and continues to prove B1 pending-row safety.

## Concerns

- Production migration remains blocked on the explicit D4 backup, duplicate preflight, and migration-baseline review. C3 does not authorize `wrangler d1 migrations apply` on the existing unbaselined database.
- The career endpoint currently performs two complete-history queries per request: one scalar aggregate and one spell grouping query. This is correct for C3; performance should be measured before introducing summary tables or caches.
- The older v1 match-submission achievement lookup remains a separate compatibility path in `index.js`; this reviewer fix changes only the public C3 career aggregate requested for `GET /api/achievements`.
