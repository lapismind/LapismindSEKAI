/**
 * worker/index.js
 * Worker 入口 —— 路由分发：
 * - /ws?roomId=... → SoupRoom DO（WebSocket 升级）
 * - /api/...       → PuzzleLib DO（谜题 REST）
 * - 其余           → 静态资源
 */

import { SoupRoom } from './soupRoom'
import { PuzzleLib } from './puzzleLib'
import { verifyIdentityToken } from '@lapismind/lobby-kit'

export { SoupRoom, PuzzleLib }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 统一认证：/ws 握手前验会话 cookie（HttpOnly，跨子域共享）。
    // 有效会话 → 以服务端 playerId 为准（覆盖客户端自报值）；
    // 无有效会话 → 降级接受短期 HMAC token（showhand 同款，为后续强制登录留接口；
    // 当前 turtle-soup 前端尚未带 token，因此 SESSION_SECRET 未配置时保持旧行为）。
    if (url.pathname === '/ws' && env.SESSION_SECRET) {
      const cookie = request.headers.get('cookie') || ''
      const m = cookie.match(/(?:^|;\s*)session=([^;]+)/)
      const identity = m ? await verifyIdentityToken(m[1], env.SESSION_SECRET) : null
      // 会话身份通过请求头注入 DO（RequestInit.url 重写在部分运行时不可靠）：
      // 有效会话 → 覆盖为会话 playerId；无会话（旧 token 路径/未配置）→ 删除该头，回退 URL 参数
      const headers = new Headers(request.headers)
      if (identity) {
        headers.set('x-sekai-session-player-id', identity.playerId)
      } else {
        const token = url.searchParams.get('token')
        const legacy = token ? await verifyIdentityToken(token, env.IDENTITY_SECRET, 24 * 60 * 60 * 1000) : null
        if (!legacy) return new Response('invalid identity', { status: 401 })
        headers.delete('x-sekai-session-player-id')
      }
      request = new Request(request, { headers })
    }

    if (url.pathname.startsWith('/ws')) {
      const roomId = url.searchParams.get('roomId')
      if (!roomId) return new Response('缺少 roomId', { status: 400 })
      const id = env.ROOM.idFromName(roomId)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname.startsWith('/api/')) {
      // 调试：ping 不碰 DO，隔离问题
      if (url.pathname === '/api/ping') {
        return new Response(JSON.stringify({ ok: true, from: 'worker', path: url.pathname }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      const id = env.PUZZLE_LIB.idFromName('global')
      const stub = env.PUZZLE_LIB.get(id)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
