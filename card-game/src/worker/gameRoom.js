/**
 * src/worker/gameRoom.js
 * GameRoom —— 每桌牌局一个 Durable Object 实例。
 *
 * 职责：
 * - 管理一桌最多 8 个玩家的 WebSocket 连接
 * - 用 storage 持久化牌局状态（发牌/回合/出牌）
 * - 用 Alarm 实现回合超时自动跳过
 * - 用 WebSocket Hibernation：空闲时 DO 休眠、连接不断、不计费
 *
 * 关键设计（Hibernation 正确姿势）：
 * - 不要用内存 Map 记录"连接↔玩家"，休眠后会丢失！
 * - 用 socket.serializeAttachment() 把 playerId 挂到连接上，随连接持久化
 * - 遍历连接用 this.ctx.getWebSockets()，而非自己维护的数组
 * - 连接建立后立即 acceptWebSocket，之后的消息走 webSocketMessage()
 */

import { shuffle } from '../game/cardDefs'

const MAX_PLAYERS = 8
const HAND_SIZE = 5
const TURN_SECONDS = 30
const SUITS = ['spade', 'heart', 'diamond', 'club']

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = ctx.name
  }

  async fetch(req) {
    const upgrade = req.headers.get('Upgrade')
    if (upgrade === 'websocket') {
      return this.handleWebSocketUpgrade(req)
    }
    return new Response('Not found', { status: 404 })
  }

  /** 处理 WebSocket 升级：从 URL 取昵称，分配座位，接受连接 */
  async handleWebSocketUpgrade(req) {
    const url = new URL(req.url)
    const nickname = url.searchParams.get('nickname') || '玩家'
    const playerId = url.searchParams.get('playerId') || crypto.randomUUID()

    const state = await this.getState()

    // 同 ID 重连：更新状态即可，不占新座；否则检查满员
    const existing = state.players.find((p) => p.id === playerId)
    if (!existing && state.players.length >= MAX_PLAYERS) {
      return new Response('房间已满', { status: 403 })
    }

    const [client, server] = Object.values(new WebSocketPair())

    let player
    if (existing) {
      player = existing
      player.connected = true
    } else {
      const seat = this.findFreeSeat(state.players)
      player = {
        id: playerId,
        nickname,
        seat,
        hand: [],
        handCount: 0,
        isReady: false,
        connected: true,
      }
      state.players.push(player)
    }

    await this.saveState(state)

    // 关键：把 playerId 存到连接的 attachment，休眠不丢
    server.serializeAttachment({ playerId })
    this.ctx.acceptWebSocket(server)

    this.broadcast({ type: 'player_joined', data: { player: this.publicPlayer(player) } })
    this.broadcastState()
    this.sendGameStateTo(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  /** Hibernation 回调：收到玩家消息 */
  async webSocketMessage(socket, message) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return

    let msg
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }

    switch (msg.type) {
      case 'ready':
        await this.handleReady(playerId)
        break
      case 'play_card':
        await this.handlePlayCard(socket, playerId, msg.data)
        break
      case 'skip_turn':
        await this.handleSkip(playerId)
        break
      case 'chat':
        this.broadcast({ type: 'chat', data: { playerId, text: msg.data?.text } })
        break
      default:
        break
    }
  }

  /** Hibernation 回调：玩家断开 */
  async webSocketClose(socket) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return

    const state = await this.getState()
    const player = state.players.find((p) => p.id === playerId)
    if (player) {
      player.connected = false
    }
    await this.saveState(state)

    this.broadcast({ type: 'player_left', data: { playerId } })
    this.broadcastState()
  }

  /** 玩家点准备：满员且全准备即开局 */
  async handleReady(playerId) {
    const state = await this.getState()
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    player.isReady = true
    await this.saveState(state)

    if (state.players.length >= 2 && state.players.every((p) => p.isReady)) {
      await this.startGame(state)
    } else {
      this.broadcastState()
    }
  }

  /** 开局：洗牌发牌，随机先手，设回合 Alarm */
  async startGame(state) {
    const deck = shuffle(this.buildDeck())
    const perPlayer = Math.min(HAND_SIZE, Math.floor(deck.length / state.players.length))

    for (const p of state.players) {
      p.hand = deck.splice(0, perPlayer).map((card) => ({ ...card, faceUp: false }))
      p.handCount = p.hand.length
    }

    state.phase = 'playing'
    state.deck = deck
    state.topCard = null
    state.currentIndex = Math.floor(Math.random() * state.players.length)
    state.log = []
    state.turnStartedAt = Date.now()
    await this.saveState(state)

    this.broadcastState()
    this.setTurnAlarm()
  }

  /** 出牌 */
  async handlePlayCard(socket, playerId, data) {
    const state = await this.getState()
    if (state.phase !== 'playing') return
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    if (state.players[state.currentIndex]?.id !== playerId) return // 不是你的回合

    const cardId = data?.cardId
    const idx = player.hand.findIndex((c) => c.id === cardId)
    if (idx === -1) return

    const card = player.hand[idx]
    if (!this.canPlay(card, state.topCard)) {
      this.sendTo(socket, { type: 'error', data: { message: '不能出这张牌' } })
      return
    }

    player.hand.splice(idx, 1)
    player.handCount = player.hand.length
    state.topCard = card
    state.passCount = 0
    state.roundLeader = playerId // 记录当前这一轮最后出牌的人
    state.log.push({ playerId, playerName: player.nickname, card, at: Date.now() })
    await this.saveState(state)

    if (player.hand.length === 0) {
      state.phase = 'ended'
      state.winnerId = player.id
      state.currentIndex = null
      this.ctx.storage.deleteAlarm()
      await this.saveState(state)
      this.broadcastState()
      return
    }

    this.nextTurn(state)
  }

  /** 跳过。全场都跳过时回到最后出牌者重新起头（否则 K 会卡死全场） */
  async handleSkip(playerId) {
    const state = await this.getState()
    if (state.phase !== 'playing') return
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    if (state.players[state.currentIndex]?.id !== playerId) return

    // 起头（无上家牌）不允许跳过，必须出牌
    if (state.topCard === null) {
      this.sendToByPlayerId(playerId, { type: 'error', data: { message: '你是起头者，必须出牌' } })
      return
    }

    await this.applySkip(state)
  }

  /** 应用一次跳过：计数累计，全跳过则重置桌面回到出牌者 */
  async applySkip(state) {
    state.passCount = (state.passCount ?? 0) + 1

    // 除了最后出牌者，其余人都已跳过 -> 桌面清空，回到最后出牌者重新起头
    const others = state.players.filter((p) => p.id !== state.roundLeader).length
    if (state.passCount >= others) {
      state.topCard = null
      state.passCount = 0
      state.currentIndex = state.players.findIndex((p) => p.id === state.roundLeader)
      state.turnStartedAt = Date.now()
      await this.saveState(state)
      this.broadcastState()
      this.setTurnAlarm()
      return
    }

    this.nextTurn(state)
  }

  /** 进入下一玩家回合，重置 Alarm */
  async nextTurn(state) {
    state.currentIndex = (state.currentIndex + 1) % state.players.length
    state.turnStartedAt = Date.now()
    await this.saveState(state)
    this.broadcastState()
    this.setTurnAlarm()
  }

  /** 回合超时 Alarm：自动跳过当前玩家 */
  async alarm() {
    const state = await this.getState()
    if (state.phase !== 'playing') return

    // 起头回合超时：不能让局面卡死，直接轮到下家（不累计跳过）
    if (state.topCard === null) {
      await this.nextTurn(state)
      return
    }
    await this.applySkip(state)
  }

  setTurnAlarm() {
    this.ctx.storage.setAlarm(Date.now() + TURN_SECONDS * 1000)
  }

  // ---- 辅助 ----

  buildDeck() {
    const deck = []
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `${suit}-${rank}`, suit, rank })
      }
    }
    return deck
  }

  canPlay(card, topCard) {
    if (!topCard) return true // 首手随意
    return card.rank >= topCard.rank
  }

  findFreeSeat(players) {
    const taken = new Set(players.map((p) => p.seat))
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (!taken.has(i)) return i
    }
    return 0
  }

  async getState() {
    const state = await this.ctx.storage.get('state')
    if (state) return state
    const fresh = {
      players: [],
      phase: 'waiting',
      deck: [],
      topCard: null,
      currentIndex: null,
      log: [],
      winnerId: null,
      turnStartedAt: null,
      passCount: 0,
      roundLeader: null,
    }
    await this.ctx.storage.put('state', fresh)
    return fresh
  }

  async saveState(state) {
    await this.ctx.storage.put('state', state)
  }

  /** 广播完整牌局状态给所有连接的玩家（每人视角不同） */
  broadcastState() {
    void this.getState().then((state) => {
      for (const socket of this.ctx.getWebSockets()) {
        this.sendGameStateTo(socket, state)
      }
    })
  }

  sendGameStateTo(socket, stateOverride) {
    void this.getState().then((state) => {
      const { playerId } = socket.deserializeAttachment() ?? {}
      if (!playerId) return
      this.sendTo(socket, { type: 'game_state', data: this.viewFor(playerId, stateOverride ?? state) })
    })
  }

  broadcast(message) {
    for (const socket of this.ctx.getWebSockets()) {
      this.sendTo(socket, message)
    }
  }

  sendTo(socket, message) {
    try {
      socket.send(JSON.stringify(message))
    } catch {
      /* socket 可能已断开 */
    }
  }

  /** 按 playerId 定向发送（用于跳过受限等场景） */
  sendToByPlayerId(playerId, message) {
    for (const socket of this.ctx.getWebSockets()) {
      const { playerId: pid } = socket.deserializeAttachment() ?? {}
      if (pid === playerId) {
        this.sendTo(socket, message)
        break
      }
    }
  }

  /** 构造某玩家视角的牌局状态 */
  viewFor(playerId, state) {
    return {
      phase: state.phase,
      roomId: this.roomId,
      myPlayerId: playerId,
      currentPlayerId: state.players[state.currentIndex]?.id ?? null,
      topCard: state.topCard,
      winnerId: state.winnerId,
      players: state.players.map((p) => {
        const isMe = p.id === playerId
        return {
          id: p.id,
          nickname: p.nickname,
          seat: p.seat,
          isReady: p.isReady,
          connected: p.connected,
          hand: isMe ? p.hand : [],
          handCount: isMe ? p.hand.length : p.handCount,
        }
      }),
      log: state.log.map((e) => ({
        playerId: e.playerId,
        playerName: e.playerName,
        card: e.card,
        at: e.at,
      })),
    }
  }

  publicPlayer(player) {
    return {
      id: player.id,
      nickname: player.nickname,
      seat: player.seat,
      isReady: player.isReady,
      connected: player.connected,
      handCount: player.handCount,
    }
  }
}
