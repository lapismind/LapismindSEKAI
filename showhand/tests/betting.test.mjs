import assert from 'node:assert/strict'
import {
  createBettingRound,
  advanceBet,
  bettingRoundDone,
  applyLook,
  callCost,
  priceFor,
} from '../src/core/betting.js'

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
assert.equal(round.currentLevel, 30, '当前档位 30')
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

// ============ 闷牌轮 ============
// 基准：底注 10 已付，闷牌轮起注档位 = 20（底注的 2 倍）——
// 底注算作已投入，于是看牌者要补一个底注，闷牌者不用。
const ANTE = 10
const BLIND_LEVEL = ANTE * 2

function mkBlindRound() {
  const ps = [
    { id: 'blind', chips: 990, bet: ANTE, level: ANTE, folded: false, allIn: false, blind: true },
    { id: 'looker', chips: 990, bet: ANTE, level: ANTE, folded: false, allIn: false, blind: false, looked: true },
  ]
  return { ps, round: createBettingRound(ps, 'blind', BLIND_LEVEL, { halfPrice: true }) }
}

// --- 闷牌者半价，看牌者全价，两者都算"跟到" ---
{
  const { ps, round } = mkBlindRound()
  assert.equal(callCost(round, ps[0]), 0, '闷牌者跟到 20 只需付 0（底注已抵半价档位）')
  assert.equal(callCost(round, ps[1]), ANTE, '看牌者跟到 20 要补一个底注')

  assert.equal(advanceBet(round, ps, 'blind', 'call').valid, true)
  assert.equal(ps[0].bet, ANTE, '闷牌者实际仍只投入底注')
  assert.equal(ps[0].level, BLIND_LEVEL, '但档位已记为跟到 20')
  assert.equal(advanceBet(round, ps, 'looker', 'call').valid, true)
  assert.equal(ps[1].bet, BLIND_LEVEL, '看牌者实际投入 20')
  assert.equal(
    bettingRoundDone(round, ps),
    true,
    '半价者与全价者都算已跟到同一档位，本轮正常结束',
  )
}

// --- 面对加注时，同档位投入 2:1（闷牌的收益所在）---
{
  const { ps, round } = mkBlindRound()
  advanceBet(round, ps, 'blind', 'call')
  assert.equal(advanceBet(round, ps, 'looker', 'raise', { amount: 100 }).valid, true)
  assert.equal(round.currentLevel, 100, '档位抬到 100')

  assert.equal(callCost(round, ps[0]), Math.ceil(100 / 2) - ANTE, '闷牌者补到 100 付 40')
  assert.equal(advanceBet(round, ps, 'blind', 'call').valid, true)
  assert.equal(ps[0].bet, 50, '闷牌者累计投入 50')
  assert.equal(ps[1].bet, 100, '看牌者累计投入 100')
  assert.equal(ps[1].bet, ps[0].bet * 2, '同档位下看牌者投入是闷牌者的两倍')
}

// --- 半价向上取整（奇数档位）---
{
  const ps = [
    { id: 'blind', chips: 990, bet: 0, level: 0, folded: false, allIn: false, blind: true },
  ]
  const round = createBettingRound(ps, 'blind', 0, { halfPrice: true })
  assert.equal(priceFor(round, ps[0], 25), 13, '档位 25 时闷牌者付 ceil(25/2)=13')
}

// --- 看牌必须补齐省下的差额（否则闷牌加注 + 白嫖看牌是无风险套利）---
{
  const { ps, round } = mkBlindRound()
  advanceBet(round, ps, 'blind', 'call') // 付 0，档位 20
  advanceBet(round, ps, 'looker', 'raise', { amount: 100 })
  advanceBet(round, ps, 'blind', 'call') // 付 40，bet 50，档位 100

  const looked = applyLook(ps[0])
  assert.equal(looked.valid, true, '看牌成功')
  assert.equal(ps[0].blind, false, '不再享受半价')
  assert.equal(ps[0].level, ps[0].bet, '看牌后档位回落到实际投入')
  assert.equal(callCost(round, ps[0]), 50, '看牌后要补齐 100-50，便宜不能带走')
  assert.equal(applyLook(ps[0]).valid, false, '不能重复看牌')
}

// --- 闷牌时不能全下；非闷牌轮不受这条限制 ---
{
  const { ps, round } = mkBlindRound()
  const res = advanceBet(round, ps, 'blind', 'all-in')
  assert.equal(res.valid, false, '闷牌时全下应被拒绝')
  assert.match(res.error, /先看牌/, '错误信息要说明原因')

  const normalPs = [
    { id: 'blind', chips: 990, bet: ANTE, level: ANTE, folded: false, allIn: false, blind: true },
  ]
  const normal = createBettingRound(normalPs, 'blind', BLIND_LEVEL)
  assert.equal(advanceBet(normal, normalPs, 'blind', 'all-in').valid, true, '非闷牌轮允许全下')
}

// --- 半价规则只在闷牌轮生效：后续轮次即使还带着 blind 标记也按全价 ---
{
  const ps = [
    { id: 'blind', chips: 990, bet: ANTE, level: ANTE, folded: false, allIn: false, blind: true },
  ]
  const normal = createBettingRound(ps, 'blind', BLIND_LEVEL)
  assert.equal(callCost(normal, ps[0]), BLIND_LEVEL - ANTE, '非闷牌轮跟注按全价')
  assert.equal(priceFor(normal, ps[0], 100), 100 - ANTE, '非闷牌轮加注也按全价')
}
