/**
 * network/api.js
 * 大厅 REST 调用 —— 走 Worker 的 /api 路由（转发给 Lobby DO）。
 */

const BASE = ''

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status}`)
  }
  return res.json()
}

export const api = {
  listRooms() {
    return request('/api/rooms')
  },
  createRoom() {
    return request('/api/rooms', { method: 'POST' })
  },
  closeRoom(roomId) {
    return request(`/api/rooms/${roomId}`, { method: 'DELETE' })
  },
}
