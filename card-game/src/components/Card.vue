<script setup>
import { computed } from 'vue'
import { cardLabel } from '../game/cardDefs'

const props = defineProps({
  card: { type: Object, default: null },
  faceUp: { type: Boolean, default: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md | lg
})

const emit = defineEmits(['select'])

const isRed = computed(() => props.card?.suit === 'heart' || props.card?.suit === 'diamond')
const sizeClass = computed(() => ({
  sm: 'w-9 h-13 text-xs rounded-md',
  md: 'w-14 h-20 text-sm rounded-lg',
  lg: 'w-20 h-28 text-base rounded-xl',
}[props.size]))

function onClick() {
  if (props.disabled) return
  emit('select', props.card)
}
</script>

<template>
  <button
    type="button"
    :class="[
      sizeClass,
      'relative shrink-0 border font-bold shadow-md transition-transform duration-150 select-none',
      faceUp
        ? (isRed ? 'border-red-300 bg-white text-red-600' : 'border-slate-300 bg-white text-slate-900')
        : 'border-indigo-700 bg-indigo-600 text-transparent',
      selected && 'translate-y--2 scale-105 ring-2 ring-amber-400',
      !disabled && faceUp ? 'cursor-pointer hover:translate-y--1 hover:shadow-lg' : 'cursor-default',
      disabled && 'opacity-60',
    ]"
    :disabled="disabled"
    @click="onClick"
  >
    <template v-if="faceUp && card">
      <span class="absolute top-0.5 left-1 leading-none">{{ cardLabel(card) }}</span>
      <span class="absolute bottom-0.5 right-1 rotate-180 leading-none">{{ cardLabel(card) }}</span>
    </template>
  </button>
</template>
