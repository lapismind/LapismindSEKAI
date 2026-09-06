<script setup>
import { computed, ref, useId } from 'vue'

const props = defineProps({
  spellId: { type: Number, default: null },
  faceDown: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // sm | md | lg
})

import { SPELLS } from '../core/rules'

const spell = computed(() => SPELLS.find(s => s.id === props.spellId) ?? null)
const effectOpen = ref(false)
const effectId = `spell-effect-${useId()}`

const dims = computed(() => {
  if (props.size === 'sm') return 'w-12 min-w-[36px] h-16 text-xl'
  if (props.size === 'lg') return 'w-20 h-28 text-3xl'
  return 'w-16 h-24 text-2xl'
})
</script>

<template>
  <div class="relative shrink min-w-0">
    <button
      v-if="!faceDown && spell"
      type="button"
      class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#D8D0E4] bg-[#FAF7FC] shadow-md transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      :class="dims"
      :title="`${spell.name}：${spell.desc}`"
      :aria-label="`${spell.name}效果说明`"
      :aria-expanded="effectOpen"
      :aria-controls="effectId"
      @click="effectOpen = !effectOpen"
    >
      <div class="text-center leading-tight">
        <div>{{ spell.emoji }}</div>
        <div v-if="size !== 'sm'" class="mt-0.5 text-[10px] font-medium text-[#55506B]">{{ spell.name }}</div>
      </div>
    </button>
    <div
      v-else-if="faceDown"
      class="flex items-center justify-center rounded-lg border border-amber-700/60 bg-gradient-to-b from-amber-800 to-amber-950 shadow-md transition"
      :class="dims"
    >
      <span class="opacity-50">🧙</span>
    </div>
    <div
      v-if="effectOpen && spell"
      :id="effectId"
      class="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-[#D8D0E4] bg-white p-3 text-left text-xs leading-relaxed text-[#55506B] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56"
    >
      <strong class="text-[#333333]">{{ spell.name }}</strong>：{{ spell?.desc }}
    </div>
  </div>
</template>
