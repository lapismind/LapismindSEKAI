<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@lapismind/chat-kit'
import { EmojiPicker } from '@lapismind/chat-kit/vue'

const props = defineProps({
  roomId: { type: String, required: true },
  playerId: { type: String, required: true },
  nickname: { type: String, required: true },
  avatarId: { type: String, default: '1' },
})

const chatStore = useChatStore()
const { recentMessages, isConnected } = storeToRefs(chatStore)
const inputText = ref('')
const showEmojiPicker = ref(false)
const messagesContainer = ref(null)

onMounted(() => {
  chatStore.connect(props.roomId, props.playerId, props.nickname, props.avatarId)
})

onUnmounted(() => {
  chatStore.disconnect()
})

const sendMessage = () => {
  if (inputText.value.trim()) {
    chatStore.sendChat(inputText.value)
    inputText.value = ''
  }
}

const handleEmojiSelect = (folder, emojiId) => {
  chatStore.sendEmoji(folder, emojiId)
  showEmojiPicker.value = false
}

const getAvatarUrl = (avatarId) => `/avatars/${avatarId}.png`
const getEmojiUrl = (folder, emojiId) => `/chat-kit/emojis/${folder}/${emojiId}.png`

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

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

<template>
  <div class="flex h-full flex-col bg-[#f9f9f9]">
    <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
      <h3 class="text-sm font-bold text-[#333]">聊天室</h3>
      <span class="text-xs" :class="isConnected ? 'text-green-600' : 'text-red-500'">
        {{ isConnected ? '● 已连接' : '● 未连接' }}
      </span>
    </div>

    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-2">
      <div v-if="recentMessages.length === 0" class="flex h-full items-center justify-center">
        <p class="text-xs text-gray-400">暂无消息，发一条吧~</p>
      </div>
      <div
        v-for="(msg, index) in recentMessages"
        :key="index"
        class="mb-2 flex gap-2 rounded-lg p-2"
        :class="msg.type === 'emoji' ? 'bg-blue-50' : 'bg-gray-100'"
      >
        <img :src="getAvatarUrl(msg.avatarId)" :alt="msg.nickname" class="h-8 w-8 shrink-0 rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="mb-0.5 flex items-baseline justify-between">
            <span class="text-xs font-bold text-[#333]">{{ msg.nickname }}</span>
            <span class="text-[10px] text-gray-400">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="text-sm text-[#444] break-words">
            <template v-if="msg.type === 'chat'">{{ msg.text }}</template>
            <template v-else-if="msg.type === 'emoji'">
              <img :src="getEmojiUrl(msg.emojiId, msg.characterId)" class="max-h-20 max-w-[120px] object-contain" />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 border-t border-gray-200 p-2">
      <input
        v-model="inputText"
        @keyup.enter="sendMessage"
        placeholder="输入消息..."
        :disabled="!isConnected"
        class="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 disabled:opacity-50"
      />
      <button
        @click="sendMessage"
        :disabled="!isConnected || !inputText.trim()"
        class="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
      >发送</button>
      <button
        @click="showEmojiPicker = !showEmojiPicker"
        :disabled="!isConnected"
        class="shrink-0 rounded-lg bg-green-500 px-2.5 py-1.5 text-sm text-white hover:bg-green-600 disabled:opacity-50"
      >😊</button>
    </div>

    <div v-if="showEmojiPicker" class="border-t border-gray-200">
      <EmojiPicker @select="handleEmojiSelect" @close="showEmojiPicker = false" />
    </div>
  </div>
</template>
