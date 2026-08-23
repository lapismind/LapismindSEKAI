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
  let errorClearTimer = null
  const myPlayerId = useLobbyStore().myPlayerId

  async function connect(roomCode, nickname, playerId, avatarId) {
    // 先换取身份 token（失败则无 token 直接连，服务端拒绝）
    let token = null
    try {
      const res = await fetch('/api/identity?playerId=' + encodeURIComponent(playerId))
      if (res.ok) {
        const body = await res.json()
        token = body.token ?? null
        if (token) sessionStorage.setItem("identity_token", token)
      }
    } catch { /* offline or server error */ }
    roomId.value = roomCode
    inRoom.value = true
    wsClient.connect({ roomId: roomCode, nickname, playerId, avatarId, token })
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
        // 新一局开始（phase 从 settled 回到 playing 且 round 变化）时清掉摊牌
        if (phase.value === 'settled' && data.phase === 'playing') {
          showdown.value = null
          lastGameOver.value = null
        }
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
      wsClient.on(Msg.RCV_BET_RESULT, (data) => {
        // 下注后可能轮转到下家或进入下一轮，清掉当前行动标记避免误判
        if (roomState.value) {
          roomState.value = { ...roomState.value, currentPlayerId: null }
        }
        handlers.onBetResult?.(data)
      }),
      wsClient.on(Msg.RCV_TURN_TO, (data) => {
        // 同步当前行动者到 roomState（BetPanel 靠它判断 myTurn）
        if (roomState.value) {
          roomState.value = { ...roomState.value, currentPlayerId: data.playerId, currentBet: data.currentBet }
        }
        handlers.onTurnTo?.(data)
      }),
      wsClient.on(Msg.RCV_ERROR, (data) => {
        error.value = data.message ?? '未知错误'
        // 连续报错时先清掉旧定时器，避免前一个提前把新错误清掉
        if (errorClearTimer) clearTimeout(errorClearTimer)
        errorClearTimer = setTimeout(() => {
          error.value = null
          errorClearTimer = null
        }, 5000)
      }),
      wsClient.on('_open', () => handlers.onOpen?.()),
    ]
    return () => unsubs.forEach((un) => un())
  }

  function clearShowdown() {
    showdown.value = null
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
    clearShowdown,
  }
})
