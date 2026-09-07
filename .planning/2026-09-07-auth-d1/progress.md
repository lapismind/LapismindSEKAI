# Task D1 Progress

- 2026-09-07: Loaded project/user conventions, existing B1-C2 persistence, approved design/plan, migration policy, and current tests.
- 2026-09-07: Chose best-effort per-player report batches after achievements. Match/achievement success remains HTTP 200; `savedReports` is exact and retryable.
- 2026-09-07: Migration and real-D1 RED both failed at the absent migration 007, proving the schema feature is missing before implementation.
- 2026-09-07: First post-migration route RED exposed an invalid test story rather than missing storage; corrected the fixture without changing production validation.
- 2026-09-07: Focused GREEN covers exact registered-player storage, guest skip, retry, corruption repair, 11-match retention, another game, partial failure, and unlock recovery.
- 2026-09-07: Fresh Auth full passed 66/66; syntax, scoped diff, and production forbidden-field scans passed.
- 2026-09-07: Reviewer P2/P3 round: made unlocked_keys_json authoritative-derivation cache (RED on valid-JSON semantic corruption → GREEN), added real-D1 concurrent writes and equal-finished_at tie coverage, hardened startup gate to dynamic port + ~60s polling + early-exit detection.
- 2026-09-07: Real-D1 concurrency (two identical concurrent posts) proved stable against the isolated worker; tie-break keeps the 10 highest ids for identical finished_at.
