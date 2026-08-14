import assert from 'node:assert/strict'
import { evaluateHand, compareHands } from '../src/core/poker.js'

const FACE = { T: 10, J: 11, Q: 12, K: 13, A: 14 }

function h(...cards) {
  return cards.map((c) => {
    const suit = c[0]
    const rankStr = c.slice(1)
    const rank = /^\d+$/.test(rankStr) ? Number(rankStr) : FACE[rankStr]
    return { suit, rank }
  })
}

// 各牌型
assert.equal(evaluateHand(h('s14', 's13', 's12', 's11', 's10')).rank, 8, '同花顺')
assert.equal(evaluateHand(h('h2', 'd2', 'c2', 's2', 's7')).rank, 7, '四条')
assert.equal(evaluateHand(h('h2', 'd2', 'c2', 's7', 'd7')).rank, 6, '葫芦')
assert.equal(evaluateHand(h('h3', 'h7', 'h9', 'hJ', 'hK')).rank, 5, '同花')
assert.equal(evaluateHand(h('h3', 'd4', 'c5', 's6', 'h7')).rank, 4, '顺子')
assert.equal(evaluateHand(h('h9', 'd9', 'c9', 's6', 'h7')).rank, 3, '三条')
assert.equal(evaluateHand(h('h9', 'd9', 'c5', 's5', 'h7')).rank, 2, '两对')
assert.equal(evaluateHand(h('h9', 'd9', 'c3', 's6', 'h7')).rank, 1, '一对')
assert.equal(evaluateHand(h('h2', 'd5', 'c9', 'sJ', 'hA')).rank, 0, '高牌')

// 轮转顺子 A2345
assert.equal(evaluateHand(h('h14', 'd2', 'c3', 's4', 'h5')).rank, 4, 'A2345 也是顺子')
assert.equal(evaluateHand(h('h2', 'd3', 'c4', 's5', 'h14')).rank, 4, '2345A 排序后同 A2345，是顺子')
// 非顺子：断口
assert.equal(evaluateHand(h('h2', 'd3', 'c4', 's5', 'h7')).rank, 0, '23457 不是顺子')

// tiebreak：两对 high 顺序
const r1 = evaluateHand(h('h9', 'd9', 'c5', 's5', 'h7'))
assert.deepEqual(r1.high, [9, 5, 7], '两对 high = [大对, 小对, 踢脚]')

// 顺子 tiebreak high
const r2 = evaluateHand(h('h3', 'd4', 'c5', 's6', 'h7'))
assert.deepEqual(r2.high, [7, 6, 5, 4, 3], '顺子 high 降序')
const r3 = evaluateHand(h('h14', 'd2', 'c3', 's4', 'h5'))
assert.deepEqual(r3.high, [5, 4, 3, 2, 14], 'A2345 high 以 5 为顶')

// compareHands
assert.equal(compareHands(r1, r2), -1, '两对比顺子小')
assert.equal(compareHands(r2, r2), 0, '相等')
// 同是单对，踢脚大者赢：99+8,7,5 > 99+7,5,3
const pairA = evaluateHand(h('h9', 'd9', 'c8', 's5', 'h7'))
const pairB = evaluateHand(h('h9', 'd9', 'c7', 's5', 'h3'))
assert.equal(compareHands(pairA, pairB), 1, '单对踢脚大者赢')
assert.deepEqual(pairA.high, [9, 8, 7, 5], '单对 high = [对, 踢脚降序]')

console.log('poker tests passed')
