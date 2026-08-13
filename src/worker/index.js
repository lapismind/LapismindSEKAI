/**
 * worker/index.js
 * Worker 入口 —— 路由分发：
 * - /ws?roomId=... → SoupRoom DO（WebSocket 升级）
 * - /api/...       → PuzzleLib DO（谜题 REST）
 * - 其余           → 静态资源
 */

import { SoupRoom } from './soupRoom'
import { PuzzleLib } from './puzzleLib'

export { SoupRoom, PuzzleLib }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/ws')) {
      const roomId = url.searchParams.get('roomId')
      if (!roomId) return new Response('缺少 roomId', { status: 400 })
      const id = env.ROOM.idFromName(roomId)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    if (url.pathname.startsWith('/api/')) {
      const id = env.PUZZLE_LIB.idFromName('global')
      const stub = env.PUZZLE_LIB.get(id)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
