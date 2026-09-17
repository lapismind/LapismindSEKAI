/**
 * stores/gameStore.js —— 房间状态管理。
 * 只读渲染服务端状态，操作一律发指令给服务端仲裁。
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
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
  // 连接状态（来自 ws-client 的 _status）。掉线必须能显示出来：
  // 重试耗尽后服务端不再有任何动作，界面却还停在最后一个画面，
  // 玩家会以为"别人慢"，实际这局对他已经废了。
  const connStatus = ref('idle')
  const connAttempt = ref(0)
  const connMaxRetry = ref(wsClient.maxRetry ?? 5)
  // 下注提交锁：发出 bet 后立刻禁用操作，收到 bet_result / turn_to / error 后释放。
  // 加注和全下是不可逆的代价性动作，手快连点两次会重复提交同一笔下注。
  const betLocked = ref(false)
  let errorClearTimer = null
  let betLockTimer = null
  let previousUnsubs = []
  let connectGeneration = 0
  const lobbyStore = useLobbyStore()
  // 响应式读大厅 playerId：认证身份（会话 playerId）就绪后会更新，
  // 房间内登录/换号后 me/回合判断等跟着最新身份走
  const myPlayerId = computed(() => lobbyStore.myPlayerId)

  async function connect(roomCode, nickname, playerId, avatarId) {
    if (roomId.value && roomId.value !== roomCode) leaveRoom()
    const generation = ++connectGeneration
    // 先换取身份 token（失败则无 token 直接连，服务端拒绝）
    let token = null
    try {
      const res = await fetch('/api/identity?playerId=' + encodeURIComponent(playerId))
      if (res.ok) {
        const body = await res.json()
        token = body.token ?? null
      }
    } catch { /* offline or server error */ }
    // 换 token 期间可能已离开或切了房间，丢弃这次过期的连接
    if (generation !== connectGeneration) return
    if (token) sessionStorage.setItem('identity_token', token)
    roomId.value = roomCode
    inRoom.value = true
    wsClient.connect({ roomId: roomCode, nickname, playerId, avatarId, token })
  }

  function releaseBetLock() {
    if (betLockTimer) {
      clearTimeout(betLockTimer)
      betLockTimer = null
    }
    betLocked.value = false
  }

  /** 清掉只属于"刚刚结束的那一场"的展示状态 */
  function clearMatchTransients() {
    showdown.value = null
    lastGameOver.value = null
    spectateState.value = null
  }

  function disconnect() {
    clearMatchTransients()
    error.value = null
    releaseBetLock()
    wsClient.disconnect()
    inRoom.value = false
  }

  /** 离开房间：撤掉监听、断开连接，并把房间状态清干净 */
  function leaveRoom() {
    ++connectGeneration
    previousUnsubs.forEach(unsubscribe => unsubscribe())
    previousUnsubs = []
    disconnect()
    roomId.value = null
    connStatus.value = 'idle'
    connAttempt.value = 0
    phase.value = 'waiting'
    roomState.value = null
    myHand.value = []
    myRole.value = 'player'
  }

  function sendBet(action, amount) {
    if (betLocked.value) return
    betLocked.value = true
    wsClient.send(Msg.SEND_BET, { action, amount })
    // 兜底：即使 bet_result 丢失也要放开锁，避免界面永久卡在不可操作
    if (betLockTimer) clearTimeout(betLockTimer)
    betLockTimer = setTimeout(() => {
      betLocked.value = false
      betLockTimer = null
    }, 1200)
  }

  function setHostConfig(config) {
    wsClient.send(Msg.SEND_SET_HOST_CONFIG, config)
  }

  /** 闷牌轮看牌：亮给自己，之后的跟注按全价 */
  function look() {
    wsClient.send(Msg.SEND_LOOK, {})
  }

  function startGame() {
    wsClient.send(Msg.SEND_START_GAME, {})
  }

  /** 整场结束后由房主发起：重置筹码、观众重新入座、回到 waiting */
  function rematch() {
    clearMatchTransients()
    wsClient.send(Msg.SEND_REMATCH, {})
  }

  /** 重试耗尽后玩家点"重新连接" */
  function retryConnection() {
    return wsClient.retry()
  }

  function toSpectator() {
    wsClient.send(Msg.SEND_SPECTATE, {})
  }

  function hydrate(handlers = {}) {
    // 同一事件被注册两次会被处理两次（重复弹窗、重复计数），
    // 先撤掉上一次的监听再装新的。
    previousUnsubs.forEach(unsubscribe => unsubscribe())
    previousUnsubs = []

    const newUnsubs = [
      wsClient.on(Msg.RCV_ROOM_STATE, (data) => {
        // 开新一局（局数推进）或房主开了再来一局（回到 waiting）时，
        // 清掉上一局的摊牌/结算残留，否则弹层会一直盖着牌桌
        const newHandStarted = data.phase === 'playing'
          && roomState.value != null
          && data.round !== roomState.value.round
        if (newHandStarted || data.phase === 'waiting') clearMatchTransients()
        roomState.value = data
        phase.value = data.phase
        const me = data.players.find((p) => p.id === myPlayerId.value)
        if (me) myRole.value = me.role
        // 不在本局行动阶段时旧的提交锁无意义
        if (data.phase !== 'playing') releaseBetLock()
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
        // 我的下注已被服务端受理，放开提交锁。
        // 服务端在 bet_result 之后紧接着补发 room_state（底池与各座位投入实时更新）
        // 再发 turn_to，因此这里不需要自己修补 currentPlayerId。
        releaseBetLock()
        handlers.onBetResult?.(data)
      }),
      wsClient.on(Msg.RCV_TURN_TO, (data) => {
        // 回合交到我手上时，上一次提交的锁已无意义（服务端已处理完并移交回合）
        if (data.playerId === myPlayerId.value) releaseBetLock()
        // 同步当前行动者到 roomState（BetPanel 靠它判断 myTurn）
        if (roomState.value) {
          roomState.value = { ...roomState.value, currentPlayerId: data.playerId, currentBet: data.currentBet }
        }
        handlers.onTurnTo?.(data)
      }),
      wsClient.on(Msg.RCV_ERROR, (data) => {
        error.value = data.message ?? '未知错误'
        // 服务端拒绝了上一步操作：提交锁必须复位，否则玩家再也点不动
        releaseBetLock()
        // 连续报错时先清掉旧定时器，避免前一个提前把新错误清掉
        if (errorClearTimer) clearTimeout(errorClearTimer)
        errorClearTimer = setTimeout(() => {
          error.value = null
          errorClearTimer = null
        }, 5000)
      }),
      wsClient.on('_status', (s) => {
        connStatus.value = s.status
        connAttempt.value = s.attempt ?? 0
        connMaxRetry.value = s.maxRetry ?? connMaxRetry.value
      }),
      wsClient.on('_send_failed', (d) => {
        // 操作没发出去就要说，否则玩家点了按钮什么都没发生，只会以为游戏卡了
        error.value = '网络未连接，这一步没有发出去'
        if (errorClearTimer) clearTimeout(errorClearTimer)
        errorClearTimer = setTimeout(() => { error.value = null; errorClearTimer = null }, 5000)
        handlers.onSendFailed?.(d)
      }),
      wsClient.on('_open', () => handlers.onOpen?.()),
    ]
    previousUnsubs = newUnsubs
    return () => newUnsubs.forEach((un) => un())
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
    betLocked,
    connStatus,
    connAttempt,
    connMaxRetry,
    myPlayerId,
    connect,
    disconnect,
    leaveRoom,
    sendBet,
    setHostConfig,
    look,
    startGame,
    rematch,
    retryConnection,
    toSpectator,
    hydrate,
    clearShowdown,
  }
})
