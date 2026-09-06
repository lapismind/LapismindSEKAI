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
const MAX_PLAYER_ID_LENGTH = 64
const MAX_NICKNAME_LENGTH = 64
const MAX_MATCH_FACTS = 100
const FACT_PRIORITY = {
  comeback_win: 0,
  dragon_multi_kill: 1,
  low_hp_kill: 2,
  turn_clear_streak: 3,
  multi_kill_non_dragon: 4,
  round_win_routes: 5,
  round_win_low_hp: 6,
  all_spell_types: 7,
  turn_distinct_spells: 8,
  survivor_secret_stack: 9,
  voluntary_stop: 10,
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareFactStrength(left, right) {
  const leftData = left.data
  const rightData = right.data
  const descending = (...values) => {
    for (const [leftValue, rightValue] of values) {
      if (leftValue !== rightValue) return rightValue - leftValue
    }
    return 0
  }
  let strength = 0
  switch (left.key) {
    case 'turn_distinct_spells':
      strength = descending([leftData.spellIds.length, rightData.spellIds.length], [leftData.castCount, rightData.castCount])
      break
    case 'turn_clear_streak':
      strength = descending([leftData.successCount, rightData.successCount])
      break
    case 'low_hp_kill':
      strength = descending([leftData.targetHpBefore, rightData.targetHpBefore])
      break
    case 'multi_kill_non_dragon':
    case 'dragon_multi_kill':
      strength = descending([leftData.killCount, rightData.killCount])
      break
    case 'comeback_win':
      strength = descending(
        [leftData.opponentScoreBefore - leftData.playerScoreBefore, rightData.opponentScoreBefore - rightData.playerScoreBefore],
        [leftData.finalScore - leftData.opponentScoreBefore, rightData.finalScore - rightData.opponentScoreBefore],
        [leftData.finalScore, rightData.finalScore],
      )
      break
    case 'survivor_secret_stack':
      strength = descending([leftData.secretCount, rightData.secretCount])
      break
    case 'round_win_routes':
      strength = descending([leftData.kill + leftData.allSpells, rightData.kill + rightData.allSpells])
      break
    case 'voluntary_stop':
      strength = descending([leftData.successCount, rightData.successCount], [leftData.distinctCount, rightData.distinctCount])
      break
    default:
      break
  }
  return strength || compareText(JSON.stringify(leftData), JSON.stringify(rightData))
}

function compareFacts(left, right) {
  const priority = (FACT_PRIORITY[left.key] ?? Number.MAX_SAFE_INTEGER)
    - (FACT_PRIORITY[right.key] ?? Number.MAX_SAFE_INTEGER)
  return priority
    || compareText(left.key, right.key)
    || compareText(left.playerId, right.playerId)
    || compareFactStrength(left, right)
}

function retainMatchFacts(facts) {
  const sorted = [...facts].sort(compareFacts)
  const representatives = new Map()
  for (const fact of sorted) {
    const group = `${fact.key}\u0000${fact.playerId}`
    if (!representatives.has(group)) representatives.set(group, fact)
  }
  const retained = [...representatives.values()]
  const representativeSet = new Set(retained)
  for (const fact of sorted) {
    if (retained.length >= MAX_MATCH_FACTS) break
    if (!representativeSet.has(fact)) retained.push(fact)
  }
  return retained.sort(compareFacts)
}

function validPlayerId(playerId) {
  return typeof playerId === 'string' && playerId.startsWith('p') && playerId.length <= MAX_PLAYER_ID_LENGTH
}

function normalizeNickname(nickname) {
  return (typeof nickname === 'string' ? nickname.trim() : '').slice(0, MAX_NICKNAME_LENGTH) || '玩家'
}

export class AbracaRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = String(ctx.name || 'room').slice(0, 64)
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
        // 本局历史战绩：每局 game_over 时存入一条快照
        matchHistory: [],
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
    if (!validPlayerId(playerId)) return new Response('invalid playerId', { status: 400 })

    const state = await this.getState()

    if (state.phase === 'game_over' && !state.players.find(p => p.id === playerId)) {
      return new Response('game over', { status: 410 })
    }

    let joinedNow = false
    const existing = state.players.find(p => p.id === playerId)
    if (!existing) {
      // Only allow new players to join during waiting phase
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
      if (player) {
        // Only mark as disconnected if no other connections exist for this player
        const otherConnections = [...this.ctx.getWebSockets()]
          .filter(ws => ws !== socket)
          .filter(ws => {
            const att = ws.deserializeAttachment()
            return att && att.playerId === playerId
          })
        if (otherConnections.length === 0) {
          player.connected = false
        }
      }
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
      case 'chat':
      case 'emoji':
        // Broadcast chat/emoji messages to all connected clients
        this.broadcastChat(state, msg.type, msg.data, playerId)
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
      reportId: 'abracadawhat:' + crypto.randomUUID(),
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
        scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 },
        roundWins: 0,
        roundWinsByReason: { kill: 0, all_spells: 0 },
        maxTurnCastCount: 0,
        maxTurnDistinctSpells: 0,
      }])),
      round: 0,
      facts: [],
      factsVersion: 2,
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
    state.round = 0          // 每局轮次独立计数：再来一局后从第 1 轮开始
    await this.hostStart(state, playerId)
  }

  /** 一轮结算后开下一轮（保留分数）或宣布冠军 */
  async startNextRound(state) {
    if (state.phase !== 'round_end') return
    const champion = [...state.players].sort((a, b) => b.score - a.score)[0]
    if (champion && champion.score >= state.targetScore) {
      state.phase = 'game_over'
      const finishedAt = state.matchStats?.finishedAt ?? new Date().toISOString()
      if (state.matchStats) state.matchStats.finishedAt = finishedAt
      this.captureComebackFact(state, champion)
      // 记录本局战绩快照到房间历史
      if (!state.matchHistory) state.matchHistory = []
      state.matchHistory.push({
        startedAt: state.matchStats?.startAt ?? new Date().toISOString(),
        endedAt: finishedAt,
        rounds: state.round,
        winnerId: champion.id,
        standings: [...state.players].map(p => ({
          id: p.id, nickname: p.nickname, avatarId: p.avatarId, score: p.score,
        })).sort((a, b) => b.score - a.score),
      })
      // 上报战绩到 auth Worker（异步，不阻塞广播）
      const reportPayload = this.buildMatchReport(state, champion)
      const matchStartedAt = state.matchStats?.startAt
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
      this.ctx.waitUntil(this.reportMatch(reportPayload, matchStartedAt))
      return
    }
    await this.beginRound(state)
  }

  buildMatchReport(state, champion) {
    const snapshots = state.matchStats?.scoreSnapshots || []
    if (!state.matchStats?.reportId || state.matchStats?.factsVersion !== 2) {
      return {
        game: 'abracadawhat',
        roomId: this.roomId,
        rounds: state.round,
        players: Object.values(state.matchStats?.players || {}).map(ms => {
          const player = state.players.find(p => p.id === ms.playerId)
          const wasBehind = ms.playerId === champion.id && snapshots.some(snap => {
            const opponentMax = Math.max(0, ...Object.entries(snap)
              .filter(([id]) => id !== ms.playerId)
              .map(([, score]) => score))
            return opponentMax >= 7 && (snap[ms.playerId] || 0) <= 3
          })
          return {
            ...ms,
            nickname: normalizeNickname(ms.nickname),
            score: player?.score ?? ms.score,
            isChampion: ms.playerId === champion.id,
            finalHp: player?.health ?? null,
            comebackFromBehind: ms.comebackFromBehind === true || wasBehind,
          }
        }),
      }
    }
    const standings = [...state.players]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => {
        const ms = state.matchStats?.players?.[player.id] || {}
        const wasBehind = ms.playerId === champion.id && snapshots.some(snap => {
          const oppMax = Math.max(0, ...Object.entries(snap)
            .filter(([id]) => id !== ms.playerId)
            .map(([, value]) => value))
          return oppMax >= 7 && (snap[ms.playerId] || 0) <= 3
        })
        return {
          playerId: player.id,
          nickname: normalizeNickname(ms.nickname ?? player.nickname),
          rank: index + 1,
          score: player.score ?? ms.score ?? 0,
          scoreBySource: ms.scoreBySource ?? { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 },
          spellCounts: ms.spellsCast ?? {},
          kills: ms.kills ?? 0,
          dragonKills: ms.dragonKills ?? 0,
          deaths: ms.deaths ?? 0,
          suicides: ms.suicides ?? 0,
          roundWins: ms.roundWins ?? 0,
          roundWinsByReason: ms.roundWinsByReason ?? { kill: 0, all_spells: 0 },
          maxTurnCastCount: ms.maxTurnCastCount ?? 0,
          maxTurnDistinctSpells: ms.maxTurnDistinctSpells ?? 0,
        }
      })
    const reportFactState = { matchStats: { facts: structuredClone(state.matchStats?.facts ?? []) } }
    const championSnapshot = snapshots.find(snap => {
      const opponentScoreBefore = Math.max(0, ...Object.entries(snap)
        .filter(([id]) => id !== champion.id)
        .map(([, value]) => value))
      return opponentScoreBefore >= 7
        && (snap[champion.id] || 0) <= 3
        && champion.score > opponentScoreBefore
    })
    if (championSnapshot) {
      const data = {
        playerScoreBefore: championSnapshot[champion.id] || 0,
        opponentScoreBefore: Math.max(0, ...Object.entries(championSnapshot)
          .filter(([id]) => id !== champion.id)
          .map(([, value]) => value)),
        finalScore: champion.score,
      }
      this.addMatchFact(reportFactState, 'comeback_win', champion.id, data)
    }
    return {
      schemaVersion: 2,
      reportId: state.matchStats?.reportId,
      game: 'abracadawhat',
      roomId: this.roomId,
      startedAt: state.matchStats?.startAt,
      finishedAt: state.matchStats?.finishedAt,
      rounds: state.round,
      standings,
      facts: reportFactState.matchStats.facts,
      stories: [],
    }
  }

  async reportMatch(payload, matchStartedAt) {
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
        if (state.phase !== 'game_over' || state.matchStats?.startAt !== matchStartedAt) return
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
    state.startingHands = Object.fromEntries(state.players.map(p => [p.id, [...p.hand]]))
    if (state.matchStats) {
      for (const ms of Object.values(state.matchStats.players)) {
        const usedIndexes = Object.keys(ms.turnSpellSets ?? {}).map(Number)
        const nextUnusedIndex = usedIndexes.length > 0 ? Math.max(...usedIndexes) + 1 : 0
        ms.currentTurnIndex = Math.max(ms.currentTurnIndex ?? 0, nextUnusedIndex)
      }
    }

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
    const actorHpBefore = state.players.find(p => p.id === playerId)?.health ?? null
    const healthBefore = new Map(state.players.map(p => [p.id, p.health]))
    const aliveBefore = new Set(state.players.filter(p => p.alive).map(p => p.id))
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
      const damagedPlayerIds = [...new Set((result.damaged || []).map(d => d.playerId))]
      const killedPlayerIds = damagedPlayerIds.filter((targetId) => {
        const victim = state.players.find(p => p.id === targetId)
        return aliveBefore.has(targetId) && victim && !victim.alive
      })
      const killsThisCast = killedPlayerIds.length
      for (const targetId of killedPlayerIds) {
        const victim = state.players.find(p => p.id === targetId)
        const targetHpBefore = healthBefore.get(targetId)
        if (victim && actorHpBefore === 1 && targetHpBefore >= 3) {
          ms.killedHighHpTarget = true
          this.addMatchFact(state, 'low_hp_kill', playerId, {
            round: state.round,
            spellId,
            actorHp: 1,
            targetHpBefore,
            targetPlayerId: targetId,
          })
        }
      }
      ms.kills += killsThisCast
      if (spellId === 1) {
        ms.dragonKills += killsThisCast
        ms.dragonOneCastKills = Math.max(ms.dragonOneCastKills, killsThisCast)
      } else {
        if (killsThisCast >= 2) {
          ms.singleCastMultiKillNonDragon = Math.max(ms.singleCastMultiKillNonDragon, killsThisCast)
          this.addMatchFact(state, 'multi_kill_non_dragon', playerId, {
            round: state.round, spellId, killCount: killsThisCast,
          })
        }
      }
      if (spellId === 1 && killsThisCast >= 3) {
        this.addMatchFact(state, 'dragon_multi_kill', playerId, {
          round: state.round, spellId: 1, killCount: killsThisCast,
        })
      }
      // 受击方死亡计数
      for (const targetId of killedPlayerIds) {
        const vStats = state.matchStats.players[targetId]
        if (vStats) vStats.deaths += 1
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
      if (result.ok) {
        const spellIds = Object.keys(ms.spellsCast).filter(id => ms.spellsCast[id] > 0).map(Number).sort((a, b) => a - b)
        if (spellIds.length === 8) this.addMatchFact(state, 'all_spell_types', playerId, { spellIds })
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
      this.captureCompletedRound(state, playerId)
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
    const ms = state.matchStats?.players?.[playerId]
    const turnSpells = ms?.turnSpellSets?.[ms.currentTurnIndex] ?? []
    const deliberatelyStopped = turnSpells.length >= 2 && !state.castFailed?.[playerId]
    const result = endTurn(state, playerId)
    if (!result.ok) {
      this.errorTo(this.socketFor(playerId), result.error || '无法结束回合')
      return
    }
    this.captureTurnFacts(state, playerId, turnSpells, deliberatelyStopped)
    // 当前玩家的行动结束后切到新的统计桶，其他玩家保持自己的行动序号。
    this.advanceActionIndex(state, playerId)
    await this.saveState(state)
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
      matchHistory: state.matchHistory ?? [],
      summary: state.summary,
      ...(state.phase === 'round_end' && viewerId && state.startingHands?.[viewerId]
        ? { startingHand: [...state.startingHands[viewerId]] }
        : {}),
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
        // 轮结束时所有牌公开（含自己），方便复盘
        hand: state.phase === 'round_end' ? [...p.hand] : (isSelf(p) ? p.hand.map(() => null) : [...p.hand]),
        // 轮结束时秘密牌也公开
        ...(state.phase === 'round_end' ? { secrets: [...p.secrets] } : {}),
      })),
    }
  }

  addMatchFact(state, key, playerId, data) {
    const facts = (state.matchStats.facts ??= [])
    const serialized = JSON.stringify(data)
    if (facts.some(fact => fact.key === key && fact.playerId === playerId && JSON.stringify(fact.data) === serialized)) return
    facts.push({ key, playerId, data })
    state.matchStats.facts = retainMatchFacts(facts)
  }

  captureComebackFact(state, champion) {
    const snapshots = state.matchStats?.scoreSnapshots ?? []
    const snapshot = snapshots.find((scores) => {
      const opponentScore = Math.max(0, ...Object.entries(scores)
        .filter(([id]) => id !== champion.id)
        .map(([, score]) => score))
      return opponentScore >= 7 && (scores[champion.id] || 0) <= 3 && champion.score > opponentScore
    })
    if (!snapshot) return
    this.addMatchFact(state, 'comeback_win', champion.id, {
      playerScoreBefore: snapshot[champion.id] || 0,
      opponentScoreBefore: Math.max(0, ...Object.entries(snapshot)
        .filter(([id]) => id !== champion.id)
        .map(([, score]) => score)),
      finalScore: champion.score,
    })
  }

  advanceActionIndex(state, playerId) {
    const ms = state.matchStats?.players?.[playerId]
    if (ms) ms.currentTurnIndex = (ms.currentTurnIndex ?? 0) + 1
  }

  captureTurnFacts(state, playerId, turnSpells, voluntary) {
    const ms = state.matchStats?.players?.[playerId]
    if (!ms || turnSpells.length === 0) return
    const spellIds = [...new Set(turnSpells)].sort((a, b) => a - b)
    ms.maxTurnCastCount = Math.max(ms.maxTurnCastCount ?? 0, turnSpells.length)
    ms.maxTurnDistinctSpells = Math.max(ms.maxTurnDistinctSpells ?? 0, spellIds.length)
    if (spellIds.length >= 3) {
      this.addMatchFact(state, 'turn_distinct_spells', playerId, {
        round: state.round, spellIds, castCount: turnSpells.length,
      })
    }
    if (voluntary) {
      this.addMatchFact(state, 'voluntary_stop', playerId, {
        round: state.round, successCount: turnSpells.length, distinctCount: spellIds.length,
      })
    }
  }

  captureCompletedRound(state, actingPlayerId) {
    if (!state.summary || state.matchStats.completedRound === state.round) return
    state.matchStats.completedRound = state.round
    for (const row of state.summary.standings) {
      const ms = state.matchStats.players[row.id]
      if (!ms) continue
      ms.scoreBySource ??= { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 }
      ms.roundWins ??= 0
      ms.roundWinsByReason ??= { kill: 0, all_spells: 0 }
      ms.maxTurnCastCount ??= 0
      ms.maxTurnDistinctSpells ??= 0
      for (const source of ['roundWinPoints', 'survivalPoints', 'secretPoints']) {
        ms.scoreBySource[source] += row.scoreBySource[source]
      }
      const player = state.players.find(p => p.id === row.id)
      if (state.summary.reason === 'all_spells' && row.id !== state.summary.winnerId) ms.deaths += 1
      if (player?.alive && player.secrets.length >= 3) {
        this.addMatchFact(state, 'survivor_secret_stack', row.id, {
          round: state.round, secretCount: player.secrets.length,
        })
      }
    }
    const actingStats = state.matchStats.players[actingPlayerId]
    const turnSpells = actingStats?.turnSpellSets?.[actingStats.currentTurnIndex] ?? []
    this.captureTurnFacts(state, actingPlayerId, turnSpells, false)
    const winnerId = state.summary.winnerId
    if (!winnerId) {
      this.advanceActionIndex(state, actingPlayerId)
      return
    }
    const winnerStats = state.matchStats.players[winnerId]
    const winner = state.players.find(p => p.id === winnerId)
    if (!winnerStats || !winner) return
    winnerStats.roundWins += 1
    winnerStats.roundWinsByReason[state.summary.reason] += 1
    if (winner.health === 1) {
      this.addMatchFact(state, 'round_win_low_hp', winnerId, {
        round: state.round, actorHp: 1, reason: state.summary.reason,
      })
    }
    if (winnerStats.roundWinsByReason.kill >= 1 && winnerStats.roundWinsByReason.all_spells >= 1) {
      this.addMatchFact(state, 'round_win_routes', winnerId, {
        kill: winnerStats.roundWinsByReason.kill,
        allSpells: winnerStats.roundWinsByReason.all_spells,
      })
    }
    if (state.summary.reason === 'all_spells' && turnSpells.length >= 4) {
      this.addMatchFact(state, 'turn_clear_streak', winnerId, {
        round: state.round, successCount: turnSpells.length, reason: 'all_spells',
      })
    }
    this.advanceActionIndex(state, actingPlayerId)
  }

  sendHandTo(state, socket, playerId) {
    const me = state.players.find(p => p.id === playerId)
    if (!me) return
    // 不发具体牌面！玩家自己也不能看自己的牌。
    this.sendTo(socket, { type: 'your_hand', data: { handSize: me.hand.length } })
    this.sendTo(socket, { type: 'your_secrets', data: { secrets: me.secrets } })
  }

  broadcastChat(state, type, data, senderId) {
    const sender = state.players.find(p => p.id === senderId)
    if (!sender) return
    
    const message = {
      type: type,
      data: {
        ...data,
        playerId: senderId,
        nickname: sender.nickname,
        avatarId: sender.avatarId,
      }
    }
    
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() ?? {}
      if (att.playerId) {
        this.sendTo(ws, message)
      }
    }
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
