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
import { createBettingRound, advanceBet, bettingRoundDone, nextPlayer, applyLook } from '../core/betting'
import { evaluateHand, bestFive, compareHands } from '../core/poker'
import { settlePots, awardPots } from '../core/settle'
import { verifyIdentityToken } from '@lapismind/lobby-kit'

const MAX_PLAYERS = 8
const BET_TIMEOUT_MS = 30000 // 30 秒超时自动弃牌
const MAX_PLAYER_ID_LENGTH = 64
const MAX_NICKNAME_LENGTH = 64

function validPlayerId(playerId) {
  return typeof playerId === 'string' && playerId.startsWith('p') && playerId.length <= MAX_PLAYER_ID_LENGTH
}

function normalizeNickname(nickname) {
  return (typeof nickname === 'string' ? nickname.trim() : '').slice(0, MAX_NICKNAME_LENGTH) || '玩家'
}

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
        currentLevel: 0,
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
    const nickname = normalizeNickname(url.searchParams.get('nickname'))
    const avatarId = url.searchParams.get('avatarId') || '0'

    // 验证身份 token —— 无有效 token 则拒绝连接
    const secret = this.env?.IDENTITY_SECRET
    const token = url.searchParams.get('token')
    let playerId
    if (secret) {
      // 身份以验签后的 token 为准：/api/identity 会话优先签发（存在有效会话时
      // token 只可能是会话 playerId），因此这里的 playerId 不会被 URL 参数冒充
      const identity = await verifyIdentityToken(token, secret, 24 * 60 * 60 * 1000)
      if (!identity) return new Response('invalid token', { status: 401 })
      playerId = identity.playerId
    } else {
      // 未配置密钥时降级为旧行为（信任 URL 参数）
      playerId = url.searchParams.get('playerId') || 'p' + crypto.randomUUID().replaceAll('-', '')
    }
    if (!validPlayerId(playerId)) return new Response('invalid playerId', { status: 400 })

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
      if (player) {
        // 同一玩家可能同时存在多个连接（多标签页、重连过渡期），
        // 只有最后一个连接关闭时才标记离线，否则刷新页面会把还在线的自己判为掉线
        const otherConnections = [...this.ctx.getWebSockets()]
          .filter((ws) => ws !== socket)
          .filter((ws) => {
            const att = ws.deserializeAttachment()
            return att && att.playerId === playerId
          })
        if (otherConnections.length === 0) player.connected = false
      }
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
      case 'rematch':
        await this.hostRematch(state, playerId)
        break
      case 'bet':
        await this.doBet(state, playerId, msg.data)
        break
      case 'look':
        await this.doLook(state, playerId)
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
    if (state.finished) return // 整场已结束，防止误开新一局
    const players = state.players.filter((p) => p.role === 'player')
    if (players.length < 2) {
      this.errorTo(this.socketFor(state, playerId), '至少需要 2 名玩家')
      return
    }
    await this.beginHand(state)
  }

  /**
   * 整场结束后再来一局：筹码回到初始值、清空牌局状态，房间退回 waiting。
   * 输光转观众的玩家重新入座（按加入顺序填满 MAX_PLAYERS），
   * 否则一局打完房间就废了，只能回大厅重建。
   */
  async hostRematch(state, playerId) {
    if (state.hostId !== playerId) {
      this.errorTo(this.socketFor(state, playerId), '只有房主能再来一局')
      return
    }
    if (!state.finished) {
      this.errorTo(this.socketFor(state, playerId), '整场尚未结束')
      return
    }

    const ordered = [...state.players].sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
    let seated = 0
    for (const p of ordered) {
      const getsSeat = seated < MAX_PLAYERS
      if (getsSeat) seated += 1
      p.role = getsSeat ? 'player' : 'spectator'
      p.chips = state.config.initialChips
      p.cards = []
      p.bet = 0
      p.level = 0
      p.folded = false
      p.allIn = false
      p.blind = false
      p.looked = false
      p.everPlayed = false
    }

    state.phase = 'waiting'
    state.round = 0
    state.finished = false
    state.pot = 0
    state.currentLevel = 0
    state.currentPlayerId = null
    state.lastRaiser = null
    state.bettingRound = null
    state.hand = null
    state.currentLevel = 0
    this.clearTimer()

    await this.saveState(state)
    this.broadcastState(state)
    for (const p of state.players) {
      if (p.role === 'player') this.sendHandTo(state, this.socketFor(state, p.id))
    }
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

    // 清掉所有人的本局残留（含观众上一局留下的 bet —— 不清会一直挂在座位上显示），
    // 再给在座玩家发牌。注意不能在 toSpectator 里清：中途转观众的玩家
    // 已经投入的筹码仍要参与本局结算。
    for (const p of state.players) {
      p.cards = []
      p.bet = 0
      p.level = 0
      p.folded = false
      p.allIn = false
      p.blind = false
      p.looked = false
    }
    // 标记"上过牌桌"：最终排名要包含中途输光转观众的玩家，
    // 而不是只统计最后一局的参与者
    for (const p of seatPlayers) p.everPlayed = true

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
      // 底注计入档位：闷牌轮的起注档位是底注的 2 倍，
      // 于是看牌者要补一个底注、闷牌者补 0 —— 半价从这里开始就有实感
      p.level = p.bet
      state.pot += p.bet
    }

    // 边发边下注，但第一轮是"闷牌轮"：只发 1 张暗牌，玩家可以选择
    // 不看牌半价下注。hand 必须以纯数据形式持久化（含剩余 deck），
    // 跨消息 / hibernation 唤醒后仍能续发。
    const freshHand = createHand(state.config.mode, seatPlayers.length)
    state.hand = {
      mode: freshHand.mode,
      stage: 'blind',
      deck: freshHand.deck,
      playerIds: seatPlayers.map((p) => p.id),
      ante,
      blindLevel: ante * 2,
    }
    // 闷牌轮每人只发开头那张暗牌
    for (const p of seatPlayers) {
      const card = state.hand.deck.pop()
      p.cards.push({ suit: card.suit, rank: card.rank, hidden: true })
      p.blind = true
    }
    // 先把起注档位写好再广播：beginBettingRound 也会算一遍（同样的值），
    // 但这里之前是 0，导致"开局第一帧"的房间状态带着一个不存在的档位
    state.currentLevel = state.hand.blindLevel

    await this.saveState(state)
    this.broadcastState(state)
    this.syncHands(state)
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
    if (hand.stage === 'blind') {
      // 闷牌轮结束：补发 preflop 剩下的牌，之后的节奏与原来完全一致。
      // 同时所有人自动亮牌给自己 —— 半价只买第一轮，不能带着走到后面。
      if (isFive) {
        dealEach(false) // 第 2 张：明牌
      } else if (isSeven) {
        dealEach(true) // 第 2 张：暗牌
        dealEach(false) // 第 3 张：明牌
      }
      for (const p of participants) p.blind = false
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
    // 只把本局参与者交给下注状态机。观众虽然还在 state.players 里，但
    // nextPlayer / bettingRoundDone 只看 folded/allIn、不看 role，一旦把观众
    // 一起传进去，回合会被交给观众，下注轮永远结束不了（只能靠 30 秒超时
    // 逐个把观众"弃牌"才推得动）。
    const participants = this.handParticipants(state)
    const notFolded = participants.filter((p) => !p.folded)
    if (notFolded.length <= 1) {
      await this.settleHand(state)
      return
    }
    const canAct = notFolded.filter((p) => !p.allIn)
    if (canAct.length === 0) {
      // 所有人都 all-in，跳到下一阶段发牌
      await this.armNextStage(state)
      return
    }
    const firstId = canAct[0].id
    // 闷牌轮：起注档位 = 底注的 2 倍（底注已计入各方档位，于是看牌者补一个
    // 底注、闷牌者补 0），且本轮启用半价规则。其余轮次按"已有投入的最大值"
    // 起手，与闷牌轮之前的行为一致。
    const isBlindRound = state.hand?.stage === 'blind'
    const currentLevel = isBlindRound
      ? Math.max(state.hand.blindLevel ?? 0, 0)
      : Math.max(...participants.map((p) => p.bet), 0)
    state.currentLevel = currentLevel
    state.lastRaiser = null
    state.bettingRound = createBettingRound(participants, firstId, currentLevel, {
      halfPrice: isBlindRound,
    })
    state.currentPlayerId = firstId
    await this.saveState(state)
    // 补一次状态广播：调用方（beginHand / armNextStage）在算档位之前已经播过一帧，
    // 那一帧里 currentPlayerId 与档位都还是旧值。不补的话客户端只能靠 turn_to
    // 打补丁，任何按 room_state 判断回合的代码都会读到不一致的状态。
    this.broadcastState(state)
    this.broadcast(state, {
      type: 'turn_to',
      data: {
        playerId: firstId,
        currentBet: state.currentLevel,
        blindRound: isBlindRound,
      },
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
    const participants = this.handParticipants(state)
    const result = advanceBet(round, participants, playerId, action, { amount })
    if (!result.valid) {
      this.errorTo(this.socketFor(state, playerId), result.error)
      return
    }

    // 更新底池 = 本局参与者累计 bet 之和
    state.pot = participants.reduce((sum, p) => sum + p.bet, 0)

    // 广播下注结果
    const allIn = player.allIn
    this.broadcast(state, {
      type: 'bet_result',
      data: { playerId, action, amount: action === 'raise' ? amount : player.bet, allIn, pot: state.pot },
    })

    // 检查一轮是否结束
    if (bettingRoundDone(round, participants)) {
      state.currentPlayerId = null
      state.bettingRound = null
      await this.saveState(state)
      await this.armNextStage(state)
      return
    }

    state.currentPlayerId = round.currentPlayer
    await this.saveState(state)
    // 每次下注后重播房间状态：底池和每个座位已投入的筹码必须实时可见，
    // 否则一整轮下注期间这两处数字都是冻结的，玩家看不到池子怎么涨
    this.broadcastState(state)
    this.broadcast(state, {
      type: 'turn_to',
      data: { playerId: round.currentPlayer, currentBet: round.currentLevel },
    })
    this.armTimer(state)
  }

  /**
   * 看牌：闷牌者亮牌给自己。
   * 只能在**自己回合**看 —— 若允许随时看牌，已行动玩家的档位会中途回落到
   * 实际投入（applyLook 的规则），"本轮是否结束"的判断会随之变化，很难推理。
   * 轮到你行动时也正是你需要做决定的时候，所以限制在自己回合不影响体验。
   */
  async doLook(state, playerId) {
    if (state.phase !== 'playing') return
    if (state.hand?.stage !== 'blind') {
      this.errorTo(this.socketFor(state, playerId), '闷牌轮已经结束')
      return
    }
    if (state.currentPlayerId !== playerId) {
      this.errorTo(this.socketFor(state, playerId), '只能在你自己的回合看牌')
      return
    }
    const player = this.handParticipants(state).find((p) => p.id === playerId)
    if (!player) {
      this.errorTo(this.socketFor(state, playerId), '你不在本局牌桌上')
      return
    }
    if (!state.bettingRound) return
    const result = applyLook(player)
    if (!result.valid) {
      this.errorTo(this.socketFor(state, playerId), result.error)
      return
    }
    await this.saveState(state)
    // 亮给自己：sendHandTo 不再屏蔽这个人的牌
    this.sendHandTo(state, this.socketFor(state, playerId))
    this.broadcastState(state)
  }

  /** 把各自的手牌推送给所有在座玩家（发牌后 / 状态变化后调用） */
  syncHands(state) {
    for (const p of state.players) {
      if (p.role === 'player') this.sendHandTo(state, this.socketFor(state, p.id))
    }
  }

  /** 一轮下注结束 → 发下一阶段牌并开新一轮下注；最后阶段结束则摊牌 */
  async armNextStage(state) {
    const notFolded = this.handParticipants(state).filter((p) => !p.folded)
    if (notFolded.length <= 1) {
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
    // 多个分池时同一玩家会出现在 winners 里多次；按玩家聚合成一条再广播，
    // 避免前端把重复的 netDelta 累加出错误总额
    const aggWinners = Object.values(
      winners.reduce((acc, w) => {
        acc[w.id] = acc[w.id] || { playerId: w.id, amount: 0 }
        acc[w.id].amount += w.amount
        return acc
      }, {})
    )

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
          totalBet: e.totalBet,
          // 本局净变化 = 赢得的池份额 - 自己累计投入（弃牌者必为负）
          delta: (winMap[e.id] || 0) - e.totalBet,
        })),
        winners: aggWinners.map((w) => ({
          ...w,
          netDelta: winMap[w.playerId] ?? 0,
        })),
        pot: state.pot,
      },
    })

    // 广播本局结束；固定局数打满则立即标记整场完成（前端据此直接揭晓冠军）
    state.phase = 'settled'
    if (state.round >= state.config.rounds) {
      state.finished = true
    }
    await this.saveState(state)
    this.broadcastState(state)
    // 打满局数时给出整场最终排名（含中途输光退席的玩家），否则只报本局参与者
    this.broadcast(state, {
      type: 'game_over',
      data: state.finished
        ? this.finalStandings(state)
        : {
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
        .filter((p) => p.everPlayed === true)
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
      currentBet: state.currentLevel,
      blindRound: state.hand?.stage === 'blind',
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
        // 闷牌中（本轮还没看牌）：座位上显示"闷"标记
        blind: p.blind === true,
        looked: p.looked === true,
        // 明牌：只发公开的牌
        publicCards: (p.cards || []).filter((c) => !c.hidden),
        cardCount: (p.cards || []).length,
      })),
    }
  }

  /** 给指定玩家发房间公开状态 */
  sendStateTo(state, socket) {
    if (!socket) return
    this.sendTo(socket, { type: 'room_state', data: this.publicState(state) })
  }

  /**
   * 某人应收到的牌面。
   * 闷牌者的暗牌**连他自己都不发**：前端把牌藏起来挡不住 DevTools，
   * 一旦下发，"不看牌换半价"的机制当场作废。所以遮罩必须发生在服务端。
   * 占位符不带 suit/rank，客户端渲染成"闷"牌背。
   */
  visibleCards(player) {
    const cards = player.cards || []
    if (player.blind !== true) return cards
    return cards.map((c) =>
      c.hidden ? { suit: '', rank: 0, hidden: true, concealed: true } : c,
    )
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
      data: { cards: this.visibleCards(player) },
    })
  }

  broadcastSpectateState(state) {
    const data = {
      players: state.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        chips: p.chips,
        // 上帝视角看全桌，但闷牌者的暗牌同样遮住：
        // 观众若能看见，一句"你那张是梅花 3"就能把机制废掉
        cards: this.visibleCards(p),
        folded: p.folded,
        allIn: p.allIn,
        blind: p.blind === true,
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
      const participants = this.handParticipants(state)
      state.pot = participants.reduce((sum, p) => sum + p.bet, 0)
      await this.saveState(state)
      this.broadcast(state, {
        type: 'bet_result',
        data: { playerId, action: 'fold', timeout: true, pot: state.pot },
      })

      if (bettingRoundDone(state.bettingRound, participants)) {
        state.currentPlayerId = null
        state.bettingRound = null
        await this.saveState(state)
        await this.armNextStage(state)
        return
      }

      state.currentPlayerId = state.bettingRound.currentPlayer
      await this.saveState(state)
      this.broadcastState(state)
      this.broadcast(state, {
        type: 'turn_to',
        data: { playerId: state.currentPlayerId, currentBet: state.currentLevel },
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
