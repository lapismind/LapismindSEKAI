import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateAchievements, ACHIEVEMENT_DEFS } from '../src/achievements.js'

const emptyCareer = () => ({ totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0, spellCounts: {} })

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

test('流星火雨：火球连续成功 3 次', async () => {
  const match = {
    players: [{
      playerId: 'p1', spellsCast: { 7: 3 }, castStreaks: { 7: [true, true, true] },
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'meteor'))
})

test('霜天：暴风雪连续 2 次成功 + 1 次失败不触发', async () => {
  const match = {
    players: [{
      playerId: 'p1', spellsCast: { 6: 3 }, castStreaks: { 6: [true, true, false] },
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(!out.some(u => u.key === 'frost'))
})

test('绝地反击：1 血击杀死前血量 >=3 的目标', async () => {
  const match = {
    players: [{
      playerId: 'p1', kills: 1, killedHighHpTarget: true, spellsCast: { 7: 1 },
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'comeback'))
})

test('卡牌大师：0 击杀夺冠', async () => {
  const match = {
    players: [{
      playerId: 'p1', isChampion: true, kills: 0, deaths: 1, score: 8,
      spellsCast: { 3: 2 }, roundsSurvived: 3,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'pacifist_king'))
})

test('奶龙大王：龙失败 10 次 + 自杀 10 次（跨场累计）', async () => {
  const match = {
    players: [{
      playerId: 'p1', dragonFails: 4, suicides: 4, spellsCast: {},
      deaths: 4, roundsSurvived: 0,
    }],
  }
  const career = { totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 6, suicides: 6, spellCounts: {} }
  const out = await evaluateAchievements(match, async () => career)
  assert.ok(out.some(u => u.key === 'dragon_clown'))
})

test('元素反应：单回合集齐雷雪火', async () => {
  const match = {
    players: [{
      playerId: 'p1', spellsCast: { 5: 1, 6: 1, 7: 1 },
      turnSpellSets: { 0: [5, 6, 7] },
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'elemental'))
})

test('我不同意：对手曾到 7 分自己 <=3 最终夺冠', async () => {
  const match = {
    players: [{
      playerId: 'p1', isChampion: true, comebackFromBehind: true, score: 9,
      spellsCast: {}, deaths: 0, roundsSurvived: 5,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'not_approved'))
})

test('白板登基：轮胜时 0 秘密牌且从未放过猫头鹰', async () => {
  const match = {
    players: [{
      playerId: 'p1', roundWonNoSecrets: true, spellsCast: { 7: 1 },
      deaths: 0, roundsSurvived: 1,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.ok(out.some(u => u.key === 'egg_no_secret_win'))
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
