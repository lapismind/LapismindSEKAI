# Findings

- Exact B5 source: `docs/superpowers/plans/2026-09-06-abracadawhat-story-progression.md` lines 384-413.
- Approved design source: `docs/superpowers/specs/2026-09-06-abracadawhat-story-progression-design.md` sections 3.3 and 5.
- Round authority is already in `roomState.summary`, with `winnerId`, `decisiveSpellId`, `reason`, standings, and per-player scoreBySource.
- Viewer-only `roomState.startingHand` is emitted only during round_end; all player hands and secrets are already revealed in PlayerZone.
- Match game_over currently carries only basic standings plus stories/reportId; full v2 standings exist in the report builder but are not broadcast yet. B5 will present optional key stats when supplied and remain safe for basic/legacy rows.
- Existing A4 uses compiled Vue SFC fixtures and validates dialog focus, persistent controls, route cleanup, and 44px actions.
