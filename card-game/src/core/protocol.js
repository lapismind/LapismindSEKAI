/**
 * core/protocol.js
 * 前后端消息契约 —— 与 src/worker/ 下的后端实现保持一致。
 *
 * 约定：
 * - 客户端→服务器消息用 SEND_* 前缀；服务器→客户端用 RCV_* 前缀。
 * - WebSocket 消息统一结构：{ type, data }。
 * - 大厅走 REST（见 network/api.js），牌局走 WebSocket。
 */

export const Msg = {
  // ---- 牌局（WebSocket，客户端→服务器） ----
  SEND_READY: 'ready',
  SEND_PLAY_CARD: 'play_card',
  SEND_SKIP_TURN: 'skip_turn',
  SEND_CHAT: 'chat',

  // ---- 牌局（服务器→客户端） ----
  RCV_GAME_STATE: 'game_state',
  RCV_PLAYER_JOINED: 'player_joined',
  RCV_PLAYER_LEFT: 'player_left',
  RCV_CHAT: 'chat',
  RCV_ERROR: 'error',
}

/** 构造一条 WebSocket 消息 */
export function makeMessage(type, data = {}) {
  return { type, data }
}

/**
 * 检查服务器消息是否合规（防御性，防止脏数据进入状态层）。
 */
export function isServerMessageValid(raw) {
  if (!raw || typeof raw !== 'object') return false
  if (typeof raw.type !== 'string') return false
  return raw.data === undefined || (typeof raw.data === 'object' && raw.data !== null)
}
