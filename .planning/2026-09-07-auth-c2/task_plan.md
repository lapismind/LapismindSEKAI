# Task C2 Plan

## Goal

Implement the approved C2 contract: exactly ten active legendary achievement checkers driven by sanitized v2 facts/standings, retain safe v1 fallback, and minimally wire v2 match persistence to return newly inserted achievements idempotently after completion.

## Scope

- Modify Auth achievement evaluator tests and implementation.
- Modify Auth v2 persistence/API tests and minimal persistence wiring if required for real unlocks.
- Update `C2-report.md` and commit only C2 scope.
- No migration C3, career profile, recent reports, UI, or Abracadawhat production changes.

## Phases

- [complete] Phase 1: Add evaluator contract tests and verify focused RED.
- [complete] Phase 2: Implement minimal v2/v1 evaluator and verify focused GREEN.
- [complete] Phase 3: Add v2 persistence retry/pending tests and verify RED.
- [complete] Phase 4: Implement minimal v2 achievement writes and shared projection.
- [complete] Phase 5: Run Auth full including D1, affected Abracadawhat verification, self-review, report, and commit.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Persistence fixture expected only `last_breath`, but its base standing already met `different_paths` | 1 | Kept production semantics and corrected the assertion to the exact two unlocks. |
| Full Auth real-D1 fixture had no pre-existing `achievements` table | 1 | Added the historical table to the pre-005 clean fixture; no migration was added. |
| B1 worker test still required zero v2 achievement attempts | 1 | Updated it to the C2 contract: active checker attempts occur after completion and retries rely on `INSERT OR IGNORE`. |
