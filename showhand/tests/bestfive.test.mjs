import assert from 'node:assert/strict'
import { bestFive, compareHands, evaluateHand } from '../src/core/poker.js'

const FACE = { T: 10, J: 11, Q: 12, K: 13, A: 14 }
function h(...cards) {
  return cards.map((c) => {
    const suit = c[0]
    const rankStr = c.slice(1)
    return { suit, rank: /^\d+$/.test(rankStr) ? Number(rankStr) : FACE[rankStr] }
  })
}

// 7 张里藏着同花顺，应选出它
const straightFlush = h('s9', 's10', 'sJ', 'sQ', 'sK', 'hA', 'd2')
const r = bestFive(straightFlush)
assert.equal(r.rank, 8, '选中最强同花顺')
assert.deepEqual(r.high, [13, 12, 11, 10, 9], 'high 正确')

// 7 张里四条 + 一对 → 应选四条（rank 7）
const four = h('h2', 'd2', 'c2', 's2', 'hK', 'dK', 'c3')
const r2 = bestFive(four)
assert.equal(r2.rank, 7, '选出四条')

// 7 张里两对 + 高牌 → 最优应是两对
const twoPair = h('h9', 'd9', 'c5', 's5', 'hK', 'd3', 'c2')
const r3 = bestFive(twoPair)
assert.equal(r3.rank, 2, '选出两对')
assert.deepEqual(r3.high, [9, 5, 13], '两对 high = [9,5,踢脚K]')

// 7 张里葫芦（三条+一对）> 两对
const fullHouse = h('h9', 'd9', 'c9', 's5', 'd5', 'hK', 'd2')
const r4 = bestFive(fullHouse)
assert.equal(r4.rank, 6, '选出葫芦')

// 纯高牌：7 张全是散牌
const high = h('h2', 'd5', 'c9', 'sJ', 'hA', 'd4', 'c8')
const r5 = bestFive(high)
assert.equal(r5.rank, 0, '高牌')
assert.deepEqual(r5.high, [14, 11, 9, 8, 5], '高牌取最大 5 张')

// bestFive 结果可被 compareHands 比较
assert.equal(compareHands(r, r2), 1, '同花顺 > 四条')

// 5 张时 bestFive == evaluateHand
const five = h('h2', 'd5', 'c9', 'sJ', 'hA')
assert.deepEqual(bestFive(five), evaluateHand(five), '5 张时等价')

console.log('bestFive tests passed')
