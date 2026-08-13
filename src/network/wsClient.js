/**
 * network/wsClient.js
 * WebSocket 客户端 —— 单例，与 UI / 状态层解耦。
 *
 * 约定：
 * - connect(roomId, nickname, playerId) 建立房间连接
 * - 外部只关心 send(type, data) 和 on(type, handler)
 * - 断线自动重连（指数退避）；连接基于房间，换房间前先 disconnect()
 */

import { Msg, makeMessage, isServerMessageValid } from '../core/protocol'

export class WSClient {
  constructor() {
    this.ws = null
    this.ready = false
    this.handlers = new Map()
    this.retryCount = 0
    this.maxRetry = 5
    this.reconnectDelayMs = 500
    this.roomId = null
    this.nickname = null
    this.playerId = null
  }

  get connected() {
    return this.ready
  }

  /** 连接房间 WebSocket。url 不传则默认同源 /ws */
  connect({ roomId, nickname, playerId, url }) {
    this.roomId = roomId
    this.nickname = nickname
    this.playerId = playerId

    const wsUrl =
      url ??
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?roomId=${encodeURIComponent(roomId)}&nickname=${encodeURIComponent(nickname)}&playerId=${encodeURIComponent(playerId)}`

    this.ws = new WebSocket(wsUrl)
    this.ws.onopen = () => {
      this.ready = true
      this.retryCount = 0
      this.reconnectDelayMs = 500
      this._emit('_open', {})
    }
    this.ws.onmessage = (e) => this._handleMessage(e.data)
    this.ws.onclose = () => {
      this.ready = false
      this._emit('_close', {})
      this._scheduleReconnect()
    }
    this.ws.onerror = () => this.ws?.close()
  }

  disconnect() {
    this.roomId = null
    this.retryCount = this.maxRetry // 手动断开不再重连
    this.ready = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /** 发送消息到服务器 */
  send(type, data = {}) {
    if (!this.ready) {
      console.warn('[ws] 连接未就绪，丢弃消息:', type)
      return
    }
    this.ws.send(JSON.stringify(makeMessage(type, data)))
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type).add(handler)
    return () => this.off(type, handler)
  }

  off(type, handler) {
    this.handlers.get(type)?.delete(handler)
  }

  _handleMessage(raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.warn('[ws] 非 JSON 消息:', raw)
      return
    }
    if (!isServerMessageValid(parsed)) {
      console.warn('[ws] 非法消息被丢弃:', parsed)
      return
    }
    this._emit(parsed.type, parsed.data)
  }

  _emit(type, data) {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(data)
    }
  }

  _scheduleReconnect() {
    if (this.retryCount >= this.maxRetry) {
      console.error('[ws] 重连次数达上限，停止重连')
      return
    }
    this.retryCount += 1
    const delay = this.reconnectDelayMs * 2 ** (this.retryCount - 1)
    setTimeout(() => this.connect({
      roomId: this.roomId,
      nickname: this.nickname,
      playerId: this.playerId,
    }), Math.min(delay, 10000))
  }
}

/** 全局单例 */
export const wsClient = new WSClient()
