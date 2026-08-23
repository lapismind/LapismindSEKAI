<script setup>
import { computed } from 'vue'
import { JUDGE_LABEL } from '../game/judge'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  myPlayerId: { type: String, default: null },
  mode: { type: String, default: 'ai' },
  players: { type: Array, default: () => [] },
})

const display = computed(() => props.messages)

function judgeClass(judge) {
  return {
    yes: 'text-emerald-300',
    no: 'text-red-300',
    irrelevant: 'text-slate-400',
    ambiguous: 'text-amber-300',
    correct: 'text-amber-300 font-bold',
  }[judge] ?? 'text-slate-300'
}

function senderName(m, players) {
  if (m.from === 'moderator') return props.mode === 'ai' ? '🐟 大肥鱼' : '🕵️ 主持人'
  const p = players.find((x) => x.id === m.from)
  return p?.nickname ?? '玩家'
}

/** AI 模式的判定不显示分析（主持人只回答固定几个字） */
function showReason(m) {
  return m.from === 'moderator' && m.source === 'human'
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(m, i) in display"
      :key="i"
      class="rounded-lg px-3 py-2"
      :class="m.judge ? 'bg-slate-800/80' : 'bg-slate-900/60'"
    >
      <div class="text-xs text-slate-500">
        {{ senderName(m, players) }}
        <span v-if="m.kind === 'question'">提问</span>
        <span v-if="m.judge" class="ml-1">
          → <span :class="judgeClass(m.judge)">{{ JUDGE_LABEL[m.judge] }}</span>
        </span>
      </div>
      <div class="text-sm" :class="m.from === myPlayerId ? 'text-brand-200' : 'text-slate-200'">
        {{ m.text }}
        <span v-if="showReason(m)" class="ml-1 text-xs text-slate-500">（{{ m.reason }}）</span>
      </div>
    </div>
    <div v-if="messages.length === 0" class="py-6 text-center text-sm text-slate-600">
      提问开始后，对话会显示在这里
    </div>
  </div>
</template>
