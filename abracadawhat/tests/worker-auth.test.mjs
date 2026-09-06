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
  const report = room.buildMatchReport({ round: 3, players, matchStats: { players: stats } }, players[0])
  const sanitized = sanitizeMatchReport(report)

  assert.equal(report.players[0].nickname.length, 64, 'sender 归一化展示昵称')
  assert.equal(sanitized.ok, true, '实际 buildMatchReport v1 payload 可由 Auth 接收')
}

console.log('abraca worker auth tests passed')
