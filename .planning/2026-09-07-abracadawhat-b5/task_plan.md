# Abracadawhat B5

## Goal

Implement approved Task B5 only: fixed story presentation, authoritative round recap, match recap, legacy-safe rendering, and deterministic desktop/mobile browser coverage.

## Phases

- [complete] 1. Confirm B5 contracts and existing A4 patterns
- [complete] 2. RED pure presentation and UI regression tests
- [complete] 3. GREEN presentation and recap UI
- [complete] 4. RED/GREEN deterministic compiled SFC Playwright fixture
- [complete] 5. Serial build, full tests, Playwright, review, report, commit

## Constraints

- Strict TDD: no production implementation before expected failing tests.
- Visible text, DOM text, title, aria-label, and accessibility attributes must not expose standalone internal story tiers.
- Story stars are exactly four, three, two, or one visible stars.
- Do not implement Stage C achievement catalog or Stage D reports.
- Preserve A4 dialog semantics, focus handling, and persistent post-game controls.
- Support legacy game_over payloads without stories or reportId.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| Playwright exact achievement-title lookup failed because stars/title share one rendered text node | 1 | Target highlighted achievement card containers and collapsed details visibility instead of assuming interpolation-level nodes. |
| Collapsed achievement substring matched both title and description | 2 | Assert the details element lacks `open` and its content container is hidden. |
| Initial self-destruct fixture used `suicide` instead of rules-engine `self_destruct` | 3 | Corrected fixture to the authoritative enum, observed expected browser RED, then mapped the real value. |
