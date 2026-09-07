# Task D1 Findings

- The approved D1 contract is in `docs/superpowers/plans/2026-09-06-abracadawhat-story-progression.md` lines 567-623.
- Migration 007 has an exact approved table and recent-order index shape.
- Existing B1-C2 flow verifies the match complete, then inserts achievements, then currently returns `savedReports: []`.
- The approved design says Auth/report save failure must not block settlement or rematch; therefore personal-report persistence is a best-effort post-step, not part of the complete-match/player transaction.
- `savedReports` is an array of successfully persisted registered `playerId` values; guests are absent.
- Recent-report data is intentionally minimized to own rank/score, match metadata, a full final standings nickname snapshot, own stories, and keys first unlocked by that match.
- Existing unrelated planning and lesson files are dirty/untracked and must not be staged or modified for D1.
- Reviewer P2/P3: `unlocked_keys_json` is a cache. Authoritative source is `achievements` rows for the same `(match_id, player_id)`; retries recompute it as known keys, deduplicated, deterministically sorted, and always overwrite the stored JSON. This repairs valid-JSON semantic corruption while preserving first-save keys (the achievements rows persist even when the retry's own `newAchievements` is empty).
- Equal `finished_at` retention tie is resolved by the index `(player_id, game, finished_at DESC, id DESC)`: keep the 10 highest ids.
- Real isolated D1 concurrency (identical concurrent posts) is stable on this worker; the fixture registers p2 earlier so post-registration concurrent savedReports are `['p1','p2']`.
