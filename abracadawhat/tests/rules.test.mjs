import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SPELLS,
  TARGET_SCORE,
  secretCountFor,
  createDeck,
  prepareRound,
  canCast,
  applyCast,
  endTurn,
} from '../src/core/rules.js'

const fixedRng = () => 0

test('卡牌表忠实于 8 种魔法和 36 张总量', () => {
  assert.equal(SPELLS.length, 8)
  assert.equal(SPELLS.reduce((n, s) => n + s.count, 0), 36)
  const expected = [
    ['🐉', '古代巨龙', 1],
    ['👻', '黑暗幽灵', 2],
    ['💕', '甜蜜的梦', 3],
    ['🦉', '猫头鹰', 4],
    ['⛈️', '闪电暴风雨', 5],
    ['🌨️', '暴风雪', 6],
    ['🔥', '火球', 7],
    ['🧪', '魔法药水', 8],
  ]
  expected.forEach(([emoji, name, count], i) => {
    assert.equal(SPELLS[i].emoji, emoji)
    assert.equal(SPELLS[i].name, name)
    assert.equal(SPELLS[i].count, count)
    assert.equal(SPELLS[i].id, i + 1)
  })
  assert.equal(TARGET_SCORE, 8)
})

test('不同人数的秘密牌数量正确', () => {
  assert.equal(secretCountFor(2), 12)
  assert.equal(secretCountFor(3), 6)
  assert.equal(secretCountFor(4), 4)
  assert.equal(secretCountFor(5), 4)
  assert.throws(() => secretCountFor(1))
  assert.throws(() => secretCountFor(6))
})

test('准备一轮会分出秘密牌、五张暗手，并保留摸牌堆', () => {
  const deck = createDeck()
  assert.equal(deck.length, 36)
  const state = prepareRound([
    { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
  ], fixedRng)

  assert.equal(state.secretPile.length, 4)
  assert.equal(state.deck.length, 12)
  assert.equal(state.players.length, 4)
  for (const p of state.players) {
    assert.equal(p.hand.length, 5)
    assert.equal(p.health, 6)
    assert.deepEqual(p.secrets, [])
  }
  assert.deepEqual(state.castCounts, { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0 })

  const allVisible = state.players.flatMap((p) => p.hand).concat(state.secretPile, state.deck)
  const counts = {}
  for (const id of allVisible) counts[id] = (counts[id] || 0) + 1
  for (const spell of SPELLS) assert.equal(counts[spell.id] ?? 0, spell.count)
})

test('递增限制：成功后不能施放更罕见等级，新回合重置', () => {
  assert.equal(canCast(null, 7), true)
  assert.equal(canCast(7, 7), true)
  assert.equal(canCast(7, 8), true)
  assert.equal(canCast(7, 6), false)
  assert.equal(canCast(1, 8), true)
})

function makeStartedState() {
  // 数组顺序即座位顺序（也是行动顺序）：caster 的下家是第二位。
  const state = prepareRound([{ id:'caster' }, { id:'next' }, { id:'prev' }], fixedRng)
  state.currentPlayerId = 'caster'
  state.players[0].hand = [8]
  state.players[1].hand = [8, 8, 8, 8, 8]
  state.players[2].hand = [8, 8, 8, 8, 8]
  return state
}

test('魔法药水成功：消耗手牌、回血并允许继续或结束', () => {
  const state = makeStartedState()
  state.players[0].hand = [8, 8]
  state.players[0].health = 4
  const result = applyCast(state, 'caster', 8, fixedRng)
  assert.equal(result.ok, true)
  assert.equal(result.spellId, 8)
  assert.equal(state.players[0].health, 5)
  assert.equal(state.players[0].hand.length, 1)
  assert.equal(state.castCounts[8], 1)
  assert.equal(state.currentPlayerId, 'caster')
  assert.equal(state.lastCastLevel, 8)
  assert.equal(state.phase, 'playing')
})

test('火球击败下家立即结算：施法者三分、存活者一分', () => {
  const state = makeStartedState()
  state.players[0].hand = [7]
  // 火球命中下家（数组第二位）。
  state.players[1].health = 1
  state.players[2].health = 1
  const nextPlayer = state.players.find((p) => p.id === 'next')
  state.currentPlayerId = 'caster'
  const result = applyCast(state, 'caster', 7, fixedRng)
  assert.equal(result.ok, true)
  assert.equal(nextPlayer.health, 0)
  assert.equal(state.phase, 'round_end')
  assert.equal(state.summary.winnerId, 'caster')
  assert.equal(state.players[0].score, 3)
  // 被击败的下家得 0 分，存活的另一名玩家得 1 分。
  assert.equal(state.players[1].score, 0)
  assert.equal(state.players[2].score, 1)
})

test('普通施法失败扣一心并锁定回合；古龙失败掷骰扣 1 到 3 心', () => {
  let calls = 0
  const rng = () => { calls++; return 0 }
  const state = makeStartedState()
  state.players[0].hand = []
  const failed = applyCast(state, 'caster', 6, rng)
  assert.equal(failed.ok, false)
  assert.equal(failed.reason, 'missing')
  assert.equal(state.players[0].health, 5)
  assert.equal(calls, 0)
  // 猜错后仍停留在原回合，等待玩家手动结束
  assert.equal(state.currentPlayerId, 'caster')
  const passed = endTurn(state, 'caster')
  assert.equal(passed.ok, true)
  assert.equal(state.currentPlayerId, 'next')

  const dragon = makeStartedState()
  dragon.players[0].hand = []
  const dragonFailed = applyCast(dragon, 'caster', 1, rng)
  assert.equal(dragonFailed.ok, false)
  assert.equal(dragonFailed.reason, 'missing')
  assert.equal(dragonFailed.damage, 1)
  assert.equal(dragon.players[0].health, 5)
})

test('猫头鹰获取秘密牌，轮末存活时每张加一分', () => {
  const state = makeStartedState()
  state.secretPile = [3, 6]
  state.players[0].hand = [4, 8]
  applyCast(state, 'caster', 4, fixedRng)
  assert.deepEqual(state.players[0].secrets, [3])
  assert.equal(state.secretPile.length, 1)

  // “结束回合”只是换下一位玩家继续本轮，不提前计分。
  endTurn(state, 'caster')
  assert.equal(state.phase, 'playing')
  assert.equal(state.currentPlayerId, 'next')
  assert.equal(state.players[0].hand.length, 5)
  for (const player of state.players) assert.equal(player.score, 0)
})

test('死亡玩家的秘密牌不加分', () => {
  const state = makeStartedState()
  // caster 有 1 张秘密牌但被打死；next 也活着但没有秘密牌。
  state.players[0].secrets = [2]
  state.players[0].hand = [7]
  state.players[1].health = 1
  applyCast(state, 'caster', 7, fixedRng)
  assert.equal(state.phase, 'round_end')
  assert.equal(state.summary.reason, 'kill')
  assert.equal(state.players[0].score, 4) // 击杀得 3 分 + 存活且持秘密牌加 1
})

test('清空全部魔法立即获胜，其他玩家按死亡处理', () => {
  const state = makeStartedState()
  state.players[0].secrets = [2]
  const result = applyCast(state, 'caster', 8, fixedRng)
  assert.equal(result.ok, true)
  assert.equal(result.spellId, 8);
  assert.equal(state.phase, 'round_end')
  assert.equal(state.summary.reason, 'all_spells')
  assert.equal(state.players[0].score, 4)
  assert.equal(state.players[1].score, 0)
  assert.equal(state.players[2].score, 0)
})

test('结束回合会补齐手牌并轮到下一位', () => {
  const state = makeStartedState()
  state.players[0].hand = [8, 8] // 用掉 1 张后剩 1 张，回合结束应补到 5
  state.deck = [3, 6, 6, 7, 7]
  applyCast(state, 'caster', 8, fixedRng)
  assert.equal(state.players[0].hand.length, 1)
  endTurn(state, 'caster')
  assert.equal(state.players[0].hand.length, 5)
  assert.equal(state.deck.length, 1) // 只补了 4 张
  assert.equal(state.currentPlayerId, 'next')
})

test('没有宣告过魔法前不能主动结束回合', () => {
  const state = makeStartedState()
  const result = endTurn(state, 'caster')
  assert.equal(result.ok, false)
  assert.match(result.error, /至少需要宣告一次/)
})

test('猜错后留在原回合：不能继续施法，只能结束回合换人', () => {
  const state = makeStartedState()
  state.players[0].hand = [4] // 只剩 1 张，宣告一个没有的魔法会失败
  state.deck = [6, 6, 6, 6]
  const failed = applyCast(state, 'caster', 6, fixedRng)
  assert.equal(failed.ok, false)
  // 猜错后不补手牌、不换人
  assert.equal(state.players[0].hand.length, 1)
  assert.equal(state.deck.length, 4)
  assert.equal(state.currentPlayerId, 'caster')
  // 锁定施法，但允许结束回合
  const again = applyCast(state, 'caster', 7, fixedRng)
  assert.equal(again.ok, false)
  assert.match(again.error, /请结束回合/)
  const passed = endTurn(state, 'caster')
  assert.equal(passed.ok, true)
  assert.equal(state.players[0].hand.length, 5)
  assert.equal(state.deck.length, 0) // 结束回合时才补齐
  assert.equal(state.currentPlayerId, 'next')
})

test('连续施法：成功后只能出同级或更常见魔法', () => {
  const state = makeStartedState()
  state.players[0].hand = [8, 8, 7]
  const first = applyCast(state, 'caster', 8, fixedRng)
  assert.equal(first.ok, true)
  assert.equal(state.lastCastLevel, 8)
  // 出过药水(8)后不能再出火球(7)
  const blocked = applyCast(state, 'caster', 7, fixedRng)
  assert.equal(blocked.ok, false)
  // 但可以继续出药水
  const second = applyCast(state, 'caster', 8, fixedRng)
  assert.equal(second.ok, true)
  assert.equal(state.castCounts[8], 2)
})
