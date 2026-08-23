<script setup>
import { computed } from 'vue'

const props = defineProps({
  spellId: { type: Number, default: null },
  faceDown: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md | lg
})

import { SPELLS } from '../core/rules'

const spell = computed(() => SPELLS.find(s => s.id === props.spellId) ?? null)

const dims = computed(() => {
  if (props.size === 'sm') return 'w-12 h-16 text-xl'
  if (props.size === 'lg') return 'w-20 h-28 text-3xl'
  return 'w-16 h-24 text-2xl'
})
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center rounded-lg border shadow-md transition"
    :class="[dims, faceDown ? 'border-amber-700/60 bg-gradient-to-b from-amber-800 to-amber-950' : 'border-[#D8D0E4] bg-[#FAF7FC]']"
    :title="faceDown ? '' : `${spell?.name}：${spell?.desc}`"
  >
    <template v-if="!faceDown && spell">
      <div class="text-center leading-tight">
        <div>{{ spell.emoji }}</div>
        <div v-if="size !== 'sm'" class="mt-0.5 text-[10px] font-medium text-[#55506B]">{{ spell.name }}</div>
      </div>
    </template>
    <template v-else-if="faceDown">
      <span class="opacity-50">🧙</span>
    </template>
  </div>
</template>
