<script setup>
import { JUDGE } from '../game/judge'

const props = defineProps({
  // 待判定的问题：{ question: string, from: string }
  pending: { type: Object, default: null },
  // 玩家列表，用于显示提问者昵称
  players: { type: Array, default: () => [] },
})

const emit = defineEmits(['judge'])

function submit(judge) {
  if (props.pending) {
    emit('judge', judge)
  }
}

function askerName(from) {
  return props.players.find((p) => p.id === from)?.nickname ?? '玩家'
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-xl border border-sky-700/60 bg-sky-900/30 p-3">
    <div class="text-xs font-semibold text-sky-300">主持人面板</div>

    <!-- 待判定的问题 -->
    <div v-if="pending" class="rounded-lg bg-slate-800/80 px-3 py-2 text-sm text-slate-200">
      <div class="mb-1 text-xs text-slate-400">{{ askerName(pending.from) }} 提问：</div>
      <div class="leading-snug">{{ pending.question }}</div>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button type="button" class="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white" @click="submit(JUDGE.YES)">是</button>
        <button type="button" class="rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white" @click="submit(JUDGE.NO)">否</button>
        <button type="button" class="rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white" @click="submit(JUDGE.AMBIGUOUS)">是也不是</button>
        <button type="button" class="rounded-md bg-slate-600 px-3 py-1 text-xs font-bold text-white" @click="submit(JUDGE.IRRELEVANT)">无关</button>
      </div>
    </div>
    <div v-else class="text-xs text-slate-500">等玩家提问…</div>
  </div>
</template>
