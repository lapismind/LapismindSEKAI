import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { wsClient } from '../network/wsClient'
import { Msg } from '../core/protocol'
import { useLobbyStore } from './lobbyStore'

export const useGameStore = defineStore('game', () => {
  const inRoom = ref(false)
  const roomId = ref(null)
  const phase = ref('waiting')
  const roomState = ref(null)
  const myHandSize = ref(0)
  const mySecrets = ref([])
  const lastCastResult = ref(null)
  const roundEndSummary = ref(null)
  const lastGameOver = ref(null)
  const newAchievements = ref([])
  const error = ref(null)
  const lobbyStore = useLobbyStore()
  // 响应式读大厅 playerId：认证身份（会话 playerId）就绪后会更新，
  // 房间内登录/换号后 me/回合判断等跟着最新身份走
  const myPlayerId = computed(() => lobbyStore.myPlayerId)

  let errorClearTimer = null

  async function connect(roomCode, nickname, playerId, avatarId) {
    let token = null
    try {
      const res = await fetch('/api/identity?playerId=' + encodeURIComponent(playerId))
      if (res.ok) {
        const body = await res.json()
        token = body.token ?? null
        if (token) sessionStorage.setItem('identity_token', token)
      }
    } catch { /* offline */ }
    roomId.value = roomCode
    inRoom.value = true
    wsClient.connect({ roomId: roomCode, nickname, playerId, avatarId, token })
  }

  function disconnect() {
    wsClient.disconnect()
    inRoom.value = false
  }

  function startRound() {
    wsClient.send(Msg.SEND_START_ROUND, {})
  }

  function cast(spellId) {
    wsClient.send(Msg.SEND_CAST, { spellId })
  }

  function endTurn() {
    wsClient.send(Msg.SEND_END_TURN, {})
  }

  function nextRound() {
    roundEndSummary.value = null
    wsClient.send(Msg.SEND_NEXT_ROUND, {})
  }

  function hydrate(handlers = {}) {
    return [
      wsClient.on(Msg.RCV_ROOM_STATE, (data) => {
        roomState.value = data
        phase.value = data.phase
        // 进入下一轮后服务端会发 playing 的 room_state；旧结算弹窗必须关掉，
        // 否则回合结算遮罩一直盖着界面，房主看似“无法开启下一轮”。
        if (data.phase !== 'round_end') roundEndSummary.value = null
      }),
      wsClient.on(Msg.RCV_YOUR_HAND, (data) => {
        myHandSize.value = data.handSize ?? 0
      }),
      wsClient.on(Msg.RCV_YOUR_SECRETS, (data) => {
        mySecrets.value = data.secrets ?? []
      }),
      wsClient.on(Msg.RCV_TURN_TO, (data) => {
        if (roomState.value) {
          roomState.value = { ...roomState.value, currentPlayerId: data.playerId, round: data.round ?? roomState.value.round }
        }
        handlers.onTurnTo?.(data)
      }),
      wsClient.on(Msg.RCV_CAST_RESULT, (data) => {
        lastCastResult.value = data
        handlers.onCastResult?.(data)
      }),
      wsClient.on(Msg.RCV_ROUND_END, (data) => {
        roundEndSummary.value = data
        handlers.onRoundEnd?.(data)
      }),
      wsClient.on(Msg.RCV_GAME_OVER, (data) => {
        lastGameOver.value = data
      }),
      wsClient.on(Msg.RCV_ACHIEVEMENTS_UNLOCKED, (data) => {
        newAchievements.value = data || []
      }),
      wsClient.on(Msg.RCV_ERROR, (data) => {
        error.value = data.message ?? '未知错误'
        if (errorClearTimer) clearTimeout(errorClearTimer)
        errorClearTimer = setTimeout(() => { error.value = null; errorClearTimer = null }, 5000)
      }),
    ]
  }

  function clearRoundEnd() {
    roundEndSummary.value = null
  }

  function clearCastResult() {
    lastCastResult.value = null
  }

  return {
    inRoom, roomId, phase, roomState,
    myHandSize, mySecrets,
    lastCastResult, roundEndSummary, lastGameOver, newAchievements,
    error, myPlayerId,
    connect, disconnect,
    startRound, cast, endTurn, nextRound,
    hydrate, clearRoundEnd, clearCastResult,
  }
})
