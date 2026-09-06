<script setup>
import { nextTick } from 'vue'
import { useLobbyStore } from '../../src/stores/lobbyStore.js'
import { useGameStore } from '../../src/stores/gameStore.js'
import { wsClient } from '../../src/network/wsClient.js'
import { Msg } from '../../src/core/protocol.js'

const lobby = useLobbyStore()
const game = useGameStore()
let resolveIdentity

lobby.myPlayerId = 'host'
game.inRoom = true
game.roomId = 'A4TEST'
game.roomState = {
  phase: 'game_over',
  round: 3,
  hostId: 'host',
  currentPlayerId: null,
  targetScore: 8,
  players: [
    { id: 'host', nickname: '房主法师', score: 8, health: 3, alive: true, isHost: true },
    { id: 'guest', nickname: '客人法师', score: 5, health: 2, alive: true, isHost: false },
  ],
  castCounts: {},
  matchHistory: [],
  deckRemaining: 12,
  secretPileRemaining: 4,
  castSucceeded: {},
  castFailed: {},
}
game.lastGameOver = {
  standings: [
    { id: 'host', nickname: '房主法师', score: 8 },
    { id: 'guest', nickname: '客人法师', score: 5 },
  ],
}
game.gameOverOpen = true

window.__a4Sent = []
window.__a4Connections = []
window.fetch = () => new Promise(resolve => { resolveIdentity = resolve })
window.__a4ResolveIdentity = () => resolveIdentity?.({ ok: false })
wsClient.send = (type, payload) => {
  window.__a4Sent.push({ type, payload })
}
wsClient.connect = options => {
  window.__a4Connections.push(options.roomId)
}

window.__a4SetHost = async (isHost) => {
  game.roomState = { ...game.roomState, hostId: isHost ? 'host' : 'guest' }
  await nextTick()
}

window.__a4EmitLateRoomA = () => {
  wsClient._emit(Msg.RCV_GAME_OVER, {
    standings: [{ id: 'late', nickname: '旧房间迟到法师', score: 9 }],
  })
}

window.__a4EmitRoomB = () => {
  wsClient._emit(Msg.RCV_ROOM_STATE, {
    phase: 'waiting',
    round: 0,
    hostId: 'host',
    players: [{ id: 'host', nickname: '房间 B 法师', score: 0, health: 3, alive: true }],
  })
}

window.__a4RematchType = Msg.SEND_REMATCH
</script>

<template>
  <RouterView />
</template>
