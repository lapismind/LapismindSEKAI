import assert from 'node:assert/strict'
import { settlePots, awardPots } from '../src/core/settle.js'

// 场景：A 全下 100，B 跟 100 后加注到 200，C 跟 200
// totalBet: A=100, B=200, C=200
// 底池1 = 300（三人各 100），底池2 = 200（B、C 各 100）
// C 牌型最大赢全部
const players = [
  { id: 'A', totalBet: 100, handRank: { rank: 3, high: [10, 9, 8, 7, 6] }, folded: false },
  { id: 'B', totalBet: 200, handRank: { rank: 2, high: [11, 10, 5] }, folded: false },
  { id: 'C', totalBet: 200, handRank: { rank: 4, high: [12, 11, 10, 9, 8] }, folded: false },
]
const pots = settlePots(players)
assert.equal(pots.length, 2, '分 2 个底池')
assert.equal(pots[0].amount, 300, '主池 300')
assert.equal(pots[1].amount, 200, '边池 200')
assert.deepEqual(pots[0].eligible.map((p) => p.id).sort(), ['A', 'B', 'C'], '主池三人都有资格')
assert.deepEqual(pots[1].eligible.map((p) => p.id).sort(), ['B', 'C'], '边池只有 B、C')

const winners = awardPots(pots)
assert.equal(winners.length, 2, 'C 赢两个池')
assert.equal(winners[0].id, 'C', '主池给 C')
assert.equal(winners[1].id, 'C', '边池给 C')
assert.equal(winners[0].amount + winners[1].amount, 500, 'C 拿全部 500')

// 场景 2：弃牌玩家无权
const players2 = [
  { id: 'A', totalBet: 100, handRank: { rank: 5, high: [14, 13, 12, 11, 10] }, folded: false },
  { id: 'B', totalBet: 100, handRank: null, folded: true },
]
const pots2 = settlePots(players2)
assert.equal(pots2.length, 1, '无全下时分 1 池')
assert.equal(pots2[0].amount, 200, '池 200')
assert.equal(pots2[0].eligible.length, 1, '弃牌玩家无资格')
assert.equal(pots2[0].eligible[0].id, 'A', 'A 赢')

// 场景 3：平池无全下，简化为单池
const players3 = [
  { id: 'X', totalBet: 50, handRank: { rank: 1, high: [9, 8, 7, 5] }, folded: false },
  { id: 'Y', totalBet: 50, handRank: { rank: 1, high: [9, 8, 7, 4] }, folded: false },
  { id: 'Z', totalBet: 50, handRank: { rank: 0, high: [14, 11, 10, 6, 3] }, folded: false },
]
const pots3 = settlePots(players3)
assert.equal(pots3.length, 1, '无全下 1 池')
assert.equal(pots3[0].amount, 150, '池 150')
assert.equal(pots3[0].eligible.length, 3, '三人都有资格')

console.log('settle tests passed')
