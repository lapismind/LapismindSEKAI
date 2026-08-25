import assert from 'node:assert/strict'
import { generatePlayerId, isValidPlayerId, createIdentityToken, verifyIdentityToken } from '../src/player-id.js'

// generatePlayerId
for (let i = 0; i < 50; i++) {
  const id = generatePlayerId()
  assert.match(id, /^p[0-9a-z]{12,20}$/, `格式 p+时间戳36进制+随机，实际: ${id}`)
}

// 唯一性：短时间内生成两个不同
const a = generatePlayerId()
const b = generatePlayerId()
assert.notEqual(a, b, '两次生成不同')

// isValidPlayerId
assert.equal(isValidPlayerId('p12345'), true, 'p 开头即认为合法（宽松校验）')
assert.equal(isValidPlayerId('abc'), false, '不以 p 开头')
assert.equal(isValidPlayerId(''), false)
assert.equal(isValidPlayerId(null), false)

// --- 身份 token：签发 / 验签 / 防篡改 / 过期 ---
{
  const secret = 'test-secret-key-42'
  const pid = 'pabc123'
  const token = await createIdentityToken(pid, secret, 1700000000000)
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'token 格式应为 b64url.b64url')

  const ok = await verifyIdentityToken(token, secret)
  assert.ok(ok, '正确密钥应验签通过')
  assert.equal(ok.playerId, pid, '验签恢复出原 playerId')
  assert.equal(ok.issuedAt, 1700000000000, 'issuedAt 为签发时间戳')

  assert.equal(await verifyIdentityToken(token, 'wrong-secret'), null, '错误密钥验签失败')

  const [payloadB64, sigB64] = token.split('.')
  const tamperedPayload = payloadB64.slice(0, -3) + 'xyz.' + sigB64
  assert.equal(await verifyIdentityToken(tamperedPayload, secret), null, '篡改 payload 验签失败')
  const tamperedSig = payloadB64 + '.' + sigB64.slice(0, -1) + 'A'
  assert.equal(await verifyIdentityToken(tamperedSig, secret), null, '篡改签名验签失败')

  assert.equal(await verifyIdentityToken(token, secret, 1000), null, '超过 maxAge 判过期')
  assert.ok(await verifyIdentityToken(token, secret, Number.MAX_SAFE_INTEGER), '未过期可通过')

  assert.equal(await verifyIdentityToken('', secret), null, '空 token 拒绝')
  assert.equal(await verifyIdentityToken(null, secret), null, 'null 拒绝')
  assert.equal(await verifyIdentityToken('garbage-no-dot', secret), null, '无点号格式拒绝')

  const weird = 'p中文+id/测试'
  const t2 = await createIdentityToken(weird, secret)
  const v2 = await verifyIdentityToken(t2, secret)
  assert.equal(v2.playerId, weird, '特殊字符 playerId 可无损往返')

  const before = Date.now()
  const t3 = await createIdentityToken('pnow', secret)
  const v3 = await verifyIdentityToken(t3, secret)
  assert.ok(v3.issuedAt >= before - 10 && v3.issuedAt <= Date.now() + 10, '默认 issuedAt 为当前时间')
}

console.log('player-id tests passed')

// --- v2 会话 token（统一认证层）：JSON payload / 兼容性 / 过期 ---
{
  const { createSessionToken } = await import('../src/player-id.js')
  const secret = 'session-secret-77'
  const now = Date.now()
  const token = await createSessionToken(
    { playerId: 'ptest1', provider: 'github', issuedAt: now },
    secret,
  )
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, '会话 token 同样是 b64url.b64url 信封')

  // 信封兼容：旧 createIdentityToken 的验签函数能读出 v2 payload 字段
  const ok = await verifyIdentityToken(token, secret)
  assert.ok(ok, 'v2 会话 token 验签通过')
  assert.equal(ok.playerId, 'ptest1')
  assert.equal(ok.provider, 'github')
  assert.equal(ok.issuedAt, now)
  assert.ok(ok.expiresAt > now, 'exp 晚于 iat')

  // guest 会话
  const gToken = await createSessionToken({ playerId: generatePlayerId(), provider: 'guest', issuedAt: now }, secret)
  const gOk = await verifyIdentityToken(gToken, secret)
  assert.equal(gOk.provider, 'guest', 'guest 会话验签通过')

  // 错误密钥拒绝
  assert.equal(await verifyIdentityToken(token, 'wrong'), null)

  // 过期拒绝（exp 已过）
  const expired = await createSessionToken(
    { playerId: 'pold', provider: 'guest', issuedAt: now - 31 * 24 * 3600 * 1000 },
    secret,
  )
  assert.equal(await verifyIdentityToken(expired, secret), null, '过期会话拒绝')

  // 篡改 payload 拒绝
  const [pb64, sig] = token.split('.')
  const tampered = pb64.slice(0, -2) + 'xx.' + sig
  assert.equal(await verifyIdentityToken(tampered, secret), null, '篡改 JSON payload 验签失败')

  // 向后兼容：旧格式 token 在新验签下行为不变
  const legacy = await createIdentityToken('plegacy', secret, 1700000000000)
  const lOk = await verifyIdentityToken(legacy, secret)
  assert.ok(lOk, '旧格式 token 仍可验签')
  assert.equal(lOk.playerId, 'plegacy')
  assert.equal(lOk.provider, undefined, '旧格式无 provider 字段')
  assert.equal(lOk.expiresAt, undefined, '旧格式无 exp 字段')
}

console.log('player-id session-token tests passed')
