/**
 * src/worker/niigoRoom.js —— 每个房间一个 Durable Object 实例
 *
 * 回合制派对游戏（复刻星引擎 + 小游戏层）。
 * 本文件目前只是骨架：连接管理 + 广播，**玩法规格见 docs/specs/**。
 *
 * Hibernation 要点（沿用本仓库既有教训，别重踩）：
 * - 连接级状态用 socket.serializeAttachment() 持久化，**不要用内存 Map**
 *   （DO 休眠会清内存 → 本地测试通过、线上必炸）
 * - 遍历连接用 this.ctx.getWebSockets()
 * - 房间状态用 this.ctx.storage（SQLite）
 */

const MAX_PLAYERS = 4

export class NiigoRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = ctx.name
    // 串行化：DO 是单线程，但 await 之间会交错，用队列保证回合处理不重入
    this.queue = Promise.resolve()
  }

  enqueue(task) {
    this.queue = this.queue.then(task, task)
    return this.queue
  }

  async fetch(req) {
    if ((req.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return this.enqueue(() => this.handleUpgrade(req))
    }
    return new Response('Not found', { status: 404 })
  }

  /** 房间状态。目前只有连接；玩法规格定了再往里加。 */
  async getState() {
    return (
      (await this.ctx.storage.get('state')) ?? {
        phase: 'waiting', // waiting | playing | settled
        round: 0,
        players: [], // { id, nickname, avatarId, seat, connected }
      }
    )
  }

  async handleUpgrade(req) {
    const url = new URL(req.url)
    const playerId = (url.searchParams.get('playerId') || 'anon').slice(0, 64)
    const nickname = (url.searchParams.get('nickname') || '玩家').slice(0, 64)
    const avatarId = (url.searchParams.get('avatarId') || '0').slice(0, 8)

    const state = await this.getState()
    if (state.players.filter((p) => p.connected).length >= MAX_PLAYERS) {
      return new Response('房间已满', { status: 409 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Hibernation API：连接期间不计时长
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId, nickname, avatarId })

    await this.enqueue(async () => {
      const s = await this.getState()
      const existing = s.players.find((p) => p.id === playerId)
      if (existing) {
        existing.connected = true
        existing.nickname = nickname
        existing.avatarId = avatarId
      } else {
        s.players.push({
          id: playerId,
          nickname,
          avatarId,
          seat: s.players.length,
          connected: true,
        })
      }
      await this.ctx.storage.put('state', s)
      this.broadcast(s)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws, raw) {
    let msg
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      return // 非法消息直接丢，不触发任何逻辑
    }
    // TODO: 玩法规格定了以后在这里分发 { type, data }
    // 目前只处理心跳，方便联调确认链路通
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: msg.t, serverTs: Date.now() }))
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment() || {}
    await this.enqueue(async () => {
      const s = await this.getState()
      const p = s.players.find((x) => x.id === att.playerId)
      if (p) p.connected = false
      await this.ctx.storage.put('state', s)
      this.broadcast(s)
    })
    try {
      ws.close()
    } catch {
      /* 已断开，忽略 */
    }
  }

  async webSocketError(ws) {
    try {
      ws.close()
    } catch {
      /* 忽略 */
    }
  }

  broadcast(state) {
    const payload = JSON.stringify({
      type: 'room_state',
      data: { roomId: this.roomId, ...state, maxPlayers: MAX_PLAYERS },
    })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload)
      } catch {
        /* 死连接，忽略 */
      }
    }
  }
}
