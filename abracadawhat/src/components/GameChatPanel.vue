<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useGameStore } from '../stores/gameStore'
import { EmojiPicker } from '@lapismind/chat-kit/vue'
import { avatarUrl } from '../game/avatars'

const game = useGameStore()
const { chatMessages, chatMessageVersion, connected } = storeToRefs(game)
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

// 自动滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

onMounted(async () => {
  await nextTick()
  scrollToBottom()
})

watch(
  () => chatMessageVersion.value,
  async () => {
    await nextTick()
    scrollToBottom()
  }
)
</script>

<template>
  <div class="flex h-full flex-col bg-surface">
    <div class="flex items-center justify-between border-b border-line px-3 py-2">
      <h3 class="text-sm font-bold text-ink">聊天室</h3>
      <span
        class="text-xs"
        :class="connected ? 'text-emerald-600' : 'text-red-500'"
        role="status"
        aria-live="polite"
      >{{ connected ? '● 已连接' : '○ 连接中…' }}</span>
    </div>

    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-2">
      <div v-if="chatMessages.length === 0" class="flex h-full items-center justify-center">
        <p class="text-xs text-muted">暂无消息，发一条吧~</p>
      </div>
      <div
        v-for="(msg, index) in chatMessages"
        :key="index"
        class="mb-2 flex gap-2 rounded-lg p-2"
        :class="msg.type === 'emoji' ? 'bg-brand-50' : 'bg-field'"
      >
        <img :src="avatarUrl(msg.avatarId)" :alt="msg.nickname" class="h-8 w-8 shrink-0 rounded-full object-cover" />
        <div class="min-w-0 flex-1">
          <div class="mb-0.5 flex items-baseline justify-between">
            <span class="text-xs font-bold text-ink">{{ msg.nickname }}</span>
            <span class="text-[10px] text-muted">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="text-sm text-ink break-words">
            <template v-if="msg.type === 'chat'">{{ msg.text }}</template>
            <template v-else-if="msg.type === 'emoji'">
              <img :src="getEmojiUrl(msg.folder, msg.emojiId)" class="h-20 w-[120px] object-contain" />
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 border-t border-line p-2">
      <input
        v-model="inputText"
        @keyup.enter="sendMessage"
        placeholder="输入消息..."
        aria-label="聊天消息"
        class="min-w-0 flex-1 rounded-lg border border-line bg-field px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-400"
      />
      <button
        type="button"
        @click="sendMessage"
        :disabled="!inputText.trim()"
        class="shrink-0 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >发送</button>
      <button
        type="button"
        :aria-expanded="showEmojiPicker"
        aria-label="选择表情"
        @click="showEmojiPicker = !showEmojiPicker"
        class="shrink-0 rounded-lg bg-neutral px-2.5 py-1.5 text-sm text-ink-soft hover:bg-neutral-hover"
      >😊</button>
    </div>

    <div v-if="showEmojiPicker" class="border-t border-line">
      <EmojiPicker @select="handleEmojiSelect" @close="showEmojiPicker = false" />
    </div>
  </div>
</template>
