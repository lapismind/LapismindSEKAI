/**
 * tests/worker-auth.test.mjs —— 统一认证在 abracadawhat Worker 侧的行为。
 *
 * 与 showhand 同构（会话优先签发 token + DO 以验签身份为准）：
 *   /api/identity：存在有效会话时只给会话 playerId 签发 token（杜绝任意 ID 冒充）；
 *                   无会话/无效会话保持旧的按请求 playerId 签发（机器人/降级路径）。
 *   /ws：token 校验后原样转发；身份判定交给 DO。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import './helpers/workerLoader.mjs'

const { default: worker } = await import('../src/worker/index.js')
const { AbracaRoom } = await import('../src/worker/abracaRoom.js')
const { createSessionToken, createIdentityToken, verifyIdentityToken } = await import('@lapismind/lobby-kit')
const { hashMatchReport, sanitizeMatchReport } = await import('../../auth/src/matchReports.js')

let forwarded = null
function resetForwarded() {
  forwarded = { fetch: async (req) => { forwarded.last = req; return new Response('forwarded') } }
}
resetForwarded()

const env = {
  IDENTITY_SECRET: 'test-id-secret',
  SESSION_SECRET: 'test-session-secret',
  ROOM: { idFromName: (n) => n, get: () => forwarded },
}

{
  // /api/identity：无会话按请求 playerId 签发；有效会话只签会话身份
  const free = await worker.fetch(new Request('https://abraca.test/api/identity?playerId=pcustom'), env)
  assert.equal((await free.json()).playerId, 'pcustom')
  const sessionToken = await createSessionToken({ playerId: 'psession-a', provider: 'guest' }, env.SESSION_SECRET)
  const bound = await worker.fetch(
    new Request('https://abraca.test/api/identity?playerId=pspoof', {
      headers: { cookie: 'session=' + sessionToken },
    }),
    env,
  )
  const body = await bound.json()
  assert.equal(body.playerId, 'psession-a', '会话优先：签发会话 playerId，不理会自报值')
  const identity = await verifyIdentityToken(body.token, env.IDENTITY_SECRET)
  assert.equal(identity.playerId, 'psession-a')

  const longPlayerId = 'p' + 'x'.repeat(64)
  const rejectedFree = await worker.fetch(new Request('https://abraca.test/api/identity?playerId=' + longPlayerId), env)
  assert.equal(rejectedFree.status, 400, '降级身份不签发 Auth 无法接收的 playerId')

  const longSessionToken = await createSessionToken({ playerId: longPlayerId, provider: 'guest' }, env.SESSION_SECRET)
  const rejectedSession = await worker.fetch(new Request('https://abraca.test/api/identity?playerId=pfallback', {
    headers: { cookie: 'session=' + longSessionToken },
  }), env)
  assert.equal(rejectedSession.status, 400, '无效会话身份不能回退成请求参数或被截断')
}

{
  // /ws：有效 token 原样转发；无效 token 401
  resetForwarded()
  const token = await createIdentityToken('pclient-a', env.IDENTITY_SECRET)
  const ok = await worker.fetch(
    new Request('https://abraca.test/ws?roomId=R1&playerId=pclient-a&token=' + encodeURIComponent(token)),
    env,
  )
  assert.equal(ok.status, 200)
  assert.equal(new URL(forwarded.last.url).searchParams.get('playerId'), 'pclient-a')
  const bad = await worker.fetch(
    new Request('https://abraca.test/ws?roomId=R1&playerId=pclient-a&token=garbage'),
    env,
  )
  assert.equal(bad.status, 401)

  const longRoom = await worker.fetch(
    new Request('https://abraca.test/ws?roomId=' + 'R'.repeat(65) + '&playerId=pclient-a&token=' + encodeURIComponent(token)),
    env,
  )
  assert.equal(longRoom.status, 400, '房间 ID 最多 64 字符')
}

{
  // 古代巨龙击杀既计入总击杀，也单独计入巨龙击杀子集。
  const state = {
    phase: 'playing',
    round: 1,
    targetScore: 8,
    currentPlayerId: 'caster',
    lastCastLevel: null,
    castSucceeded: {},
    castFailed: {},
    castCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    deck: [],
    secretPile: [],
    summary: null,
    players: [
      { id: 'caster', nickname: '施法者', seat: 0, score: 0, health: 6, hand: [1, 8], secrets: [], alive: true },
      { id: 'p2', nickname: '目标二', seat: 1, score: 0, health: 3, hand: [], secrets: [], alive: true },
      { id: 'p3', nickname: '目标三', seat: 2, score: 0, health: 3, hand: [], secrets: [], alive: true },
      { id: 'p4', nickname: '目标四', seat: 3, score: 0, health: 3, hand: [], secrets: [], alive: true },
    ],
    matchStats: {
      players: Object.fromEntries(['caster', 'p2', 'p3', 'p4'].map((playerId) => [playerId, {
        playerId,
        kills: 0,
        deaths: 0,
        spellsCast: {},
        roundSpellCasts: [],
        castStreaks: {},
        turnSpellSets: {},
        currentTurnIndex: 0,
        dragonKills: 0,
        dragonOneCastKills: 0,
        dragonFails: 0,
        suicides: 0,
        killedHighHpTarget: false,
        singleCastMultiKillNonDragon: 0,
        castOwlThisMatch: false,
        roundWonAtHp1: false,
        roundEndSecrets: 0,
        roundWonNoSecrets: false,
        roundsSurvived: 0,
      }])),
    },
  }
  const ctx = {
    storage: { put: async () => {} },
    getWebSockets: () => [],
  }
  const room = new AbracaRoom(ctx, {})
  const originalRandom = Math.random
  Math.random = () => 0.999
  try {
    await room.doCast(state, 'caster', { spellId: 1 })
  } finally {
    Math.random = originalRandom
  }

  assert.equal(state.matchStats.players.caster.kills, 3)
  assert.equal(state.matchStats.players.caster.dragonKills, 3)
}

{
  const makeState = (spellId, targetHealth) => ({
    phase: 'playing',
    round: 1,
    targetScore: 8,
    currentPlayerId: 'caster',
    lastCastLevel: null,
    castSucceeded: {},
    castFailed: {},
    castCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    deck: [],
    secretPile: [],
    summary: null,
    players: [
      { id: 'caster', nickname: '施法者', seat: 0, score: 0, health: 6, hand: [spellId, 8], secrets: [], alive: true },
      { id: 'target', nickname: '目标', seat: 1, score: 0, health: targetHealth, hand: [], secrets: [], alive: true },
    ],
    matchStats: {
      players: Object.fromEntries(['caster', 'target'].map((playerId) => [playerId, {
        playerId, kills: 0, deaths: 0, spellsCast: {}, roundSpellCasts: [], castStreaks: {},
        turnSpellSets: {}, currentTurnIndex: 0, dragonKills: 0, dragonOneCastKills: 0,
        dragonFails: 0, suicides: 0, killedHighHpTarget: false,
        singleCastMultiKillNonDragon: 0, castOwlThisMatch: false, roundWonAtHp1: false,
        roundEndSecrets: 0, roundWonNoSecrets: false, roundsSurvived: 0,
      }])),
    },
  })
  const ctx = { storage: { put: async () => {} }, getWebSockets: () => [] }

  const ordinary = makeState(7, 1)
  await new AbracaRoom(ctx, {}).doCast(ordinary, 'caster', { spellId: 7 })
  assert.equal(ordinary.matchStats.players.caster.kills, 1)
  assert.equal(ordinary.matchStats.players.caster.dragonKills, 0)

  const dragon = makeState(1, 1)
  await new AbracaRoom(ctx, {}).doCast(dragon, 'caster', { spellId: 1 })
  assert.equal(dragon.matchStats.players.caster.kills, 1)
  assert.equal(dragon.matchStats.players.caster.dragonKills, 1)
}

{
  const longNickname = '法'.repeat(80)
  const players = [
    { id: 'p1', nickname: longNickname, avatarId: '1', score: 8, health: 6 },
    { id: 'p2', nickname: '法师二号', avatarId: '2', score: 3, health: 4 },
  ]
  const stats = Object.fromEntries(players.map((player) => [player.id, {
    playerId: player.id,
    nickname: player.nickname,
    score: player.score,
    isChampion: false,
    kills: 0,
    deaths: 0,
    spellsCast: {},
    secretsTaken: 0,
    roundsSurvived: 1,
    roundWonAtHp1: false,
    roundEndSecrets: 0,
    roundKillsNonDragon: 0,
    dragonKills: 0,
    dragonOneCastKills: 0,
    finalHp: player.health,
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
    scoreBySource: player.id === 'p1'
      ? { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }
      : { roundWinPoints: 3, survivalPoints: 0, secretPoints: 0 },
    roundWins: player.id === 'p1' ? 2 : 1,
    roundWinsByReason: player.id === 'p1' ? { kill: 1, all_spells: 1 } : { kill: 1, all_spells: 0 },
    maxTurnCastCount: 0,
    maxTurnDistinctSpells: 0,
  }]))
  const room = new AbracaRoom({ name: 'ROOM-1' }, {})
  const reportId = 'abracadawhat:123e4567-e89b-42d3-a456-426614174000'
  const report = room.buildMatchReport({ round: 3, players, matchStats: { reportId, factsVersion: 2, startAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:20:00.000Z', players: stats } }, players[0])
  const sanitized = sanitizeMatchReport(report)

  assert.equal(report.schemaVersion, 2)
  assert.equal(report.reportId, reportId)
  assert.equal(report.standings[0].nickname.length, 64, 'sender 归一化展示昵称')
  assert.equal(sanitized.ok, true, '实际 buildMatchReport v2 payload 可由 Auth 接收')
}

{
  // 部署前已持久化并休眠的进行中房间没有 reportId，结束时必须继续发 v1。
  const players = [
    { id: 'p1', nickname: '旧一号', score: 8, health: 4 },
    { id: 'p2', nickname: '旧二号', score: 3, health: 2 },
  ]
  const stats = Object.fromEntries(players.map((player) => [player.id, {
    playerId: player.id, nickname: player.nickname, score: player.score, kills: 0, deaths: 0,
    spellsCast: {}, secretsTaken: 0, roundsSurvived: 1, roundWonAtHp1: false,
    roundEndSecrets: 0, roundKillsNonDragon: 0, dragonKills: 0, dragonOneCastKills: 0,
    finalHp: player.health, firstRoundSuicide: false, roundSpellCasts: [], maxFailsInRound: 0,
    hadFullHpThenDied: false, castStreaks: {}, turnSpellSets: {}, currentTurnIndex: 0,
    dragonFails: 0, suicides: 0, killedHighHpTarget: false, singleCastMultiKillNonDragon: 0,
    firstTurnDragon3: false, comebackFromBehind: false, roundWonNoSecrets: false,
    hadLowThenFullThenDied: false, lowHpSeen: false, castOwlThisMatch: false,
  }]))
  const room = new AbracaRoom({ name: 'OLD-ROOM' }, {})
  const report = room.buildMatchReport({
    round: 3,
    players,
    matchStats: {
      startAt: '2026-01-01T00:00:00.000Z',
      scoreSnapshots: [{ p1: 3, p2: 7 }],
      players: stats,
    },
  }, players[0])

  assert.equal(report.schemaVersion, undefined)
  assert.ok(Array.isArray(report.players))
  assert.equal(report.standings, undefined)
  assert.equal(report.players.find((player) => player.playerId === 'p1').comebackFromBehind, true)
  assert.equal(sanitizeMatchReport(report).version, 1)
}

{
  const players = [
    { id: 'p1', nickname: '一号', avatarId: '1', score: 8, health: 6 },
    { id: 'p2', nickname: '二号', avatarId: '2', score: 3, health: 4 },
  ]
  const stats = Object.fromEntries(players.map((player) => [player.id, {
    playerId: player.id, nickname: player.nickname, score: player.score, spellsCast: {}, kills: 0,
    dragonKills: 0, deaths: 0, suicides: 0,
    scoreBySource: player.id === 'p1'
      ? { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }
      : { roundWinPoints: 3, survivalPoints: 0, secretPoints: 0 },
    roundWins: player.id === 'p1' ? 2 : 1,
    roundWinsByReason: player.id === 'p1' ? { kill: 1, all_spells: 1 } : { kill: 1, all_spells: 0 },
    maxTurnCastCount: 0,
    maxTurnDistinctSpells: 0,
  }]))
  let savedState
  const waits = []
  const ctx = {
    name: 'ROOM-STABLE-FINISH',
    storage: {
      get: async () => savedState,
      put: async (_key, state) => { savedState = structuredClone(state) },
    },
    getWebSockets: () => [],
    waitUntil(promise) { waits.push(promise) },
  }
  const room = new AbracaRoom(ctx, {})
  const state = {
    phase: 'round_end', round: 3, targetScore: 8, players,
    matchStats: { reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000', factsVersion: 2, startAt: '2026-01-01T00:00:00.000Z', players: stats },
    matchHistory: [],
  }

  const originalError = console.error
  const errors = []
  console.error = (...args) => errors.push(args)
  try {
    await room.startNextRound(state)
    await waits[0]
  } finally {
    console.error = originalError
  }
  assert.equal(errors[0]?.[0], 'report match configuration error: MATCH_REPORT_SECRET is missing')
  const first = room.buildMatchReport(savedState, players[0])
  await new Promise((resolve) => setTimeout(resolve, 2))
  const second = room.buildMatchReport(savedState, players[0])

  assert.equal(savedState.matchStats.finishedAt, first.finishedAt)
  assert.equal(first.finishedAt, second.finishedAt)
  assert.equal(await hashMatchReport(sanitizeMatchReport(first).report), await hashMatchReport(sanitizeMatchReport(second).report))
}

{
  let state = {
    hostId: 'p1',
    phase: 'waiting',
    round: 0,
    targetScore: 8,
    players: [
      { id: 'p1', nickname: '一号', avatarId: '1', score: 0, isHost: true },
      { id: 'p2', nickname: '二号', avatarId: '2', score: 0, isHost: false },
    ],
    matchHistory: [],
  }
  const ctx = {
    name: 'ROOM-REPORT-ID',
    storage: {
      put: async (_key, nextState) => { state = nextState },
    },
    getWebSockets: () => [],
  }
  const room = new AbracaRoom(ctx, {})

  await room.hostStart(state, 'p1')
  const firstReportId = state.matchStats.reportId
  assert.match(firstReportId, /^abracadawhat:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(room.buildMatchReport(state, state.players[0]).reportId, firstReportId)
  assert.equal(room.buildMatchReport(state, state.players[0]).reportId, firstReportId, '同一场重复构建保持稳定')

  state.phase = 'game_over'
  await room.hostRematch(state, 'p1')
  assert.notEqual(state.matchStats.reportId, firstReportId, '重赛生成新的 reportId')
}

{
  // A 局上报尚未返回时开始 B 局，A 局成就不得串进 B 局。
  let resolveReport
  const reportResponse = new Promise((resolve) => { resolveReport = resolve })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => reportResponse

  const sent = []
  const socket = {
    send(message) { sent.push(JSON.parse(message)) },
    deserializeAttachment() { return { playerId: 'p1' } },
  }
  let state = {
    hostId: 'p1',
    phase: 'game_over',
    round: 3,
    targetScore: 8,
    players: [
      { id: 'p1', nickname: '一号', avatarId: '1', score: 8, isHost: true },
      { id: 'p2', nickname: '二号', avatarId: '2', score: 3, isHost: false },
    ],
    matchStats: { startAt: '2026-09-07T00:00:00.000Z', players: {} },
    matchHistory: [],
  }
  const ctx = {
    name: 'ROOM-STALE-REPORT',
    storage: {
      get: async () => state,
      put: async (_key, nextState) => { state = nextState },
    },
    getWebSockets: () => [socket],
  }
  const room = new AbracaRoom(ctx, { MATCH_REPORT_SECRET: 'test-secret' })
  const pendingReport = room.reportMatch({ game: 'abracadawhat', players: [] }, state.matchStats.startAt)

  await room.hostRematch(state, 'p1')
  assert.equal(state.phase, 'playing')
  assert.equal(state.round, 1)
  assert.notEqual(state.matchStats.startAt, '2026-09-07T00:00:00.000Z')

  resolveReport(new Response(JSON.stringify({
    newAchievements: [{ playerId: 'p1', key: 'first_cast' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }))
  try {
    await pendingReport
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(
    sent.some(message => message.type === 'achievements_unlocked'),
    false,
    '旧比赛延迟返回的成就不得广播到新比赛',
  )
}

{
  // 同一场 Auth 成功返回时应广播新成就，关闭 A2 追踪的正向测试缺口。
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    newAchievements: [{ playerId: 'p1', key: 'first_cast' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })
  const sent = []
  const socket = {
    send(message) { sent.push(JSON.parse(message)) },
    deserializeAttachment() { return { playerId: 'p1' } },
  }
  const state = {
    phase: 'game_over',
    matchStats: { startAt: '2026-09-07T01:00:00.000Z' },
  }
  const room = new AbracaRoom({
    storage: { get: async () => state },
    getWebSockets: () => [socket],
  }, { MATCH_REPORT_SECRET: 'test-secret' })
  try {
    await room.reportMatch({ game: 'abracadawhat', players: [] }, state.matchStats.startAt)
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(sent.filter((message) => message.type === 'achievements_unlocked').length, 1)
}

function makeFinishedV2State(reportId = 'abracadawhat:123e4567-e89b-42d3-a456-426614174000') {
  const players = [
    { id: 'p1', nickname: '一号', avatarId: '1', score: 8, health: 1, isHost: true },
    { id: 'p2', nickname: '二号', avatarId: '2', score: 7, health: 3, isHost: false },
  ]
  return {
    hostId: 'p1', phase: 'round_end', round: 3, targetScore: 8, players, matchHistory: [],
    matchStats: {
      reportId,
      factsVersion: 2,
      startAt: '2026-09-07T02:00:00.000Z',
      facts: [{
        key: 'low_hp_kill', playerId: 'p1',
        data: { round: 3, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' },
      }],
      players: Object.fromEntries(players.map((player) => [player.id, {
        playerId: player.id,
        nickname: player.nickname,
        spellsCast: {}, kills: 0, dragonKills: 0, deaths: 0, suicides: 0,
        scoreBySource: player.id === 'p1'
          ? { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }
          : { roundWinPoints: 6, survivalPoints: 1, secretPoints: 0 },
        roundWins: 2,
        roundWinsByReason: { kill: 1, all_spells: 1 },
        maxTurnCastCount: 4,
        maxTurnDistinctSpells: 3,
      }])),
    },
  }
}

function makeReportRoom({ state, env = { MATCH_REPORT_SECRET: 'test-secret' } }) {
  const sent = []
  const waits = []
  const socket = { send: message => sent.push(JSON.parse(message)) }
  const ctx = {
    name: 'ROOM-B4',
    storage: {
      get: async () => state,
      put: async (_key, nextState) => { state = nextState },
    },
    getWebSockets: () => [socket],
    waitUntil(promise) { waits.push(promise) },
  }
  const room = new AbracaRoom(ctx, env)
  return { room, sent, waits }
}

async function withFetch(fetchImpl, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('game_over broadcasts reportId, standings, stories and saving before Auth resolves', async () => {
  const pending = deferredResponse()
  const state = makeFinishedV2State()
  const harness = makeReportRoom({ state })

  await withFetch(() => pending.promise, async () => {
    await harness.room.startNextRound(state)
    assert.equal(harness.waits.length, 1)
    assert.deepEqual(harness.sent[0], {
      type: 'game_over',
      data: {
        reportId: state.matchStats.reportId,
        winnerId: 'p1',
        rounds: 3,
        standings: [
          {
            id: 'p1', playerId: 'p1', nickname: '一号', avatarId: '1', rank: 1, score: 8,
            scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 },
            spellCounts: {}, kills: 0, dragonKills: 0, deaths: 0, suicides: 0,
            roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 },
            maxTurnCastCount: 4, maxTurnDistinctSpells: 3,
          },
          {
            id: 'p2', playerId: 'p2', nickname: '二号', avatarId: '2', rank: 2, score: 7,
            scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 0 },
            spellCounts: {}, kills: 0, dragonKills: 0, deaths: 0, suicides: 0,
            roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 },
            maxTurnCastCount: 4, maxTurnDistinctSpells: 3,
          },
        ],
        stories: [{
          key: 'low_hp_kill', playerId: 'p1', tier: 'A',
          data: { round: 3, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' },
        }],
        reportStatus: 'saving',
      },
    })
    assert.equal(harness.sent.length, 1, 'Auth 尚未返回时只应有立即 game_over')
    pending.resolve(new Response(JSON.stringify({
      ok: true,
      matchId: 41,
      reportId: state.matchStats.reportId,
      savedReports: [],
      newAchievements: [],
    }), { status: 200 }))
    await harness.waits[0]
  })
})

function deferredResponse() {
  let resolve
  const promise = new Promise(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

test('reportMatch 200 broadcasts report-scoped achievements and saved true even with empty savedReports', async () => {
  const state = makeFinishedV2State()
  state.phase = 'game_over'
  const harness = makeReportRoom({ state })
  await withFetch(async () => new Response(JSON.stringify({
    ok: true,
    matchId: 42,
    reportId: state.matchStats.reportId,
    savedReports: [],
    newAchievements: [
      { playerId: 'p1', key: 'spell_ladder' },
      null,
      'invalid',
      [],
    ],
  }), { status: 200 }), async () => {
    await harness.room.reportMatch({ reportId: state.matchStats.reportId })
  })

  assert.deepEqual(harness.sent, [
    { type: 'achievements_unlocked', data: { reportId: state.matchStats.reportId, achievements: [{ playerId: 'p1', key: 'spell_ladder' }] } },
    { type: 'match_report_status', data: { reportId: state.matchStats.reportId, saved: true } },
  ])
})

test('reportMatch accepts a valid v2 response with string matchId', async () => {
  const state = makeFinishedV2State()
  state.phase = 'game_over'
  const harness = makeReportRoom({ state })
  await withFetch(async () => new Response(JSON.stringify({
    ok: true,
    matchId: 'match-42',
    reportId: state.matchStats.reportId,
    savedReports: [],
    newAchievements: [],
  }), { status: 200 }), async () => {
    await harness.room.reportMatch({ reportId: state.matchStats.reportId })
  })

  assert.deepEqual(harness.sent, [
    { type: 'achievements_unlocked', data: { reportId: state.matchStats.reportId, achievements: [] } },
    { type: 'match_report_status', data: { reportId: state.matchStats.reportId, saved: true } },
  ])
})

test('missing MATCH_REPORT_SECRET fails current v2 report without fetching and leaves legacy v1 silent', async () => {
  const state = makeFinishedV2State()
  state.phase = 'game_over'
  const harness = makeReportRoom({ state, env: {} })
  const originalFetch = globalThis.fetch
  const originalError = console.error
  let fetchCalls = 0
  const errors = []
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch') }
  console.error = (...args) => errors.push(args)
  try {
    await harness.room.reportMatch({ reportId: state.matchStats.reportId })
    assert.deepEqual(harness.sent, [{
      type: 'match_report_status',
      data: { reportId: state.matchStats.reportId, saved: false, message: '战报暂未保存' },
    }])
    assert.equal(errors.length, 1)
    assert.equal(errors[0][0], 'report match configuration error: MATCH_REPORT_SECRET is missing')

    harness.sent.length = 0
    errors.length = 0
    await harness.room.reportMatch({ game: 'abracadawhat', players: [] }, state.matchStats.startAt)
    assert.deepEqual(harness.sent, [])
    assert.deepEqual(errors, [])
    assert.equal(fetchCalls, 0)
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalError
  }
})

for (const malformed of [
  { name: 'empty object', body: {} },
  { name: 'null', body: null },
  {
    name: 'ok false',
    body: { ok: false, matchId: 43, reportId: 'CURRENT', savedReports: [], newAchievements: [] },
  },
  {
    name: 'truthy non-boolean ok',
    body: { ok: 1, matchId: 43, reportId: 'CURRENT', savedReports: [], newAchievements: [] },
  },
  {
    name: 'mismatched reportId',
    body: { ok: true, matchId: 44, reportId: 'abracadawhat:wrong', savedReports: [], newAchievements: [] },
  },
  {
    name: 'missing matchId',
    body: { ok: true, reportId: 'CURRENT', savedReports: [], newAchievements: [] },
  },
  {
    name: 'non-array savedReports',
    body: { ok: true, matchId: 45, reportId: 'CURRENT', savedReports: null, newAchievements: [] },
  },
  {
    name: 'non-array newAchievements',
    body: { ok: true, matchId: 'match-46', reportId: 'CURRENT', savedReports: [], newAchievements: {} },
  },
]) {
  test(`reportMatch rejects malformed 2xx contract: ${malformed.name}`, async () => {
    const state = makeFinishedV2State()
    state.phase = 'game_over'
    const body = structuredClone(malformed.body)
    if (body?.reportId === 'CURRENT') body.reportId = state.matchStats.reportId
    const harness = makeReportRoom({ state })
    const originalError = console.error
    const errors = []
    console.error = (...args) => errors.push(args)
    try {
      await withFetch(async () => new Response(JSON.stringify(body), { status: 200 }), async () => {
        await harness.room.reportMatch({ reportId: state.matchStats.reportId })
      })
    } finally {
      console.error = originalError
    }

    assert.equal(errors.length, 1)
    assert.equal(errors[0][0], 'report match failed:')
    assert.deepEqual(harness.sent, [{
      type: 'match_report_status',
      data: { reportId: state.matchStats.reportId, saved: false, message: '战报暂未保存' },
    }])
  })
}

for (const failure of [
  { name: 'HTTP 500', fetchImpl: async () => new Response('server failed', { status: 500 }) },
  { name: 'invalid JSON', fetchImpl: async () => new Response('{', { status: 200 }) },
  { name: 'network error', fetchImpl: async () => { throw new Error('offline') } },
]) {
  test(`reportMatch ${failure.name} logs and broadcasts report-scoped saved false without rejecting`, async () => {
    const state = makeFinishedV2State()
    state.phase = 'game_over'
    const harness = makeReportRoom({ state })
    const originalError = console.error
    const errors = []
    console.error = (...args) => errors.push(args)
    try {
      await withFetch(failure.fetchImpl, async () => {
        await assert.doesNotReject(() => harness.room.reportMatch({ reportId: state.matchStats.reportId }))
      })
    } finally {
      console.error = originalError
    }

    assert.equal(errors.length, 1)
    assert.equal(errors[0][0], 'report match failed:')
    assert.deepEqual(harness.sent, [{
      type: 'match_report_status',
      data: { reportId: state.matchStats.reportId, saved: false, message: '战报暂未保存' },
    }])
  })
}

test('report A completion does not broadcast after report B becomes current', async () => {
  const reportA = 'abracadawhat:123e4567-e89b-42d3-a456-426614174000'
  const reportB = 'abracadawhat:223e4567-e89b-42d3-a456-426614174000'
  const state = makeFinishedV2State(reportA)
  state.phase = 'game_over'
  const pending = deferredResponse()
  const harness = makeReportRoom({ state })

  await withFetch(() => pending.promise, async () => {
    const reporting = harness.room.reportMatch({ reportId: reportA })
    state.matchStats.reportId = reportB
    pending.resolve(new Response(JSON.stringify({
      ok: true, matchId: 46, reportId: reportA,
      savedReports: [], newAchievements: [{ playerId: 'p1', key: 'spell_ladder' }],
    }), { status: 200 }))
    await reporting
  })

  assert.deepEqual(harness.sent, [])
})

test('report A failure does not broadcast saved false after report B becomes current', async () => {
  const reportA = 'abracadawhat:123e4567-e89b-42d3-a456-426614174000'
  const reportB = 'abracadawhat:223e4567-e89b-42d3-a456-426614174000'
  const state = makeFinishedV2State(reportA)
  state.phase = 'game_over'
  const pending = deferredResponse()
  const harness = makeReportRoom({ state })
  const originalError = console.error
  console.error = () => {}
  try {
    await withFetch(() => pending.promise, async () => {
      const reporting = harness.room.reportMatch({ reportId: reportA })
      state.matchStats.reportId = reportB
      pending.resolve(new Response('server failed', { status: 500 }))
      await reporting
    })
  } finally {
    console.error = originalError
  }

  assert.deepEqual(harness.sent, [])
})

console.log('abraca worker auth tests passed')
