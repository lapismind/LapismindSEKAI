# Task C1 Plan

## Goal

Implement approved Task C1 only: reshape the Auth achievement catalog to exactly ten active legendary achievements, preserve all prior definitions as legacy metadata, and enforce active/legacy/hidden API projection without implementing C2 checkers, UI, migrations, or D1 deletion.

## Scope

- Modify only `auth/src/achievements.js`, `auth/src/index.js`, `auth/tests/achievements.test.mjs`, and `auth/tests/worker.test.mjs` for product/test code.
- Preserve B1 pending-match isolation.
- Keep `stars === difficulty` as the sole one-release API alias.
- Commit only C1 files.

## Phases

- [complete] Phase 1: Add catalog/evaluator/API contract tests and verify focused RED.
- [complete] Phase 2: Implement the minimal catalog and API projection changes.
- [complete] Phase 3: Run focused GREEN, full Auth verification, diff review, and C1-only commit.
- [complete] Phase 4: Add reviewer regression tests for shared projection and stable counts; verify RED.
- [complete] Phase 5: Centralize projection and correct count semantics without C2 logic.
- [complete] Phase 6: Run Auth and affected Abracadawhat verification, append C1 report, and create a new fix commit.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Added `await computeCareer()` inside synchronous `flatMap()` projection | 1 | Removed target/progress projection because C1 has no active cumulative achievements; retained career logic for match reporting. |
