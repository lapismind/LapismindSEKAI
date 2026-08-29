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
const { createSessionToken, createIdentityToken, verifyIdentityToken } = await import('@lapismind/lobby-kit')

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
}

console.log('abraca worker auth tests passed')
