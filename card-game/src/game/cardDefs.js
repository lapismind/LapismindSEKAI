/**
 * game/cardDefs.js
 * 卡牌定义 —— 换游戏玩法时，只需要替换这里的牌型数据。
 *
 * 当前为 Mock：以"数字比大小"的简易牌型占位，后端/真实玩法确定后替换。
 */

/** 花色，null 表示无花色（如万能牌） */
export const SUITS = {
  SPADE: 'spade',
  HEART: 'heart',
  DIAMOND: 'diamond',
  CLUB: 'club',
}

export const SUIT_LABEL = {
  [SUITS.SPADE]: '♠',
  [SUITS.HEART]: '♥',
  [SUITS.DIAMOND]: '♦',
  [SUITS.CLUB]: '♣',
}

/**
 * @typedef {Object} Card
 * @property {string} id       唯一 id（服务端分配或本地生成）
 * @property {string|null} suit 花色
 * @property {number} rank     牌面值，A=1, J/Q/K=11/12/13
 * @property {boolean} faceUp  是否明牌
 */

/**
 * 生成一副牌（Mock：一副去大小王的标准 52 张）。
 * @returns {Card[]}
 */
export function createDeck() {
  const deck = []
  for (const suit of Object.values(SUITS)) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        faceUp: false,
      })
    }
  }
  return shuffle(deck)
}

/** Fisher–Yates 洗牌 */
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 牌面显示：如 "♠7"、"♥K" */
export function cardLabel(card) {
  if (!card) return ''
  const rankLabel = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[card.rank] ?? String(card.rank)
  return `${card.suit ? SUIT_LABEL[card.suit] : ''}${rankLabel}`
}
