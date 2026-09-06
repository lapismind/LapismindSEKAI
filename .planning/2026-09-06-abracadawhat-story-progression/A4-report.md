# Task A4 Report

## Status

Complete. Task A4 was implemented with strict RED-GREEN TDD and committed locally. No push or deployment was performed.

## Commit

- SHA: `1f36a6a`
- Message: `fix(abracadawhat): keep score goal and rematch accessible`

## Changes

- Added `targetScore` to `PublicArea` with a default of 8 and passed the authoritative room-state value from `RoomView`.
- Added an always-visible score-goal strip showing `先到 N 分` and `还差 N 分` for every room player, including eliminated zero-score players.
- Added `gameOverOpen` so dismissing game-over details no longer destroys `lastGameOver`.
- Kept the post-game action bar visible while `lastGameOver` is retained: hosts can rematch, non-hosts see waiting text only, and everyone can return to the lobby.
- Kept rematch voting and later story/protocol work out of scope.
- Made the game-over close control and post-game action buttons at least 44px tall/wide where applicable, with visible keyboard focus styles.

## A2 Retry Safety

- `rematch()` still clears only `newAchievements`, `roundEndSummary`, and `roundScoreDeltas` before sending.
- A dropped/disconnected rematch send retains `lastGameOver` and the persistent host retry button.
- A rejected rematch retains `lastGameOver` and the persistent host retry button.
- Only confirmed `room_state { phase: 'playing', round: 1 }` clears `lastGameOver` and closes game-over detail state.

## TDD Evidence

Initial RED was observed before production changes:

- `node --test tests/game-store.test.mjs tests/ui-regressions.test.mjs`: 12 passed, 4 failed. Failures proved the missing `gameOverOpen` lifecycle, target-score UI, and persistent post-game action bar.
- The every-player target-strip edge case was separately returned to RED: `node --test tests/ui-regressions.test.mjs` passed 8 and failed 1 because `targetStandings` did not yet include every room player.

Focused GREEN:

- `node --test tests/game-store.test.mjs tests/ui-regressions.test.mjs`: 16/16 passed.
- `node --test tests/ui-regressions.test.mjs`: 9/9 passed after the every-player correction.

## Required Verification

Run serially in the requested order:

1. Focused Store/UI tests: 16/16 passed.
2. `npm run build`: passed; Vite transformed 101 modules and postbuild copied enabled emoji assets.
3. `npm test`: 40/40 passed, including A2 dropped/rejected rematch and confirmed round-1 clearing tests.
4. Python Playwright through the test-only Vite harness: passed at 390x844 with no page errors.

The browser test verified:

- Visible target score and both players' points remaining.
- Game-over detail can be closed independently.
- Host post-game action bar remains visible after closing detail.
- Clicking host `再来一局` sends the existing `rematch` message with `{}` through `wsClient.send`.
- The retained action bar remains available after the send, preserving retry access.
- A non-host has no executable rematch button, sees only waiting text, and retains `返回大厅`.
- No voting UI is rendered.
- Close, rematch, and return controls meet the 44px touch-target requirement.

## Commit Scope

The commit contains only these A4 implementation/test files:

- `abracadawhat/src/components/PublicArea.vue`
- `abracadawhat/src/stores/gameStore.js`
- `abracadawhat/src/views/RoomView.vue`
- `abracadawhat/tests/game-store.test.mjs`
- `abracadawhat/tests/ui-regressions.test.mjs`
- `abracadawhat/tests/a4-post-game-browser.py`
- `abracadawhat/tests/fixtures/A4Harness.vue`
- `abracadawhat/tests/fixtures/a4-harness.html`
- `abracadawhat/tests/fixtures/a4-harness.js`

Pre-existing planning-file changes and `.superpowers/` remain outside the commit. This report was intentionally created after the A4 commit so it can include the final SHA and remains uncommitted.

## Concerns

- `lastGameOver` remains in client memory until confirmed round 1 or room teardown. This is intentional and required for retry safety, not persistence across page reloads.
- The Playwright harness replaces `wsClient.send` only inside the test page. It exercises the production `RoomView` and production store action without requiring a live Worker, but it does not test server acceptance of rematch; existing Worker tests cover protocol behavior.
- No story UI, schema/protocol changes, rematch voting, push, or deployment were included.

## Reviewer Follow-up

All reported A4 Medium findings and related Low dialog/harness findings were addressed in a new follow-up commit; the original `1f36a6a` commit was not amended.

### Correctness Fixes

- Added explicit `leaveRoom()` teardown. It unregisters room handlers, disconnects transport, and clears `roomId`, `roomState`, game-over data/display state, achievements, cast/report/round transients, hand/secrets, chat, errors, and action locks.
- `connect()` invokes destructive teardown only when the requested room differs from the retained room id. Existing same-room identity/transport reconnect behavior continues to use `disconnect()` and retains retry-capable match state.
- Returning to the lobby now uses `leaveRoom()`, so delayed room-A messages cannot recreate stale game-over UI or a stale rematch path before room-B entry.
- The closed post-game action bar now provides a `查看结算详情` button with a 44px minimum touch target.
- Reopening restores the retained game-over details without changing `lastGameOver`.
- The game-over detail now has `role="dialog"`, `aria-modal="true"`, a labelled heading, initial close-button focus, Escape close, Tab/Shift+Tab containment, and focus restoration to the reopen trigger or post-game action bar.
- Replaced the harness's runtime inline-template lobby route with compiled `A4LobbyHarness.vue` and a real hash-router navigation flow.

### Follow-up TDD Evidence

RED was observed before the production fixes:

- Focused Store/UI run: 22 tests, 16 passed and 6 failed. The failures proved missing teardown, cross-room reset, reopen API/UI, dialog keyboard/focus semantics, and RoomView teardown usage.
- Compiled-SFC harness regression: 12 tests, 11 passed and 1 failed because the lobby route still used an inline template.
- Initial browser RED failed because an initially open dialog did not receive focus.
- A subsequent browser RED exposed focus restoration racing the conditionally rendered reopen button.

Final serial GREEN verification:

1. `node --test tests/game-store.test.mjs tests/ui-regressions.test.mjs`: 23/23 passed.
2. `npm run build`: passed; Vite transformed 101 modules and postbuild copied enabled emoji assets.
3. `npm test`: 47/47 passed, including all A2 dropped/rejected retry and confirmed round-1 clearing tests.
4. Python Playwright at 390x844: passed with no page errors.

The final browser flow verified initial dialog focus, focus containment, Escape close, reopen and focus restoration, host rematch send, actual return-to-lobby navigation, teardown, delayed room-A event suppression, room-B re-entry, no stale post-game UI, and no stale rematch send.

### Follow-up Scope And Concerns

- Teardown is intentionally destructive only for leaving or switching rooms. Plain `disconnect()` remains non-destructive so same-room reconnects preserve A2 retry safety.
- The browser harness still intercepts outbound `wsClient.send`, but it now exercises actual router navigation and production teardown/re-entry behavior. Worker protocol acceptance remains covered by the existing Worker suite.
- No voting, story UI, later protocol/schema work, push, or deployment was added.

## Reviewer Follow-up 2

The remaining A4 Medium findings were addressed in another new commit. Neither `1f36a6a` nor `3c8881f` was amended.

### Connection And Route-Lifecycle Fixes

- `RoomView` route unmount is now the single destructive cleanup owner. Any route exit, including the explicit return action, browser Back, or external router navigation, reaches `onUnmounted()` and calls `leaveRoom()` exactly once.
- The explicit return action now only navigates. It no longer tears down before unmount, avoiding duplicate cleanup.
- Identity-driven reconnect while the same `RoomView` remains mounted still uses non-destructive `disconnect()` followed by `connect()`, preserving `lastGameOver` and the A2 rematch retry path.
- Added monotonically increasing `connectGeneration`. Every connect request obtains a new generation; every `leaveRoom()` invalidates pending generations.
- After identity fetch success or failure, a connect continuation must still own the current generation before writing the identity token, setting `roomId`/`inRoom`, or calling `wsClient.connect()`.
- Overlapping room-A/room-B connects are last-request-wins even when identity responses resolve out of order. A stale rejected request is also ignored.

### Follow-up 2 TDD Evidence

RED was observed before production changes:

- Focused Store/UI run: 27 tests, 22 passed and 5 failed. The failures proved pending connect-after-leave, out-of-order overlapping connects, stale fetch rejection, non-destructive route unmount, and missing generation protection.
- The route cleanup ownership refinement was returned to RED: 13 UI tests, 12 passed and 1 failed because `goToLobby()` still called `leaveRoom()` before unmount.
- Browser Back coverage initially stopped on the intentionally missing compiled-harness resolver (`window.__a4ResolveIdentity`); after adding the minimal harness control, the production Back/unmount assertions ran.

Final serial verification is recorded below after the final code state.

### Follow-up 2 Final Verification

Run serially after the final ownership and generation changes:

1. `node --test tests/game-store.test.mjs tests/ui-regressions.test.mjs`: 27/27 passed.
2. `npm run build`: passed; Vite transformed 101 modules and postbuild copied enabled emoji assets.
3. `npm test`: 51/51 passed, including A2 dropped/rejected rematch, confirmed round-1 clearing, same-room reconnect preservation, delayed connect invalidation, and out-of-order last-request-wins tests.
4. Python Playwright at 390x844: passed with no page errors.

The browser test additionally verified that browser Back unmounts `RoomView`, returns to the compiled lobby route, invalidates a still-pending identity request, and prevents the delayed continuation from opening a socket, restoring stale post-game UI, or sending a stale rematch.

### Follow-up 2 Concerns

- Generation invalidation prevents stale continuations from committing state or opening sockets, but it does not cancel network transfer itself. The identity request may still finish in the background; its result is ignored. This satisfies the requested generation-token option without introducing AbortController compatibility concerns.
- `RoomView` unmount is the destructive cleanup boundary. Same-room identity reconnect remains non-destructive only while the same component stays mounted.
- No later tasks, protocol/schema changes, voting, push, or deployment were included.
