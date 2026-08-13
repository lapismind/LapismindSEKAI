/**
 * core/protocol.js
 * 前后端消息契约 —— 与 src/worker/ 后端实现保持一致。
 */

export const Msg = {
  // ---- 房间内（WebSocket，客户端→服务器） ----
  SEND_SET_HOST_CONFIG: 'set_host_config',
  SEND_APPLY_MODERATOR: 'apply_moderator',
  SEND_SELECT_PUZZLE: 'select_puzzle',
  SEND_START_GAME: 'start_game',
  SEND_ASK_QUESTION: 'ask_question',
  SEND_MODERATOR_JUDGE: 'moderator_judge',
  SEND_GUESS_ANSWER: 'guess_answer',
  SEND_REVEAL: 'reveal',
  SEND_REVIEW_NOTE: 'review_note',
  SEND_AI_HINT: 'ai_hint',
  SEND_ADD_PUZZLE: 'add_puzzle',
  SEND_CHAT: 'chat',

  // ---- 服务器→客户端 ----
  RCV_GAME_STATE: 'game_state',
  RCV_PLAYER_JOINED: 'player_joined',
  RCV_PLAYER_LEFT: 'player_left',
  RCV_MODERATOR_CHANGED: 'moderator_changed',
  RCV_MODERATOR_QUESTION: 'moderator_question',
  RCV_GUESS_PROPOSED: 'guess_proposed',
  RCV_CHAT: 'chat',
  RCV_ERROR: 'error',
}

export function makeMessage(type, data = {}) {
  return { type, data }
}

export function isServerMessageValid(raw) {
  if (!raw || typeof raw !== 'object') return false
  if (typeof raw.type !== 'string') return false
  return raw.data === undefined || (typeof raw.data === 'object' && raw.data !== null)
}
