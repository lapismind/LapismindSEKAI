<template>
  <div class="chat-panel">
    <div class="chat-header">
      <h3>聊天室</h3>
      <span v-if="!isConnected" class="connection-status disconnected">未连接</span>
      <span v-else class="connection-status connected">已连接</span>
    </div>
    
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="(msg, index) in recentMessages" 
        :key="index" 
        class="chat-message"
        :class="{ 'emoji-message': msg.type === 'emoji' }"
      >
        <div class="message-avatar">
          <img :src="getAvatarUrl(msg.avatarId)" :alt="msg.nickname" />
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="nickname">{{ msg.nickname }}</span>
            <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="message-body">
            <template v-if="msg.type === 'chat'">
              {{ msg.text }}
            </template>
            <template v-else-if="msg.type === 'emoji'">
              <img 
                :src="getEmojiUrl(msg.emojiId, msg.characterId)" 
                class="emoji-image"
                :alt="'Emoji ' + msg.emojiId"
              />
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <div class="chat-input">
      <input 
        v-model="inputText"
        @keyup.enter="sendMessage"
        placeholder="输入消息..."
        :disabled="!isConnected"
      />
      <button 
        @click="sendMessage"
        :disabled="!isConnected || !inputText.trim()"
      >
        发送
      </button>
      <button 
        @click="showEmojiPicker = !showEmojiPicker"
        :disabled="!isConnected"
        class="emoji-button"
      >
        😊
      </button>
    </div>
    
    <EmojiPicker 
      v-if="showEmojiPicker"
      @select="handleEmojiSelect"
      @close="showEmojiPicker = false"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../chat-store'
import EmojiPicker from './EmojiPicker.vue'

const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  playerId: {
    type: String,
    required: true
  },
  nickname: {
    type: String,
    required: true
  },
  avatarId: {
    type: String,
    default: '1'
  }
})

const chatStore = useChatStore()
const inputText = ref('')
const showEmojiPicker = ref(false)
const messagesContainer = ref(null)

// 从 store 获取状态
const { recentMessages, isConnected } = chatStore

// 连接到房间
onMounted(() => {
  chatStore.connect(props.roomId, props.playerId, props.nickname, props.avatarId)
})

// 断开连接
onUnmounted(() => {
  chatStore.disconnect()
})

// 发送文本消息
const sendMessage = () => {
  if (inputText.value.trim()) {
    chatStore.sendChat(inputText.value)
    inputText.value = ''
  }
}

// 处理表情选择
const handleEmojiSelect = (folder, emojiId) => {
  chatStore.sendEmoji(folder, emojiId)
  showEmojiPicker.value = false
}

// 获取头像URL
const getAvatarUrl = (avatarId) => {
  return `/avatars/${avatarId}.png`
}

// 获取表情URL
const getEmojiUrl = (folder, emojiId) => {
  return `/chat-kit/emojis/${folder}/${emojiId}.png`
}

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 自动滚动到底部
watch(
  () => recentMessages.value.length,
  async () => {
    await nextTick()
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
)
</script>

<style scoped>
.chat-panel {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 12px;
  max-width: 400px;
  background: #f9f9f9;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ddd;
}

.connection-status {
  font-size: 12px;
}

.connection-status.connected {
  color: green;
}

.connection-status.disconnected {
  color: red;
}

.chat-messages {
  height: 300px;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.chat-message {
  display: flex;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 8px;
  background: #f0f0f0;
}

.chat-message.emoji-message {
  background: #e8f4fd;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 8px;
  flex-shrink: 0;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.nickname {
  font-weight: bold;
  color: #333;
}

.timestamp {
  font-size: 12px;
  color: #888;
}

.message-body {
  word-wrap: break-word;
}

.emoji-image {
  max-width: 100px;
  max-height: 100px;
}

.chat-input {
  display: flex;
  gap: 8px;
}

.chat-input input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.chat-input button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
}

.chat-input button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.chat-input button.emoji-button {
  background: #28a745;
}
</style>




