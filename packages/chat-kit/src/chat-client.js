/**
 * chat-kit/chat-client.js —— 聊天 WebSocket 客户端。
 *
 * 复用 lobby-kit 的 WebSocket 连接，在同一连接上收发聊天消息。
 * 消息格式遵循 lobby-kit 协议信封。
 */

import { createWSClient } from '@lapismind/lobby-kit'

// 聊天消息类型
export const ChatMsg = {
  // 客户端 → 服务端
  SEND_CHAT: 'chat',
  SEND_EMOJI: 'emoji',

  // 服务端 → 客户端
  RCV_CHAT: 'chat',
  RCV_EMOJI: 'emoji',
}

/**
 * 创建聊天客户端
 * @param {Object} options
 * @param {string} options.roomId - 房间ID
 * @param {string} options.playerId - 玩家ID
 * @param {string} options.nickname - 玩家昵称
 * @param {string} options.avatarId - 玩家头像ID
 * @returns {Object} 聊天客户端实例
 */
export function createChatClient(options) {
  const { roomId, playerId, nickname, avatarId } = options

  // 创建 WebSocket 客户端
  const wsClient = createWSClient({
    makeMessage: (type, data) => ({ type, data }),
    isServerMessageValid: (msg) => msg && typeof msg.type === 'string',
  })

  // 连接到房间
  wsClient.connect({ roomId, nickname, playerId, avatarId })

  return {
    // 发送文本消息
    sendChat(text) {
      wsClient.send(ChatMsg.SEND_CHAT, { text, playerId, nickname, avatarId })
    },

    // 发送表情包
    sendEmoji(folder, emojiId) {
      wsClient.send(ChatMsg.SEND_EMOJI, { folder, emojiId, playerId, nickname, avatarId })
    },

    // 监听聊天消息
    onChat(callback) {
      return wsClient.on(ChatMsg.RCV_CHAT, callback)
    },

    // 监听表情包消息
    onEmoji(callback) {
      return wsClient.on(ChatMsg.RCV_EMOJI, callback)
    },

    // 断开连接
    disconnect() {
      wsClient.disconnect()
    },

    // 获取底层 WebSocket 客户端
    getWsClient() {
      return wsClient
    },
  }
}
