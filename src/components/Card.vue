<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, required: true }, // { suit, rank, hidden }
  size: { type: String, default: 'md' }, // sm | md | lg
})

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLOR = { s: 'text-slate-900', h: 'text-red-600', d: 'text-red-600', c: 'text-slate-900' }
const RANK_LABEL = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' }

const isDark = computed(() => props.card.hidden)
const isRevealed = computed(() => !props.card.hidden && props.card.revealed)
const label = computed(() => RANK_LABEL[props.card.rank] ?? String(props.card.rank))
const symbol = computed(() => SUIT_SYMBOL[props.card.suit] ?? '')
const colorClass = computed(() => SUIT_COLOR[props.card.suit] ?? 'text-slate-900')

const sizeClass = computed(() => ({
  sm: 'h-10 w-7 rounded text-[10px]',
  md: 'h-14 w-10 rounded-md text-xs',
  lg: 'h-20 w-14 rounded-lg text-base',
})[props.size])
</script>

<template>
  <div
    v-if="isDark"
    class="flex items-center justify-center border border-slate-600 bg-gradient-to-br from-indigo-700 to-indigo-900 text-indigo-300 shadow"
    :class="sizeClass"
  >
    <span class="text-lg">?</span>
  </div>
  <div
    v-else
    class="flex flex-col items-center justify-between bg-white p-0.5 font-bold shadow"
    :class="[sizeClass, colorClass, isRevealed ? 'border-2 border-indigo-500' : 'border border-slate-300']"
  >
    <span class="leading-none">{{ label }}</span>
    <span class="leading-none">{{ symbol }}</span>
  </div>
</template>
