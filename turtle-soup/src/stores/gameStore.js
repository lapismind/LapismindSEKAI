/**
 * stores/gameStore.js
 * 房间状态 —— 只读渲染服务器状态，操作一律发指令给服务器仲裁。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../network/wsClient'
import { Msg } from '../core/protocol'
import { AI_MODE_ENABLED } from '../core/features'

export const useGameStore = defineStore('game', () => {
  const inRoom = ref(false)
  const roomId = ref(null)
  const myPlayerId = ref(null)
  const phase = ref('waiting')
  const mode = ref('human')
  const maxPlayers = ref(8)
  const questionLimit = ref(null)
  const questionsExhausted = ref(false)
  const puzzle = ref(null)
  const hostId = ref(null)
  const moderatorId = ref(null)
  const moderatorApplicants = ref([])
  const players = ref([])
  const spectators = ref([])
  const messages = ref([])
  const reviewNotes = ref([])
  const questionCount = ref(0)
  const winnerId = ref(null)
  const revealed = ref(false)
  const error = ref(null)
  const amI = ref({ isHost: false, isModerator: false })
  // —— 揭底后的投票 ——
  // 服务端只把"我自己的名单"下发给我；appleCounts 在投票结束前是 null，
  // 这是有意的（投的过程中互相看得见会从众），不要在前端把它补成 0。
  const myApples = ref([])
  const myFlowers = ref([])
  const appleQuota = ref(0)
  const appleCounts = ref(null)
  const flowerCounts = ref({})
  const votingClosed = ref(false)
  const votingComplete = ref(false)
  const voted = ref(0)
  const voters = ref(0)

  const me = computed(() => players.value.find((p) => p.id === myPlayerId.value) ?? null)
  const isHost = computed(() => amI.value?.isHost ?? false)
  const isModerator = computed(() => amI.value?.isModerator ?? false)
  const isSpectator = computed(() => amI.value?.isSpectator ?? false)
  // 主持人仅指真人主持人（AI 模式下无真人主持人，全员都是玩家，包括房主）
  const amModerator = computed(() => isModerator.value && mode.value === 'human')

  /** 进入房间 */
  function enterRoom(roomIdVal, myId) {
    roomId.value = roomIdVal
    myPlayerId.value = myId
    inRoom.value = true
    resetRoom()
  }

  function resetRoom() {
    phase.value = 'waiting'
    // 默认真人主持：AI 主持入口已关闭，重新开放见 core/features.js
    mode.value = 'human'
    maxPlayers.value = 2
    questionLimit.value = null
    questionsExhausted.value = false
    puzzle.value = null
    hostId.value = null
    moderatorId.value = null
    moderatorApplicants.value = []
    players.value = []
    spectators.value = []
    messages.value = []
    reviewNotes.value = []
    questionCount.value = 0
    winnerId.value = null
    revealed.value = false
    error.value = null
    amI.value = { isHost: false, isModerator: false }
    myApples.value = []
    myFlowers.value = []
    appleQuota.value = 0
    appleCounts.value = null
    flowerCounts.value = {}
    votingClosed.value = false
    votingComplete.value = false
    voted.value = 0
    voters.value = 0
  }

  function connect(roomIdVal, nickname, playerId, avatarId = '0') {
    wsClient.connect({ roomId: roomIdVal, nickname, playerId, avatarId })
  }

  /** 房间内换身份重连：不重置 inRoom（避免界面切回大厅），直接关旧连开新连 */
  function reconnect(roomIdVal, nickname, playerId, avatarId = '0') {
    wsClient.disconnect()
    connect(roomIdVal, nickname, playerId, avatarId)
  }

  function disconnect() {
    wsClient.disconnect()
    inRoom.value = false
    roomId.value = null
    myPlayerId.value = null
  }

  // ---- 玩家操作 ----
  function setHostConfig(cfg) {
    wsClient.send(Msg.SEND_SET_HOST_CONFIG, cfg)
  }

  function applyModerator(apply) {
    wsClient.send(Msg.SEND_APPLY_MODERATOR, { apply })
  }

  function setSpectator(spectator) {
    wsClient.send(Msg.SEND_SET_SPECTATOR, { spectator })
  }

  function selectPuzzle(puzzleId) {
    wsClient.send(Msg.SEND_SELECT_PUZZLE, { puzzleId })
  }

  function startGame() {
    wsClient.send(Msg.SEND_START_GAME, {})
  }

  function askQuestion(text) {
    wsClient.send(Msg.SEND_ASK_QUESTION, { text })
  }

  function moderatorJudge(judge, reason = '') {
    wsClient.send(Msg.SEND_MODERATOR_JUDGE, { judge, reason })
  }

  function guessAnswer(text) {
    wsClient.send(Msg.SEND_GUESS_ANSWER, { text })
  }

  function reveal() {
    wsClient.send(Msg.SEND_REVEAL, {})
  }

  function reviewNote(text) {
    wsClient.send(Msg.SEND_REVIEW_NOTE, { text })
  }

  function aiHint() {
    // 关掉 AI 后前端不该再发这个指令；这里兜一层，避免入口藏了但请求照发
    if (!AI_MODE_ENABLED) return
    wsClient.send(Msg.SEND_AI_HINT, {})
  }

  function sendChat(text) {
    wsClient.send(Msg.SEND_CHAT, { text })
  }

  // ---- 揭底后的投票 ----
  // 点同一个人第二次 = 撤回（服务端按"名单"处理，不是按"票数"累加）
  function giveApple(to) {
    wsClient.send(Msg.SEND_GIVE_APPLE, { to })
  }

  function giveFlower(to) {
    wsClient.send(Msg.SEND_GIVE_FLOWER, { to })
  }

  function closeVoting() {
    wsClient.send(Msg.SEND_CLOSE_VOTING, {})
  }

  /** 用服务器下发的 game_state 替换视图状态 */
  function hydrate(s) {
    phase.value = s.phase ?? phase.value
    mode.value = s.mode ?? mode.value
    maxPlayers.value = s.maxPlayers ?? maxPlayers.value
    questionLimit.value = s.questionLimit ?? null
    questionsExhausted.value = s.questionsExhausted ?? false
    puzzle.value = s.puzzle ?? null
    hostId.value = s.hostId ?? null
    moderatorId.value = s.moderatorId ?? null
    moderatorApplicants.value = s.moderatorApplicants ?? []
    players.value = s.players ?? []
    spectators.value = s.spectators ?? []
    messages.value = s.messages ?? []
    reviewNotes.value = s.reviewNotes ?? []
    questionCount.value = s.questionCount ?? 0
    winnerId.value = s.winnerId ?? null
    revealed.value = s.revealed ?? false
    amI.value = s.amI ?? { isHost: false, isModerator: false }
    myApples.value = s.myApples ?? []
    myFlowers.value = s.myFlowers ?? []
    appleQuota.value = s.appleQuota ?? 0
    // 注意 ?? null 而不是 ?? {}：null 是"还没公开"的信号，别把它退化成空对象
    appleCounts.value = s.appleCounts ?? null
    flowerCounts.value = s.flowerCounts ?? {}
    votingClosed.value = s.votingClosed ?? false
    votingComplete.value = s.votingComplete ?? false
    voted.value = s.voted ?? 0
    voters.value = s.voters ?? 0
  }

  function setError(msg) {
    error.value = msg
    setTimeout(() => (error.value = null), 4000)
  }

  function bindServer(handlers = {}) {
    const offs = [
      wsClient.on(Msg.RCV_GAME_STATE, hydrate),
      wsClient.on(Msg.RCV_PLAYER_JOINED, (p) => handlers.onPlayerJoined?.(p)),
      wsClient.on(Msg.RCV_PLAYER_LEFT, (p) => handlers.onPlayerLeft?.(p)),
      wsClient.on(Msg.RCV_MODERATOR_CHANGED, (m) => handlers.onModeratorChanged?.(m)),
      wsClient.on(Msg.RCV_MODERATOR_QUESTION, (q) => handlers.onModeratorQuestion?.(q)),
      wsClient.on(Msg.RCV_GUESS_PROPOSED, (g) => handlers.onGuessProposed?.(g)),
      wsClient.on(Msg.RCV_ERROR, (e) => setError(e.message ?? '未知错误')),
    ]
    return () => offs.forEach((off) => off())
  }

  function onConnected(handler) {
    return wsClient.on('_open', handler)
  }

  return {
    inRoom,
    roomId,
    myPlayerId,
    phase,
    mode,
    maxPlayers,
    questionLimit,
    questionsExhausted,
    puzzle,
    hostId,
    moderatorId,
    moderatorApplicants,
    players,
    spectators,
    messages,
    reviewNotes,
    questionCount,
    winnerId,
    revealed,
    error,
    amI,
    // 投票（Phase 2 服务端下发，Phase 3 面板消费）——漏导出会表现为
    // "面板渲染到一半整个消失"，而构建和单元测试都不会报错
    myApples,
    myFlowers,
    appleQuota,
    appleCounts,
    flowerCounts,
    votingClosed,
    votingComplete,
    voted,
    voters,
    me,
    isHost,
    isModerator,
    isSpectator,
    amModerator,
    enterRoom,
    connect,
    reconnect,
    disconnect,
    setHostConfig,
    applyModerator,
    setSpectator,
    selectPuzzle,
    startGame,
    askQuestion,
    moderatorJudge,
    guessAnswer,
    reveal,
    reviewNote,
    aiHint,
    giveApple,
    giveFlower,
    closeVoting,
    sendChat,
    bindServer,
    onConnected,
  }
})
