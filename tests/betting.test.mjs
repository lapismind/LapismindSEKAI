import assert from 'node:assert/strict'
import { createBettingRound, advanceBet, bettingRoundDone } from '../src/core/betting.js'

function mkPlayers() {
  return [
    { id: 'a', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'b', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'c', chips: 100, bet: 10, folded: false, allIn: false },
  ]
}

// --- 基础轮转 ---
let players = mkPlayers()
let round = createBettingRound(players, 'a', 10) // currentBet 已有人加注到 10
assert.equal(round.currentPlayer, 'a', '从 a 开始')

// a 跟注 10 → 下一位 b
let result = advanceBet(round, players, 'a', 'call')
assert.equal(result.valid, true, 'a 跟注合法')
assert.equal(round.currentPlayer, 'b', '轮到 b')

// b 加注到 30
result = advanceBet(round, players, 'b', 'raise', { amount: 30 })
assert.equal(result.valid, true, 'b 加注合法')
assert.equal(round.currentBet, 30, '当前注额 30')
assert.equal(round.lastRaiser, 'b', 'b 是最后加注人')
assert.equal(round.currentPlayer, 'c', '轮到 c')

// c 需要跟 20（30-10）
result = advanceBet(round, players, 'c', 'call')
assert.equal(result.valid, true, 'c 跟注合法')
assert.equal(round.currentPlayer, 'a', '回轮到 a，因为 b 加注后 a 要再跟')

// a 再跟到 30
result = advanceBet(round, players, 'a', 'call')
assert.equal(result.valid, true, 'a 跟到 30')
assert.equal(round.currentPlayer, 'b', '轮到 b')
assert.equal(bettingRoundDone(round, players), true, '大家都跟到 30，一轮结束')

// --- 弃牌 ---
players = mkPlayers()
round = createBettingRound(players, 'a', 10)
advanceBet(round, players, 'a', 'fold')
assert.equal(players[0].folded, true, 'a 弃牌')
assert.equal(round.currentPlayer, 'b', '轮到 b')

// --- 全下 ---
players = mkPlayers()
round = createBettingRound(players, 'a', 10)
const lowChips = [
  { id: 'a', chips: 10, bet: 0, folded: false, allIn: false },
  { id: 'b', chips: 100, bet: 0, folded: false, allIn: false },
]
result = advanceBet(round, lowChips, 'a', 'all-in')
assert.equal(result.valid, true, 'a 全下 10 合法')
assert.equal(lowChips[0].allIn, true, 'a 标记 all-in')

// 全下后轮转跳过 all-in 玩家
players = mkPlayers()
round = createBettingRound(players, 'a', 10)
advanceBet(round, players, 'a', 'all-in')
assert.equal(players[0].allIn, true, 'a 全下')
assert.equal(round.currentPlayer, 'b', '轮到 b，a 全下不再轮转')

// --- 非法操作 ---
players = mkPlayers()
round = createBettingRound(players, 'a', 10)
result = advanceBet(round, players, 'b', 'call') // 不该 b 行动
assert.equal(result.valid, false, '非当前玩家不能行动')
result = advanceBet(round, players, 'a', 'raise', { amount: 5 }) // 加注必须 > currentBet
assert.equal(result.valid, false, '加注额必须大于当前注额')

console.log('betting tests passed')

// --- 弃牌不能缩短“无人加注”的行动圈 ---
{
  const fourPlayers = () => [
    { id: 'p1', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p2', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p3', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p4', chips: 100, bet: 10, folded: false, allIn: false },
  ]

  players = fourPlayers()
  round = createBettingRound(players, 'p1', 10)
  assert.equal(advanceBet(round, players, 'p1', 'fold').valid, true)
  assert.equal(advanceBet(round, players, 'p2', 'call').valid, true)
  assert.equal(advanceBet(round, players, 'p3', 'call').valid, true)

  // p1 弃牌后活跃人数变成 3，但 p4 还没有行动。
  assert.equal(bettingRoundDone(round, players), false, 'p4 未行动，轮未结束')
  assert.equal(round.currentPlayer, 'p4', '仍轮到 p4')

  assert.equal(advanceBet(round, players, 'p4', 'call').valid, true)
  assert.equal(bettingRoundDone(round, players), true, '所有活跃玩家行动后结束')
}

// --- 加注重置已行动名单 ---
{
  const raisePlayers = () => [
    { id: 'p1', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p2', chips: 100, bet: 10, folded: false, allIn: false },
  ]

  players = raisePlayers()
  round = createBettingRound(players, 'p1', 10)
  assert.equal(advanceBet(round, players, 'p1', 'call').valid, true)
  assert.deepEqual(round.actedIds, ['p1'], 'p1 行动后记录 p1')

  assert.equal(advanceBet(round, players, 'p2', 'raise', { amount: 30 }).valid, true)
  assert.deepEqual(round.actedIds, ['p2'], '加注后只保留加注者')
  assert.equal(bettingRoundDone(round, players), false, 'p1 需要再跟新注额')

  assert.equal(advanceBet(round, players, 'p1', 'call').valid, true)
  assert.deepEqual(round.actedIds, ['p2', 'p1'], '继续追加已行动玩家')
  assert.equal(bettingRoundDone(round, players), true, '两人都跟到 30 后结束')
}

// --- 全员无加注跟注后正常结束 ---
{
  const fourPlayers = () => [
    { id: 'p1', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p2', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p3', chips: 100, bet: 10, folded: false, allIn: false },
    { id: 'p4', chips: 100, bet: 10, folded: false, allIn: false },
  ]

  players = fourPlayers()
  round = createBettingRound(players, 'p1', 10)
  for (const playerId of ['p1', 'p2', 'p3', 'p4']) {
    assert.equal(advanceBet(round, players, playerId, 'call').valid, true)
  }

  assert.deepEqual(round.actedIds, ['p1', 'p2', 'p3', 'p4'])
  assert.equal(bettingRoundDone(round, players), true, '全员跟到相同 bet')
}
