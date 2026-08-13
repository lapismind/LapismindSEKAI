/**
 * src/worker/index.js
 * Worker 入口 —— 路由分发：
 *
 * - 静态资源（前端 dist/）由 assets 绑定自动托管（见 wrangler.toml）
 * - /ws 开头 → WebSocket 升级请求，路由到对应 GameRoom DO
 * - /api/rooms → 大厅 REST，路由到 Lobby DO（单例）
 *
 * 注意：assets 模式下本 Worker 只处理非静态文件的请求。
 */

import { GameRoom } from './gameRoom'
import { Lobby } from './lobby'

export { GameRoom, Lobby }

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // 房间 WebSocket 升级：/ws?roomId=XXXXXX&nickname=xxx&playerId=xxx
    if (url.pathname.startsWith('/ws')) {
      const roomId = url.searchParams.get('roomId')
      if (!roomId) {
        return new Response('缺少 roomId', { status: 400 })
      }
      const id = env.GAME_ROOM.idFromName(roomId)
      const stub = env.GAME_ROOM.get(id)
      return stub.fetch(request)
    }

    // 大厅 REST：转发给 Lobby DO
    if (url.pathname.startsWith('/api/')) {
      const id = env.LOBBY.idFromName('global')
      const stub = env.LOBBY.get(id)
      return stub.fetch(request)
    }

    // 其他请求交给静态资源（若 assets 未命中会返回 404，由平台处理）
    return env.ASSETS.fetch(request)
  },
}
