<script setup>
import { computed } from 'vue'
import { SPELLS } from '../core/rules'

const props = defineProps({
  castCounts: { type: Object, default: () => ({}) },
  deckRemaining: { type: Number, default: 0 },
  secretPileRemaining: { type: Number, default: 0 },
})

// 牌堆紧张时高亮提醒（≤5 张算告急）
const deckLow = computed(() => props.deckRemaining <= 5)
</script>

<template>
  <div class="rounded-xl border border-[#D8D0E4] bg-white p-4 shadow-sm">
    <div class="mb-2 flex items-center justify-between text-xs text-[#8A8299]">
      <span>已打出的魔法（已用 / 总数）</span>
      <span class="flex items-center gap-3">
        <span class="rounded-full px-2.5 py-1 font-bold" :class="deckLow ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'">
          🂠 牌堆 {{ deckRemaining }}
        </span>
        <span class="rounded-full bg-[#F7EFF8] px-2.5 py-1 text-[#8A8299]">🔮 秘密牌 {{ secretPileRemaining }}</span>
      </span>
    </div>
    <div class="flex flex-wrap justify-center gap-3">
      <div
        v-for="spell in SPELLS"
        :key="spell.id"
        class="flex flex-col items-center rounded-lg bg-[#F7EFF8] px-2.5 py-1.5"
        :title="spell.desc"
      >
        <span class="text-xl">{{ spell.emoji }}</span>
        <span class="mt-0.5 text-[9px] text-[#8A8299]">{{ spell.name }}</span>
        <span class="text-xs font-bold text-brand-600">
          {{ castCounts[spell.id] ?? 0 }}/{{ spell.count }}
        </span>
      </div>
    </div>
  </div>
</template>
