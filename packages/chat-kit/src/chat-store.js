/**
 * chat-kit/chat-store.js —— 聊天状态管理（Pinia store）。
 *
 * 管理聊天消息列表、表情包状态、连接状态等。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createChatClient, ChatMsg } from './chat-client'

export const useChatStore = defineStore('chat', () => {
  const messages = ref([])
  const isConnected = ref(false)
  const chatClient = ref(null)
  const currentRoomId = ref(null)

  // 最近消息（用于显示最新几条）
  const recentMessages = computed(() => {
    return messages.value.slice(-50) // 保留最近50条消息
  })

  // 连接到房间聊天
  function connect(roomId, playerId, nickname, avatarId) {
    if (chatClient.value) {
      chatClient.value.disconnect()
    }

    chatClient.value = createChatClient({
      roomId,
      playerId,
      nickname,
      avatarId,
    })

    currentRoomId.value = roomId
    isConnected.value = true

    // 监听聊天消息
    chatClient.value.onChat((data) => {
      messages.value.push({
        type: 'chat',
        playerId: data.playerId,
        nickname: data.nickname,
        avatarId: data.avatarId,
        text: data.text,
        timestamp: Date.now(),
      })
    })

    // 监听表情包消息
    chatClient.value.onEmoji((data) => {
      messages.value.push({
        type: 'emoji',
        playerId: data.playerId,
        nickname: data.nickname,
        avatarId: data.avatarId,
        emojiId: data.emojiId,
        characterId: data.characterId,
        timestamp: Date.now(),
      })
    })
  }

  // 断开连接
  function disconnect() {
    if (chatClient.value) {
      chatClient.value.disconnect()
      chatClient.value = null
    }
    isConnected.value = false
    currentRoomId.value = null
  }

  // 发送文本消息
  function sendChat(text) {
    if (chatClient.value && text.trim()) {
      chatClient.value.sendChat(text.trim())
    }
  }

  // 发送表情包
  function sendEmoji(folder, emojiId) {
    if (chatClient.value) {
      chatClient.value.sendEmoji(folder, emojiId)
    }
  }

  // 清空消息
  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    isConnected,
    currentRoomId,
    recentMessages,
    connect,
    disconnect,
    sendChat,
    sendEmoji,
    clearMessages,
  }
})


