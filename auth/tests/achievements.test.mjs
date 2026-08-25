import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateAchievements, ACHIEVEMENT_DEFS } from '../src/achievements.js'

const emptyCareer = () => ({ totalCasts: 0, totalKills: 0, totalWins: 0, spellCounts: {} })

test('成就定义 key 无重复', () => {
  const keys = ACHIEVEMENT_DEFS.map(d => d.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('龙来：单次龙息击杀 >= 3 触发', async () => {
  const match = {
    players: [{
      playerId: 'p1', kills: 3, dragonKills: 3, dragonOneCastKills: 3,
      spellsCast: { 1: 1 }, deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  const keys = out.filter(u => u.playerId === 'p1').map(u => u.key)
  assert.ok(keys.includes('dragon_triple_one'), '应触发龙来')
  assert.ok(keys.includes('first_cast'), '首次施法也应触发')
  assert.ok(keys.includes('first_kill'), '首次击杀也应触发')
})

test('三星龙：分多次累计击杀 3 人触发，但不触发龙来', async () => {
  const match = {
    players: [{
      playerId: 'p1', kills: 3, dragonKills: 3, dragonOneCastKills: 1,
      spellsCast: { 1: 3 }, deaths: 0, roundsSurvived: 3,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  const keys = out.map(u => u.key)
  assert.ok(keys.includes('dragon_triple_total'))
  assert.ok(!keys.includes('dragon_triple_one'), '单次只有 1 杀不应触发龙来')
})

test('一滴血王朝：夺冠时 finalHp === 1', async () => {
  const match = {
    players: [{
      playerId: 'p1', isChampion: true, finalHp: 1, score: 8,
      spellsCast: {}, deaths: 0, roundsSurvived: 3,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'one_hp_king'))
})

test('稳如老狗：0 死亡 + 冠军', async () => {
  const match = {
    players: [{
      playerId: 'p1', isChampion: true, deaths: 0, finalHp: 3, score: 9,
      spellsCast: {}, roundsSurvived: 3,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'untouchable'))
})

test('彩蛋出生即退场：第 1 轮自杀', async () => {
  const match = {
    players: [{
      playerId: 'p1', firstRoundSuicide: true, deaths: 1,
      spellsCast: {}, roundsSurvived: 0,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'egg_first_round_suicide'))
})

test('天气之子：同轮 5/6/7 各一次', async () => {
  const match = {
    players: [{
      playerId: 'p1', spellsCast: { 5: 1, 6: 1, 7: 1 },
      roundSpellCasts: [{ round: 1, spellId: 5 }, { round: 1, spellId: 6 }, { round: 1, spellId: 7 }],
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'weather_child'))
})

test('跨场次累计：career + 当前场相加判定', async () => {
  const match = {
    players: [{
      playerId: 'p1', kills: 1, spellsCast: { 2: 5 }, deaths: 0, roundsSurvived: 1,
    }],
  }
  const career = { totalCasts: 95, totalKills: 0, totalWins: 0, spellCounts: { 2: 18 } }
  const out = await evaluateAchievements(match, async () => career)
  const keys = out.map(u => u.key)
  assert.ok(keys.includes('hundred_casts'), '95 + 5 = 100 应触发百法齐鸣')
  assert.ok(keys.includes('night_walker'), '18 + 5 = 23 >= 20 应触发夜行侠')
})
