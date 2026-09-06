# Findings

- Current trap selector only includes buttons, links, and tabindex nodes; native `summary` controls are omitted.
- Current open dialog has disclosures but no rematch/return actions. The persistent bar remains behind the modal, creating duplicate action names once dialog actions are added unless gated while open.
- `game.rematch()` clears transient report state but intentionally retains `lastGameOver` and `gameOverOpen` until a new round is confirmed, which supports retry without closing the dialog.
- `STARS_BY_TIER` is an ordinary object and `storyStars` indexes it directly, so inherited keys such as `toString` do not return null.
