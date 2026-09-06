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

test('v1 清洗使用适合单场比赛的字段和集合上限', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const basePlayer = { playerId: 'p1', nickname: '法师', spellsCast: { 1: 1 } }
  const pair = (first) => [first, { ...basePlayer, playerId: 'p2' }]
  const body = (players, overrides = {}) => ({ game: 'abracadawhat', roomId: 'R', rounds: 1, players, ...overrides })

  assert.equal(sanitize(body(pair(basePlayer), { roomId: 'R'.repeat(65) })).ok, false, 'roomId 最多 64 字符')
  assert.equal(sanitize(body(pair(basePlayer), { rounds: 101 })).ok, false, '单场轮数有独立上限')
  assert.equal(sanitize(body(pair({ ...basePlayer, finalHp: 7 }))).ok, false, '最终生命不能超过规则上限')
  assert.equal(sanitize(body(pair({ ...basePlayer, score: 1501 }))).ok, false, '分数上限覆盖 100 轮双人局理论最大值')
  assert.equal(sanitize(body(pair({ ...basePlayer, dragonOneCastKills: 5 }))).ok, false, '单次击杀不超过其余玩家数')
  assert.equal(sanitize(body(pair({ ...basePlayer, roundSpellCasts: Array.from({ length: 4097 }, () => ({ round: 1, spellId: 1 })) }))).ok, false, '事件数组有保守上限')
  assert.equal(sanitize(body(pair({ ...basePlayer, castStreaks: { 1: Array(4096).fill(true), 2: [true] } }))).ok, false, '跨魔法连续施法记录有总量上限')
  assert.equal(sanitize(body(pair({ ...basePlayer, turnSpellSets: { 0: Array(37).fill(1) } }))).ok, false, '单回合施法集合有保守上限')
  assert.equal(sanitize(body(pair({ ...basePlayer, spellsCast: { 1: 4096, 2: 1 } }))).ok, false, '魔法次数聚合不能绕过总量上限')

  const maximumValid = sanitize(body(pair({
    ...basePlayer,
    score: 1500,
    finalHp: 6,
    roundsSurvived: 100,
    roundEndSecrets: 12,
    kills: 400,
    deaths: 100,
  }), { roomId: 'R'.repeat(64), rounds: 100 }))
  assert.equal(maximumValid.ok, true, '规则允许的边界值保持兼容')
})

test('v1 清洗限制整份报告的遥测集合总量', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const events = Array.from({ length: 3000 }, () => ({ round: 1, spellId: 1 }))
  const streak = Array(3000).fill(true)
  const turns = Object.fromEntries(Array.from({ length: 100 }, (_, turn) => [turn, Array(36).fill(1)]))
  const player = (playerId) => ({
    playerId,
    nickname: '法师',
    spellsCast: { 1: 3000 },
    roundSpellCasts: events,
    castStreaks: { 1: streak },
    turnSpellSets: turns,
  })

  assert.equal(sanitize({
    game: 'abracadawhat',
    roomId: 'R',
    rounds: 100,
    players: [player('p1'), player('p2')],
  }).ok, false, '各集合单独合法时仍限制整份报告总元素数')
})

test('v1 清洗拒绝重复 playerId', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const player = { playerId: 'p-duplicate', nickname: '法师', spellsCast: {} }

  assert.equal(sanitize({ game: 'abracadawhat', roomId: 'R', rounds: 1, players: [player, { ...player }] }).ok, false)
})

test('v1 魔法对象只接受规范键 1 到 8', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const basePlayer = { playerId: 'p1', nickname: '法师' }
  const body = (field, value) => ({
    game: 'abracadawhat',
    roomId: 'R',
    rounds: 1,
    players: [{ ...basePlayer, [field]: value }, { ...basePlayer, playerId: 'p2' }],
  })

  for (const alias of ['01', '+1', '1.0']) {
    assert.equal(sanitize(body('spellsCast', { [alias]: 1 })).ok, false, `spellsCast 拒绝 ${alias}`)
    assert.equal(sanitize(body('castStreaks', { [alias]: [true] })).ok, false, `castStreaks 拒绝 ${alias}`)
  }
})

test('A1 不接受 v2 或其他游戏形状', () => {
  assert.ok(moduleResult.module?.sanitizeMatchReport, 'sanitizeMatchReport must be implemented')
  const sanitize = moduleResult.module.sanitizeMatchReport

  assert.equal(sanitize({ schemaVersion: 2, game: 'abracadawhat', standings: [] }).ok, false)
  assert.equal(sanitize({ schemaVersion: 3, game: 'abracadawhat', players: [{ playerId: 'p1' }, { playerId: 'p2' }] }).ok, false)
  assert.equal(sanitize({ game: 'showhand', players: [{ playerId: 'p1' }, { playerId: 'p2' }] }).ok, false)
})

function validV2Report() {
  return {
    schemaVersion: 2,
    reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
    game: 'abracadawhat',
    roomId: 'ROOM-2',
    startedAt: '2026-09-07T00:00:00.000Z',
    finishedAt: '2026-09-07T00:20:00.000Z',
    rounds: 3,
    standings: [
      {
        playerId: 'p1',
        nickname: '法师一号',
        rank: 1,
        score: 8,
        scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 },
        spellCounts: { 1: 2, 8: 1 },
        kills: 2,
        dragonKills: 1,
        deaths: 1,
        suicides: 0,
        roundWins: 2,
        roundWinsByReason: { kill: 1, all_spells: 1 },
        maxTurnCastCount: 4,
        maxTurnDistinctSpells: 3,
      },
      {
        playerId: 'p2',
        nickname: '法师二号',
        rank: 2,
        score: 3,
        scoreBySource: { roundWinPoints: 3, survivalPoints: 0, secretPoints: 0 },
        spellCounts: { 2: 1 },
        kills: 0,
        dragonKills: 0,
        deaths: 2,
        suicides: 1,
        roundWins: 1,
        roundWinsByReason: { kill: 1, all_spells: 0 },
        maxTurnCastCount: 1,
        maxTurnDistinctSpells: 1,
      },
    ],
    facts: [],
    stories: [],
  }
}

test('v2 清洗接受规范字段和当前空事实与故事结构', () => {
  const result = moduleResult.module.sanitizeMatchReport(validV2Report())

  assert.equal(result.ok, true)
  assert.equal(result.version, 2)
  assert.deepEqual(result.report, validV2Report())
})

test('v2 清洗拒绝未知 key、无效 tier、越界值和非规范对象键', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const mutate = (change) => {
    const body = validV2Report()
    change(body)
    return sanitize(body)
  }

  assert.equal(mutate((body) => { body.unknown = true }).ok, false, '顶层未知 key')
  assert.equal(mutate((body) => { body.standings[0].unknown = true }).ok, false, '排名项未知 key')
  assert.equal(mutate((body) => { body.standings[0].scoreBySource.bonus = 1 }).ok, false, '得分来源未知 key')
  assert.equal(mutate((body) => { body.standings[0].spellCounts = { '01': 1 } }).ok, false, '魔法键必须规范')
  assert.equal(mutate((body) => { body.facts = [{ key: 'not_a_fact', playerId: 'p1', data: {} }] }).ok, false, '未知 fact key')
  assert.equal(mutate((body) => { body.stories = [{ key: 'comeback_win', playerId: 'p1', tier: 'Z', data: {} }] }).ok, false, '无效 story tier')
  assert.equal(mutate((body) => { body.rounds = 101 }).ok, false, '轮数越界')
  assert.equal(mutate((body) => { body.standings[0].score = 1501 }).ok, false, '分数越界')
  assert.equal(mutate((body) => { body.standings[0].maxTurnDistinctSpells = 9 }).ok, false, '不同魔法数越界')
  assert.equal(mutate((body) => { body.facts = Array.from({ length: 101 }, () => ({})) }).ok, false, '事实数组越界')
  assert.equal(mutate((body) => { body.stories = Array.from({ length: 4 }, () => ({})) }).ok, false, '故事数组越界')
})

test('v2 清洗拒绝重复 playerId、重复/缺失 rank 和 dragonKills 大于 kills', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const mutate = (change) => {
    const body = validV2Report()
    change(body)
    return sanitize(body)
  }

  assert.equal(mutate((body) => { body.standings[1].playerId = 'p1' }).ok, false)
  assert.equal(mutate((body) => { body.standings[1].rank = 1 }).ok, false)
  assert.equal(mutate((body) => { body.standings[1].rank = 3 }).ok, false)
  assert.equal(mutate((body) => { body.standings[0].dragonKills = 3 }).ok, false)
})

test('v2 清洗要求完整规范键、稳定 reportId 和有效时间顺序', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const mutate = (change) => {
    const body = validV2Report()
    change(body)
    return sanitize(body)
  }

  assert.equal(mutate((body) => { delete body.facts }).ok, false)
  assert.equal(mutate((body) => { delete body.standings[0].roundWins }).ok, false)
  assert.equal(mutate((body) => { delete body.standings[0].scoreBySource.secretPoints }).ok, false)
  assert.equal(mutate((body) => { body.reportId = 'abracadawhat:not-a-uuid' }).ok, false)
  assert.equal(mutate((body) => { body.startedAt = '2026-09-07' }).ok, false)
  assert.equal(mutate((body) => { body.finishedAt = '2026-09-06T23:59:59.999Z' }).ok, false)
})

test('v2 清洗限制结构化 fact/story data 的规范键和值域', () => {
  const sanitize = moduleResult.module.sanitizeMatchReport
  const fact = (data) => [{ key: 'low_hp_kill', playerId: 'p1', data }]
  const story = (data) => [{ key: 'low_hp_kill', playerId: 'p1', tier: 'A', data }]
  const mutate = (change) => {
    const body = validV2Report()
    change(body)
    return sanitize(body)
  }

  assert.equal(mutate((body) => { body.facts = fact({ unknown: 1 }) }).ok, false)
  assert.equal(mutate((body) => { body.facts = fact({ spellId: 9 }) }).ok, false)
  assert.equal(mutate((body) => { body.facts = fact({ actorHp: 7 }) }).ok, false)
  assert.equal(mutate((body) => { body.facts = fact({ targetPlayerId: 'p3' }) }).ok, false)
  assert.equal(mutate((body) => { body.facts = fact({ reason: 'arbitrary' }) }).ok, false)
  assert.equal(mutate((body) => { body.stories = story({ spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' }) }).ok, true)
})
