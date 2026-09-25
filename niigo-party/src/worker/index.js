/**
 * src/worker/index.js —— Worker 入口
 *
 * 路由：
 *   /ws    → 房间 Durable Object（每房一个实例）
 *   /api/* → 预留（身份签发 / 健康检查）
 *   其余   → 静态资源（Vite 构建产物）
 *
 * DO 类必须从 main 模块导出，所以这里 re-export。
 */

export { NiigoRoom } from './niigoRoom.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      // 房间码：6 位大写字母数字（lobby-kit 的 generateRoomCode 同规格）
      const roomId = (url.searchParams.get('roomId') || 'default').toUpperCase().slice(0, 8)
      const id = env.ROOM.idFromName(roomId)
      return env.ROOM.get(id).fetch(request)
    }

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, serverTs: Date.now() })
    }

    return env.ASSETS.fetch(request)
  },
}
