/**
 * playerId 生成 —— p + 时间戳(36进制) + 随机后缀，会话内唯一。
 */

export function generatePlayerId() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `p${ts}${rand}`
}

export function isValidPlayerId(id) {
  return typeof id === 'string' && id.startsWith('p') && id.length > 1
}

/**
 * 身份 token —— 服务端 HMAC-SHA256 签发，格式：base64url(playerId).base64url(sig)。
 * 客户端拿到后存 sessionStorage（关浏览器即失效），
 * 重连时带同一 token，服务端验签恢复身份。
 */

function b64urlEncode(bytes) {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * 异步版本——用 Web Crypto（浏览器 / Workers 均可用）。
 * verifyIdentityToken(token, secret) → { playerId } | null
 */
export async function createIdentityToken(playerId, secret, timestamp = Date.now()) {
  const payload = `${playerId}.${timestamp}`
  const payloadB64 = b64urlEncode(new TextEncoder().encode(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payloadB64}.${b64urlEncode(new Uint8Array(sig))}`
}

export async function verifyIdentityToken(token, secret, maxAgeMs = Infinity) {
  if (!token || typeof token !== 'string') return null
  const dotIdx = token.indexOf('.')
  if (dotIdx <= 0 || dotIdx === token.length - 1) return null

  const decodeB64url = (s) => {
    const padded = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4)
    const raw = atob(padded)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
  }

  let payloadBytes, sigBytes
  try {
    payloadBytes = decodeB64url(token.slice(0, dotIdx))
    sigBytes = decodeB64url(token.slice(dotIdx + 1))
  } catch { return null }

  const payloadStr = new TextDecoder().decode(payloadBytes)
  const lastDot = payloadStr.lastIndexOf('.')
  if (lastDot <= 0) return null
  const playerId = payloadStr.slice(0, lastDot)
  const ts = Number(payloadStr.slice(lastDot + 1))
  if (!Number.isFinite(ts)) return null

  // 验签
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)
  if (!ok) return null

  if (maxAgeMs !== Infinity && Date.now() - ts > maxAgeMs) return null
  return { playerId, issuedAt: ts }
}
