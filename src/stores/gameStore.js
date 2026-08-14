/**
 * stores/gameStore.js —— 房间状态管理。
 * 只读渲染服务端状态，操作一律发指令给服务端仲裁。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { wsClient } from '../network/wsClient'
import { Msg } from '../core/protocol'
import { useLobbyStore } from './lobbyStore'

export const useGameStore = defineStore('game', () => {
  const inRoom = ref(false)
  const roomId = ref(null)
  const phase = ref('waiting')
  const roomState = ref(null) // 公开状态（room_state）
  const myHand = ref([]) // 我的完整手牌（含暗牌）
  const myRole = ref('player') // 'player' | 'spectator'
  const spectateState = ref(null) // 观众上帝视角
  const showdown = ref(null) // 最近一次摊牌
  const lastGameOver = ref(null)
  const error = ref(null)
  const myPlayerId = useLobbyStore().myPlayerId

  function connect(roomCode, nickname, playerId, avatarId) {
    roomId.value = roomCode
    inRoom.value = true
    wsClient.connect({ roomId: roomCode, nickname, playerId, avatarId })
  }

  function disconnect() {
    wsClient.disconnect()
    inRoom.value = false
  }

  function sendBet(action, amount) {
    wsClient.send(Msg.SEND_BET, { action, amount })
  }

  function setHostConfig(config) {
    wsClient.send(Msg.SEND_SET_HOST_CONFIG, config)
  }

  function startGame() {
    wsClient.send(Msg.SEND_START_GAME, {})
  }

  function toSpectator() {
    wsClient.send(Msg.SEND_SPECTATE, {})
  }

  function hydrate(handlers) {
    const unsubs = [
      wsClient.on(Msg.RCV_ROOM_STATE, (data) => {
        roomState.value = data
        phase.value = data.phase
        const me = data.players.find((p) => p.id === myPlayerId)
        if (me) myRole.value = me.role
      }),
      wsClient.on(Msg.RCV_YOUR_HAND, (data) => {
        myHand.value = data.cards
      }),
      wsClient.on(Msg.RCV_SPECTATE_STATE, (data) => {
        spectateState.value = data
        myRole.value = 'spectator'
      }),
      wsClient.on(Msg.RCV_SHOWDOWN, (data) => {
        showdown.value = data
      }),
      wsClient.on(Msg.RCV_GAME_OVER, (data) => {
        lastGameOver.value = data
      }),
      wsClient.on(Msg.RCV_TURN_TO, (data) => handlers.onTurnTo?.(data)),
      wsClient.on(Msg.RCV_BET_RESULT, (data) => handlers.onBetResult?.(data)),
      wsClient.on(Msg.RCV_ERROR, (data) => {
        error.value = data.message ?? '未知错误'
      }),
      wsClient.on('_open', () => handlers.onOpen?.()),
    ]
    return () => unsubs.forEach((un) => un())
  }

  return {
    inRoom,
    roomId,
    phase,
    roomState,
    myHand,
    myRole,
    spectateState,
    showdown,
    lastGameOver,
    error,
    myPlayerId,
    connect,
    disconnect,
    sendBet,
    setHostConfig,
    startGame,
    toSpectator,
    hydrate,
  }
})
