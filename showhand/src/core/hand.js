/**
 * core/hand.js —— 一局牌的管理（纯逻辑）。
 *
 * 发牌节奏：
 * - five：1 暗 + 4 明（4 轮发牌：第 1 轮发 1 暗 1 明，后 3 轮各 1 明）
 * - seven：3 暗 + 4 明（4 轮：2 暗+1 明，再 3 张明逐张亮，最后 1 暗）
 *
 * 牌：{ suit, rank, hidden: boolean }，hidden=true 为暗牌（玩家自己可见，他人不可见）。
 *
 * 用法：
 *   const hand = createHand('five', 3)
 *   hand.dealNextStage()  // 发一轮，返回是否还有下一轮
 *   hand.stage            // 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
 */

export function createHand(mode, playerCount) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i === 0 ? 'host' : `p${i}`,
    cards: [],
  }))

  const state = {
    mode,
    players,
    stage: 'preflop',
    deck: shuffledDeck(),
  }

  const dealCard = (hidden) => {
    const card = state.deck.pop()
    return { suit: card.suit, rank: card.rank, hidden }
  }

  const dealEach = (hidden) => {
    for (const p of state.players) p.cards.push(dealCard(hidden))
  }

  return {
    get mode() {
      return state.mode
    },
    get stage() {
      return state.stage
    },
    get players() {
      return state.players
    },
    get deck() {
      return state.deck
    },
    /** 发下一轮牌，返回是否还有后续轮次 */
    dealNextStage() {
      if (state.stage === 'showdown') return false
      const isFive = state.mode === 'five'
      const isSeven = state.mode === 'seven'

      if (state.stage === 'preflop') {
        if (isFive) {
          dealEach(true) // 1 暗
          dealEach(false) // 1 明
        } else if (isSeven) {
          dealEach(true)
          dealEach(true) // 2 暗
          dealEach(false) // 1 明
        }
        state.stage = 'flop'
        return true
      }
      if (state.stage === 'flop') {
        dealEach(false) // 1 明
        state.stage = 'turn'
        return true
      }
      if (state.stage === 'turn') {
        dealEach(false) // 1 明
        state.stage = 'river'
        return true
      }
      if (state.stage === 'river') {
        // 七张：最后发 1 明 + 1 暗（第 7 张暗牌）；五张：最后 1 张明牌
        dealEach(false)
        if (isSeven) dealEach(true)
        state.stage = 'showdown'
        return true
      }
      return false
    },
  }
}

function shuffledDeck() {
  const suits = ['s', 'h', 'd', 'c']
  const deck = []
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank })
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}
