/**
 * core/poker.js —— 牌型判定（纯函数）。
 * 牌表示：{ suit: 's'|'h'|'d'|'c', rank: 2-14 }，14=A。
 * rank：8=同花顺 7=四条 6=葫芦 5=同花 4=顺子 3=三条 2=两对 1=一对 0=高牌
 * high：降序 tiebreak 数组。
 */

const RANKS = {
  8: '同花顺',
  7: '四条',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌',
}

export function evaluateHand(cards) {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank)
  const ranks = sorted.map((c) => c.rank)
  const suits = new Set(sorted.map((c) => c.suit))

  const isFlush = suits.size === 1
  const isStraight = (() => {
    const uniq = [...new Set(ranks)]
    if (uniq.length !== 5) return false
    if (uniq[0] - uniq[4] === 4) return true
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) return true
    return false
  })()

  const count = {}
  for (const r of ranks) count[r] = (count[r] || 0) + 1
  const groups = Object.entries(count).sort((a, b) => b[1] - a[1] || b[0] - a[0])

  const isWheel = ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2
  const straightHigh = isWheel ? [5, 4, 3, 2, 14] : ranks

  if (isFlush && isStraight) return { rank: 8, name: RANKS[8], high: straightHigh }
  if (groups[0][1] === 4) return { rank: 7, name: RANKS[7], high: [Number(groups[0][0]), Number(groups[1][0])] }
  if (groups[0][1] === 3 && groups[1][1] === 2)
    return { rank: 6, name: RANKS[6], high: [Number(groups[0][0]), Number(groups[1][0])] }
  if (isFlush) return { rank: 5, name: RANKS[5], high: ranks }
  if (isStraight) return { rank: 4, name: RANKS[4], high: straightHigh }
  if (groups[0][1] === 3)
    return { rank: 3, name: RANKS[3], high: [Number(groups[0][0]), ...ranks.filter((r) => r !== Number(groups[0][0]))] }
  if (groups[0][1] === 2 && groups[1][1] === 2)
    return {
      rank: 2,
      name: RANKS[2],
      high: [Number(groups[0][0]), Number(groups[1][0]), Number(groups[2][0])],
    }
  if (groups[0][1] === 2)
    return { rank: 1, name: RANKS[1], high: [Number(groups[0][0]), ...ranks.filter((r) => r !== Number(groups[0][0]))] }
  return { rank: 0, name: RANKS[0], high: ranks }
}

export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1
  for (let i = 0; i < Math.min(a.high.length, b.high.length); i++) {
    if (a.high[i] !== b.high[i]) return a.high[i] > b.high[i] ? 1 : -1
  }
  return 0
}

/** 7 张牌里选 5 张最佳牌型（遍历所有 5 张组合取最高） */
export function bestFive(cards) {
  if (cards.length <= 5) return evaluateHand(cards)
  const idx = [0, 1, 2, 3, 4]
  const n = cards.length
  let best = null
  while (idx[0] <= n - 5) {
    const combo = idx.map((i) => cards[i])
    const r = evaluateHand(combo)
    if (!best || compareHands(r, best) > 0) best = r
    let k = 4
    while (k >= 0 && idx[k] === n - 5 + k) k--
    if (k < 0) break
    idx[k]++
    for (let j = k + 1; j < 5; j++) idx[j] = idx[j - 1] + 1
  }
  return best
}
