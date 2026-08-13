<script setup>
const props = defineProps({
  puzzle: { type: Object, default: null },
  selected: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])
</script>

<template>
  <button
    type="button"
    class="flex w-full flex-col gap-1 rounded-xl border p-4 text-left transition"
    :class="selected ? 'border-brand-400 bg-brand-500/20' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'"
    @click="puzzle && emit('select', puzzle.id)"
  >
    <div class="flex items-center justify-between">
      <span class="font-semibold text-slate-100">{{ puzzle?.title ?? '未选谜题' }}</span>
      <span v-if="puzzle?.custom" class="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">自定义</span>
    </div>
    <p class="line-clamp-2 text-xs leading-relaxed text-slate-400">{{ puzzle?.story }}</p>
    <div class="mt-1 text-xs text-slate-500">难度 {{ puzzle?.difficulty ?? '-' }}</div>
  </button>
</template>
