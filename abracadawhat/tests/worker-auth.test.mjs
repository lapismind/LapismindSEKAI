/**
 * tests/worker-auth.test.mjs —— 统一认证在 abracadawhat Worker 侧的行为。
 *
 * 与 showhand 同构（会话优先签发 token + DO 以验签身份为准）：
 *   /api/identity：存在有效会话时只给会话 playerId 签发 token（杜绝任意 ID 冒充）；
 *                   无会话/无效会话保持旧的按请求 playerId 签发（机器人/降级路径）。
 *   /ws：token 校验后原样转发；身份判定交给 DO。
 */
import assert from 'node:assert/strict'
import './helpers/workerLoader.mjs'

const { default: worker } = await import('../src/worker/index.js')
const { AbracaRoom } = await import('../src/worker/abracaRoom.js')
const { createSessionToken, createIdentityToken, verifyIdentityToken } = await import('@lapismind/lobby-kit')
const { sanitizeMatchReport } = await import('../../auth/src/matchReports.js')

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
  }]))
  const room = new AbracaRoom({ name: 'ROOM-1' }, {})
  const reportId = 'abracadawhat:123e4567-e89b-42d3-a456-426614174000'
  const report = room.buildMatchReport({ round: 3, players, matchStats: { reportId, startAt: '2026-01-01T00:00:00.000Z', players: stats } }, players[0])
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

console.log('abraca worker auth tests passed')
