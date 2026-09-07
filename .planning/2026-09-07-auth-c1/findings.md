# Task C1 Findings

- Approved plan: `docs/superpowers/plans/2026-09-06-abracadawhat-story-progression.md`, Task C1 lines 419-446.
- Approved product definitions: `docs/superpowers/specs/2026-09-06-abracadawhat-story-progression-design.md`, section 3.1.
- Current catalog has 27 definitions: 25 active and 2 legacy. C1 reuses `last_breath`, adds nine legendary keys, and marks the other 26 old keys legacy, producing 36 definitions with 10 active.
- No production definition is hidden in C1. Hidden masking must remain generic and will be tested with a temporary synthetic test-only definition.
- B1 retrieval filters achievement rows to `match_id IS NULL` or a joined match with `report_status = 'complete'`; C1 must retain that SQL.
- C1 does not implement C2 fact-driven checkers. Undefined active checkers must not emit unlocks; the retained `last_breath` checker may continue to work.
- Existing target/progress metadata may remain internal for legacy compatibility, but the API must not expose target/progress for legacy entries.
- Reviewer finding verified: `GET /api/achievements` constructs canonical `difficulty` plus `stars`, but `postMatch` spreads raw definitions and therefore omits `stars`; B5 renders `repeat(a.stars) || '🥚'`, so current active unlocks display the egg fallback.
- Reviewer finding verified: current API count fields derive from visible rows/unfiltered DB key count, so unlocked legacy/unknown keys can alter `total`/`unlockedCount` despite the intended active legendary meaning.
- Count decision: `total` and `unlockedCount` count `active` definitions only. Future `hidden` entries remain triggerable and visible under privacy rules but do not enter these active-legendary counts unless the contract is deliberately revised. `legacyUnlockedCount` separately counts known visible legacy unlocks. Unknown DB keys are ignored in all catalog counts and projections.
