import assert from 'node:assert/strict'
import { createHand } from '../src/core/hand.js'

// 五张梭哈：1 暗 + 4 明
const hand5 = createHand('five', 3)
assert.equal(hand5.mode, 'five')
assert.equal(hand5.stage, 'preflop', '初始 stage')
// 第一轮发牌：1 暗 + 1 明
let dealt = hand5.dealNextStage()
assert.equal(dealt, true, '第一轮可发')
const p0 = hand5.players[0]
assert.equal(p0.cards.filter((c) => c.hidden).length, 1, '1 张暗牌')
assert.equal(p0.cards.filter((c) => !c.hidden).length, 1, '1 张明牌')

// 发完剩余 3 轮明牌
for (let i = 0; i < 3; i++) {
  assert.equal(hand5.dealNextStage(), true, `第 ${i + 2} 轮发牌`)
}
assert.equal(hand5.dealNextStage(), false, '5 张已发完，无下一轮')
assert.equal(hand5.stage, 'showdown', '发完进入 showdown')
assert.equal(p0.cards.length, 5, '共 5 张')
assert.equal(p0.cards.filter((c) => c.hidden).length, 1, '仍是 1 暗 4 明')

// 七张梭哈：3 暗 + 4 明
const hand7 = createHand('seven', 2)
const p = hand7.players[0]
let rounds = 0
while (hand7.dealNextStage()) {
  rounds++
  assert.ok(p.cards.length <= 7, '不超过 7 张')
}
assert.equal(rounds, 4, '七张共 4 轮发牌')
assert.equal(p.cards.length, 7, '共 7 张')
assert.equal(p.cards.filter((c) => c.hidden).length, 3, '3 张暗牌')
assert.equal(p.cards.filter((c) => !c.hidden).length, 4, '4 张明牌')

// 牌不重复（3 人五张 = 15 张各不相同）
const hand3 = createHand('five', 3)
while (hand3.dealNextStage()) {}
const allCards = hand3.players.flatMap((pl) => pl.cards.map((c) => `${c.suit}${c.rank}`))
assert.equal(new Set(allCards).size, 15, '15 张牌不重复')

console.log('hand tests passed')
