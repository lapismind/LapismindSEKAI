<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import MessageList from './MessageList.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  reviewNotes: { type: Array, default: () => [] },
  myPlayerId: { type: String, default: null },
  mode: { type: String, default: 'ai' },
  players: { type: Array, default: () => [] },
  canAIHint: { type: Boolean, default: false }, // 主持人/房主可触发 AI 复盘
  questionCount: { type: Number, default: 0 },
  questionLimit: { type: [Number, null], default: null },
})

const emit = defineEmits(['note', 'ai-hint'])

const open = ref(false)
const tab = ref('log') // log | review
const noteText = ref('')
const listEl = ref(null)

watch(open, (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
    scrollToBottom()
  } else {
    document.body.style.overflow = ''
  }
})

watch(() => props.messages.length, scrollToBottom)

function scrollToBottom() {
  nextTick(() => {
    listEl.value?.scrollTo({ top: listEl.value.scrollHeight })
  })
}

function sendNote() {
  const text = noteText.value.trim()
  if (!text) return
  emit('note', text)
  noteText.value = ''
}

const remaining = computed(() =>
  props.questionLimit ? props.questionLimit - props.questionCount : null,
)
</script>

<template>
  <!-- 右侧触发按钮（竖排，fixed 定位避免受祖先 transform 影响 -->
  <button
    type="button"
    class="fixed right-2 top-1/2 z-40 flex w-8 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/90 py-2 text-xs font-semibold text-slate-300 shadow transition hover:bg-slate-700"
    @click="open = !open"
  >
    <span v-if="!open">☰</span>
    <span v-else>▶</span>
    <span class="[writing-mode:vertical-rl] text-[10px]">
      {{ open ? '收起' : (tab === 'review' ? '复盘' : '记录') }}
    </span>
    <span v-if="!open && remaining !== null" class="text-[10px] text-amber-400">剩{{ Math.max(remaining, 0) }}</span>
  </button>

  <!-- 遮罩 -->
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-black/50"
    @click="open = false"
  />

  <!-- 右侧侧边栏 -->
  <transition name="slide-right">
    <div
      v-if="open"
      class="fixed right-0 top-0 bottom-0 z-50 flex w-80 max-w-[85vw] flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
    >
      <!-- 头部：标签切换 + 收起 -->
      <div class="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div class="flex gap-1 rounded-lg bg-slate-800 p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-semibold"
            :class="tab === 'log' ? 'bg-brand-500 text-white' : 'text-slate-400'"
            @click="tab = 'log'"
          >
            问答记录
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1 text-xs font-semibold"
            :class="tab === 'review' ? 'bg-brand-500 text-white' : 'text-slate-400'"
            @click="tab = 'review'"
          >
            复盘
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <!-- AI 复盘按钮（房主/主持人专属，常驻头部可见） -->
          <button
            v-if="canAIHint"
            type="button"
            class="rounded-md bg-gradient-to-r from-brand-600 to-brand-600 px-2.5 py-1 text-xs font-bold text-white shadow transition hover:opacity-90"
            :title="'生成 AI 复盘提示'"
            @click="emit('ai-hint')"
          >
            🐟 AI复盘
          </button>
          <button type="button" class="text-slate-400 hover:text-slate-200" @click="open = false">✕</button>
        </div>
      </div>

      <!-- 问答记录页 -->
      <div v-if="tab === 'log'" ref="listEl" class="flex-1 overflow-y-auto px-4 py-3">
        <MessageList
          :messages="messages"
          :my-player-id="myPlayerId"
          :mode="mode"
          :players="players"
        />
      </div>

      <!-- 复盘页 -->
      <div v-else class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div class="flex flex-col gap-2">
            <div
              v-for="(n, i) in reviewNotes"
              :key="i"
              class="rounded-lg px-3 py-2"
              :class="n.kind === 'ai' ? 'bg-brand-900/40 border border-brand-700/50' : 'bg-slate-800/70'"
            >
              <div class="text-xs text-slate-500">
                {{ n.kind === 'ai' ? '🐟 大肥鱼复盘' : (players.find((p) => p.id === n.from)?.nickname ?? '玩家') }}
              </div>
              <div class="text-sm" :class="n.kind === 'ai' ? 'text-brand-200' : 'text-slate-200'">
                {{ n.text }}
              </div>
            </div>
            <div v-if="reviewNotes.length === 0" class="py-6 text-center text-sm text-slate-600">
              复盘笔记区：所有玩家都能看到这里的内容
            </div>
          </div>
        </div>

        <!-- 复盘输入区 -->
        <div class="border-t border-slate-800 p-3">
          <div class="flex gap-2">
            <input
              v-model="noteText"
              class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="复盘笔记，所有人可见…"
              maxlength="500"
              @keyup.enter="sendNote"
            />
            <button
              type="button"
              class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-400"
              @click="sendNote"
            >
              发送            </button>
          </div>
        </div>
      </div>

      <!-- 底部：AI 辅助复盘（仅房主/主持人，独立于 tab，随时可见） -->
      <div v-if="canAIHint" class="border-t border-brand-900/40 bg-brand-950/40 p-3">
        <button
          type="button"
          class="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-600 px-3 py-2.5 text-xs font-bold text-white shadow transition hover:opacity-90"
          @click="emit('ai-hint')"
        >
          🐟 大肥鱼 · AI 辅助复盘提示
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
