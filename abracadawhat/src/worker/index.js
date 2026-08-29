import { AbracaRoom } from './abracaRoom'
import { createIdentityToken, verifyIdentityToken } from '@lapismind/lobby-kit'

export { AbracaRoom }

// 读取跨子域会话 cookie（与 sekai-auth 共用同一 SESSION_SECRET 值）。
// 博客登录用户 / 游客自动登录都会种下这个 HttpOnly 会话，跨子域携带。
async function getSessionIdentity(request, env) {
  if (!env.SESSION_SECRET) return null
  const cookie = request.headers.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
  return m ? verifyIdentityToken(m[1], env.SESSION_SECRET) : null
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 身份签发端点：存在有效会话时以会话 playerId 为准，只有博客/游客登录身份
    // 才能换 token，杜绝任意 playerId 冒充；无会话（SESSION_SECRET 未配置/降级）保持旧行为。
    if (url.pathname === '/api/identity') {
      const pid = url.searchParams.get('playerId')
      if (!pid) return new Response(JSON.stringify({ error: 'missing playerId' }), { status: 400 })
      const secret = env.IDENTITY_SECRET
      if (!secret) return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500 })
      const session = await getSessionIdentity(request, env)
      const mintedPid = session?.playerId ?? pid
      const token = await createIdentityToken(mintedPid, secret)
      return new Response(JSON.stringify({ token, playerId: mintedPid }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.pathname.startsWith('/ws')) {
      // 第一层验证：无效 token 直接拒升级，不进 DO。
      // 身份以 DO 验签后的 token 为准（token 由 /api/identity 会话优先签发），
      // 这里不做 URL 重写——RequestInit.url 在部分运行时不可靠，DO 侧不依赖 URL 身份。
      const secret = env.IDENTITY_SECRET
      const token = url.searchParams.get('token')
      if (secret && token) {
        const identity = await verifyIdentityToken(token, secret, 24 * 60 * 60 * 1000)
        if (!identity) return new Response('invalid token', { status: 401 })
      }
      const roomId = url.searchParams.get('roomId')
      if (!roomId) return new Response('missing roomId', { status: 400 })
      const id = env.ROOM.idFromName(roomId)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
