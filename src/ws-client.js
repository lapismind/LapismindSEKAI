/**
 * WebSocket 客户端 —— 纯逻辑，不依赖浏览器全局。
 *
 * 依赖注入（为了可单测 + 协议解耦）：
 *   createWSClient({ wsImpl, makeMessage, isServerMessageValid, reconnectDelayMs, maxRetry })
 *     wsImpl: WebSocket 构造函数（浏览器默认，测试可换 Fake）
 *     makeMessage / isServerMessageValid: 协议信封，由各游戏注入
 *
 * 用法：
 *   const ws = createWSClient({ makeMessage, isServerMessageValid })
 *   ws.connect({ roomId, nickname, playerId, url? })
 *   ws.send('chat', { text })
 *   const off = ws.on('room_state', (data) => {})
 *   ws.disconnect()
 */

export function createWSClient({
  wsImpl = globalThis.WebSocket,
  makeMessage,
  isServerMessageValid,
  reconnectDelayMs = 500,
  maxRetry = 5,
} = {}) {
  if (!makeMessage || typeof makeMessage !== 'function') {
    throw new Error('createWSClient: makeMessage 必填')
  }
  if (!isServerMessageValid || typeof isServerMessageValid !== 'function') {
    throw new Error('createWSClient: isServerMessageValid 必填')
  }

  let ws = null
  let ready = false
  const handlers = new Map()
  let retryCount = 0
  let baseDelay = reconnectDelayMs
  let session = null

  function emit(type, data) {
    for (const handler of handlers.get(type) ?? []) {
      handler(data)
    }
  }

  function handleMessage(raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!isServerMessageValid(parsed)) return
    emit(parsed.type, parsed.data)
  }

  function connect({ roomId, nickname, playerId, avatarId, url }) {
    session = { roomId, nickname, playerId, avatarId }
    const wsUrl =
      url ??
      `${typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws'}://${
        typeof location !== 'undefined' ? location.host : 'localhost'
      }/ws?roomId=${encodeURIComponent(roomId)}&nickname=${encodeURIComponent(
        nickname,
      )}&playerId=${encodeURIComponent(playerId)}${
        avatarId ? `&avatarId=${encodeURIComponent(avatarId)}` : ''
      }`

    ws = new wsImpl(wsUrl)
    ws.onopen = () => {
      ready = true
      retryCount = 0
      baseDelay = reconnectDelayMs
      emit('_open', {})
    }
    ws.onmessage = (e) => handleMessage(e.data)
    ws.onclose = () => {
      ready = false
      emit('_close', {})
      scheduleReconnect()
    }
    ws.onerror = () => ws?.close()
  }

  function scheduleReconnect() {
    if (retryCount >= maxRetry) return
    retryCount += 1
    const delay = Math.min(baseDelay * 2 ** (retryCount - 1), 10000)
    setTimeout(() => {
      if (!session) return
      connect({ ...session })
    }, delay)
  }

  function disconnect() {
    session = null
    retryCount = maxRetry
    ready = false
    if (ws) {
      ws.close()
      ws = null
    }
  }

  function send(type, data = {}) {
    if (!ready) {
      console.warn('[ws] 连接未就绪，丢弃消息:', type)
      return
    }
    ws.send(JSON.stringify(makeMessage(type, data)))
  }

  function on(type, handler) {
    if (!handlers.has(type)) {
      handlers.set(type, new Set())
    }
    handlers.get(type).add(handler)
    return () => off(type, handler)
  }

  function off(type, handler) {
    handlers.get(type)?.delete(handler)
  }

  return {
    get connected() {
      return ready
    },
    connect,
    disconnect,
    send,
    on,
    off,
    // 测试辅助
    _emit: emit,
  }
}
