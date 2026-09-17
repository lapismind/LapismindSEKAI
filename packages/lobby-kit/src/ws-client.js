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
 *   ws.retry()        // 重试耗尽后手动重连
 *   ws.disconnect()
 *
 * ── 连接状态（`status` getter / `_status` 事件）────────────────
 * 这是本模块最容易做错的地方：**放弃重连必须是一个明确的状态，不能是"什么都不做"**。
 * 之前 scheduleReconnect 在重试耗尽时直接 return，于是客户端永远停在"连接中…"，
 * 而桌面上还显示着最后一个画面——玩家以为只是别人慢，实际这一局已经废了。
 *
 *   idle          未连接，或已主动 disconnect
 *   connecting    首次连接中
 *   open          已连接
 *   reconnecting  断线后正在重试（带 attempt / nextDelayMs）
 *   offline       重试耗尽，已放弃（带 attempt / maxRetry）→ UI 必须提示，并给手动重连入口
 *
 * `_close`    连接关闭（每一次）
 * `_send_failed` 消息因未连接/发送异常而未能发出（带 type）——调用方应告知玩家，
 *                否则玩家点了按钮却什么都没发生，只会以为游戏卡了
 */

const STATUS_IDLE = 'idle'
const STATUS_CONNECTING = 'connecting'
const STATUS_OPEN = 'open'
const STATUS_RECONNECTING = 'reconnecting'
const STATUS_OFFLINE = 'offline'

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
  let status = STATUS_IDLE
  let reconnectTimer = null
  // 代次：retry()/disconnect() 会让旧的延迟重连失效，避免"手动重连"与"排期中的重连"叠加
  let generation = 0

  function emit(type, data) {
    for (const handler of handlers.get(type) ?? []) {
      handler(data)
    }
  }

  function setStatus(next, extra = {}) {
    status = next
    emit('_status', { status: next, attempt: retryCount, maxRetry, ...extra })
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

  function connect({ roomId, nickname, playerId, avatarId, token, url }) {
    // url 也要存进 session：否则重连时会退回到按 location 拼 URL，
    // 自定义地址（测试夹具 / 跨域调试）在第一次断线后就被丢掉
    session = { roomId, nickname, playerId, avatarId, token, url }
    const wsUrl =
      url ??
      `${typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws'}://${
        typeof location !== 'undefined' ? location.host : 'localhost'
      }/ws?roomId=${encodeURIComponent(roomId)}&nickname=${encodeURIComponent(
        nickname,
      )}&playerId=${encodeURIComponent(playerId)}${
        avatarId ? `&avatarId=${encodeURIComponent(avatarId)}` : ''
      }${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`

    setStatus(retryCount > 0 ? STATUS_RECONNECTING : STATUS_CONNECTING)

    try {
      ws = new wsImpl(wsUrl)
    } catch {
      // 构造失败（url 非法等）也要走重连流程，不能把异常抛给调用方
      ws = null
      ready = false
      scheduleReconnect()
      return
    }
    ws.onopen = () => {
      ready = true
      retryCount = 0
      baseDelay = reconnectDelayMs
      setStatus(STATUS_OPEN)
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
    // session 为空 = 调用方主动 disconnect，不应重连
    if (!session) {
      setStatus(STATUS_IDLE)
      return
    }
    if (reconnectTimer) return // 已有排期，不叠加

    if (retryCount >= maxRetry) {
      // 重试耗尽：必须是明确状态。UI 见 offline 要提示并给手动重连入口
      setStatus(STATUS_OFFLINE, { attempt: retryCount })
      return
    }

    retryCount += 1
    const delay = Math.min(baseDelay * 2 ** (retryCount - 1), 10000)
    setStatus(STATUS_RECONNECTING, { attempt: retryCount, nextDelayMs: delay })

    const gen = generation
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (gen !== generation) return // 已被 retry() / disconnect() 取代
      if (!session) return
      connect({ ...session })
    }, delay)
  }

  /** 重试耗尽（offline）或任何时刻手动重连；没有会话可恢复时返回 false */
  function retry() {
    if (!session) return false
    generation += 1
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    retryCount = 0
    baseDelay = reconnectDelayMs
    connect({ ...session })
    return true
  }

  function disconnect() {
    session = null
    generation += 1
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    retryCount = 0
    ready = false
    if (ws) {
      ws.close()
      ws = null
    }
    setStatus(STATUS_IDLE)
  }

  function send(type, data = {}) {
    if (!ready || !ws) {
      console.warn('[ws] 连接未就绪，消息未发出:', type)
      // 不能静默丢弃：调用方要能告诉玩家"这一步没发出去"
      emit('_send_failed', { type, status })
      return false
    }
    try {
      ws.send(JSON.stringify(makeMessage(type, data)))
      return true
    } catch {
      emit('_send_failed', { type, status })
      return false
    }
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
    get status() {
      return status
    },
    /** 当前已重试次数（offline/reconnecting 时用于显示"第 N 次"） */
    get retryCount() {
      return retryCount
    },
    get maxRetry() {
      return maxRetry
    },
    connect,
    disconnect,
    retry,
    send,
    on,
    off,
    // 测试辅助
    _emit: emit,
  }
}

export const WS_STATUS = {
  IDLE: STATUS_IDLE,
  CONNECTING: STATUS_CONNECTING,
  OPEN: STATUS_OPEN,
  RECONNECTING: STATUS_RECONNECTING,
  OFFLINE: STATUS_OFFLINE,
}
