import assert from 'node:assert/strict'
import { test } from 'node:test'

const storyModule = await import('../src/core/story.js')
const { sanitizeMatchReport } = await import('../../auth/src/matchReports.js')

const fact = (key, playerId, data, extras = {}) => ({ key, playerId, data, ...extras })

const validFacts = {
  comeback_win: fact('comeback_win', 'p1', {
    playerScoreBefore: 2,
    opponentScoreBefore: 7,
    finalScore: 8,
  }),
  dragon_multi_kill: fact('dragon_multi_kill', 'p1', {
    round: 2,
    spellId: 1,
    killCount: 3,
  }),
  low_hp_kill: fact('low_hp_kill', 'p1', {
    round: 3,
    spellId: 7,
    actorHp: 1,
    targetHpBefore: 3,
    targetPlayerId: 'p2',
  }),
  turn_clear_streak: fact('turn_clear_streak', 'p1', {
    round: 4,
    successCount: 4,
    reason: 'all_spells',
  }),
  survivor_secret_stack: fact('survivor_secret_stack', 'p1', {
    round: 5,
    secretCount: 3,
  }),
  round_win_routes: fact('round_win_routes', 'p1', {
    kill: 1,
    allSpells: 1,
  }),
  all_spell_types: fact('all_spell_types', 'p1', {
    spellIds: [1, 2, 3, 4, 5, 6, 7, 8],
  }),
  voluntary_stop: fact('voluntary_stop', 'p1', {
    round: 6,
    successCount: 3,
    distinctCount: 2,
  }),
}

const expectedStories = {
  comeback_win: {
    key: 'comeback_win',
    playerId: 'p1',
    tier: 'S',
    data: { playerScoreBefore: 2, opponentScoreBefore: 7, finalScore: 8 },
  },
  dragon_multi_kill: {
    key: 'dragon_multi_kill',
    playerId: 'p1',
    tier: 'S',
    data: { round: 2, spellId: 1, killCount: 3 },
  },
  low_hp_kill: {
    key: 'low_hp_kill',
    playerId: 'p1',
    tier: 'A',
    data: { round: 3, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' },
  },
  turn_clear_streak: {
    key: 'turn_clear_streak',
    playerId: 'p1',
    tier: 'A',
    data: { round: 4, successCount: 4, reason: 'all_spells' },
  },
  survivor_secret_stack: {
    key: 'secret_score',
    playerId: 'p1',
    tier: 'B',
    data: { secretPoints: 3, secretCount: 3 },
  },
  round_win_routes: {
    key: 'round_win_routes',
    playerId: 'p1',
    tier: 'B',
    data: { kill: 1, allSpells: 1 },
  },
  all_spell_types: {
    key: 'all_spell_types',
    playerId: 'p1',
    tier: 'C',
    data: { spellIds: [1, 2, 3, 4, 5, 6, 7, 8] },
  },
  voluntary_stop: {
    key: 'voluntary_stop',
    playerId: 'p1',
    tier: 'C',
    data: { round: 6, successCount: 3, distinctCount: 2 },
  },
}

function validReport(stories) {
  const standing = (playerId, rank) => ({
    playerId,
    nickname: playerId,
    rank,
    score: rank === 1 ? 8 : 0,
    scoreBySource: rank === 1
      ? { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }
      : { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 },
    spellCounts: {},
    kills: rank === 1 ? 4 : 0,
    dragonKills: rank === 1 ? 4 : 0,
    deaths: 0,
    suicides: 0,
    roundWins: rank === 1 ? 2 : 0,
    roundWinsByReason: rank === 1 ? { kill: 1, all_spells: 1 } : { kill: 0, all_spells: 0 },
    maxTurnCastCount: rank === 1 ? 4 : 0,
    maxTurnDistinctSpells: rank === 1 ? 4 : 0,
  })
  return {
    schemaVersion: 2,
    reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
    game: 'abracadawhat',
    roomId: 'B3-CONTRACT',
    startedAt: '2026-09-07T00:00:00.000Z',
    finishedAt: '2026-09-07T00:20:00.000Z',
    rounds: 6,
    standings: ['p1', 'p2', 'p3', 'p4', 'p5'].map((playerId, index) => standing(playerId, index + 1)),
    facts: [],
    stories,
  }
}

test('story module exports only the server tiers and selector', () => {
  assert.deepEqual(Object.keys(storyModule).sort(), ['STORY_TIERS', 'selectMatchStories'])
  assert.deepEqual(storyModule.STORY_TIERS, ['S', 'A', 'B', 'C'])
})

test('maps every supported B2 fact to the exact Auth story key and data schema', () => {
  for (const [key, input] of Object.entries(validFacts)) {
    assert.deepEqual(storyModule.selectMatchStories([input]), [expectedStories[key]], key)
  }
})

test('every selected story passes the real Auth v2 sanitizer contract', () => {
  for (const [key, input] of Object.entries(validFacts)) {
    const stories = storyModule.selectMatchStories([input])
    const result = sanitizeMatchReport(validReport(stories))
    assert.equal(result.ok, true, `${key}: ${result.error}`)
    assert.deepEqual(result.report.stories, stories)
  }
})

test('orders S before A before B before C and uses fixed key order within a tier', () => {
  const input = [
    validFacts.voluntary_stop,
    validFacts.round_win_routes,
    validFacts.turn_clear_streak,
    validFacts.dragon_multi_kill,
    validFacts.all_spell_types,
    validFacts.survivor_secret_stack,
    validFacts.low_hp_kill,
    validFacts.comeback_win,
  ]

  assert.deepEqual(
    storyModule.selectMatchStories(input, 3).map((story) => [story.tier, story.key]),
    [['S', 'comeback_win'], ['S', 'dragon_multi_kill'], ['A', 'low_hp_kill']],
  )
})

test('uses playerId and round as stable tie-breakers without adding player quotas', () => {
  const inputs = [
    fact('low_hp_kill', 'p2', { round: 1, spellId: 7, actorHp: 1, targetHpBefore: 4, targetPlayerId: 'p1' }),
    fact('low_hp_kill', 'p1', { round: 3, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' }),
    fact('low_hp_kill', 'p1', { round: 2, spellId: 6, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' }),
    fact('turn_clear_streak', 'p1', { round: 4, successCount: 4, reason: 'all_spells' }),
  ]

  assert.deepEqual(
    storyModule.selectMatchStories(inputs).map((story) => [story.key, story.playerId, story.data.round]),
    [
      ['low_hp_kill', 'p1', 2],
      ['low_hp_kill', 'p2', 1],
      ['turn_clear_streak', 'p1', 4],
    ],
  )
})

test('deduplicates the same story family per player to its strongest evidence', () => {
  const inputs = [
    fact('dragon_multi_kill', 'p1', { round: 1, spellId: 1, killCount: 3 }),
    fact('dragon_multi_kill', 'p1', { round: 4, spellId: 1, killCount: 4 }),
    fact('dragon_multi_kill', 'p2', { round: 2, spellId: 1, killCount: 3 }),
    fact('survivor_secret_stack', 'p1', { round: 2, secretCount: 3 }),
    fact('survivor_secret_stack', 'p1', { round: 5, secretCount: 5 }),
  ]

  assert.deepEqual(storyModule.selectMatchStories(inputs), [
    { key: 'dragon_multi_kill', playerId: 'p1', tier: 'S', data: { round: 4, spellId: 1, killCount: 4 } },
    { key: 'dragon_multi_kill', playerId: 'p2', tier: 'S', data: { round: 2, spellId: 1, killCount: 3 } },
    { key: 'secret_score', playerId: 'p1', tier: 'B', data: { secretPoints: 5, secretCount: 5 } },
  ])
})

test('returns at most three stories, honors lower limits, and allows fewer or none', () => {
  const inputs = Object.values(validFacts)

  assert.equal(storyModule.selectMatchStories(inputs).length, 3)
  assert.equal(storyModule.selectMatchStories(inputs, 99).length, 3)
  assert.equal(storyModule.selectMatchStories(inputs, 2).length, 2)
  assert.deepEqual(storyModule.selectMatchStories(inputs, 0), [])
  assert.deepEqual(storyModule.selectMatchStories([validFacts.all_spell_types]), [expectedStories.all_spell_types])
  assert.deepEqual(storyModule.selectMatchStories([]), [])
})

test('ignores unknown, incomplete, malformed, or semantically invalid facts', () => {
  const invalid = [
    null,
    'fact',
    {},
    fact('unknown', 'p1', {}),
    fact('comeback_win', 'p1', { playerScoreBefore: 4, opponentScoreBefore: 7, finalScore: 8 }),
    fact('dragon_multi_kill', 'p1', { round: 1, spellId: 1, killCount: 2 }),
    fact('low_hp_kill', '', validFacts.low_hp_kill.data),
    fact('low_hp_kill', 'p1', { ...validFacts.low_hp_kill.data, actorHp: 2 }),
    fact('low_hp_kill', 'p1', { ...validFacts.low_hp_kill.data, targetPlayerId: 'p1' }),
    fact('turn_clear_streak', 'p1', { round: 1, successCount: 3, reason: 'all_spells' }),
    fact('survivor_secret_stack', 'p1', { round: 1, secretCount: 2 }),
    fact('round_win_routes', 'p1', { kill: 1, allSpells: 0 }),
    fact('all_spell_types', 'p1', { spellIds: [1, 2, 3, 4, 5, 6, 7] }),
    fact('voluntary_stop', 'p1', { round: 1, successCount: 1, distinctCount: 1 }),
  ]

  assert.deepEqual(storyModule.selectMatchStories(invalid), [])
  assert.deepEqual(storyModule.selectMatchStories(null), [])
})

test('whitelists output fields and never carries arbitrary text or nested extras', () => {
  const input = fact('low_hp_kill', 'p1', {
    ...validFacts.low_hp_kill.data,
    text: 'client supplied',
    description: 'client supplied',
    nested: { arbitrary: true },
  }, {
    tier: 'S',
    name: 'client supplied',
    text: 'client supplied',
  })

  const [story] = storyModule.selectMatchStories([input])
  assert.deepEqual(story, expectedStories.low_hp_kill)
  assert.deepEqual(Object.keys(story), ['key', 'playerId', 'tier', 'data'])
  assert.equal(JSON.stringify(story).includes('client supplied'), false)
})

test('does not mutate inputs and returns fresh deep data on repeated calls', () => {
  const input = Object.values(validFacts).map((entry) => structuredClone(entry))
  const before = structuredClone(input)

  const first = storyModule.selectMatchStories(input)
  const second = storyModule.selectMatchStories(input)

  assert.deepEqual(input, before)
  assert.deepEqual(first, second)
  assert.notEqual(first, second)
  assert.notEqual(first[0], second[0])
  assert.notEqual(first[0].data, second[0].data)
})

test('treats facts as unordered and produces identical output for permutations', () => {
  const inputs = [
    ...Object.values(validFacts),
    fact('dragon_multi_kill', 'p1', { round: 7, spellId: 1, killCount: 4 }),
    fact('voluntary_stop', 'p2', { round: 2, successCount: 4, distinctCount: 3 }),
  ]
  const orders = [inputs, [...inputs].reverse(), [...inputs.slice(3), ...inputs.slice(0, 3)]]

  const results = orders.map((entries) => storyModule.selectMatchStories(entries))
  assert.deepEqual(results[1], results[0])
  assert.deepEqual(results[2], results[0])
})
