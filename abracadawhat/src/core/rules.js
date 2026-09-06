/**
 * core/rules.js —— 《出包魔法师》规则引擎。
 * 服务端持有全部暗牌并做唯一仲裁；这里只操作可序列化纯数据。
 */

export const TARGET_SCORE = 8
export const MAX_HEALTH = 6
export const HAND_SIZE = 5

export const SPELLS = [
  { id: 1, emoji: '🐉', name: '古代巨龙', count: 1, dice: true, desc: '其他玩家扣 1–3❤️；施法失败也扣 1–3❤️' },
  { id: 2, emoji: '👻', name: '黑暗幽灵', count: 2, desc: '其他玩家扣 1❤️，你加 1❤️' },
  { id: 3, emoji: '💕', name: '甜蜜的梦', count: 3, dice: true, desc: '你回复 1–3❤️' },
  { id: 4, emoji: '🦉', name: '猫头鹰', count: 4, desc: '获取一张秘密牌；轮末存活时每张秘密牌多加 1 分' },
  { id: 5, emoji: '⛈️', name: '闪电暴风雨', count: 5, desc: '上家和下家各扣 1❤️' },
  { id: 6, emoji: '🌨️', name: '暴风雪', count: 6, desc: '上家扣 1❤️' },
  { id: 7, emoji: '🔥', name: '火球', count: 7, desc: '下家扣 1❤️' },
  { id: 8, emoji: '🧪', name: '魔法药水', count: 8, desc: '你加 1❤️' },
]

export function secretCountFor(playerCount) {
  if (playerCount === 2) return 12
  if (playerCount === 3) return 6
  if (playerCount === 4 || playerCount === 5) return 4
  throw new Error('出包魔法师支持 2–5 名玩家')
}

export function createDeck() {
  const deck = []
  for (const spell of SPELLS) {
    for (let i = 0; i < spell.count; i += 1) deck.push(spell.id)
  }
  return deck
}

export function shuffle(input, rng = Math.random) {
  const items = [...input]
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

export function prepareRound(playerInputs, rng = Math.random, startingPlayerId = null) {
  const count = playerInputs.length
  const secretTotal = secretCountFor(count)
  const pool = shuffle(createDeck(), rng)
  const players = playerInputs.map((input, index) => ({
    ...input,
    seat: index,
    score: input.score ?? 0,
    health: MAX_HEALTH,
    hand: [],
    secrets: [],
    alive: true,
    connected: input.connected ?? true,
    isHost: input.isHost ?? false,
  }))

  const secretPile = pool.splice(0, secretTotal)
  for (const player of players) player.hand = pool.splice(0, HAND_SIZE)

  const first = startingPlayerId ?? players[0].id
  return {
    phase: 'playing',
    round: 1,
    targetScore: TARGET_SCORE,
    players,
    deck: pool,
    secretPile,
    castCounts: Object.fromEntries(SPELLS.map((spell) => [spell.id, 0])),
    currentPlayerId: first,
    lastCastLevel: null,
    castSucceeded: {},
    castFailed: {},
    summary: null,
  }
}

function rollDamage(rng) {
  return Math.floor(rng() * 3) + 1
}

function clampHealth(player) {
  player.health = Math.min(MAX_HEALTH, Math.max(0, player.health))
  if (player.health === 0) player.alive = false
}

export function canCast(lastLevel, level) {
  return lastLevel == null || level >= lastLevel
}

function neighborsOf(state, playerId) {
  const index = state.players.findIndex((p) => p.id === playerId)
  const count = state.players.length
  return {
    up: state.players[(index - 1 + count) % count],
    down: state.players[(index + 1) % count],
  }
}

function aliveOthers(state, playerId) {
  return state.players.filter((p) => p.id !== playerId && p.alive)
}

function finishRound(state, reason, winnerId = null, decisiveSpellId = null) {
  if (state.phase === 'round_end') return

  const roundGains = {}
  const scoreBySource = {}
  for (const player of state.players) {
    const sources = { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 }
    // 规则：清空手牌者获胜时，其余玩家按死亡处理。
    if (reason === 'all_spells' && player.id !== winnerId) player.alive = false
    if (player.alive) {
      if (player.id === winnerId && (reason === 'all_spells' || reason === 'kill')) {
        sources.roundWinPoints = 3
      } else if (reason !== 'all_spells') {
        sources.survivalPoints = 1
      }
      sources.secretPoints = player.secrets.length
    }
    const gained = Object.values(sources).reduce((sum, points) => sum + points, 0)
    player.score += gained
    roundGains[player.id] = gained
    scoreBySource[player.id] = sources
  }

  state.phase = 'round_end'
  state.currentPlayerId = null
  state.lastCastLevel = null
  state.summary = {
    reason,
    winnerId,
    decisiveSpellId,
    standings: [...state.players]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatarId: p.avatarId,
        score: p.score,
        gained: roundGains[p.id],
        scoreBySource: scoreBySource[p.id],
      })),
  }
}

function nextAlivePlayer(state, fromId) {
  const ordered = [...state.players].sort((a, b) => a.seat - b.seat)
  const start = ordered.findIndex((p) => p.id === fromId)
  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered[(start + offset) % ordered.length]
    if (candidate.alive) return candidate.id
  }
  return null
}

export function applyCast(state, playerId, spellId, rng = Math.random) {
  if (state.phase !== 'playing') return { ok: false, error: '本轮已结束' }
  if (state.currentPlayerId !== playerId) return { ok: false, error: '不是你的回合' }
  if (state.castFailed?.[playerId]) return { ok: false, error: '本回合已猜错，请结束回合' }

  const caster = state.players.find((p) => p.id === playerId)
  if (!caster?.alive) return { ok: false, error: '你不能施法' }

  const spell = SPELLS.find((item) => item.id === Number(spellId))
  if (!spell) return { ok: false, error: '未知魔法' }
  if (!canCast(state.lastCastLevel, spell.id)) {
    return { ok: false, error: '不能施放比上一个魔法更罕见的魔法' }
  }

  // 失败：普通魔法固定 1 心，古代巨龙掷 1–3。
  if (!caster.hand.includes(spell.id)) {
    const damage = spell.id === 1 ? rollDamage(rng) : 1
    caster.health -= damage
    clampHealth(caster)
    const event = {
      type: 'cast_failed',
      reason: 'missing',
      playerId,
      spellId: spell.id,
      damage,
      died: !caster.alive,
    }

    if (!caster.alive) {
      finishRound(state, 'self_destruct', null, spell.id)
      return { ok: false, ...event, roundEnded: true }
    }

    // 规则：猜错后仍留在自己的回合，但不能继续施法，
    // 只能按“结束回合”补齐手牌并轮到下一位。
    state.lastCastLevel = null
    state.castSucceeded = { ...state.castSucceeded, [playerId]: false }
    state.castFailed = { ...state.castFailed, [playerId]: true }
    return { ok: false, ...event }
  }

  // 成功：消耗一张牌，再结算效果。
  caster.hand.splice(caster.hand.indexOf(spell.id), 1)
  state.castCounts[spell.id] += 1
  state.lastCastLevel = spell.id
  state.castSucceeded = { ...state.castSucceeded, [playerId]: true }
  state.castFailed = { ...state.castFailed, [playerId]: false }

  const { up, down } = neighborsOf(state, playerId)
  const damaged = []
  const healed = []
  let dice = null
  let secretTaken = null

  const damagePlayer = (target, amount) => {
    if (!target?.alive || amount <= 0) return
    target.health -= amount
    clampHealth(target)
    damaged.push({ playerId: target.id, amount })
  }
  const healCaster = (amount) => {
    if (amount <= 0) return
    caster.health += amount
    clampHealth(caster)
    healed.push({ playerId: playerId, amount })
  }

  switch (spell.id) {
    case 1: {
      dice = rollDamage(rng)
      for (const target of aliveOthers(state, playerId)) damagePlayer(target, dice)
      break
    }
    case 2: {
      for (const target of aliveOthers(state, playerId)) damagePlayer(target, 1)
      healCaster(1)
      break
    }
    case 3:
      dice = rollDamage(rng)
      healCaster(dice)
      break
    case 4:
      secretTaken = state.secretPile.shift() ?? null
      if (secretTaken != null) caster.secrets.push(secretTaken)
      break
    case 5:
      for (const target of new Map([up, down].filter(Boolean).map((player) => [player.id, player])).values()) {
        damagePlayer(target, 1)
      }
      break
    case 6:
      damagePlayer(up, 1)
      break
    case 7:
      damagePlayer(down, 1)
      break
    case 8:
      healCaster(1)
      break
    default:
      break
  }

  const event = {
    type: 'cast_success',
    playerId,
    spellId: spell.id,
    dice,
    damaged,
    healed,
    secretTaken,
    handEmpty: caster.hand.length === 0,
  }

  const killedSomeone = state.players.some((p) => p.id !== playerId && !p.alive)
  if (killedSomeone) {
    finishRound(state, 'kill', playerId, spell.id)
    return { ok: true, ...event, roundEnded: true }
  }
  if (caster.hand.length === 0) {
    finishRound(state, 'all_spells', playerId, spell.id)
    return { ok: true, ...event, roundEnded: true }
  }

  return { ok: true, ...event }
}

export function refillHand(state, playerId) {
  const player = state.players.find((p) => p.id === playerId)
  while (player && player.hand.length < HAND_SIZE && state.deck.length > 0) {
    player.hand.push(state.deck.shift())
  }
}

export function endTurn(state, playerId) {
  if (state.phase !== 'playing') return { ok: false, error: '本轮已结束' }
  if (state.currentPlayerId !== playerId) return { ok: false, error: '不是你的回合' }

  // 规则：必须至少宣告过一次魔法（无论成败），才允许主动结束回合。
  const attempted = state.castSucceeded?.[playerId] || state.castFailed?.[playerId]
  if (!attempted) {
    return { ok: false, error: '至少需要宣告一次魔法才能结束回合' }
  }

  refillHand(state, playerId)

  state.lastCastLevel = null
  state.castSucceeded = { ...state.castSucceeded, [playerId]: false }
  state.castFailed = { ...state.castFailed, [playerId]: false }
  state.currentPlayerId = nextAlivePlayer(state, playerId)
  return { ok: true, type: 'turn_passed', nextPlayerId: state.currentPlayerId }
}
