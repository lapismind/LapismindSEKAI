<script setup>
import { computed } from 'vue'

const props = defineProps({
  player: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }, // 当前回合者
  isLocalPlayer: { type: Boolean, default: false }, // 本机玩家的座位（正面朝下自己的视角）
})

const showCards = computed(() => props.isMe || props.isLocalPlayer)
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-xl border px-3 py-2 transition"
    :class="[
      isActive ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-500/20' : 'border-slate-700 bg-slate-800/60',
      isMe && 'ring-1 ring-sky-400/60',
    ]"
  >
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      :class="isMe ? 'bg-sky-500 text-white' : 'bg-slate-600 text-slate-200'"
    >
      {{ player.nickname?.slice(0, 1) ?? '?' }}
    </div>

    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-semibold text-slate-100">
        {{ player.nickname }}<span v-if="isMe" class="ml-1 text-xs text-sky-400">(我)</span>
      </div>
      <div class="text-xs text-slate-400">
        {{ showCards ? `手牌 ${player.hand?.length ?? 0}` : `手牌 ${player.handCount ?? 0} 张` }}
      </div>
    </div>

    <span
      v-if="isActive"
      class="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-900"
    >
      出牌中
    </span>
    <span
      v-else-if="player.isReady"
      class="shrink-0 rounded-full bg-emerald-600/70 px-2 py-0.5 text-xs text-emerald-100"
    >
      准备
    </span>
  </div>
</template>
