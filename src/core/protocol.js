/**
 * 梭哈消息协议 —— 游戏侧定义具体消息类型。
 * 信封格式（makeMessage/isServerMessageValid）来自 @lapismind/lobby-kit。
 */

export { makeMessage, isServerMessageValid } from '@lapismind/lobby-kit'

export const Msg = {
  // 客户端 → 服务端
  SEND_JOIN: 'join',
  SEND_SET_HOST_CONFIG: 'set_host_config',
  SEND_START_GAME: 'start_game',
  SEND_BET: 'bet',
  SEND_SPECTATE: 'spectate',

  // 服务端 → 客户端
  RCV_ROOM_STATE: 'room_state',
  RCV_YOUR_HAND: 'your_hand',
  RCV_TURN_TO: 'turn_to',
  RCV_BET_RESULT: 'bet_result',
  RCV_SHOWDOWN: 'showdown',
  RCV_GAME_OVER: 'game_over',
  RCV_PLAYER_JOINED: 'player_joined',
  RCV_PLAYER_LEFT: 'player_left',
  RCV_SPECTATE_STATE: 'spectate_state',
  RCV_ERROR: 'error',
}
