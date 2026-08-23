/**
 * core/cards.js —— 牌堆工具（纯函数）。
 * 牌：{ suit: 's'|'h'|'d'|'c', rank: 2-14 }，14=A。
 */

export function createDeck() {
  const suits = ['s', 'h', 'd', 'c']
  const deck = []
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

export function shuffle(deck) {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
