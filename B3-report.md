# Task B3 Report

## Status

Implemented the pure deterministic story selector in `abracadawhat/src/core/story.js`. No WebSocket, UI, database, Worker integration, or deployment changes are included.

## Contract

- The module exports only `STORY_TIERS` and `selectMatchStories`.
- Internal tiers are fixed as `S`, `A`, `B`, `C` and remain server-only. This task adds no visible stars or UI presentation.
- Selection is global at match level, ordered by tier, fixed story key order, `playerId`, round, then canonical data. No per-player quota was added because the approved spec does not require one.
- Same-family dedupe is scoped to `story key + playerId`, so different players retain independent candidates. The strongest valid evidence is kept deterministically.
- The hard maximum is three stories. A smaller non-negative integer limit is honored; larger limits are capped at three; low-value placeholders are never added.
- Output is rebuilt from whitelisted fields only as `{ key, playerId, tier, data }`. Arbitrary fact text and extra nested fields are discarded.
- Invalid, incomplete, malformed, and unknown facts are ignored without mutating the input or throwing.

## B2 To Auth Mapping

| B2 fact key | Auth story key | Tier |
|---|---|---|
| `comeback_win` | `comeback_win` | S |
| `dragon_multi_kill` | `dragon_multi_kill` | S |
| `low_hp_kill` | `low_hp_kill` | A |
| `turn_clear_streak` | `turn_clear_streak` | A |
| `survivor_secret_stack` | `secret_score` | B |
| `round_win_routes` | `round_win_routes` | B |
| `all_spell_types` | `all_spell_types` | C |
| `voluntary_stop` | `voluntary_stop` | C |

`secret_score` has no same-named B2 fact. It is mapped from the authoritative `survivor_secret_stack` evidence, with `secretPoints` equal to the proven `secretCount`, matching the existing Auth story schema.

## TDD Evidence

- Bootstrap RED: `story.js` did not exist.
- Behavioral RED after adding only the two required exports: 7 assertions failed for missing mappings, priority, stable tie-breaking, dedupe, limit handling, output whitelisting, and fresh copies.
- GREEN focused selector tests cover all supported mappings and negative cases, tier/key/player/round ordering, max three, fewer results, strongest same-family evidence, multiple players without quotas, input immutability, repeated deep equality, fresh output objects, permutation determinism, invalid facts, and arbitrary-text removal.
- The test suite passes every selected story through the real `auth/src/matchReports.js` v2 sanitizer.

## Verification

Commands are run serially where required:

```text
abracadawhat: node --test tests/story.test.mjs
abracadawhat: npm run build
abracadawhat: npm test
auth: node --test tests/match-reports.test.mjs
```

Final results:

- B3 focused: 11/11 passed.
- Abracadawhat production build and emoji postbuild: passed.
- Abracadawhat full: 88/88 passed.
- Auth sanitizer contract: 19/19 passed.
- `git diff --check`: passed.

## Concerns

- The selector cannot verify that referenced player IDs belong to a particular match because its approved interface accepts only `facts`, not standings. B3 validates player ID shape and rejects a low-HP self-target; the existing Auth sanitizer remains the match-membership boundary when stories enter a v2 report.
- Match-level priority can select several stories for one player. The approved specification defines no fairness quota, so B3 does not invent one. `playerId` is preserved for later per-player report filtering.
