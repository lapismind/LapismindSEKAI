import { ShowhandRoom } from './showhandRoom'
import { createIdentityToken, verifyIdentityToken } from '@lapismind/lobby-kit'

export { ShowhandRoom }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 身份签发端点：客户端用 playerId 换短期 HMAC token
    if (url.pathname === '/api/identity') {
      const pid = url.searchParams.get('playerId')
      if (!pid) return new Response(JSON.stringify({ error: 'missing playerId' }), { status: 400 })
      const secret = env.IDENTITY_SECRET
      if (!secret) return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500 })
      const token = await createIdentityToken(pid, secret)
      return new Response(JSON.stringify({ token }), { headers: { 'content-type': 'application/json' } })
    }

    if (url.pathname.startsWith('/ws')) {
      // 第一层验证：无效 token 直接拒升级，不进 DO
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
