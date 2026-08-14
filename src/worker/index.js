import { ShowhandRoom } from './showhandRoom'

export { ShowhandRoom }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/ws')) {
      const roomId = url.searchParams.get('roomId')
      if (!roomId) return new Response('missing roomId', { status: 400 })
      const id = env.ROOM.idFromName(roomId)
      const stub = env.ROOM.get(id)
      return stub.fetch(request)
    }

    return env.ASSETS.fetch(request)
  },
}
