# Task C3 Findings

- Approved C3 contract is in `docs/superpowers/plans/2026-09-06-abracadawhat-story-progression.md` lines 474-531.
- Existing databases are unbaselined in Wrangler migration tracking; C3 must use direct isolated local fixture execution and must not run remote or `migrations apply`.
- Migration 005 gives old v1 rows defaults for every C3 field added after v1: zero numeric values and `'{}'` for `round_wins_by_reason`.
- Public career reads must join `matches` and filter `report_status = 'complete'`; pending rows must not affect sums, maxima, spell favorites, or reason totals.
- `kills` already includes `dragon_kills`; the public total must sum only `kills`.
- Existing internal `computeCareer()` has a legacy evaluator shape and should remain compatible with v1 match evaluation.
- Reviewer root cause: public career SQL invokes `json_each` and `json_extract` on raw historical columns. SQLite rejects malformed JSON before JavaScript can sanitize results, causing the route to return 500.
- The spell grouping has no SQL-level canonical key/type filter. JSON aliases, unknown keys, strings, fractions, negatives, and zero rows can enter the response or affect favorite/type calculations.
- A real route integration can use the production `auth/src/index.js` under isolated Wrangler D1, a signed guest-style session token, and a dynamically reserved localhost port; no remote or duplicate SQL implementation is needed.
