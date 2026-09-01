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
  const roundScoreDeltas = ref({})
  let preRoundScores = {}
  const lastGameOver = ref(null)
  const newAchievements = ref([])
  const chatMessages = ref([])
  const error = ref(null)
  // 施法提交锁：发出 cast 后立刻禁用施法按钮，收到 cast_result 或超时后释放，
  // 防止手机/手快连点把同一张牌发出去两次（第二次必然判“猜错”自伤）。
  const castLocked = ref(false)
  // 本回合是否已宣告过魔法：宣告后结束回合按钮立刻可用，
  // 即使 cast_result / room_state 还没回来也不会出现“点了结束没反应”。
  const declared = ref(false)
  const lobbyStore = useLobbyStore()
  // 响应式读大厅 playerId：认证身份（会话 playerId）就绪后会更新，
  // 房间内登录/换号后 me/回合判断等跟着最新身份走
  const myPlayerId = computed(() => lobbyStore.myPlayerId)

  let errorClearTimer = null
  let castLockTimer = null
  let previousUnsubs = []

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
    // 离开房间/切换身份前清空聊天记录，避免旧房间消息泄漏进新房间
    chatMessages.value = []
    declared.value = false
    releaseCastLock()
    wsClient.disconnect()
    inRoom.value = false
  }

  function startRound() {
    wsClient.send(Msg.SEND_START_ROUND, {})
  }

  function cast(spellId) {
    if (castLocked.value) return
    castLocked.value = true
    declared.value = true
    wsClient.send(Msg.SEND_CAST, { spellId })
    // 兜底：即使 cast_result 丢失，固定时间后也要放开锁，避免永久卡死。
    // 句柄保存在 castLockTimer：新一次施法或结果回来时先清掉旧 timer，
    // 避免旧 timer 在本轮锁定期内误开锁（残留连点窗口）。
    if (castLockTimer) clearTimeout(castLockTimer)
    castLockTimer = setTimeout(() => {
      castLocked.value = false
      castLockTimer = null
    }, 800)
  }

  function releaseCastLock() {
    if (castLockTimer) {
      clearTimeout(castLockTimer)
      castLockTimer = null
    }
    castLocked.value = false
  }

  function endTurn() {
    wsClient.send(Msg.SEND_END_TURN, {})
  }

  function nextRound() {
    roundEndSummary.value = null
    roundScoreDeltas.value = {}
    preRoundScores = {}
    wsClient.send(Msg.SEND_NEXT_ROUND, {})
  }

  function rematch() {
    lastGameOver.value = null
    wsClient.send(Msg.SEND_REMATCH, {})
  }

  function sendChat(text) {
    if (text && text.trim()) {
      wsClient.send(Msg.SEND_CHAT, { text: text.trim() })
    }
  }

  function sendEmoji(folder, emojiId) {
    wsClient.send(Msg.SEND_EMOJI, { folder, emojiId })
  }

  // 聊天记录设上限，避免长房间会话内存无界增长
  function trimChatMessages() {
    if (chatMessages.value.length > 200) {
      chatMessages.value.splice(0, chatMessages.value.length - 200)
    }
  }

  function hydrate(handlers = {}) {
    // Clean up previous handlers to prevent duplicate messages
    previousUnsubs.forEach(u => u())
    previousUnsubs = []

    const newUnsubs = [
      wsClient.on(Msg.RCV_ROOM_STATE, (data) => {
        // 新轮开始时快照各玩家分数，用于结算时算 delta
        if (data.phase === 'playing' && roomState.value?.phase !== 'playing') {
          preRoundScores = {}
          for (const p of (data.players ?? [])) {
            preRoundScores[p.id] = p.score
          }
        }
        roomState.value = data
        phase.value = data.phase
        // 不在游戏中或回合已不在我身上时，清掉本回合的宣告标记，避免跨回合残留
        if (data.phase !== 'playing' || (data.currentPlayerId && data.currentPlayerId !== myPlayerId.value)) {
          declared.value = false
        }
        // 离开游戏中状态时，施法锁一并释放（回合结算/换轮后旧锁无意义）
        if (data.phase !== 'playing') releaseCastLock()
        // 进入下一轮后服务端会发 playing 的 room_state；旧结算弹窗必须关掉，
        // 否则回合结算遮罩一直盖着界面，房主看似"无法开启下一轮"。
        if (data.phase !== 'round_end') roundEndSummary.value = null
      }),
      wsClient.on(Msg.RCV_YOUR_HAND, (data) => {
        myHandSize.value = data.handSize ?? 0
      }),
      wsClient.on(Msg.RCV_YOUR_SECRETS, (data) => {
        mySecrets.value = data.secrets ?? []
      }),
      wsClient.on(Msg.RCV_TURN_TO, (data) => {
        const roundChanged =
          data.round != null && roomState.value && data.round !== roomState.value.round
        // 回合交到别人手上，或开启了新的一轮（轮到我也算），宣告标记都要复位
        if (data.playerId !== myPlayerId.value || roundChanged) declared.value = false
        // 回合交到我手上时，上一次施法的锁已无意义（服务端已处理完并移交回合），直接释放
        if (data.playerId === myPlayerId.value) releaseCastLock()
        if (roomState.value) {
          roomState.value = { ...roomState.value, currentPlayerId: data.playerId, round: data.round ?? roomState.value.round }
        }
        handlers.onTurnTo?.(data)
      }),
      wsClient.on(Msg.RCV_CAST_RESULT, (data) => {
        lastCastResult.value = data
        releaseCastLock()
        handlers.onCastResult?.(data)
      }),
      wsClient.on(Msg.RCV_ROUND_END, (data) => {
        roundEndSummary.value = data
        // 计算每人本轮得分变化：结算后分数 - 轮开始时快照
        const deltas = {}
        for (const row of (data.standings ?? [])) {
          deltas[row.id] = row.score - (preRoundScores[row.id] ?? 0)
        }
        roundScoreDeltas.value = deltas
        handlers.onRoundEnd?.(data)
      }),
      wsClient.on(Msg.RCV_GAME_OVER, (data) => {
        lastGameOver.value = data
      }),
      wsClient.on(Msg.RCV_ACHIEVEMENTS_UNLOCKED, (data) => {
        newAchievements.value = data || []
      }),
      wsClient.on(Msg.RCV_CHAT, (data) => {
        chatMessages.value.push({
          type: 'chat',
          playerId: data.playerId,
          nickname: data.nickname,
          avatarId: data.avatarId,
          text: data.text,
          timestamp: Date.now(),
        })
        trimChatMessages()
      }),
      wsClient.on(Msg.RCV_EMOJI, (data) => {
        chatMessages.value.push({
          type: 'emoji',
          playerId: data.playerId,
          nickname: data.nickname,
          avatarId: data.avatarId,
          folder: data.folder,
          emojiId: data.emojiId,
          timestamp: Date.now(),
        })
        trimChatMessages()
      }),
      wsClient.on(Msg.RCV_ERROR, (data) => {
        error.value = data.message ?? '未知错误'
        // 服务端拒绝了上一步操作（如施法无效）：宣告标记/施法锁都要复位，
        // 否则结束回合按钮会在未宣告的情况下可用，点了又被服务端拒绝
        declared.value = false
        releaseCastLock()
        if (errorClearTimer) clearTimeout(errorClearTimer)
        errorClearTimer = setTimeout(() => { error.value = null; errorClearTimer = null }, 5000)
      }),
    ]

    previousUnsubs = newUnsubs
    return newUnsubs
  }

  function clearRoundEnd() {
    roundEndSummary.value = null
  }

  function clearCastResult() {
    lastCastResult.value = null
  }

  function clearGameOver() {
    lastGameOver.value = null
  }

  return {
    inRoom, roomId, phase, roomState,
    myHandSize, mySecrets,
    lastCastResult, roundEndSummary, roundScoreDeltas, lastGameOver, newAchievements,
    error, myPlayerId, chatMessages, castLocked, declared,
    sendChat, sendEmoji,
    connect, disconnect,
    startRound, cast, endTurn, nextRound, rematch,
    hydrate, clearRoundEnd, clearCastResult, clearGameOver,
  }
})
