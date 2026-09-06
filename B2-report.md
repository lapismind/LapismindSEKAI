# Task B2 Report

## Status

Implemented Task B2 against the exact Auth v2 schemas in `auth/src/matchReports.js` at `bbf82dc`. No stories were selected and nothing was deployed.

## Producer Contract

- `finishRound()` keeps `gained` and adds exact `scoreBySource` keys: `roundWinPoints`, `survivalPoints`, `secretPoints`.
- `finishRound()` adds `decisiveSpellId` for `kill`, `all_spells`, and `self_destruct`.
- `beginRound()` snapshots each player's starting hand. `publicState()` exposes only the viewer's own snapshot and only during `round_end`.
- `buildMatchReport()` never includes `startingHand` or `startingHands`.
- Match standings accumulate authoritative `roundWins`, `roundWinsByReason`, `maxTurnCastCount`, and `maxTurnDistinctSpells`.
- Cumulative score sources are updated from each round summary and reconcile exactly to final player score.

## Fact Semantics

The producer emits only Auth-approved fixed facts with exact data shapes:

- `turn_distinct_spells`: a completed action with at least three distinct successful spell IDs.
- `turn_clear_streak`: at least four successful casts in the terminal action that ended the round via `all_spells`.
- `all_spell_types`: all spell IDs 1 through 8 were successfully cast in the match.
- `round_win_low_hp`: the round winner had exactly 1 HP at round completion.
- `low_hp_kill`: the actor had exactly 1 HP immediately before the decisive cast, and the target's HP is captured before damage.
- `multi_kill_non_dragon`: one non-dragon cast killed at least two distinct alive targets.
- `dragon_multi_kill`: one dragon cast killed at least three distinct alive targets.
- `comeback_win`: an authoritative prior round score snapshot had the champion at at most 3 and an opponent at at least 7, and the champion's final score strictly exceeded that prior opponent score.
- `survivor_secret_stack`: every alive end-round player with at least three secrets is recorded, not only the winner.
- `round_win_routes`: the player has at least one `kill` win and one `all_spells` win.
- `voluntary_stop`: `doEndTurn()` succeeds after at least two successful casts in that action, and no failed cast forced the player to end. Terminal casts and post-failure end-turns do not qualify.

Distinct target IDs and pre-cast alive state are used for kill/death accounting, preventing duplicate kill/death facts when an effect references the same target more than once.

## TDD Evidence

RED was observed before producer changes for missing score decomposition, decisive spell, starting-hand snapshots, counters, facts, and producer-consumer acceptance. Additional RED cycles covered lazy upgrade of persisted B1 state, missing turn maxima defaults, and rejection of sanitizer-invalid tied comeback data.

Final verification commands:

```text
abracadawhat: node --test tests/rules.test.mjs tests/match-facts.test.mjs
abracadawhat: npm run build
abracadawhat: npm test
auth: node --test tests/match-reports.test.mjs
auth: npm test
```

Final results:

- Abracadawhat focused: 31/31 passed.
- Abracadawhat production build and emoji postbuild: passed.
- Abracadawhat full: 64/64 passed.
- Auth sanitizer focused: 19/19 passed.
- Auth full, including isolated real D1 integration: 47/47 passed.

The Auth full suite intentionally logs `forced player failure` while testing transaction rollback; the test itself passes.

## Concerns

- In-progress rooms persisted before B2 have lazy defaults for current-round accounting, but their earlier rounds cannot be reconstructed. They therefore retain the existing v1 report fallback instead of emitting a v2 report with an unverifiable score breakdown. New matches initialized by B2 reconcile exactly.
- Facts are capped at the Auth limit of 100. Exact duplicate facts are suppressed, while distinct rounds/data remain available until the cap.

## Reviewer Fix Pass

The B2 High/Medium review findings were fixed with new RED/GREEN coverage. No B3 story selection was implemented.

- `doEndTurn()` now finalizes the actor's action facts and advances that player's `currentTurnIndex` before persisting state. Reloading the exact stored state therefore starts the next action in a fresh bucket while successful chained casts remain in the current bucket.
- `beginRound()` establishes each player's next unused action index from persisted action buckets, so terminal actions from separate rounds cannot merge.
- Terminal `self_destruct` actions now capture maxima and `turn_distinct_spells` from successful casts completed before the fatal miss. The failed declaration does not count as a successful cast and never creates `voluntary_stop`.
- `comeback_win` now uses the same canonical capped insertion path as every other fact. Fact retention is deterministic by fixed priority, then canonical key/player/data order. At the 100-fact boundary, high-value comeback evidence displaces lower-priority survivor/voluntary facts rather than making the Auth payload invalid. This is fact retention only, not story selection.
- Producer-consumer lifecycle tests now reload exact persisted state after `doEndTurn()`, cross real `beginRound()` boundaries, cover terminal self-destruction sequences, and sanitize capped reports produced by `buildMatchReport()`.

Strict TDD evidence:

- RED: 4 intended behavior failures after correcting one invalid self-destruct fixture: persisted action index remained `0`, two real rounds merged into bucket `0`, fatal misses left maxima at `0`, and capped comeback reports contained 101 facts.
- GREEN focused: `node --test tests/rules.test.mjs tests/match-facts.test.mjs` passed 36/36.

Final serial verification:

- Abracadawhat production build and emoji postbuild: passed.
- Abracadawhat full: 69/69 passed.
- Auth sanitizer focused: 19/19 passed.
- Auth full, including isolated real D1 integration: 47/47 passed.
- Auth full still intentionally logs `forced player failure` while proving transaction rollback; the test passes.

Remaining concern:

- Pre-B2 in-progress rooms still use the documented v1 report fallback because facts and score sources from their earlier rounds cannot be reconstructed authoritatively.

## Final Reviewer Fix Pass

The remaining B2 findings were fixed without implementing B3 story selection.

- Bounded fact retention now first keeps the strongest representative for every `key + playerId` group present, preserving each player's achievement/story evidence. Remaining slots are filled from the same fixed-priority, stable ordering up to the Auth limit of 100.
- Repeated facts use key-specific strength comparisons before canonical JSON tie-breaking: distinct spell/cast counts, clear streak length, target HP, kill count, comeback deficit/recovery, secret count, route count, and voluntary-stop cast/distinct counts. The same candidate set produces the same retained facts regardless of insertion order.
- Pressure tests prove that 100 `turn_distinct_spells` facts cannot erase the only `survivor_secret_stack`, 100 `low_hp_kill` facts cannot erase `all_spell_types`, and all 11 supported fact keys remain represented for each tested player.
- The pressured producer report remains at most 100 facts, contains all supported keys, and passes the exact Auth v2 sanitizer.
- `startNextRound()` now persists `comeback_win` into authoritative `state.matchStats.facts` before report construction and the final `game_over` state save. Future story consumption can therefore read the same persisted evidence without B2 selecting stories.
- `buildMatchReport()` remains pure and idempotent. Its legacy v1 comeback flag is computed in the returned object instead of mutating match stats, and repeated v2 builds neither add duplicate comeback facts nor alter state.

Strict TDD evidence:

- RED: survivor and all-spell evidence were evicted by fact floods; all-key/player pressure lost lower-priority groups; permutation/strongest-representative expectations failed; actual `startNextRound()` persistence contained no comeback fact.
- Additional purity RED: `buildMatchReport()` mutated the legacy `comebackFromBehind` field while reading snapshots.
- GREEN focused: `node --test tests/rules.test.mjs tests/match-facts.test.mjs` passed 42/42.

Final serial verification:

- Abracadawhat production build and emoji postbuild: passed.
- Abracadawhat full: 75/75 passed.
- Auth sanitizer focused: 19/19 passed.
- Auth full, including isolated real D1 integration: 47/47 passed.
- Auth full intentionally logged `forced player failure` while proving transaction rollback; the test passed.

Remaining concern:

- Pre-B2 in-progress rooms continue to use the documented v1 report fallback because their earlier-round facts and score sources cannot be reconstructed authoritatively.
