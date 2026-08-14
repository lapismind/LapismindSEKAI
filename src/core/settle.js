/**
 * core/settle.js —— 底池/分池结算（纯函数）。
 *
 * 分池逻辑：按每位玩家累计投入（totalBet）分层切池。
 * 每层 = 从上一档到本档的差额 × 投入达到该档的玩家数。
 * 每池的 eligible = 未弃牌（handRank 非 null）且投入 ≥ 该档的玩家。
 *
 * players 元素：{ id, totalBet, handRank }（handRank 为 evaluateHand 结果或 null=弃牌）
 */

export function settlePots(players) {
  const active = players.filter((p) => p.handRank !== null)
  if (active.length === 0) return []

  const tiers = [...new Set(players.map((p) => p.totalBet))].sort((a, b) => a - b)
  const pots = []
  let prev = 0
  let hasMultiple = false

  for (const t of tiers) {
    const level = t - prev
    if (level <= 0) continue
    const contributors = players.filter((p) => p.totalBet >= t)
    if (contributors.length === 0) continue
    const eligible = active.filter((p) => contributors.some((c) => c.id === p.id))
    pots.push({ amount: level * contributors.length, eligible })
    prev = t
  }

  // 无全下差异时（所有玩家投入相同），合并为单池
  const distinctBets = new Set(players.map((p) => p.totalBet))
  if (distinctBets.size === 1) {
    const total = players.reduce((s, p) => s + p.totalBet, 0)
    return [{ amount: total, eligible: active }]
  }

  return pots
}

/** 按牌型把每个池奖励给赢家 */
export function awardPots(pots) {
  const winners = []
  for (const pot of pots) {
    if (pot.eligible.length === 0) continue
    const best = pot.eligible.reduce((a, b) => (compareRank(a.handRank, b.handRank) > 0 ? a : b))
    winners.push({ id: best.id, amount: pot.amount })
  }
  return winners
}

/** 返回正数= a 大，负数= b 大，0=平 */
function compareRank(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank
  for (let i = 0; i < Math.min(a.high.length, b.high.length); i++) {
    if (a.high[i] !== b.high[i]) return a.high[i] - b.high[i]
  }
  return 0
}
