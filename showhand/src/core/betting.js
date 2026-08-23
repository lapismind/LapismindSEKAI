/**
 * core/betting.js —— 下注轮转状态机（纯函数）。
 *
 * 一轮下注的规则：
 * - 从 currentPlayer 开始，轮流行动：跟注 / 加注 / 弃牌 / 全下
 * - 加注后回到未跟到新注额的玩家（多次加注）
 * - 一轮结束：所有未弃牌且未 all-in 的玩家都跟到 currentBet，或只剩 1 人未弃牌
 * - 已 all-in 的玩家跳过轮转
 *
 * round 对象：{ currentPlayer, currentBet, lastRaiser, turnCount, actedIds }
 */

export function createBettingRound(players, firstPlayerId, currentBet = 0) {
  return {
    currentPlayer: firstPlayerId,
    currentBet,
    lastRaiser: null,
    turnCount: 0,
    actedIds: [],
  }
}

function activePlayers(players) {
  return players.filter((p) => !p.folded)
}

/** 找下一个未行动完的玩家（从 id 之后，跳过弃牌/all-in） */
export function nextPlayer(players, fromId) {
  const ids = players.map((p) => p.id)
  const idx = ids.indexOf(fromId)
  const active = activePlayers(players)
  if (active.length <= 1) return null
  for (let i = 1; i <= players.length; i++) {
    const p = players[(idx + i) % players.length]
    if (!p.folded && !p.allIn) return p.id
  }
  return null
}

/**
 * 处理一个行动。返回 { valid, error?, round? }。
 * players 会被原地修改（bet/folded/allIn/chips）。
 */
export function advanceBet(round, players, playerId, action, { amount } = {}) {
  const player = players.find((p) => p.id === playerId)
  if (!player) return { valid: false, error: '玩家不存在' }
  if (round.currentPlayer !== playerId) return { valid: false, error: '不是你的回合' }
  if (player.folded) return { valid: false, error: '已弃牌' }
  if (player.allIn) return { valid: false, error: '已全下' }
  if (!Array.isArray(round.actedIds)) round.actedIds = []

  const need = round.currentBet - player.bet // 本轮还需跟的差额

  if (action === 'fold') {
    player.folded = true
    round.turnCount++
    round.actedIds.push(playerId)
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'call') {
    const toPay = Math.min(need, player.chips) // 不够则全下
    player.chips -= toPay
    player.bet += toPay
    if (player.chips === 0) player.allIn = true
    round.turnCount++
    round.actedIds.push(playerId)
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'raise') {
    if (!amount || amount <= round.currentBet) {
      return { valid: false, error: '加注额必须大于当前注额' }
    }
    const toPay = amount - player.bet // 从已投入算到新注额
    if (toPay > player.chips) return { valid: false, error: '筹码不足' }
    player.chips -= toPay
    player.bet = amount
    round.currentBet = amount
    if (player.chips === 0) player.allIn = true
    round.lastRaiser = playerId
    // 加注后：从下家开始，所有未跟到新注额的人都要再行动
    round.turnCount++
    round.actedIds = [playerId]
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'all-in') {
    const toPay = player.chips
    player.bet += toPay
    player.chips = 0
    player.allIn = true
    if (player.bet > round.currentBet) {
      round.currentBet = player.bet
      round.lastRaiser = playerId
      round.actedIds = [playerId]
    } else {
      round.actedIds.push(playerId)
    }
    round.turnCount++
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  return { valid: false, error: '未知动作' }
}

/** 一轮是否结束：只剩 1 人未弃牌，或所有活跃玩家都跟到 currentBet 且轮到最后加注人的下家 */

export function bettingRoundDone(round, players) {
  // 未弃牌的玩家（包括已 all-in 的）
  const alive = players.filter((p) => !p.folded)
  // 只剩一人未弃牌 → 直接结束
  if (alive.length <= 1) return true
  // 所有未弃牌玩家都已行动，且非 all-in 的都跟到 currentBet → 本轮结束
  const notAllIn = alive.filter((p) => !p.allIn)
  const actedIds = Array.isArray(round.actedIds) ? round.actedIds : []
  const caughtUp = notAllIn.every((p) => p.bet === round.currentBet)
  if (!caughtUp) return false
  return notAllIn.every((p) => actedIds.includes(p.id))
}
