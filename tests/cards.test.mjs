import assert from 'node:assert/strict'
import { createDeck, shuffle } from '../src/core/cards.js'

// createDeck：52 张，4 花色 × 13 rank
const deck = createDeck()
assert.equal(deck.length, 52, '52 张')
assert.equal(new Set(deck.map((c) => `${c.suit}${c.rank}`)).size, 52, '无重复')

// shuffle：打乱但保留 52 张
const shuffled = shuffle([...deck])
assert.equal(shuffled.length, 52, 'shuffle 后仍 52 张')
assert.equal(new Set(shuffled.map((c) => `${c.suit}${c.rank}`)).size, 52, 'shuffle 不丢牌')

// 洗牌随机性：极大概率不完全相同
let allSame = true
for (let i = 0; i < deck.length; i++) {
  if (deck[i].suit !== shuffled[i].suit || deck[i].rank !== shuffled[i].rank) {
    allSame = false
    break
  }
}
assert.equal(allSame, false, 'shuffle 打乱了顺序')

console.log('cards tests passed')
