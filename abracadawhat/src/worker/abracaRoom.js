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
        // 战绩累积：从 hostStart 到 game_over 之间的事件流水
        matchStats: null,
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
      // 身份以验签后的 token 为准：/api/identity 会话优先签发（存在有效会话时
      // token 只可能是会话 playerId），因此这里的 playerId 不会被 URL 参数冒充
      const identity = await verifyIdentityToken(token, secret, 24 * 60 * 60 * 1000)
      if (!identity) return new Response('invalid token', { status: 401 })
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
      case 'rematch':
        await this.hostRematch(state, playerId)
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
    // 开场：初始化战绩累积器
    state.matchStats = {
      startAt: new Date().toISOString(),
      players: Object.fromEntries(state.players.map(p => [p.id, {
        playerId: p.id,
        nickname: p.nickname,
        score: 0,
        isChampion: false,
        kills: 0,
        deaths: 0,
        spellsCast: {},        // { spellId: count }
        secretsTaken: 0,
        roundsSurvived: 0,
        // 成就专用
        roundWonAtHp1: false,
        roundEndSecrets: 0,
        roundKillsNonDragon: 0,
        dragonKills: 0,
        dragonOneCastKills: 0,
        finalHp: null,
        firstRoundSuicide: false,
        roundSpellCasts: [],   // [{round, spellId}]
        maxFailsInRound: 0,
        hadFullHpThenDied: false,
        // v2 成就专用
        castStreaks: {},          // { spellId: [true/false,...] } 按施法顺序记录成败
        turnSpellSets: {},        // { turnIndex: [spellId,...] } 单回合成功施法集合
        currentTurnIndex: 0,      // 回合计数（每次 turn_to 换人 +1）
        dragonFails: 0,           // 古代巨龙施法失败次数
        suicides: 0,              // 施法失败把自己炸死次数
        killedHighHpTarget: false, // 击杀过 preKillHp >= 3 且自己 hp === 1
        singleCastMultiKillNonDragon: 0, // 单次非龙施法击杀数（幽灵/暴风雨最多 2）
        firstTurnDragon3: false,  // 本人首个回合放龙掷出 3
        comebackFromBehind: false,// 对手曾 >=7 分而自己 <=3，最终夺冠
        roundWonNoSecrets: false, // 轮胜时秘密牌为 0 且从未放过猫头鹰
        hadLowThenFullThenDied: false, // hp 曾 <=2 后回到 6 再死亡
        lowHpSeen: false,         // 内部标记
        castOwlThisMatch: false,  // 本场是否放过猫头鹰
      }])),
      round: 0,
    }
    await this.beginRound(state)
  }

  /** 房主发起再来一局：重置战绩回到 start_round 初始状态，清掉 game_over 结算 */
  async hostRematch(state, playerId) {
    if (state.hostId !== playerId) {
      this.errorTo(this.socketFor(playerId), '只有房主能再来一局')
      return
    }
    if (state.phase !== 'game_over') {
      this.errorTo(this.socketFor(playerId), '游戏未结束，无法再来一局')
      return
    }
    await this.hostStart(state, playerId)
  }

  /** 一轮结算后开下一轮（保留分数）或宣布冠军 */
  async startNextRound(state) {
    if (state.phase !== 'round_end') return
    const champion = [...state.players].sort((a, b) => b.score - a.score)[0]
    if (champion && champion.score >= state.targetScore) {
      state.phase = 'game_over'
      // 上报战绩到 auth Worker（异步，不阻塞广播）
      const reportPayload = this.buildMatchReport(state, champion)
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
      this.ctx.waitUntil(this.reportMatch(reportPayload))
      return
    }
    await this.beginRound(state)
  }

  buildMatchReport(state, champion) {
    const snapshots = state.matchStats?.scoreSnapshots || []
    return {
      game: 'abracadawhat',
      roomId: this.roomId,
      rounds: state.round,
      players: Object.values(state.matchStats?.players || {}).map(ms => {
        const sp = state.players.find(p => p.id === ms.playerId)
        // 我不同意：任一时刻有对手分数 >=7 而自己 <=3，最终自己夺冠
        const wasBehind = ms.playerId === champion.id && snapshots.some(snap => {
          const oppMax = Math.max(0, ...Object.entries(snap)
            .filter(([id]) => id !== ms.playerId)
            .map(([, v]) => v))
          return oppMax >= 7 && (snap[ms.playerId] || 0) <= 3
        })
        if (wasBehind) ms.comebackFromBehind = true
        return {
          ...ms,
          score: sp?.score ?? ms.score,
          isChampion: ms.playerId === champion.id,
          finalHp: sp?.health ?? null,
        }
      }),
    }
  }

  async reportMatch(payload) {
    const secret = this.env?.MATCH_REPORT_SECRET
    if (!secret) return
    try {
      // 本地开发可通过 MATCH_REPORT_URL 指向本地 auth，线上默认生产地址
      const reportUrl = this.env?.MATCH_REPORT_URL || 'https://auth.qmzhj.top/api/matches'
      const res = await fetch(reportUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + secret },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.newAchievements) && data.newAchievements.length > 0) {
        // 把新成就广播回房间（结算画面展示）
        const state = await this.getState()
        this.broadcast(state, { type: 'achievements_unlocked', data: data.newAchievements })
      }
    } catch (err) {
      console.error('report match failed:', err)
    }
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
  }

  async doCast(state, playerId, data) {
    if (state.phase !== 'playing') return
    const spellId = Number(data?.spellId)
    const result = applyCast(state, playerId, spellId)
    // 累积施法事件到战绩（无论成败都记，成就判定需要失败次数）
    if (state.matchStats && state.matchStats.players[playerId]) {
      const ms = state.matchStats.players[playerId]
      if (result.ok) {
        ms.spellsCast[spellId] = (ms.spellsCast[spellId] || 0) + 1
        ms.roundSpellCasts.push({ round: state.round, spellId })
        // 连续施法序列（流星火雨/霜天：同一魔法连续成功 3 次）
        ;(ms.castStreaks[spellId] ??= []).push(true)
        // 回合内成功施法集合（元素反应：同回合集齐 5/6/7）
        ;(ms.turnSpellSets[ms.currentTurnIndex] ??= []).push(spellId)
        if (spellId === 4) ms.castOwlThisMatch = true
      } else if (result.reason === 'missing') {
        // 失败打断连续序列
        ;(ms.castStreaks[spellId] ??= []).push(false)
        if (spellId === 1) ms.dragonFails += 1
      }
      // 伤害/击杀明细
      let killsThisCast = 0
      for (const d of result.damaged || []) {
        const victim = state.players.find(p => p.id === d.playerId)
        if (victim && !victim.alive) {
          killsThisCast += 1
          // 绝地反击：自己 1 血时击杀过死前血量 >= 3 的目标
          const preKillHp = victim.health + d.amount
          const me = state.players.find(p => p.id === playerId)
          if (preKillHp >= 3 && me?.health === 1) ms.killedHighHpTarget = true
        }
      }
      if (spellId === 1) {
        ms.dragonKills += killsThisCast
        ms.dragonOneCastKills = Math.max(ms.dragonOneCastKills, killsThisCast)
      } else {
        ms.kills += killsThisCast
        if (killsThisCast >= 2) {
          ms.singleCastMultiKillNonDragon = Math.max(ms.singleCastMultiKillNonDragon, killsThisCast)
        }
      }
      // 受击方死亡计数
      for (const d of result.damaged || []) {
        const vStats = state.matchStats.players[d.playerId]
        const vState = state.players.find(p => p.id === d.playerId)
        if (vStats && vState && !vState.alive) {
          vStats.deaths += 1
        }
      }
      // 开幕雷击：第 1 轮本人首个有施法的回合，放龙掷出 3
      if (spellId === 1 && result.ok && result.dice === 3 && state.round === 1
          && Object.keys(ms.turnSpellSets).length <= 1) {
        ms.firstTurnDragon3 = true
      }
      // 自杀（施法失败把自己炸死）
      if (result.reason === 'missing' && result.died) {
        ms.suicides += 1
        ms.deaths += 1
        if (state.round === 1) ms.firstRoundSuicide = true
      }
    }
    // 轮结束时的成就字段
    if (state.phase === 'round_end' && state.matchStats && state.summary) {
      const winnerId = state.summary.winnerId
      const wStats = winnerId && state.matchStats.players[winnerId]
      const wState = winnerId && state.players.find(p => p.id === winnerId)
      if (wStats && wState) {
        if (wState.health === 1) wStats.roundWonAtHp1 = true
        wStats.roundEndSecrets = Math.max(wStats.roundEndSecrets, wState.secrets.length)
        if (wState.secrets.length === 0 && !wStats.castOwlThisMatch) wStats.roundWonNoSecrets = true
      }
      for (const p of state.players) {
        const ms = state.matchStats.players[p.id]
        if (ms && p.alive) ms.roundsSurvived += 1
      }
      // 记录本轮结束时的分数快照（"我不同意"逆转判定用）
      ;(state.matchStats.scoreSnapshots ??= []).push(
        Object.fromEntries(state.players.map(p => [p.id, p.score]))
      )
    }
    await this.saveState(state)
    this.broadcast(state, { type: 'cast_result', data: result })
    this.broadcastStateAll(state)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) this.sendHandTo(state, ws, att.playerId)
    }
    if (state.phase === 'round_end') {
      this.broadcast(state, { type: 'round_end', data: state.summary })
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
    // 回合切换：所有玩家 currentTurnIndex +1（用于元素反应的"单回合"界定）
    if (state.matchStats) {
      for (const ms of Object.values(state.matchStats.players)) ms.currentTurnIndex += 1
    }
    this.broadcast(state, { type: 'turn_to', data: { playerId: state.currentPlayerId } })
    this.broadcastStateAll(state)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) this.sendHandTo(state, ws, att.playerId)
    }
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
