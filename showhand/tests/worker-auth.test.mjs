/**
 * tests/worker-auth.test.mjs —— 统一认证在 Worker 侧的行为。
 *
 * 覆盖「会话优先」逻辑：
 *   /api/identity：存在有效会话时只给会话 playerId 签发 token（杜绝任意 ID 冒充）；
 *                   无会话/无效会话保持旧的按请求 playerId 签发（机器人/降级路径）。
 *   /ws：token 校验后原样转发；最终身份由 DO 以验签后的 token 为准
 *        （DO 忽略 URL 自报 playerId，杜绝 URL 冒充）。
 */
import assert from 'node:assert/strict'
import './helpers/workerLoader.mjs'

const { default: worker } = await import('../src/worker/index.js')
const {
  createSessionToken,
  createIdentityToken,
  verifyIdentityToken,
} = await import('@lapismind/lobby-kit')

const env = {
  IDENTITY_SECRET: 'test-id-secret',
  SESSION_SECRET: 'test-session-secret',
  ROOM: {
    idFromName: (n) => n,
    get: () => forwarded,
  },
}

// 捕获转发给 DO 的请求
let forwarded = null
function resetForwarded() {
  forwarded = { fetch: async (req) => {
    forwarded.last = req
    return new Response('forwarded')
  } }
}
resetForwarded()

{
  // /api/identity：无会话时按请求的 playerId 签发（老客户端/机器人路径）
  const res = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=pcustom'),
    env,
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.playerId, 'pcustom')
  const identity = await verifyIdentityToken(body.token, env.IDENTITY_SECRET)
  assert.equal(identity.playerId, 'pcustom', 'token 解出目标 playerId')
}

{
  // /api/identity：有效会话时即使用户要求另一个 playerId，也只签会话身份
  const sessionToken = await createSessionToken({ playerId: 'psession-1', provider: 'guest' }, env.SESSION_SECRET)
  const res = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=pspoof', {
      headers: { cookie: 'session=' + sessionToken },
    }),
    env,
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.playerId, 'psession-1', '会话优先：签发会话 playerId，不理会自报值')
}

{
  // /api/identity：无效会话降级为按请求 playerId 签发（不阻塞老路径）
  const res = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=pcustom', {
      headers: { cookie: 'session=garbage-token' },
    }),
    env,
  )
  const body = await res.json()
  assert.equal(body.playerId, 'pcustom', '无效会话走旧行为')
}

{
  // /api/identity：过长的 playerId 一律不签发（Auth 侧存不下，也无法回读）
  const longPlayerId = 'p' + 'x'.repeat(64)
  const free = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=' + longPlayerId),
    env,
  )
  assert.equal(free.status, 400, '降级路径不签发不合法 playerId')

  const sessionToken = await createSessionToken({ playerId: longPlayerId, provider: 'guest' }, env.SESSION_SECRET)
  const viaSession = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=pfallback', {
      headers: { cookie: 'session=' + sessionToken },
    }),
    env,
  )
  assert.equal(viaSession.status, 400, '会话身份不合法时同样拒签')
}

{
  // /api/identity：不以 p 开头的 playerId 不签发
  const res = await worker.fetch(
    new Request('https://showhand.test/api/identity?playerId=no-prefix'),
    env,
  )
  assert.equal(res.status, 400)
}

{
  // /ws：超长 roomId 直接拒绝，不转发进 DO
  resetForwarded()
  const token = await createIdentityToken('pclient-1', env.IDENTITY_SECRET)
  const res = await worker.fetch(
    new Request('https://showhand.test/ws?roomId=' + 'R'.repeat(65) + '&playerId=pclient-1&token=' + encodeURIComponent(token)),
    env,
  )
  assert.equal(res.status, 400)
  assert.equal(forwarded.last, undefined, '非法 roomId 不应转发给 DO')
}

{
  // /ws：有效 token 原样转发（URL 身份不改写，最终由 DO 验签 token 定身份）
  resetForwarded()
  const token = await createIdentityToken('pclient-1', env.IDENTITY_SECRET)
  const res = await worker.fetch(
    new Request('https://showhand.test/ws?roomId=XYZ789&playerId=pclient-1&token=' + encodeURIComponent(token)),
    env,
  )
  assert.equal(res.status, 200)
  const doUrl = new URL(forwarded.last.url)
  assert.equal(doUrl.searchParams.get('playerId'), 'pclient-1', 'URL 保持原值，身份交给 DO 判定')
}

{
  // /ws：无效 token → 401 拒升级
  const res = await worker.fetch(
    new Request('https://showhand.test/ws?roomId=XYZ789&playerId=pclient-1&token=garbage'),
    env,
  )
  assert.equal(res.status, 401)
}



// ---------- DO 层：身份以验签后的 token 为准（URL 自报 playerId 无效） ----------

const { ShowhandRoom } = await import('../src/worker/showhandRoom.js')

class FakeStorage {
  constructor() { this.map = new Map() }
  async get(k) { return this.map.get(k) ?? undefined }
  async put(k, v) { this.map.set(k, structuredClone(v)) }
}

function makeRoomCtx(name = 'room-1') {
  const sockets = []
  return {
    name,
    storage: new FakeStorage(),
    getWebSockets: () => sockets,
    acceptWebSocket: (ws) => sockets.push(ws),
    waitUntil: (p) => p,
  }
}

function fakeServerSocket() {
  return {
    sent: [],
    att: null,
    send(d) { this.sent.push(JSON.parse(d)) },
    close() {},
    serializeAttachment(v) { this.att = v },
    deserializeAttachment() { return this.att },
  }
}

// Node 的 undici Response 不允许 101（且不认 webSocket 扩展），
// 这里用最小 shim 覆盖 DO 升级路径的 Response 构造
class ShimResponse {
  constructor(body, init = {}) {
    this.status = init.status ?? 200
    this.webSocket = init.webSocket
  }
}

async function doUpgradeWithToken(playerIdInToken, urlPlayerId, token, nickname = 'n') {
  const serverWs = fakeServerSocket()
  globalThis.WebSocketPair = class {
    constructor() { return { 0: { close() {} }, 1: serverWs } }
  }
  const RealResponse = globalThis.Response
  globalThis.Response = ShimResponse
  try {
    const room = new ShowhandRoom(makeRoomCtx(), { IDENTITY_SECRET: env.IDENTITY_SECRET })
    const res = await room.fetch(
      new Request(
        'https://showhand.test/ws?roomId=R1&playerId=' + urlPlayerId +
          '&nickname=' + encodeURIComponent(nickname) + '&avatarId=1&token=' + encodeURIComponent(token),
        { headers: { upgrade: 'websocket' } },
      ),
    )
    const state = await room.getState()
    return { res, state }
  } finally {
    globalThis.Response = RealResponse
    delete globalThis.WebSocketPair
  }
}


{
  // 会话优先签发的 token：即使用户在 URL 自报另一个 playerId，DO 也以 token 身份入房
  const token = await createIdentityToken('psession-3', env.IDENTITY_SECRET)
  const { res, state } = await doUpgradeWithToken('psession-3', 'pspoof', token)
  assert.equal(res.status, 101)
  assert.equal(state.players[0]?.id, 'psession-3', 'DO 以验签后的 token 身份为准，URL 自报值被忽略')
}

{
  // 无效/缺失 token → DO 拒绝连接
  const bad = await doUpgradeWithToken('x', 'px', 'garbage')
  assert.equal(bad.res.status, 401)
  const none = await doUpgradeWithToken('x', 'px', '')
  assert.equal(none.res.status, 401, '未配置会话时缺少 token 直接拒绝')
}

{
  // 验签通过但格式不合法的 playerId → DO 拒绝（不以 p 开头 / 超长）
  const noPrefix = await createIdentityToken('evil', env.IDENTITY_SECRET)
  const badPrefix = await doUpgradeWithToken('evil', 'pfallback', noPrefix)
  assert.equal(badPrefix.res.status, 400, '不以 p 开头的 playerId 应被拒绝')
  assert.equal(badPrefix.state.players.length, 0, '非法身份不应产生玩家记录')

  const longId = 'p' + 'x'.repeat(64)
  const longToken = await createIdentityToken(longId, env.IDENTITY_SECRET)
  const tooLong = await doUpgradeWithToken(longId, 'pfallback', longToken)
  assert.equal(tooLong.res.status, 400, '超长 playerId 应被拒绝')
  assert.equal(tooLong.state.players.length, 0)
}

{
  // 昵称规范化：超长截断到 64 字，空白回退为「玩家」
  const token = await createIdentityToken('pnick', env.IDENTITY_SECRET)
  const long = await doUpgradeWithToken('pnick', 'pnick', token, 'x'.repeat(100))
  assert.equal(long.res.status, 101)
  assert.equal(long.state.players[0].nickname.length, 64, '超长昵称应被截断')

  const token2 = await createIdentityToken('pblank', env.IDENTITY_SECRET)
  const blank = await doUpgradeWithToken('pblank', 'pblank', token2, '   ')
  assert.equal(blank.res.status, 101)
  assert.equal(blank.state.players[0].nickname, '玩家', '空白昵称应回退为默认值')
}

console.log('worker auth tests passed')
