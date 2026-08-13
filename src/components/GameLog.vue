<script setup>
import { computed } from 'vue'
import { cardLabel } from '../game/cardDefs'

const props = defineProps({
  log: { type: Array, default: () => [] },
  myPlayerId: { type: String, default: null },
})

const display = computed(() => [...props.log].slice(-20).reverse())
</script>

<template>
  <div class="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/70 p-2">
    <div class="mb-1 text-xs font-semibold text-slate-500">牌局记录</div>
    <ul class="space-y-1">
      <li
        v-for="(entry, i) in display"
        :key="i"
        class="text-xs"
        :class="entry.playerId === myPlayerId ? 'text-sky-300' : 'text-slate-300'"
      >
        <span class="text-slate-500">{{ entry.at ? new Date(entry.at).toLocaleTimeString('zh-CN', { hour12: false }) : '' }}</span>
        {{ entry.playerName ?? entry.playerId }} 出了 {{ cardLabel(entry.card) }}
      </li>
    </ul>
    <div v-if="display.length === 0" class="text-xs text-slate-600">还没有出牌记录</div>
  </div>
</template>
