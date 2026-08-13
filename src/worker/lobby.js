/**
 * src/worker/lobby.js
 * Lobby —— 全局单例 Durable Object，管理活跃房间列表。
 *
 * 通过 idFromName('global') 保证只有一个实例。
 * 房间创建/关闭时由 index.js 调用，数据持久化到 storage。
 */

export class Lobby {
  constructor(ctx) {
    this.ctx = ctx
  }

  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    if (req.method === 'GET' && path === '/api/rooms') {
      return this.listRooms()
    }

    if (req.method === 'POST' && path === '/api/rooms') {
      return this.createRoom()
    }

    if (req.method === 'DELETE' && path.startsWith('/api/rooms/')) {
      const roomId = path.split('/').pop()
      return this.closeRoom(roomId)
    }

    return new Response('Not found', { status: 404 })
  }

  async listRooms() {
    const rooms = await this.ctx.storage.get('rooms')
    return new Response(JSON.stringify({ rooms: rooms ?? [] }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  /** 创建房间：生成 6 位房间码，写入列表 */
  async createRoom() {
    const roomId = this.generateRoomId()
    const rooms = (await this.ctx.storage.get('rooms')) ?? []
    const room = {
      id: roomId,
      playerCount: 0,
      createdAt: Date.now(),
    }
    rooms.push(room)
    await this.ctx.storage.put('rooms', rooms)

    return new Response(JSON.stringify({ roomId }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  /** 关闭房间：从列表移除（简单版本，未做超时回收） */
  async closeRoom(roomId) {
    const rooms = (await this.ctx.storage.get('rooms')) ?? []
    const filtered = rooms.filter((r) => r.id !== roomId)
    await this.ctx.storage.put('rooms', filtered)
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆字符
    let id = ''
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
  }
}
