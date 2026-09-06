# Task C2 Report

## Status

Task C2 is implemented against the current B2 producer facts, Auth v2 sanitizer, and C1 ten-key catalog. The minimal Auth v2 persistence bridge now evaluates and inserts new active achievements after the match is verified complete.

## Evaluator Contract

- `evaluateAchievements(report, careerLookup?)` supports sanitized v2 `standings`/`facts` and the existing sanitized v1 `players` fallback.
- Exactly the 10 C1 active keys have v2 and v1 checker entries. Definitions marked `legacy` are never traversed, so cumulative and retired keys cannot unlock.
- V2 fact checks filter by the exact `playerId` being evaluated and then validate the key-specific data semantics.
- `magic_staircase` uses `turn_distinct_spells` with at least three distinct spell IDs.
- `one_breath` uses `turn_clear_streak` with `successCount >= 4` and exact reason `all_spells`.
- `eight_facets` reads the same-match standing `spellCounts` and requires every spell ID 1 through 8.
- `last_breath`, `weak_over_strong`, `pincer_finish`, `dragon_sweep`, `refuse_ending`, and `secret_investor` use their corresponding B2 facts.
- `secret_investor` requires `survivor_secret_stack`; secret points or old winner-only fields do not substitute for survivor evidence.
- `different_paths` reads exact standing counts `roundWinsByReason.kill >= 1` and `roundWinsByReason.all_spells >= 1`.
- V1 fallback unlocks only active conditions its sanitized legacy player fields can prove. It does not guess unavailable streak/survivor/route facts and does not call `careerLookup`.
- `dragon_clown`, `egg_social_death`, and every other legacy/cumulative key remain non-triggerable.
- Per-check exception isolation remains in place, so one broken checker does not stop the remaining checks for that player.

## Persistence Integration

- V2 persistence evaluates only after match rows are reloaded and verified `complete` with the exact canonical player projection.
- New unlock rows use the existing `UNIQUE(player_id, achievement_key)` contract through `INSERT OR IGNORE`.
- The response uses C1's centralized `projectAchievement()` shape.
- An identical retry returns the same match ID and no new unlocks.
- A player-write failure leaves the match pending, rolls back all player rows, and writes no achievements.
- No recent-report persistence, C3 migration, career profile, UI, or Abracadawhat production code was added.

## TDD Evidence

- Evaluator RED: 23 failures showed the old implementation required `players` and mandatory career lookup and had no v2 dispatch.
- Evaluator GREEN: 20 independent active-key cases cover one exact success and one boundary false case for each of the 10 keys.
- Additional evaluator tests cover fact/player ownership, exception isolation, v1 fallback, no career query, legacy suppression, and permanent non-triggering of `dragon_clown`/`egg_social_death`.
- Persistence RED: the v2 endpoint returned an empty achievement array for a qualifying complete report.
- Persistence GREEN: the first complete write returns canonical unlocks, the duplicate retry returns none, and pending rollback writes none.

## Verification

```text
Auth focused evaluator + persistence: 37/37 passed
Auth full including isolated real D1: 61/61 passed
Auth production syntax checks: passed
Abracadawhat production build and emoji postbuild: passed
Abracadawhat full suite: 120/120 passed
git diff --check: passed
```

The Auth rollback test intentionally logs `forced player failure`; the test passes and verifies pending safety.

## Concerns

- V1 cannot prove `one_breath`, survivor-only `secret_investor`, or `different_paths`; those keys intentionally require v2 evidence rather than legacy inference.
- Achievement insertion is a separate post-completion batch. A transient failure there leaves the match complete and a same-payload retry safely re-evaluates and inserts any still-missing unlocks.
