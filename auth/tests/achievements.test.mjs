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

function standing(playerId = 'p1', overrides = {}) {
  return {
    playerId,
    nickname: playerId,
    rank: playerId === 'p1' ? 1 : 2,
    score: playerId === 'p1' ? 8 : 2,
    scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 },
    spellCounts: {},
    kills: 0,
    dragonKills: 0,
    deaths: 0,
    suicides: 0,
    roundWins: 0,
    roundWinsByReason: { kill: 0, all_spells: 0 },
    maxTurnCastCount: 0,
    maxTurnDistinctSpells: 0,
    ...overrides,
  }
}

function v2Report({ p1 = {}, facts = [] } = {}) {
  return {
    schemaVersion: 2,
    standings: [standing('p1', p1), standing('p2')],
    facts,
  }
}

function fact(key, data, playerId = 'p1') {
  return { key, playerId, data }
}

const V2_CASES = [
  {
    key: 'magic_staircase',
    success: v2Report({ facts: [fact('turn_distinct_spells', { round: 1, spellIds: [2, 5, 7], castCount: 3 })] }),
    boundary: v2Report({ facts: [fact('turn_distinct_spells', { round: 1, spellIds: [2, 5], castCount: 2 })] }),
  },
  {
    key: 'one_breath',
    success: v2Report({ facts: [fact('turn_clear_streak', { round: 1, successCount: 4, reason: 'all_spells' })] }),
    boundary: v2Report({ facts: [fact('turn_clear_streak', { round: 1, successCount: 3, reason: 'all_spells' })] }),
  },
  {
    key: 'eight_facets',
    success: v2Report({ p1: { spellCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 } } }),
    boundary: v2Report({ p1: { spellCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 } } }),
  },
  {
    key: 'last_breath',
    success: v2Report({ facts: [fact('round_win_low_hp', { round: 1, actorHp: 1, reason: 'kill' })] }),
    boundary: v2Report({ facts: [fact('round_win_low_hp', { round: 1, actorHp: 2, reason: 'kill' })] }),
  },
  {
    key: 'weak_over_strong',
    success: v2Report({ facts: [fact('low_hp_kill', { round: 1, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' })] }),
    boundary: v2Report({ facts: [fact('low_hp_kill', { round: 1, spellId: 7, actorHp: 1, targetHpBefore: 2, targetPlayerId: 'p2' })] }),
  },
  {
    key: 'pincer_finish',
    success: v2Report({ facts: [fact('multi_kill_non_dragon', { round: 1, spellId: 7, killCount: 2 })] }),
    boundary: v2Report({ facts: [fact('multi_kill_non_dragon', { round: 1, spellId: 1, killCount: 2 })] }),
  },
  {
    key: 'dragon_sweep',
    success: v2Report({ facts: [fact('dragon_multi_kill', { round: 1, spellId: 1, killCount: 3 })] }),
    boundary: v2Report({ facts: [fact('dragon_multi_kill', { round: 1, spellId: 1, killCount: 2 })] }),
  },
  {
    key: 'refuse_ending',
    success: v2Report({ facts: [fact('comeback_win', { playerScoreBefore: 3, opponentScoreBefore: 7, finalScore: 8 })] }),
    boundary: v2Report({ facts: [fact('comeback_win', { playerScoreBefore: 4, opponentScoreBefore: 7, finalScore: 8 })] }),
  },
  {
    key: 'secret_investor',
    success: v2Report({ facts: [fact('survivor_secret_stack', { round: 1, secretCount: 3 })] }),
    boundary: v2Report({ p1: { scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 3 } }, facts: [] }),
  },
  {
    key: 'different_paths',
    success: v2Report({ p1: { roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 } } }),
    boundary: v2Report({ p1: { roundWins: 2, roundWinsByReason: { kill: 2, all_spells: 0 } } }),
  },
]

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

for (const { key, success, boundary } of V2_CASES) {
  test(`${key} 在精确 v2 条件满足时触发`, async () => {
    assert.deepEqual(await evaluateAchievements(success), [{ playerId: 'p1', key }])
  })

  test(`${key} 在边界条件不足时不触发`, async () => {
    assert.equal((await evaluateAchievements(boundary)).some((unlock) => unlock.key === key), false)
  })
}

test('v2 fact 必须属于被判定玩家，不能借用另一玩家事实', async () => {
  const report = v2Report({ facts: [fact('round_win_low_hp', { round: 1, actorHp: 1, reason: 'kill' }, 'p2')] })
  assert.equal((await evaluateAchievements(report)).some((unlock) => unlock.playerId === 'p1'), false)
})

test('单条 checker 抛异常时继续判定同一玩家的其他成就', async () => {
  const p1 = standing('p1')
  Object.defineProperty(p1, 'spellCounts', { get() { throw new Error('forced checker failure') } })
  const report = {
    schemaVersion: 2,
    standings: [p1, standing('p2')],
    facts: [fact('round_win_low_hp', { round: 1, actorHp: 1, reason: 'kill' })],
  }
  assert.deepEqual(await evaluateAchievements(report), [{ playerId: 'p1', key: 'last_breath' }])
})

test('v1 fallback 只读取可证明的单场字段且不需要 careerLookup', async () => {
  const report = {
    players: [{
      playerId: 'p1',
      roundWonAtHp1: true,
      spellsCast: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
      turnSpellSets: { 0: [2, 5, 7] },
      singleCastMultiKillNonDragon: 2,
      dragonOneCastKills: 3,
      comebackFromBehind: true,
    }],
  }
  const out = await evaluateAchievements(report, async () => {
    throw new Error('active v1 fallback must not query career data')
  })
  assert.deepEqual(out.map(({ key }) => key), [
    'magic_staircase', 'eight_facets', 'last_breath', 'pincer_finish', 'dragon_sweep', 'refuse_ending',
  ])
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
  const out = await evaluateAchievements(match, async () => {
    throw new Error('legacy/cumulative career lookup must not run')
  })
  assert.equal(out.some(({ key }) => OLD_KEYS.includes(key) && key !== 'last_breath'), false)
})

test('dragon_clown 和 egg_social_death 即使旧累计字段满足也永不触发', async () => {
  const report = { players: [{ playerId: 'p1', dragonFails: 10, suicides: 10, maxFailsInRound: 3 }] }
  const career = { ...emptyCareer(), dragonFails: 10, suicides: 10 }
  const out = await evaluateAchievements(report, async () => career)
  assert.equal(out.some(({ key }) => key === 'dragon_clown' || key === 'egg_social_death'), false)
})

test('evaluateAchievements 可遍历未来明确标为 hidden 的 checker', async () => {
  const lastBreath = ACHIEVEMENT_DEFS.find((definition) => definition.key === 'last_breath')
  const originalStatus = lastBreath.status
  lastBreath.status = 'hidden'
  try {
    const out = await evaluateAchievements({ players: [{ playerId: 'p1', roundWonAtHp1: true }] })
    assert.deepEqual(out, [{ playerId: 'p1', key: 'last_breath' }])
  } finally {
    lastBreath.status = originalStatus
  }
})
