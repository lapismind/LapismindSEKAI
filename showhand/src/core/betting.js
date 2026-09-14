/**
 * core/betting.js —— 下注轮转状态机（纯函数）。
 *
 * 一轮下注的规则：
 * - 从 currentPlayer 开始，轮流行动：跟注 / 加注 / 弃牌 / 全下
 * - 加注后回到未跟到新注额的玩家（多次加注）
 * - 一轮结束：所有未弃牌且未 all-in 的玩家都跟到 currentLevel，或只剩 1 人未弃牌
 * - 已 all-in 的玩家跳过轮转
 *
 * ── 档位 vs 实际投入 ──────────────────────────────────────────
 * 这是本文件最容易看错的地方，两个量必须分开：
 *   round.currentLevel / player.level  喊注**档位**（比大小的口径）
 *   player.bet                         实际投入的**筹码**（底池与分池只认这个）
 * 普通轮里两者相等。闷牌轮（round.halfPrice）里闷牌者按档位半价支付，
 * 于是 level > bet。半价产生的差额由 settlePots 按实际投入分层自然吸收，
 * 底池不需要任何特殊处理 —— 这也是这个机制能做干净的原因。
 *
 * player 需要：{ id, chips, bet, folded, allIn }，可选 { level, blind }。
 * `level` 缺省时按 `bet` 处理，因此不关心档位的调用方无需初始化。
 *
 * round 对象：
 *   { currentPlayer, currentLevel, lastRaiser, turnCount, actedIds, halfPrice }
 */

export function createBettingRound(players, firstPlayerId, currentLevel = 0, { halfPrice = false } = {}) {
  return {
    currentPlayer: firstPlayerId,
    currentLevel,
    lastRaiser: null,
    turnCount: 0,
    actedIds: [],
    halfPrice,
  }
}

/** 玩家当前已跟到的档位（未记录时退回实际投入） */
function levelOf(player) {
  return typeof player.level === 'number' ? player.level : player.bet
}

/** 该玩家在当前轮是否享受半价（闷牌且本轮启用半价规则） */
function isHalfPriced(round, player) {
  return round.halfPrice === true && player.blind === true
}

/**
 * 把档位换算成"从当前投入补齐到该档位需要付多少筹码"。
 * 闷牌者按半价（向上取整），其余按原价。
 * 这是档位↔筹码的唯一换算入口，服务端与客户端都必须用它，不要各写一份。
 */
export function priceFor(round, player, targetLevel) {
  const rate = isHalfPriced(round, player) ? 2 : 1
  return Math.max(0, Math.ceil(targetLevel / rate) - player.bet)
}

/** 当前玩家跟注到本轮档位需要付多少（客户端显示"跟注 N"用这个） */
export function callCost(round, player) {
  return priceFor(round, player, round.currentLevel)
}

/**
 * 看牌：闷牌者亮牌给自己。
 * 关键规则：看完牌档位重置为**实际投入**，于是当初省下的半价差额要补齐 ——
 * 否则"闷牌时加注占便宜，再看牌白嫖"就成了无风险套利。
 */
export function applyLook(player) {
  if (!player.blind) return { valid: false, error: '已经看牌了' }
  player.blind = false
  player.looked = true
  player.level = player.bet
  return { valid: true }
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
 * players 会被原地修改（bet/level/folded/allIn/chips）。
 */
export function advanceBet(round, players, playerId, action, { amount } = {}) {
  const player = players.find((p) => p.id === playerId)
  if (!player) return { valid: false, error: '玩家不存在' }
  if (round.currentPlayer !== playerId) return { valid: false, error: '不是你的回合' }
  if (player.folded) return { valid: false, error: '已弃牌' }
  if (player.allIn) return { valid: false, error: '已全下' }
  if (!Array.isArray(round.actedIds)) round.actedIds = []

  if (action === 'fold') {
    player.folded = true
    round.turnCount++
    round.actedIds.push(playerId)
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'call') {
    const toPay = Math.min(callCost(round, player), player.chips) // 不够则全下
    player.chips -= toPay
    player.bet += toPay
    player.level = round.currentLevel
    if (player.chips === 0) player.allIn = true
    round.turnCount++
    round.actedIds.push(playerId)
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'raise') {
    if (!amount || amount <= round.currentLevel) {
      return { valid: false, error: '加注额必须大于当前注额' }
    }
    const toPay = priceFor(round, player, amount)
    if (toPay > player.chips) return { valid: false, error: '筹码不足' }
    player.chips -= toPay
    player.bet += toPay
    player.level = amount
    round.currentLevel = amount
    if (player.chips === 0) player.allIn = true
    round.lastRaiser = playerId
    // 加注后：从下家开始，所有未跟到新注额的人都要再行动
    round.turnCount++
    round.actedIds = [playerId]
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  if (action === 'all-in') {
    // 闷牌时不能全下：全下筹码按档位怎么折算没有直觉答案（翻倍会让其他人被迫全下，
    // 不翻倍又与半价规则冲突），要求先看牌是最简单且不会引起争议的处理
    if (isHalfPriced(round, player)) {
      return { valid: false, error: '闷牌不能全下，请先看牌' }
    }
    const toPay = player.chips
    player.bet += toPay
    player.chips = 0
    player.allIn = true
    if (player.bet > round.currentLevel) {
      round.currentLevel = player.bet
      round.lastRaiser = playerId
      round.actedIds = [playerId]
    } else {
      round.actedIds.push(playerId)
    }
    player.level = round.currentLevel
    round.turnCount++
    round.currentPlayer = nextPlayer(players, playerId)
    return { valid: true, round }
  }

  return { valid: false, error: '未知动作' }
}

/** 一轮是否结束：只剩 1 人未弃牌，或所有活跃玩家都跟到 currentLevel 且轮到最后加注人的下家 */
export function bettingRoundDone(round, players) {
  // 未弃牌的玩家（包括已 all-in 的）
  const alive = players.filter((p) => !p.folded)
  // 只剩一人未弃牌 → 直接结束
  if (alive.length <= 1) return true
  // 所有未弃牌玩家都已行动，且非 all-in 的都跟到 currentLevel → 本轮结束
  const notAllIn = alive.filter((p) => !p.allIn)
  const actedIds = Array.isArray(round.actedIds) ? round.actedIds : []
  // 按档位比较：闷牌者半价支付后 level 仍等于 currentLevel，所以能正确判定"已跟到"
  const caughtUp = notAllIn.every((p) => levelOf(p) >= round.currentLevel)
  if (!caughtUp) return false
  return notAllIn.every((p) => actedIds.includes(p.id))
}
