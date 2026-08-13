/**
 * game/rules.js
 * 牌局规则 —— 纯函数，无 UI / 无网络 / 无副作用，可独立单测。
 *
 * 当前玩法为 Mock 占位（简化"接龙"：下家必须出大于等于上家的牌，花色不限）。
 * 换玩法时只需替换这里的校验与判胜函数，上层无需改动。
 */

import { cardLabel } from './cardDefs'

/** 玩家间顺时针顺序（座位号） */
export function nextSeat(seat, totalPlayers) {
  return (seat + 1) % totalPlayers
}

/**
 * 校验"出牌"是否合法。
 * @param {{rank:number}} card
 * @param {{rank:number}|null} topCard 桌面上家打出的牌，首手为 null
 * @returns {{ok:boolean, reason?:string}}
 */
export function canPlay(card, topCard) {
  if (topCard === null) {
    return { ok: true } // 首手随意
  }
  if (card.rank >= topCard.rank) {
    return { ok: true }
  }
  return {
    ok: false,
    reason: `必须出 ≥ ${cardLabel(topCard)}，你有 ${cardLabel(card)}`,
  }
}

/**
 * 判定游戏是否结束（Mock：手中无牌即胜）。
 * @param {{hand: unknown[]}} player
 * @returns {{over:boolean, winnerId?:string}}
 */
export function checkGameOver(player) {
  if (player.hand.length === 0) {
    return { over: true, winnerId: player.id }
  }
  return { over: false }
}

/**
 * 排序手牌（默认按点数升序，同点数按花色顺序）。
 * @param {Array<{rank:number, suit:string}>} cards
 */
export function sortHand(cards) {
  const suitOrder = { spade: 0, heart: 1, diamond: 2, club: 3 }
  return [...cards].sort(
    (a, b) => a.rank - b.rank || (suitOrder[a.suit] ?? 9) - (suitOrder[b.suit] ?? 9),
  )
}
