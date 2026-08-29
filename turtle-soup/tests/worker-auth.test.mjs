/**
 * tests/worker-auth.test.mjs —— 统一认证在 turtle-soup Worker 侧的行为。
 *
 * 覆盖「会话优先」逻辑：
 *   /ws 集群会话验证：有效会话 → 以 x-sekai-session-player-id 请求头注入 DO
 *   （soupRoom 优先读该头，覆盖客户端自报 playerId）；
 *   无有效会话且无旧 token → 401 门禁；未配置 SESSION_SECRET → 原样透传。
 */
import assert from 'node:assert/strict'
import './helpers/workerLoader.mjs'

const { default: worker } = await import('../src/worker/index.js')
const { createSessionToken, createIdentityToken } = await import('@lapismind/lobby-kit')

let forwarded = null
function resetForwarded() {
  forwarded = { fetch: async (req) => { forwarded.last = req; return new Response('forwarded') } }
}
resetForwarded()

const env = {
  SESSION_SECRET: 'test-session-secret',
  IDENTITY_SECRET: 'test-id-secret',
  ROOM: { idFromName: (n) => n, get: () => forwarded },
}

{
  // 有效会话 → 注入身份头转发给 DO（覆盖客户端自报 playerId）
  resetForwarded()
  const sessionToken = await createSessionToken({ playerId: 'psoup-1', provider: 'guest' }, env.SESSION_SECRET)
  const res = await worker.fetch(
    new Request('https://soup.test/ws?roomId=R1&playerId=pspoof', {
      headers: { cookie: 'session=' + sessionToken },
    }),
    env,
  )
  assert.equal(res.status, 200)
  const header = forwarded.last.headers.get('x-sekai-session-player-id')
  assert.equal(header, 'psoup-1', 'DO 收到会话身份头，URL 自报值被覆盖')
}

{
  // 无有效会话且无旧 token → 会话门禁 401
  const res = await worker.fetch(
    new Request('https://soup.test/ws?roomId=R1&playerId=pspoof'),
    env,
  )
  assert.equal(res.status, 401)
}

{
  // 无有效会话 + 有效旧 token（兼容路径）→ 转发且不注入身份头
  resetForwarded()
  const token = await createIdentityToken('plegacy', env.IDENTITY_SECRET)
  const res = await worker.fetch(
    new Request('https://soup.test/ws?roomId=R1&playerId=plegacy&token=' + encodeURIComponent(token)),
    env,
  )
  assert.equal(res.status, 200)
  assert.equal(forwarded.last.headers.get('x-sekai-session-player-id'), null, '无会话时不注入身份头')
}

{
  // 未配置 SESSION_SECRET → 原样透传（开发环境行为）
  resetForwarded()
  const res = await worker.fetch(
    new Request('https://soup.test/ws?roomId=R1&playerId=pdev'),
    { ...env, SESSION_SECRET: undefined },
  )
  assert.equal(res.status, 200)
  assert.equal(new URL(forwarded.last.url).searchParams.get('playerId'), 'pdev')
}

console.log('turtle worker auth tests passed')
