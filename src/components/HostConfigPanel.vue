<script setup>
const props = defineProps({
  mode: { type: String, default: 'ai' },
  maxPlayers: { type: Number, default: 2 },
  questionLimit: { type: [Number, null], default: null },
})
const emit = defineEmits(['update:mode', 'update:maxPlayers', 'update:questionLimit'])
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-slate-200">主持模式</span>
      <div class="flex gap-1 rounded-lg bg-slate-900 p-1">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-semibold transition"
          :class="mode === 'ai' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'"
          @click="emit('update:mode', 'ai')"
        >
          AI 主持
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-semibold transition"
          :class="mode === 'human' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200'"
          @click="emit('update:mode', 'human')"
        >
          真人主持
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-slate-200">
        本局人数（{{ mode === 'human' ? '含主持人' : '全部玩家' }}      </span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="n in [2, 3, 4, 5, 6, 7, 8]"
          :key="n"
          type="button"
          class="h-7 w-7 rounded-md text-xs font-semibold transition"
          :class="maxPlayers === n ? 'bg-brand-500 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
          @click="emit('update:maxPlayers', n)"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-slate-200">问题次数限制</span>
      <div class="flex gap-1">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-semibold transition"
          :class="questionLimit === null ? 'bg-brand-500 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
          @click="emit('update:questionLimit', null)"
        >
          不限
        </button>
        <button
          v-for="n in [10, 20, 30, 50]"
          :key="n"
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-semibold transition"
          :class="questionLimit === n ? 'bg-brand-500 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'"
          @click="emit('update:questionLimit', n)"
        >
          {{ n }}        </button>
      </div>
    </div>

    <p v-if="mode === 'human'" class="text-xs text-slate-500">
      真人模式下，房主（你）将担任主持人，回答玩家的提问。
    </p>
    <p v-if="questionLimit !== null" class="text-xs text-slate-500">
      全场最多 {{ questionLimit }} 个问题，用尽后由主持人揭底。
    </p>
  </div>
</template>
