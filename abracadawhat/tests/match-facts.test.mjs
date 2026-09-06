import assert from 'node:assert/strict'
import { test } from 'node:test'
import './helpers/workerLoader.mjs'

const { AbracaRoom } = await import('../src/worker/abracaRoom.js')
const { sanitizeMatchReport } = await import('../../auth/src/matchReports.js')

const emptyCounts = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 })

function player(id, seat, overrides = {}) {
  return {
    id,
    nickname: id,
    avatarId: String(seat + 1),
    seat,
    score: 0,
    health: 6,
    hand: [8, 8, 8, 8, 8],
    secrets: [],
    alive: true,
    isHost: seat === 0,
    connected: true,
    ...overrides,
  }
}

function statsFor(p) {
  return {
    playerId: p.id,
    nickname: p.nickname,
    score: 0,
    kills: 0,
    deaths: 0,
    spellsCast: {},
    secretsTaken: 0,
    roundsSurvived: 0,
    roundWonAtHp1: false,
    roundEndSecrets: 0,
    roundKillsNonDragon: 0,
    dragonKills: 0,
    dragonOneCastKills: 0,
    finalHp: null,
    firstRoundSuicide: false,
    roundSpellCasts: [],
    maxFailsInRound: 0,
    hadFullHpThenDied: false,
    castStreaks: {},
    turnSpellSets: {},
    currentTurnIndex: 0,
    dragonFails: 0,
    suicides: 0,
    killedHighHpTarget: false,
    singleCastMultiKillNonDragon: 0,
    firstTurnDragon3: false,
    comebackFromBehind: false,
    roundWonNoSecrets: false,
    hadLowThenFullThenDied: false,
    lowHpSeen: false,
    castOwlThisMatch: false,
    scoreBySource: { roundWinPoints: 0, survivalPoints: 0, secretPoints: 0 },
    roundWins: 0,
    roundWinsByReason: { kill: 0, all_spells: 0 },
    maxTurnCastCount: 0,
    maxTurnDistinctSpells: 0,
  }
}

function makeState(players, overrides = {}) {
  return {
    hostId: players[0].id,
    phase: 'playing',
    round: 1,
    targetScore: 8,
    players,
    deck: [],
    secretPile: [],
    castCounts: emptyCounts(),
    currentPlayerId: players[0].id,
    lastCastLevel: null,
    castSucceeded: {},
    castFailed: {},
    summary: null,
    matchHistory: [],
    matchStats: {
      reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
      factsVersion: 2,
      startAt: '2026-09-07T00:00:00.000Z',
      finishedAt: '2026-09-07T00:20:00.000Z',
      players: Object.fromEntries(players.map((p) => [p.id, statsFor(p)])),
      facts: [],
      round: 1,
    },
    ...overrides,
  }
}

function makeRoom(sockets = []) {
  return new AbracaRoom({
    name: 'FACT-ROOM',
    storage: { put: async () => {} },
    getWebSockets: () => sockets,
  }, {})
}

function fact(state, key, playerId) {
  return state.matchStats.facts.filter((entry) => entry.key === key && entry.playerId === playerId)
}

test('beginRound snapshots starting hands and reveals each snapshot only to its owner at round_end', async () => {
  const players = [player('p1', 0), player('p2', 1)]
  const state = makeState(players, { phase: 'waiting', round: 0 })
  const room = makeRoom()

  await room.beginRound(state)
  const p1Start = [...state.players[0].hand]
  const p2Start = [...state.players[1].hand]
  assert.deepEqual(state.startingHands, { p1: p1Start, p2: p2Start })

  state.phase = 'round_end'
  const p1View = room.publicState(state, 'p1')
  const p2View = room.publicState(state, 'p2')
  assert.deepEqual(p1View.startingHand, p1Start)
  assert.deepEqual(p2View.startingHand, p2Start)
  assert.equal(p1View.players[0].startingHand, undefined)
  assert.equal(p1View.players[1].startingHand, undefined)

  const report = room.buildMatchReport(state, state.players[0])
  assert.equal(JSON.stringify(report).includes('startingHand'), false)
})

test('successful deliberate stop records turn maxima and voluntary_stop but forced failure does not', async () => {
  const players = [player('p1', 0, { hand: [5, 6, 7, 8, 8] }), player('p2', 1), player('p3', 2)]
  const state = makeState(players, { deck: [1, 2, 3, 4] })
  const room = makeRoom()

  await room.doCast(state, 'p1', { spellId: 5 })
  await room.doCast(state, 'p1', { spellId: 6 })
  await room.doCast(state, 'p1', { spellId: 7 })
  await room.doEndTurn(state, 'p1')

  assert.equal(state.matchStats.players.p1.maxTurnCastCount, 3)
  assert.equal(state.matchStats.players.p1.maxTurnDistinctSpells, 3)
  assert.deepEqual(fact(state, 'turn_distinct_spells', 'p1'), [{
    key: 'turn_distinct_spells',
    playerId: 'p1',
    data: { round: 1, spellIds: [5, 6, 7], castCount: 3 },
  }])
  assert.deepEqual(fact(state, 'voluntary_stop', 'p1'), [{
    key: 'voluntary_stop',
    playerId: 'p1',
    data: { round: 1, successCount: 3, distinctCount: 3 },
  }])

  state.players[1].hand = [8]
  state.currentPlayerId = 'p2'
  await room.doCast(state, 'p2', { spellId: 7 })
  await room.doEndTurn(state, 'p2')
  assert.equal(fact(state, 'voluntary_stop', 'p2').length, 0)
})

test('terminal four-cast clear records turn streak, exact round win and cumulative score sources', async () => {
  const players = [player('p1', 0, { hand: [5, 6, 7, 8], secrets: [2] }), player('p2', 1)]
  const state = makeState(players)
  const room = makeRoom()

  for (const spellId of [5, 6, 7, 8]) await room.doCast(state, 'p1', { spellId })

  assert.equal(state.summary.reason, 'all_spells')
  assert.equal(state.summary.decisiveSpellId, 8)
  assert.equal(state.matchStats.players.p1.roundWins, 1)
  assert.deepEqual(state.matchStats.players.p1.roundWinsByReason, { kill: 0, all_spells: 1 })
  assert.deepEqual(state.matchStats.players.p1.scoreBySource, {
    roundWinPoints: 3,
    survivalPoints: 0,
    secretPoints: 1,
  })
  assert.equal(state.players[0].score, 4)
  assert.deepEqual(fact(state, 'turn_clear_streak', 'p1'), [{
    key: 'turn_clear_streak',
    playerId: 'p1',
    data: { round: 1, successCount: 4, reason: 'all_spells' },
  }])
})

test('low-hp kill captures actor decision HP and target pre-damage HP', async () => {
  const players = [player('p1', 0, { health: 1, hand: [1, 8] }), player('p2', 1, { health: 3 })]
  const state = makeState(players)
  const room = makeRoom()

  const originalRandom = Math.random
  Math.random = () => 0.999
  try {
    await room.doCast(state, 'p1', { spellId: 1 })
  } finally {
    Math.random = originalRandom
  }

  assert.equal(state.players[0].health, 1)
  assert.deepEqual(fact(state, 'low_hp_kill', 'p1'), [{
    key: 'low_hp_kill',
    playerId: 'p1',
    data: { round: 1, spellId: 1, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' },
  }])
  assert.deepEqual(fact(state, 'round_win_low_hp', 'p1'), [{
    key: 'round_win_low_hp',
    playerId: 'p1',
    data: { round: 1, actorHp: 1, reason: 'kill' },
  }])
})

test('multi-kill facts and death counters deduplicate repeated damaged targets', async () => {
  const ordinaryPlayers = [
    player('p1', 0, { hand: [5, 8] }),
    player('p2', 1, { health: 1 }),
    player('p3', 2, { health: 1 }),
  ]
  const ordinary = makeState(ordinaryPlayers)
  const ordinaryRoom = makeRoom()
  await ordinaryRoom.doCast(ordinary, 'p1', { spellId: 5 })
  assert.deepEqual(fact(ordinary, 'multi_kill_non_dragon', 'p1')[0].data, { round: 1, spellId: 5, killCount: 2 })
  assert.equal(ordinary.matchStats.players.p2.deaths, 1)
  assert.equal(ordinary.matchStats.players.p3.deaths, 1)

  const dragonPlayers = [
    player('p1', 0, { hand: [1, 8] }),
    player('p2', 1, { health: 1 }),
    player('p3', 2, { health: 1 }),
    player('p4', 3, { health: 1 }),
  ]
  const dragon = makeState(dragonPlayers)
  const originalRandom = Math.random
  Math.random = () => 0
  try {
    await makeRoom().doCast(dragon, 'p1', { spellId: 1 })
  } finally {
    Math.random = originalRandom
  }
  assert.deepEqual(fact(dragon, 'dragon_multi_kill', 'p1')[0].data, { round: 1, spellId: 1, killCount: 3 })

  assert.equal(ordinary.matchStats.players.p1.kills, 2)
  assert.equal(dragon.matchStats.players.p1.kills, 3)
  assert.equal(dragon.matchStats.players.p2.deaths, 1)
  assert.equal(dragon.matchStats.players.p3.deaths, 1)
  assert.equal(dragon.matchStats.players.p4.deaths, 1)

  const twoPlayer = makeState([
    player('p1', 0, { hand: [5, 8] }),
    player('p2', 1, { health: 1 }),
  ])
  await makeRoom().doCast(twoPlayer, 'p1', { spellId: 5 })
  assert.equal(twoPlayer.matchStats.players.p1.kills, 1)
  assert.equal(twoPlayer.matchStats.players.p2.deaths, 1)
  assert.equal(fact(twoPlayer, 'multi_kill_non_dragon', 'p1').length, 0)
})

test('using all eight spell types through real casts records one deterministic all_spell_types fact', async () => {
  const players = [player('p1', 0), player('p2', 1), player('p3', 2)]
  const state = makeState(players)
  const room = makeRoom()
  const originalRandom = Math.random
  Math.random = () => 0
  try {
    for (const spellId of [1, 2, 3, 4, 5, 6, 7, 8]) {
      state.phase = 'playing'
      state.currentPlayerId = 'p1'
      state.lastCastLevel = null
      state.castSucceeded = {}
      state.castFailed = {}
      state.players[0].hand = [spellId, 8]
      for (const target of state.players.slice(1)) {
        target.health = 6
        target.alive = true
      }
      await room.doCast(state, 'p1', { spellId })
    }
  } finally {
    Math.random = originalRandom
  }

  assert.deepEqual(fact(state, 'all_spell_types', 'p1'), [{
    key: 'all_spell_types',
    playerId: 'p1',
    data: { spellIds: [1, 2, 3, 4, 5, 6, 7, 8] },
  }])
})

test('all alive end-round players receive secret-stack facts, not only the winner', async () => {
  const players = [
    player('p1', 0, { hand: [7, 8], secrets: [] }),
    player('p2', 1, { health: 1, secrets: [1, 2, 3] }),
    player('p3', 2, { secrets: [4, 5, 6, 7] }),
  ]
  const state = makeState(players)
  const room = makeRoom()

  await room.doCast(state, 'p1', { spellId: 7 })

  assert.equal(fact(state, 'survivor_secret_stack', 'p1').length, 0)
  assert.equal(fact(state, 'survivor_secret_stack', 'p2').length, 0, '死亡玩家不记录秘密投资人')
  assert.deepEqual(fact(state, 'survivor_secret_stack', 'p3')[0].data, { round: 1, secretCount: 4 })
})

test('B1 persisted match stats are upgraded lazily when a B2 round finishes', async () => {
  const players = [player('p1', 0, { hand: [7, 8] }), player('p2', 1, { health: 1 })]
  const state = makeState(players)
  delete state.matchStats.factsVersion
  delete state.matchStats.facts
  for (const ms of Object.values(state.matchStats.players)) {
    delete ms.scoreBySource
    delete ms.roundWins
    delete ms.roundWinsByReason
    delete ms.maxTurnCastCount
    delete ms.maxTurnDistinctSpells
  }

  await assert.doesNotReject(() => makeRoom().doCast(state, 'p1', { spellId: 7 }))
  assert.deepEqual(state.matchStats.players.p1.scoreBySource, {
    roundWinPoints: 3,
    survivalPoints: 0,
    secretPoints: 0,
  })
  assert.equal(state.matchStats.players.p1.roundWins, 1)
  const report = makeRoom().buildMatchReport(state, state.players[0])
  assert.equal(report.schemaVersion, undefined)
  assert.equal(sanitizeMatchReport(report).version, 1)
})

test('B1 persisted match stats can record a voluntary stop without NaN turn maxima', async () => {
  const players = [player('p1', 0, { hand: [7, 8, 8] }), player('p2', 1)]
  const state = makeState(players, { deck: [1, 2, 3, 4] })
  delete state.matchStats.players.p1.maxTurnCastCount
  delete state.matchStats.players.p1.maxTurnDistinctSpells

  const room = makeRoom()
  await room.doCast(state, 'p1', { spellId: 7 })
  await room.doCast(state, 'p1', { spellId: 8 })
  await room.doEndTurn(state, 'p1')

  assert.equal(state.matchStats.players.p1.maxTurnCastCount, 2)
  assert.equal(state.matchStats.players.p1.maxTurnDistinctSpells, 2)
  assert.equal(Number.isNaN(state.matchStats.players.p1.maxTurnCastCount), false)
})

test('two authoritative win routes emit round_win_routes and actual buildMatchReport sanitizes', async () => {
  const players = [player('p1', 0, { hand: [7, 8] }), player('p2', 1, { health: 1 })]
  const state = makeState(players)
  const room = makeRoom()

  await room.doCast(state, 'p1', { spellId: 7 })
  assert.deepEqual(state.matchStats.players.p1.roundWinsByReason, { kill: 1, all_spells: 0 })

  state.phase = 'playing'
  state.round = 2
  state.summary = null
  state.currentPlayerId = 'p1'
  state.lastCastLevel = null
  state.castSucceeded = {}
  state.castFailed = {}
  state.players[0].alive = true
  state.players[0].health = 6
  state.players[0].hand = [8]
  state.players[0].secrets = []
  state.players[1].alive = true
  state.players[1].health = 6
  state.players[1].hand = [8]
  state.players[1].secrets = []
  await room.doCast(state, 'p1', { spellId: 8 })

  assert.deepEqual(state.matchStats.players.p1.roundWinsByReason, { kill: 1, all_spells: 1 })
  assert.deepEqual(fact(state, 'round_win_routes', 'p1'), [{
    key: 'round_win_routes',
    playerId: 'p1',
    data: { kill: 1, allSpells: 1 },
  }])

  state.matchStats.players.p1.spellsCast = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index + 1, 1]))
  const champion = state.players[0]
  const report = room.buildMatchReport(state, champion)
  const sanitized = sanitizeMatchReport(report)

  assert.equal(sanitized.ok, true, sanitized.error)
  for (const standing of report.standings) {
    assert.equal(
      Object.values(standing.scoreBySource).reduce((sum, points) => sum + points, 0),
      standing.score,
    )
  }
})

test('buildMatchReport emits exact comeback_win data from an authoritative score snapshot', () => {
  const players = [player('p1', 0, { score: 8 }), player('p2', 1, { score: 7 })]
  const state = makeState(players, { round: 3 })
  state.matchStats.scoreSnapshots = [{ p1: 3, p2: 7 }]
  state.matchStats.players.p1.scoreBySource = { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }
  state.matchStats.players.p1.roundWins = 2
  state.matchStats.players.p1.roundWinsByReason = { kill: 1, all_spells: 1 }
  state.matchStats.players.p2.scoreBySource = { roundWinPoints: 6, survivalPoints: 1, secretPoints: 0 }
  state.matchStats.players.p2.roundWins = 2
  state.matchStats.players.p2.roundWinsByReason = { kill: 2, all_spells: 0 }

  const report = makeRoom().buildMatchReport(state, players[0])

  assert.deepEqual(report.facts.filter((entry) => entry.key === 'comeback_win'), [{
    key: 'comeback_win',
    playerId: 'p1',
    data: { playerScoreBefore: 3, opponentScoreBefore: 7, finalScore: 8 },
  }])
  assert.equal(sanitizeMatchReport(report).ok, true)
})

test('buildMatchReport does not emit an invalid comeback fact when final score only ties the prior lead', () => {
  const players = [player('p1', 0, { score: 8 }), player('p2', 1, { score: 8 })]
  const state = makeState(players, { round: 3 })
  state.matchStats.scoreSnapshots = [{ p1: 3, p2: 8 }]
  for (const id of ['p1', 'p2']) {
    state.matchStats.players[id].scoreBySource = { roundWinPoints: 6, survivalPoints: 2, secretPoints: 0 }
    state.matchStats.players[id].roundWins = 2
    state.matchStats.players[id].roundWinsByReason = { kill: 2, all_spells: 0 }
  }

  const report = makeRoom().buildMatchReport(state, players[0])

  assert.equal(report.facts.some((entry) => entry.key === 'comeback_win'), false)
  assert.equal(sanitizeMatchReport(report).ok, true)
})
