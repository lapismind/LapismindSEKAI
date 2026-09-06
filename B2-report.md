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
