/**
 * network/wsClient.js
 * WebSocket 客户端 —— 单例，与 UI / 状态层解耦。
 * 基于 card-game 版本，去掉 Mock，断线自动重连。
 */

import { makeMessage, isServerMessageValid } from '../core/protocol'

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
    this.avatarId = '0'
  }

  get connected() {
    return this.ready
  }

  connect({ roomId, nickname, playerId, avatarId = '0', url }) {
    this.roomId = roomId
    this.nickname = nickname
    this.playerId = playerId
    this.avatarId = avatarId
    const wsUrl =
      url ??
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?roomId=${encodeURIComponent(roomId)}&nickname=${encodeURIComponent(nickname)}&playerId=${encodeURIComponent(playerId)}&avatarId=${encodeURIComponent(avatarId)}`

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
    this.retryCount = this.maxRetry
    this.ready = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

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
      return
    }
    if (!isServerMessageValid(parsed)) return
    this._emit(parsed.type, parsed.data)
  }

  _emit(type, data) {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(data)
    }
  }

  _scheduleReconnect() {
    if (this.retryCount >= this.maxRetry) return
    this.retryCount += 1
    const delay = this.reconnectDelayMs * 2 ** (this.retryCount - 1)
    setTimeout(
      () => this.connect({ roomId: this.roomId, nickname: this.nickname, playerId: this.playerId, avatarId: this.avatarId }),
      Math.min(delay, 10000),
    )
  }
}

export const wsClient = new WSClient()
