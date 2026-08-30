/**
 * 出包魔法师消息协议 —— 信封格式来自 @lapismind/lobby-kit。
 */

export { makeMessage, isServerMessageValid } from '@lapismind/lobby-kit'

export const Msg = {
  // 客户端 → 服务端
  SEND_JOIN: 'join',
  SEND_START_ROUND: 'start_round',
  SEND_REMATCH: 'rematch',
  SEND_CAST: 'cast',
  SEND_END_TURN: 'end_turn',
  SEND_NEXT_ROUND: 'next_round',

  // 服务端 → 客户端
  RCV_ROOM_STATE: 'room_state',
  RCV_YOUR_HAND: 'your_hand',
  RCV_YOUR_SECRETS: 'your_secrets',
  RCV_TURN_TO: 'turn_to',
  RCV_CAST_RESULT: 'cast_result',
  RCV_ROUND_END: 'round_end',
  RCV_GAME_OVER: 'game_over',
  RCV_ACHIEVEMENTS_UNLOCKED: 'achievements_unlocked',
  RCV_PLAYER_JOINED: 'player_joined',
  RCV_ERROR: 'error',
}
