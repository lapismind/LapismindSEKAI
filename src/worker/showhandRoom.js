/**
 * worker/showhandRoom.js —— 每个房间一个 Durable Object 实例。
 *
 * 房间机制：
 * - 房主 = 第一个进入的玩家
 * - 房主开局前设定：模式（five/seven）、局数、初始筹码
 * - 每局：发牌 → 逐轮下注（跟/加/弃/全下）→ 摊牌 → 结算 → 下一局
 * - 输光玩家 / 超员玩家 → 观众席（上帝视角看全桌）
 *
 * Hibernation 要点（复用海龟汤）：
 * - 连接状态用 socket.serializeAttachment({ playerId }) 持久化
 * - 遍历连接用 ctx.getWebSockets()
 * - 状态用 this.state.storage（SQLite）持久化
 */

import { createHand } from '../core/hand'
import { createBettingRound, advanceBet, bettingRoundDone, nextPlayer } from '../core/betting'
import { evaluateHand, bestFive, compareHands } from '../core/poker'
import { settlePots, awardPots } from '../core/settle'

const MAX_PLAYERS = 8
const BET_TIMEOUT_MS = 30000 // 30 秒超时自动弃牌

export class ShowhandRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = ctx.name
    this.queue = Promise.resolve()
  }

  enqueue(task) {
    this.queue = this.queue.then(task, task)
    return this.queue
  }

  async fetch(req) {
    const upgrade = req.headers.get('Upgrade')
    if (upgrade === 'websocket') {
      return this.enqueue(() => this.handleWebSocketUpgrade(req))
    }
    return new Response('Not found', { status: 404 })
  }

  async getState() {
    return (
      (await this.ctx.storage.get('state')) ?? {
        hostId: null,
        config: { mode: 'five', rounds: 10, initialChips: 1000 },
        phase: 'waiting', // waiting | playing | settled
        round: 0,
        finished: false,
        players: [], // { id, nickname, avatarId, chips, cards, bet, folded, allIn, isHost, role, connected }
        currentPlayerId: null,
        currentBet: 0,
        lastRaiser: null,
        pot: 0,
        bettingRound: null,
        timerDue: null,
      }
    )
  }

  async saveState(state) {
    await this.ctx.storage.put('state', state)
  }

  async handleWebSocketUpgrade(req) {
    const url = new URL(req.url)
    const nickname = url.searchParams.get('nickname') || '玩家'
    const playerId = url.searchParams.get('playerId') || crypto.randomUUID()
    const avatarId = url.searchParams.get('avatarId') || '0'

    const state = await this.getState()

    const existing = state.players.find((p) => p.id === playerId)
    if (!existing) {
      const inGame = state.phase !== 'waiting'
      const seatFull = state.players.filter((p) => p.role === 'player').length >= MAX_PLAYERS
      const isSpectator = inGame || seatFull
      const player = {
        id: playerId,
        nickname,
        avatarId,
        chips: state.config.initialChips,
        cards: [],
        bet: 0,
        folded: false,
        allIn: false,
        isHost: !isSpectator && state.players.length === 0,
        role: isSpectator ? 'spectator' : 'player',
        connected: true,
        joinedAt: Date.now(),
      }
      if (player.isHost) state.hostId = playerId
      state.players.push(player)
      await this.saveState(state)
    } else {
      existing.connected = true
      existing.nickname = nickname
      if (avatarId) existing.avatarId = avatarId
      await this.saveState(state)
    }

    const [client, server] = Object.values(new WebSocketPair())
    server.serializeAttachment({ playerId })
    this.ctx.acceptWebSocket(server)

    this.broadcast(state, {
      type: 'player_joined',
      data: { playerId, nickname, hostId: state.hostId },
    })
    this.broadcastState(state)
    this.sendStateTo(state, server)
    this.sendHandTo(state, server)

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
      const state = await this.getState()
      const player = state.players.find((p) => p.id === playerId)
      if (player) player.connected = false
      await this.saveState(state)
    })
  }

  async handleMessage(socket, playerId, raw) {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    const state = await this.getState()
    const player = state.players.find((p) => p.id === playerId)

    switch (msg.type) {
      case 'set_host_config':
        this.setHostConfig(state, playerId, msg.data)
        break
      case 'start_game':
        await this.startGame(state, playerId)
        break
      case 'bet':
        await this.doBet(state, playerId, msg.data)
        break
      case 'spectate':
        this.toSpectator(state, playerId)
        break
      default:
        this.errorTo(socket, '未知消息类型')
    }
  }

  setHostConfig(state, playerId, data) {
    if (state.hostId !== playerId) {
      this.errorTo(this.socketFor(state, playerId), '只有房主能设置')
      return
    }
    if (state.phase !== 'waiting') return
    const mode = data.mode === 'seven' ? 'seven' : 'five'
    const rounds = Math.min(Math.max(Number(data.rounds) || 10, 1), 100)
    const initialChips = Math.min(Math.max(Number(data.initialChips) || 1000, 100), 100000)
    state.config = { mode, rounds, initialChips }
    // 已加入玩家同步初始筹码
    for (const p of state.players) {
      if (p.role === 'player') p.chips = initialChips
    }
    this.saveState(state).then(() => this.broadcastState(state))
  }

  async startGame(state, playerId) {
    if (state.hostId !== playerId) return
    if (state.phase !== 'waiting' && state.phase !== 'settled') return
    const players = state.players.filter((p) => p.role === 'player')
    if (players.length < 2) {
      this.errorTo(this.socketFor(state, playerId), '至少需要 2 名玩家')
      return
    }
    await this.beginHand(state)
  }

  /** 开局/下一局 */
  async beginHand(state) {
    state.round += 1
    if (state.round > state.config.rounds) {
      // 全部局数结束
      state.phase = 'settled'
      state.finished = true
      await this.saveState(state)
      this.broadcast(state, { type: 'game_over', data: this.finalStandings(state) })
      return
    }

    state.phase = 'playing'
    state.finished = false
    state.pot = 0
    const seatPlayers = state.players.filter((p) => p.role === 'player')

    for (const p of seatPlayers) {
      p.cards = []
      p.bet = 0
      p.folded = false
      p.allIn = false
    }

    // 底注：每人入底池 initialChips 的 1%（筹码不够付底注则直接全下保护）
    const ante = Math.max(1, Math.floor(state.config.initialChips / 100))
    for (const p of seatPlayers) {
      if (p.chips <= ante) {
        p.bet = p.chips
        p.chips = 0
        p.allIn = true
      } else {
        p.chips -= ante
        p.bet = ante
      }
      state.pot += p.bet
    }

    // 边发边下注：只发第一阶段（preflop）。
    // hand 必须以纯数据形式持久化（含剩余 deck），跨消息 / hibernation 唤醒后仍能续发。
    const freshHand = createHand(state.config.mode, seatPlayers.length)
    state.hand = {
      mode: freshHand.mode,
      stage: 'preflop',
      deck: freshHand.deck,
      playerIds: seatPlayers.map((p) => p.id),
    }
    this.dealNextStageData(state)

    await this.saveState(state)
    this.broadcastState(state)
    for (const p of state.players) {
      if (p.role === 'player') this.sendHandTo(state, this.socketFor(state, p.id))
    }
    await this.beginBettingRound(state)
  }

  /** 纯数据驱动的发下一阶段牌，节奏与 core/hand.js 的 dealNextStage 完全一致 */
  dealNextStageData(state) {
    const hand = state.hand
    if (!hand || hand.stage === 'showdown') return false
    // 以开局时的座位快照为准，避免中途转观众影响发牌对象
    const participants = (hand.playerIds || [])
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean)
    const dealCard = (hidden) => {
      const card = hand.deck.pop()
      return { suit: card.suit, rank: card.rank, hidden }
    }
    const dealEach = (hidden) => {
      for (const p of participants) p.cards.push(dealCard(hidden))
    }
    const isFive = hand.mode === 'five'
    const isSeven = hand.mode === 'seven'

    if (hand.stage === 'preflop') {
      if (isFive) {
        dealEach(true) // 1 暗
        dealEach(false) // 1 明
      } else if (isSeven) {
        dealEach(true)
        dealEach(true) // 2 暗
        dealEach(false) // 1 明
      }
      hand.stage = 'flop'
      return true
    }
    if (hand.stage === 'flop') {
      dealEach(false)
      hand.stage = 'turn'
      return true
    }
    if (hand.stage === 'turn') {
      dealEach(false)
      hand.stage = 'river'
      return true
    }
    if (hand.stage === 'river') {
      dealEach(false)
      if (isSeven) dealEach(true) // 七张第 7 张为暗牌
      hand.stage = 'showdown'
      return true
    }
    return false
  }

  /** 本局实际参与者的快照；中途转观众/掉线者仍按开局座位结算 */
  handParticipants(state) {
    const ids = state.hand && state.hand.playerIds ? state.hand.playerIds : []
    return ids.map((id) => state.players.find((p) => p.id === id)).filter(Boolean)
  }

  /** 开始一轮下注 */
  async beginBettingRound(state) {
    const seatPlayers = state.players.filter((p) => p.role === 'player' && !p.folded && !p.allIn)
    const alive = seatPlayers.filter((p) => !p.folded && !p.allIn)
    if (alive.length <= 1) {
      await this.settleHand(state)
      return
    }
    const firstId = alive[0].id
    // 当前注额 = 本局参与者已有投入的最大值（排除往局残留的观众数据）
    const currentBet = Math.max(...this.handParticipants(state).map((p) => p.bet), 0)
    state.currentBet = currentBet
    state.lastRaiser = null
    state.bettingRound = createBettingRound(state.players, firstId, currentBet)
    state.currentPlayerId = firstId
    await this.saveState(state)
    this.broadcast(state, {
      type: 'turn_to',
      data: { playerId: firstId, currentBet: state.currentBet },
    })
    this.armTimer(state)
  }

  async doBet(state, playerId, data) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    if (player.role === 'spectator') {
      this.errorTo(this.socketFor(state, playerId), '观众不能下注')
      return
    }
    if (state.phase !== 'playing') return
    if (state.currentPlayerId !== playerId) {
      this.errorTo(this.socketFor(state, playerId), '不是你的回合')
      return
    }
    if (player.folded || player.allIn) return

    const action = data.action
    const amount = Number(data.amount) || 0
    const round = state.bettingRound
    const result = advanceBet(round, state.players, playerId, action, { amount })
    if (!result.valid) {
      this.errorTo(this.socketFor(state, playerId), result.error)
      return
    }

    // 更新底池 = 所有玩家累计 bet 之和
    state.pot = this.handParticipants(state).reduce((sum, p) => sum + p.bet, 0)

    // 广播下注结果
    const allIn = player.allIn
    this.broadcast(state, {
      type: 'bet_result',
      data: { playerId, action, amount: action === 'raise' ? amount : player.bet, allIn, pot: state.pot },
    })

    // 检查一轮是否结束
    if (bettingRoundDone(round, state.players)) {
      state.currentPlayerId = null
      state.bettingRound = null
      await this.saveState(state)
      await this.armNextStage(state)
      return
    }

    state.currentPlayerId = round.currentPlayer
    await this.saveState(state)
    this.broadcast(state, {
      type: 'turn_to',
      data: { playerId: round.currentPlayer, currentBet: round.currentBet },
    })
    this.armTimer(state)
  }

  /** 一轮下注结束 → 发下一阶段牌并开新一轮下注；最后阶段结束则摊牌 */
  async armNextStage(state) {
    const alive = state.players.filter((p) => p.role === 'player' && !p.folded && !p.allIn)
    if (alive.length <= 1) {
      await this.settleHand(state)
      return
    }
    if (!state.hand || state.hand.stage === 'showdown') {
      await this.settleHand(state)
      return
    }

    this.dealNextStageData(state)
    await this.saveState(state)
    this.broadcastState(state)
    for (const p of state.players) {
      if (p.role === 'player') this.sendHandTo(state, this.socketFor(state, p.id))
    }
    await this.beginBettingRound(state)
  }

  /** 摊牌 + 结算 */
  async settleHand(state) {
    state.currentPlayerId = null
    state.bettingRound = null
    this.clearTimer()

    // 计算每个玩家牌型（七张时从 7 张选最佳 5 张）
    // 按开局座位快照结算：中途转观众的玩家，其底池投入和应得奖励不会丢失
    const seatPlayers = this.handParticipants(state)
    const evaluated = seatPlayers.map((p) => {
      const handRank = p.folded ? null : bestFive(p.cards)
      return {
        id: p.id,
        nickname: p.nickname,
        chips: p.chips,
        totalBet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        cards: p.cards,
        handRank,
        handName: handRank ? handRank.name : null,
      }
    })

    const pots = settlePots(evaluated)
    const winners = awardPots(pots)
    const winMap = {}
    for (const w of winners) winMap[w.id] = (winMap[w.id] || 0) + w.amount

    // 结算筹码
    for (const p of state.players) {
      const w = winMap[p.id] || 0
      p.chips += w
    }

    // 广播摊牌
    this.broadcast(state, {
      type: 'showdown',
      data: {
        hands: evaluated.map((e) => ({
          playerId: e.id,
          nickname: e.nickname,
          cards: e.cards,
          handName: e.handName,
          folded: e.folded,
        })),
        winners: winners.map((w) => ({ playerId: w.id, amount: w.amount })),
        pot: state.pot,
      },
    })

    // 广播本局结束
    state.phase = 'settled'
    await this.saveState(state)
    this.broadcastState(state)
    this.broadcast(state, {
      type: 'game_over',
      data: {
        round: state.round,
        totalRounds: state.config.rounds,
      standings: this.handParticipants(state)
        .map((p) => ({ playerId: p.id, nickname: p.nickname, chips: p.chips }))
        .sort((a, b) => b.chips - a.chips),
      },
    })

    // 输光玩家转观众
    for (const p of state.players) {
      if (this.handParticipants(state).includes(p) && p.chips <= 0) this.toSpectator(state, p.id)
    }

    // 本局结束，等房主手动开始下一局（不自动）
    await this.saveState(state)
  }

  finalStandings(state) {
    return {
      round: state.round,
      totalRounds: state.config.rounds,
      standings: state.players
        .filter((p) => p.role === 'player')
        .sort((a, b) => b.chips - a.chips)
        .map((p) => ({ playerId: p.id, nickname: p.nickname, chips: p.chips })),
    }
  }

  toSpectator(state, playerId) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    if (player.role === 'spectator') return
    player.role = 'spectator'
    this.broadcastState(state)
    this.broadcastSpectateState(state)
  }

  /** 广播房间状态（公开信息：角色/筹码/明牌/当前回合/底池） */
  broadcastState(state) {
    const data = this.publicState(state)
    this.broadcast(state, { type: 'room_state', data })
    // 每次公开状态广播时，观众同步收到上帝视角数据
    this.broadcastSpectateState(state)
  }

  publicState(state) {
    return {
      hostId: state.hostId,
      config: state.config,
      phase: state.phase,
      round: state.round,
      finished: state.finished,
      currentPlayerId: state.currentPlayerId,
      currentBet: state.currentBet,
      pot: state.pot,
      stage: state.hand ? state.hand.stage : 'idle',
      players: state.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarId: p.avatarId,
        chips: p.chips,
        role: p.role,
        isHost: p.isHost,
        connected: p.connected,
        folded: p.folded,
        allIn: p.allIn,
        bet: p.bet,
        // 明牌：只发公开的牌
        publicCards: (p.cards || []).filter((c) => !c.hidden),
      })),
    }
  }

  /** 给指定玩家发房间公开状态 */
  sendStateTo(state, socket) {
    if (!socket) return
    this.sendTo(socket, { type: 'room_state', data: this.publicState(state) })
  }

  /** 给指定玩家发自己的手牌（含暗牌） */
  sendHandTo(state, socket) {
    if (!socket) return
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    // 观众收全桌完整牌
    if (player.role === 'spectator') {
      this.broadcastSpectateState(state)
      return
    }
    this.sendTo(socket, {
      type: 'your_hand',
      data: { cards: player.cards || [] },
    })
  }

  broadcastSpectateState(state) {
    const data = {
      players: state.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        chips: p.chips,
        cards: p.cards || [], // 全桌完整牌（含暗牌）
        folded: p.folded,
        allIn: p.allIn,
      })),
      pot: state.pot,
      currentPlayerId: state.currentPlayerId,
    }
    for (const p of state.players) {
      if (p.role === 'spectator') {
        this.sendTo(this.socketFor(state, p.id), { type: 'spectate_state', data })
      }
    }
  }

  /**
   * 超时：30 秒未行动自动弃牌。
   * 用 DO Alarm 而不是内存 setTimeout：hibernation 回收实例后内存 timer 会丢，
   * alarm 持久化在 storage 上，唤醒后仍会触发。
   */
  armTimer(state) {
    this.ctx.storage.setAlarm(Date.now() + BET_TIMEOUT_MS)
  }

  /** DO Alarm 生命周期钩子：从持久化状态恢复后执行超时弃牌 */
  async alarm() {
    await this.enqueue(async () => {
      const state = await this.getState()
      if (!state.currentPlayerId || state.phase !== 'playing') return
      const playerId = state.currentPlayerId
      const player = state.players.find((p) => p.id === playerId)
      if (!player || player.folded || player.allIn || !state.bettingRound) return

      // 超时按弃牌处理，其余逻辑与正常下注一致
      player.folded = true
      state.pot = this.handParticipants(state).reduce((sum, p) => sum + p.bet, 0)
      await this.saveState(state)
      this.broadcast(state, {
        type: 'bet_result',
        data: { playerId, action: 'fold', timeout: true, pot: state.pot },
      })

      if (bettingRoundDone(state.bettingRound, state.players)) {
        state.currentPlayerId = null
        state.bettingRound = null
        await this.saveState(state)
        await this.armNextStage(state)
        return
      }

      state.currentPlayerId = state.bettingRound.currentPlayer
      await this.saveState(state)
      this.broadcast(state, {
        type: 'turn_to',
        data: { playerId: state.currentPlayerId, currentBet: state.currentBet },
      })
      this.armTimer(state)
    })
  }

  clearTimer() {
    this.ctx.storage.deleteAlarm()
  }

  socketFor(state, playerId) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment()
      if (att && att.playerId === playerId) return ws
    }
    return null
  }

  sendTo(socket, msg) {
    try {
      socket.send(JSON.stringify(msg))
    } catch {
      /* 连接已断开 */
    }
  }

  errorTo(socket, message) {
    if (socket) this.sendTo(socket, { type: 'error', data: { message } })
  }

  broadcast(state, msg) {
    for (const ws of this.ctx.getWebSockets()) {
      this.sendTo(ws, msg)
    }
  }
}
