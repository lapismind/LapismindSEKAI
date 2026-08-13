/**
 * stores/gameStore.js
 * 牌局状态 —— 只读渲染服务器状态，本地操作一律发指令给服务器仲裁。
 *
 * 核心原则：
 * - store 里的数据只应被服务器下发的 game_state 更新（见 hydrateGameState）。
 * - UI 的临时状态（选中高亮、动画进行中）留在组件内部，不进 store。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../network/wsClient'
import { Msg } from '../core/protocol'
import { sortHand } from '../game/rules'

export const useGameStore = defineStore('game', () => {
  const inRoom = ref(false)
  const roomId = ref(null)
  const myPlayerId = ref(null)
  const players = ref([]) // [{id, seat, nickname, hand, handCount, isReady}]
  const currentPlayerId = ref(null)
  const phase = ref('waiting') // waiting | playing | ended
  const topCard = ref(null) // 桌面上家的牌
  const playedLog = ref([]) // [{playerId, cardLabel, at}]
  const error = ref(null)
  const winnerId = ref(null)

  const me = computed(() => players.value.find((p) => p.id === myPlayerId.value) ?? null)
  const isMyTurn = computed(() => currentPlayerId.value === myPlayerId.value)
  const myHand = computed(() => sortHand(me.value?.hand ?? []))

  /** 进入房间（加入/创建成功后调用） */
  function enterRoom(roomIdVal, myId) {
    roomId.value = roomIdVal
    myPlayerId.value = myId
    inRoom.value = true
    phase.value = 'waiting'
    players.value = []
    currentPlayerId.value = null
    topCard.value = null
    playedLog.value = []
    error.value = null
    winnerId.value = null
  }

  function leaveRoom() {
    inRoom.value = false
    roomId.value = null
    myPlayerId.value = null
    players.value = []
  }

  /** 用服务器下发的 game_state 整体替换本房间视图状态 */
  function hydrateGameState(s) {
    phase.value = s.phase ?? phase.value
    currentPlayerId.value = s.currentPlayerId ?? null
    topCard.value = s.topCard ?? null
    if (s.players) {
      players.value = s.players
    }
    const log = s.log ?? s.playedLog
    if (log) {
      playedLog.value = log
    }
    if (s.myPlayerId) {
      myPlayerId.value = s.myPlayerId
    }
    if (s.winnerId) {
      winnerId.value = s.winnerId
    } else if (s.phase !== 'ended') {
      winnerId.value = null
    }
  }

  function setError(msg) {
    error.value = msg
  }

  function clearError() {
    error.value = null
  }

  // ---- 连接管理 ----
  function connect(roomIdVal, nickname, playerId) {
    wsClient.connect({ roomId: roomIdVal, nickname, playerId })
  }

  function disconnect() {
    wsClient.disconnect()
    leaveRoom()
  }

  // ---- 玩家操作（发指令，不直接改状态）----
  function playCard(card) {
    wsClient.send(Msg.SEND_PLAY_CARD, { cardId: card.id })
  }

  function skipTurn() {
    wsClient.send(Msg.SEND_SKIP_TURN, {})
  }

  function setReady() {
    wsClient.send(Msg.SEND_READY, {})
  }

  function sendChat(text) {
    wsClient.send(Msg.SEND_CHAT, { text })
  }

  /** 绑定服务器事件。返回解绑函数，房间切换时调用。 */
  function bindServer(handlers = {}) {
    const offs = [
      wsClient.on(Msg.RCV_GAME_STATE, hydrateGameState),
      wsClient.on(Msg.RCV_PLAYER_JOINED, (p) => handlers.onPlayerJoined?.(p)),
      wsClient.on(Msg.RCV_PLAYER_LEFT, (p) => handlers.onPlayerLeft?.(p)),
      wsClient.on(Msg.RCV_ERROR, (e) => setError(e.message ?? '未知错误')),
    ]
    return () => offs.forEach((off) => off())
  }

  /** 订阅连接成功事件（重连成功也会触发）。 */
  function onConnected(handler) {
    return wsClient.on('_open', handler)
  }

  return {
    inRoom,
    roomId,
    myPlayerId,
    players,
    currentPlayerId,
    phase,
    topCard,
    playedLog,
    error,
    winnerId,
    me,
    isMyTurn,
    myHand,
    enterRoom,
    leaveRoom,
    hydrateGameState,
    setError,
    clearError,
    connect,
    disconnect,
    playCard,
    skipTurn,
    setReady,
    sendChat,
    bindServer,
    onConnected,
  }
})
