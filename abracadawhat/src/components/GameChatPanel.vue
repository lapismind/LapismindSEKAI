<script setup>
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '../stores/gameStore'
import { EmojiPicker } from '@lapismind/chat-kit/vue'
import { avatarUrl } from '../game/avatars'

const game = useGameStore()
const { chatMessages } = storeToRefs(game)
const inputText = ref('')
const showEmojiPicker = ref(false)
const messagesContainer = ref(null)

const sendMessage = () => {
  if (inputText.value.trim()) {
    game.sendChat(inputText.value)
    inputText.value = ''
  }
}

const handleEmojiSelect = (folder, emojiId) => {
  game.sendEmoji(folder, emojiId)
  showEmojiPicker.value = false
}

const getEmojiUrl = (folder, emojiId) => `/chat-kit/emojis/${folder}/${emojiId}.png`

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

watch(
  () => chatMessages.value.length,
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
      <span class="text-xs text-green-600">● 已连接</span>
    </div>

    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-2">
      <div v-if="chatMessages.length === 0" class="flex h-full items-center justify-center">
        <p class="text-xs text-gray-400">暂无消息，发一条吧~</p>
      </div>
      <div
        v-for="(msg, index) in chatMessages"
        :key="index"
        class="mb-2 flex gap-2 rounded-lg p-2"
        :class="msg.type === 'emoji' ? 'bg-blue-50' : 'bg-gray-100'"
      >
        <img :src="avatarUrl(msg.avatarId)" :alt="msg.nickname" class="h-8 w-8 shrink-0 rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="mb-0.5 flex items-baseline justify-between">
            <span class="text-xs font-bold text-[#333]">{{ msg.nickname }}</span>
            <span class="text-[10px] text-gray-400">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="text-sm text-[#444] break-words">
            <template v-if="msg.type === 'chat'">{{ msg.text }}</template>
            <template v-else-if="msg.type === 'emoji'">
              <img :src="getEmojiUrl(msg.folder, msg.emojiId)" class="max-h-20 max-w-[120px] object-contain" />
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
        class="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
      />
      <button
        @click="sendMessage"
        :disabled="!inputText.trim()"
        class="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
      >发送</button>
      <button
        @click="showEmojiPicker = !showEmojiPicker"
        class="shrink-0 rounded-lg bg-green-500 px-2.5 py-1.5 text-sm text-white hover:bg-green-600"
      >😊</button>
    </div>

    <div v-if="showEmojiPicker" class="border-t border-gray-200">
      <EmojiPicker @select="handleEmojiSelect" @close="showEmojiPicker = false" />
    </div>
  </div>
</template>
