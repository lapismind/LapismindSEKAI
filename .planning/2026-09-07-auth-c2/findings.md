# Task C2 Findings

- Approved C2 plan is `docs/superpowers/plans/2026-09-06-abracadawhat-story-progression.md` lines 448-472.
- Sanitized v2 input uses `standings`, `facts`, and `stories`; facts are already schema-validated and sorted.
- C1 catalog has exactly ten active keys; every other historical checker key is `legacy` and must not run.
- Current v2 persistence returns an empty achievement list, so evaluator-only work would not unlock achievements in the real pipeline.
- Achievement rows have `UNIQUE(player_id, achievement_key)`, enabling retry idempotency through `INSERT OR IGNORE`.
- Pending matches are excluded from public achievement queries; C2 writes must happen only after v2 persistence verifies the match is complete.
- V2 evaluation needs no D1/career lookup. V1 fallback may call the existing lookup but only active checkers can emit.
