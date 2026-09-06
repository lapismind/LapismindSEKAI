import assert from 'node:assert/strict'
import { test } from 'node:test'

const moduleResult = await import('../src/matchReports.js')
  .then((module) => ({ module }))
  .catch((error) => ({ error }))

test('v1 清洗保留 Worker 当前发送的完整比赛事实', () => {
  assert.ok(moduleResult.module?.sanitizeMatchReport, 'sanitizeMatchReport must be implemented')

  const player = {
    playerId: 'p1',
    nickname: '法师一号',
    score: 8,
    isChampion: true,
    kills: 4,
    deaths: 1,
    spellsCast: { 1: 2, 4: 1, 8: 3 },
    secretsTaken: 2,
    roundsSurvived: 3,
    roundWonAtHp1: true,
    roundEndSecrets: 2,
    roundKillsNonDragon: 1,
    dragonKills: 3,
    dragonOneCastKills: 3,
    finalHp: 1,
    firstRoundSuicide: false,
    roundSpellCasts: [{ round: 1, spellId: 1 }, { round: 2, spellId: 8 }],
    maxFailsInRound: 2,
    hadFullHpThenDied: true,
    dragonFails: 1,
    suicides: 1,
    castStreaks: { 7: [true, true, false], 8: [true] },
    turnSpellSets: { 0: [5, 6, 7], 1: [8] },
    currentTurnIndex: 2,
    killedHighHpTarget: true,
    singleCastMultiKillNonDragon: 2,
    firstTurnDragon3: true,
    comebackFromBehind: true,
    roundWonNoSecrets: true,
    hadLowThenFullThenDied: true,
    lowHpSeen: true,
    castOwlThisMatch: true,
    ignored: 'not part of v1',
  }
  const result = moduleResult.module.sanitizeMatchReport({
    game: 'abracadawhat',
    roomId: 'ROOM-1',
    rounds: 4,
    players: [player, { ...player, playerId: 'p2', nickname: '法师二号' }],
    ignored: true,
  })

  assert.equal(result.ok, true)
  assert.equal(result.version, 1)
  assert.deepEqual(result.report, {
    game: 'abracadawhat',
    roomId: 'ROOM-1',
    rounds: 4,
    players: [
      { ...player, ignored: undefined },
      { ...player, playerId: 'p2', nickname: '法师二号', ignored: undefined },
    ].map(({ ignored, ...clean }) => clean),
  })
})

test('v1 清洗限制玩家数量、字符串长度、魔法 id 和非负整数', () => {
  assert.ok(moduleResult.module?.sanitizeMatchReport, 'sanitizeMatchReport must be implemented')
  const sanitize = moduleResult.module.sanitizeMatchReport
  const basePlayer = { playerId: 'p1', nickname: '法师', spellsCast: { 1: 1 } }
  const body = (players) => ({ game: 'abracadawhat', roomId: 'R', rounds: 1, players })

  assert.equal(sanitize(body([basePlayer])).ok, false)
  assert.equal(sanitize(body(Array.from({ length: 6 }, (_, i) => ({ ...basePlayer, playerId: `p${i}` })))).ok, false)
  assert.equal(sanitize(body([{ ...basePlayer, playerId: 'p' + 'x'.repeat(64) }, { ...basePlayer, playerId: 'p2' }])).ok, false)
  assert.equal(sanitize(body([{ ...basePlayer, nickname: 'x'.repeat(65) }, { ...basePlayer, playerId: 'p2' }])).ok, false)
  assert.equal(sanitize(body([{ ...basePlayer, spellsCast: { 0: 1 } }, { ...basePlayer, playerId: 'p2' }])).ok, false)
  assert.equal(sanitize(body([{ ...basePlayer, kills: -1 }, { ...basePlayer, playerId: 'p2' }])).ok, false)
})

test('A1 不接受 v2 或其他游戏形状', () => {
  assert.ok(moduleResult.module?.sanitizeMatchReport, 'sanitizeMatchReport must be implemented')
  const sanitize = moduleResult.module.sanitizeMatchReport

  assert.equal(sanitize({ schemaVersion: 2, game: 'abracadawhat', standings: [] }).ok, false)
  assert.equal(sanitize({ schemaVersion: 3, game: 'abracadawhat', players: [{ playerId: 'p1' }, { playerId: 'p2' }] }).ok, false)
  assert.equal(sanitize({ game: 'showhand', players: [{ playerId: 'p1' }, { playerId: 'p2' }] }).ok, false)
})
