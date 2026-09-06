# Task C1 Report

## Status

Task C1 and its reviewer fixes are implemented. Auth now exposes one stable achievement response shape to both the catalog route and match-result producer, while active legendary counts remain independent of legacy, hidden, pending, and stale database rows.

## Delivered Contract

- The catalog contains exactly 10 `active` legendary definitions. Existing superseded definitions retain their metadata as `legacy`; the current catalog defines no hidden achievements.
- External achievement projection is centralized in `projectAchievement()`.
- Revealed achievements use canonical `difficulty` and the one-release `stars` alias with `stars === difficulty`.
- Projection includes `status`; revealed legacy entries also include `legacy: true`.
- Locked hidden entries expose only `{ key, status: 'hidden', unlocked: false, name: '？？？', desc: '？？？' }`.
- `GET /api/achievements` returns all active definitions, only unlocked known legacy definitions, and privacy-masked hidden definitions.
- `postMatch` new unlocks use the same projector, so the existing B5 UI receives numeric `stars` and does not fall back to the egg marker.
- `total` is the number of active legendary definitions and is exactly 10.
- `unlockedCount` is the number of known active legendary definitions unlocked through visible complete/null-match rows.
- `legacyUnlockedCount` separately counts known unlocked legacy definitions.
- Future hidden definitions remain triggerable and privacy-projected, but do not count toward active legendary `total` or `unlockedCount` under the C1 contract.
- Unknown stale database keys do not appear in the response and do not affect any count.
- Achievements linked to pending matches remain excluded by the B1 query. A pending active row remains locked; a pending legacy row remains absent.

## Scope Boundaries

- No C2 fact-driven checker logic was added.
- No game UI or production game code changed.
- No migration, schema change, D1 row deletion, or legacy backfill was added.
- Nine new legendary checkers remain intentionally unimplemented until C2; the retained `last_breath` checker is still the only active checker currently exercised by v1 reports.

## TDD Evidence

- Reviewer RED failed in the Auth route suite because `legacyUnlockedCount` was absent and old count semantics used raw unlocked/visible rows.
- The new Auth producer route test proves a real `last_breath` unlock returns canonical `difficulty`, equal `stars`, `status`, name, description, game, and player ID.
- A shared producer-consumer fixture is imported by both Auth and Abracadawhat tests, proving the exact produced achievement object survives the game report bridge unchanged.
- Route tests cover complete active, pending active, complete legacy, pending legacy, unknown stale, locked hidden, and unlocked hidden rows without leaking hidden metadata.

## Verification

```text
focused Auth + Abracadawhat bridge: 18/18 passed
Auth full suite: 37/37 passed, including real isolated local D1 integration
Abracadawhat production build and emoji postbuild: passed
Abracadawhat full suite: 120/120 passed
production syntax checks and git diff check: passed
```

## Concerns

- The `stars` alias is intentionally temporary for one release and should be removed only in a separately approved compatibility task after consumers move to `difficulty`.
- Hidden achievements are excluded from active counts by explicit C1 policy. Adding hidden achievements later must preserve that policy or deliberately version the count contract.
- V2 match persistence still returns an empty achievement list by the approved B1/C1 boundary; C2 owns fact-driven evaluation and unlocks.
