# Task C3 Plan

## Goal

Implement migration 006 for only the six approved legacy achievement aliases and add the exact complete-match career aggregate to `GET /api/achievements`, while preserving B1 migration governance and v1 defaults.

## Scope

- Add isolated pre-005 -> 005 -> 006 migration fixture coverage, including a second 006 execution.
- Add the exact C3 career response from all complete `match_players` rows.
- Keep D4 remote baseline/migration procedure explicit; execute no remote command.
- Update `C3-report.md` and commit only C3 files.
- No Blog UI, recent reports, migration 007, or deployment.

## Phases

- [complete] Phase 1: Add migration and career contract tests; verify expected RED.
- [complete] Phase 2: Implement migration 006 and verify isolated migration GREEN.
- [complete] Phase 3: Implement career aggregate and verify focused GREEN.
- [complete] Phase 4: Run isolated local D1 sequence twice, Auth full suite, syntax/diff checks, review, report, and commit.
- [complete] Phase 5: Add reviewer regression tests for malformed JSON and canonical integer filtering; verify RED.
- [complete] Phase 6: Extract the route-used career module and implement safe SQL; verify focused GREEN.
- [complete] Phase 7: Run migration tests, Auth full suite, review/update report, and create a new corrective commit.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Wrangler emitted a Windows libuv assertion after correctly reporting the intentionally missing 006 RED file | 1 | Treat only the missing-file assertion as the expected RED; create 006 before invoking Wrangler again. |
| Shared fake D1 matched the new career `COUNT(*)` query as a comments-count query and returned the wrong row shape | 1 | Narrowed the legacy count stub to exclude `match_players`; production SQL was unchanged. |
| Final combined syntax command ran from repository root with `src/index.js` and resolved the wrong path | 1 | Re-run with explicit `auth/src/index.js`; do not treat the path error as a code failure. |
| Fake D1 spell grouping did not emulate the new production SQL positive/canonical filter | 1 | Aligned only the fake query result contract; the real isolated D1 route had already passed. |
| Pending-career source regression only inspected `index.js` after `computeCareer` extraction | 1 | Read both `index.js` and `career.js`, preserving the complete-only assertion across all production career queries. |
