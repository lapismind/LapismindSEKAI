/**
 * worker/abracaRoom.js —— 每个房间一个 Durable Object 实例。
 *
 * 游戏机制：
 * - 房主 = 第一个进入的玩家
 * - 每轮：洗牌 → 分秘密牌 → 各发 5 张暗手（不能看自己，能看别人）
 * - 轮流施法：成功后可继续出同级或更常见的魔法，也可主动结束回合
 * - 失败扣血并强制换人；打死人/清空手牌/自杀都会立即结算
 *
 * Hibernation 要点：连接用 serializeAttachment({ playerId })，
 * 状态持久化在 storage，唤醒后可继续。
 */

import { prepareRound, applyCast, endTurn, TARGET_SCORE } from '../core/rules'
import { verifyIdentityToken } from '@lapismind/lobby-kit'

const MAX_PLAYERS = 5
const TURN_TIMEOUT_MS = 60000

export class AbracaRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = ctx.name || 'room'
    this.queue = Promise.resolve()
  }

  enqueue(task) {
    const run = () => task()
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }

  async fetch(req) {
    if (req.headers.get('Upgrade') === 'websocket') {
      // 升级请求直接执行（enqueue 会吞掉 Response 返回值）
      return this.handleWebSocketUpgrade(req)
    }
    return new Response('Not found', { status: 404 })
  }

  async getState() {
    return (
      (await this.ctx.storage.get('state')) ?? {
        hostId: null,
        phase: 'waiting',
        round: 0,
        targetScore: TARGET_SCORE,
        players: [],
        deck: [],
        secretPile: [],
        castCounts: {},
        currentPlayerId: null,
        lastCastLevel: null,
        castSucceeded: {},
        castFailed: {},
        summary: null,
      }
    )
  }

  async saveState(state) {
    await this.ctx.storage.put('state', state)
  }

  async handleWebSocketUpgrade(req) {
    const url = new URL(req.url)
    const nickname = url.searchParams.get('nickname') || '玩家'
    const avatarId = url.searchParams.get('avatarId') || '0'

    const secret = this.env?.IDENTITY_SECRET
    const token = url.searchParams.get('token')
    let playerId
    if (secret) {
      const identity = await verifyIdentityToken(token, secret, 24 * 60 * 60 * 1000)
      if (!identity || identity.playerId !== (url.searchParams.get('playerId') || '')) {
        return new Response('invalid token', { status: 401 })
      }
      playerId = identity.playerId
    } else {
      playerId = url.searchParams.get('playerId') || crypto.randomUUID()
    }

    const state = await this.getState()

    if (state.phase === 'game_over' && !state.players.find(p => p.id === playerId)) {
      return new Response('game over', { status: 410 })
    }

    let joinedNow = false
    const existing = state.players.find(p => p.id === playerId)
    if (!existing) {
      if (state.phase !== 'waiting') {
        return new Response('game in progress', { status: 409 })
      }
      if (state.players.length >= MAX_PLAYERS) {
        return new Response('room full', { status: 409 })
      }
      joinedNow = true
      const validAvatar = Number(avatarId) >= 1 && Number(avatarId) <= 26 ? avatarId : '0'
      state.players.push({
        id: playerId,
        nickname,
        avatarId: validAvatar,
        score: 0,
        health: 0,
        hand: [],
        secrets: [],
        alive: true,
        isHost: state.players.length === 0,
        connected: true,
      })
      state.hostId = state.hostId ?? playerId
    } else {
      existing.connected = true
      existing.nickname = nickname
      // 头像为空/未选时记为 0，客户端显示默认头像
      const hasValidAvatar = Number(avatarId) >= 1 && Number(avatarId) <= 26
      existing.avatarId = hasValidAvatar
        ? avatarId
        : '0'
    }
    await this.saveState(state)

    // 无论新老玩家：加入/重连后都让所有人拿到最新名单，
    // 否则老玩家的界面会一直停在旧状态（看不到新进来的人）。
    this.broadcastStateAll(state)

    const [client, server] = Object.values(new WebSocketPair())
    server.serializeAttachment({ playerId })
    this.ctx.acceptWebSocket(server)

    this.sendTo(server, { type: 'room_state', data: this.publicState(state, playerId) })
    this.sendHandTo(state, server, playerId)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(socket, message) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return
    await this.enqueue(() => this.handleMessage(socket, playerId, message))
  }

  async webSocketClose(socket) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return
    await this.enqueue(async () => {
      const s = await this.getState()
      const player = s.players.find(p => p.id === playerId)
      if (player) player.connected = false
      await this.saveState(s)
    })
  }

  async handleMessage(socket, playerId, raw) {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    const state = await this.getState()
    if (!socket || socket.readyState !== 1) return

    switch (msg.type) {
      case 'start_round':
        await this.hostStart(state, playerId)
        break
      case 'cast':
        await this.doCast(state, playerId, msg.data)
        break
      case 'end_turn':
        await this.doEndTurn(state, playerId)
        break
      case 'next_round':
        await this.startNextRound(state)
        break
      default:
        this.errorTo(socket, '未知消息类型')
    }
  }

  /** 房主开新一整场（分数归零） */
  async hostStart(state, playerId) {
    if (state.hostId !== playerId) {
      this.errorTo(this.socketFor(playerId), '只有房主能开始')
      return
    }
    if (state.players.length < 2) {
      this.errorTo(this.socketFor(playerId), '至少需要 2 名玩家')
      return
    }
    for (const p of state.players) p.score = 0
    await this.beginRound(state)
  }

  /** 一轮结算后开下一轮（保留分数）或宣布冠军 */
  async startNextRound(state) {
    if (state.phase !== 'round_end') return
    const champion = [...state.players].sort((a, b) => b.score - a.score)[0]
    if (champion && champion.score >= state.targetScore) {
      state.phase = 'game_over'
      await this.saveState(state)
      this.broadcast(state, {
        type: 'game_over',
        data: {
          winnerId: champion.id,
          standings: [...state.players]
            .map(p => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId, score: p.score }))
            .sort((a, b) => b.score - a.score),
        },
      })
      return
    }
    await this.beginRound(state)
  }

  async beginRound(state) {
    const inputs = state.players.map(p => ({
      id: p.id, nickname: p.nickname, avatarId: p.avatarId,
      score: p.score, isHost: p.isHost,
    }))
    const fresh = prepareRound(inputs)
    state.phase = fresh.phase
    state.round += 1
    state.targetScore = fresh.targetScore
    for (const fp of fresh.players) {
      const sp = state.players.find(p => p.id === fp.id)
      if (sp) Object.assign(sp, fp)
    }
    state.deck = fresh.deck
    state.secretPile = fresh.secretPile
    state.castCounts = fresh.castCounts
    state.currentPlayerId = fresh.currentPlayerId
    state.lastCastLevel = fresh.lastCastLevel
    state.castSucceeded = {}
    state.castFailed = {}
    state.summary = null

    await this.saveState(state)
    this.broadcast(state, {
      type: 'turn_to',
      data: { playerId: state.currentPlayerId, round: state.round },
    })
    this.broadcastStateAll(state)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) this.sendHandTo(state, ws, att.playerId)
    }
    this.armTimer()
  }

  async doCast(state, playerId, data) {
    if (state.phase !== 'playing') return
    const spellId = Number(data?.spellId)
    const result = applyCast(state, playerId, spellId)
    await this.saveState(state)
    this.broadcast(state, { type: 'cast_result', data: result })
    this.broadcastStateAll(state)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) this.sendHandTo(state, ws, att.playerId)
    }
    if (state.phase === 'round_end') {
      this.clearTimer()
      this.broadcast(state, { type: 'round_end', data: state.summary })
    } else {
      this.armTimer()
    }
  }

  async doEndTurn(state, playerId) {
    if (state.phase !== 'playing') return
    const result = endTurn(state, playerId)
    if (!result.ok) {
      this.errorTo(this.socketFor(playerId), result.error || '无法结束回合')
      return
    }
    await this.saveState(state)
    this.broadcast(state, { type: 'turn_to', data: { playerId: state.currentPlayerId } })
    this.broadcastStateAll(state)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) this.sendHandTo(state, ws, att.playerId)
    }
    this.armTimer()
  }

  armTimer() {
    this.ctx.storage.setAlarm(Date.now() + TURN_TIMEOUT_MS)
  }

  clearTimer() {
    this.ctx.storage.deleteAlarm()
  }

  /** 超时视为主动结束当前玩家的回合 */
  async alarm() {
    await this.enqueue(async () => {
      const state = await this.getState()
      if (state.phase !== 'playing' || !state.currentPlayerId) return
      const pid = state.currentPlayerId
      // 超时托管：无论是否宣告过，都强制把回合交给下一位。
      const result = endTurn(state, pid, { force: true })
      await this.saveState(state)
      if (result.ok) {
        this.broadcast(state, { type: 'turn_to', data: { ...result, timeout: true } })
        this.broadcastStateAll(state)
        this.armTimer()
      }
    })
  }

  broadcastStateAll(state) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      this.sendTo(ws, { type: 'room_state', data: this.publicState(state, att.playerId) })
    }
  }

  publicState(state, viewerId = null) {
    const isSelf = (p) => p.id === viewerId
    return {
      hostId: state.hostId,
      phase: state.phase,
      round: state.round,
      targetScore: state.targetScore,
      currentPlayerId: state.currentPlayerId,
      lastCastLevel: state.lastCastLevel,
      castSucceeded: state.castSucceeded ?? {},
      castFailed: state.castFailed ?? {},
      castCounts: state.castCounts,
      deckRemaining: state.deck?.length ?? 0,
      secretPileRemaining: state.secretPile?.length ?? 0,
      summary: state.summary,
      players: state.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatarId: p.avatarId,
        score: p.score,
        health: p.health,
        alive: p.alive,
        secretsCount: p.secrets.length,
        isHost: p.isHost,
        connected: p.connected,
        handSize: p.hand.length,
        // 游戏核心：你能看到别人的牌；自己的牌永远是暗的（连自己也不知道）
        hand: isSelf(p) ? p.hand.map(() => null) : [...p.hand],
      })),
    }
  }

  sendHandTo(state, socket, playerId) {
    const me = state.players.find(p => p.id === playerId)
    if (!me) return
    // 不发具体牌面！玩家自己也不能看自己的牌。
    this.sendTo(socket, { type: 'your_hand', data: { handSize: me.hand.length } })
    this.sendTo(socket, { type: 'your_secrets', data: { secrets: me.secrets } })
  }

  broadcast(_state, msg) {
    for (const ws of this.ctx.getWebSockets()) this.sendTo(ws, msg)
  }

  socketFor(playerId) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment()
      if (att && att.playerId === playerId) return ws
    }
    return null
  }

  sendTo(socket, msg) {
    try { socket.send(JSON.stringify(msg)) } catch { /* ignore */ }
  }

  errorTo(socket, message) {
    if (socket) this.sendTo(socket, { type: 'error', data: { message } })
  }
}
