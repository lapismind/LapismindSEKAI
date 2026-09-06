import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateAchievements, ACHIEVEMENT_DEFS } from '../src/achievements.js'

const ACTIVE_KEYS = [
  'magic_staircase',
  'one_breath',
  'eight_facets',
  'last_breath',
  'weak_over_strong',
  'pincer_finish',
  'dragon_sweep',
  'refuse_ending',
  'secret_investor',
  'different_paths',
]

const OLD_KEYS = [
  'first_cast', 'first_kill', 'potion_addict', 'spell_collector',
  'meteor', 'frost', 'weather_child', 'night_walker', 'last_breath', 'secret_rich',
  'comeback', 'double_kill', 'pacifist_king', 'untouchable', 'hundred_casts',
  'dragon_clown', 'all_rounded', 'dragon_triple_total',
  'not_approved', 'opening_blast', 'elemental', 'dragon_veteran', 'god_of_kill',
  'match_master', 'dragon_triple_one',
  'egg_first_round_suicide', 'egg_gentle', 'egg_full_then_dead',
  'egg_social_death', 'egg_no_secret_win',
]

const CANDIDATE_KEYS = ['self_made', 'five_spell_champion', 'full_table_school']
const emptyCareer = () => ({ totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0, spellCounts: {} })

test('成就定义 key 无重复且字段固定', () => {
  const keys = ACHIEVEMENT_DEFS.map((definition) => definition.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const definition of ACHIEVEMENT_DEFS) {
    assert.deepEqual(Object.keys(definition).sort(), ['desc', 'difficulty', 'game', 'key', 'name', 'status'])
    assert.equal(definition.game, 'abracadawhat')
    assert.ok(Number.isInteger(definition.difficulty) && definition.difficulty >= 1 && definition.difficulty <= 4)
    assert.ok(['active', 'legacy', 'hidden'].includes(definition.status))
  }
})

test('active 恰好是批准的 10 个传奇成就且本次没有 hidden', () => {
  const activeKeys = ACHIEVEMENT_DEFS.filter((definition) => definition.status === 'active').map((definition) => definition.key).sort()
  assert.deepEqual(activeKeys, [...ACTIVE_KEYS].sort())
  assert.equal(activeKeys.length, 10)
  assert.equal(ACHIEVEMENT_DEFS.some((definition) => definition.status === 'hidden'), false)
})

test('所有旧定义元数据保留，除一线生机外均转为 legacy', () => {
  const byKey = new Map(ACHIEVEMENT_DEFS.map((definition) => [definition.key, definition]))
  for (const key of OLD_KEYS) {
    const definition = byKey.get(key)
    assert.ok(definition, `旧定义 ${key} 必须保留`)
    assert.ok(definition.name.length > 0, `${key} 保留名称`)
    assert.ok(definition.desc.length > 0, `${key} 保留描述`)
    assert.equal(definition.status, key === 'last_breath' ? 'active' : 'legacy')
  }
})

test('累计成就、坏激励成就和候选替补均不 active 且候选不占位', () => {
  const byKey = new Map(ACHIEVEMENT_DEFS.map((definition) => [definition.key, definition]))
  for (const key of ['first_cast', 'first_kill', 'potion_addict', 'spell_collector', 'night_walker', 'hundred_casts', 'dragon_veteran', 'god_of_kill', 'match_master', 'dragon_clown', 'egg_social_death']) {
    assert.equal(byKey.get(key)?.status, 'legacy', `${key} 不得继续 active`)
  }
  for (const key of CANDIDATE_KEYS) assert.equal(byKey.has(key), false, `${key} 不得加入定义或预留占位`)
})

test('C1 未完成的新 checker 保持不触发，已有一线生机 checker 可继续触发', async () => {
  const match = {
    players: [{
      playerId: 'p1',
      roundWonAtHp1: true,
      spellsCast: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
      turnSpellSets: { 0: [5, 6, 7] },
      dragonOneCastKills: 3,
      comebackFromBehind: true,
      roundEndSecrets: 3,
    }],
  }
  const out = await evaluateAchievements(match, async () => emptyCareer())
  assert.deepEqual(out, [{ playerId: 'p1', key: 'last_breath' }])
})

test('evaluateAchievements 不执行 legacy checker', async () => {
  const match = {
    players: [{
      playerId: 'p1',
      kills: 50,
      isChampion: true,
      deaths: 0,
      dragonFails: 10,
      suicides: 10,
      maxFailsInRound: 3,
      spellsCast: { 1: 30, 2: 20, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10 },
    }],
  }
  const career = { totalCasts: 100, totalKills: 50, totalWins: 50, dragonFails: 10, suicides: 10, spellCounts: { 1: 30, 2: 20, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10 } }
  const out = await evaluateAchievements(match, async () => career)
  assert.equal(out.some(({ key }) => OLD_KEYS.includes(key) && key !== 'last_breath'), false)
})

test('evaluateAchievements 可遍历未来明确标为 hidden 的 checker', async () => {
  const lastBreath = ACHIEVEMENT_DEFS.find((definition) => definition.key === 'last_breath')
  const originalStatus = lastBreath.status
  lastBreath.status = 'hidden'
  try {
    const out = await evaluateAchievements({ players: [{ playerId: 'p1', roundWonAtHp1: true }] }, async () => emptyCareer())
    assert.deepEqual(out, [{ playerId: 'p1', key: 'last_breath' }])
  } finally {
    lastBreath.status = originalStatus
  }
})
