<script setup>
/** PlayerCard.vue —— 地图左上角的玩家状态条（HUD）；点头像在地图上定位该玩家 */
defineProps({
  player: { type: Object, required: true },
  isCurrent: { type: Boolean, default: false },
});
const emit = defineEmits(['locate']);
</script>

<template>
  <div
    class="pointer-events-auto flex w-60 items-center gap-2 rounded-xl border px-2 py-1.5 shadow-lg backdrop-blur-md transition-colors"
    :class="isCurrent ? 'border-yellow-300 bg-slate-900/85 ring-2 ring-yellow-300/40' : 'border-white/15 bg-slate-900/65'"
  >
    <button
      class="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white/80 hover:scale-105 focus-visible:outline-2 focus-visible:outline-yellow-300"
      :style="{ backgroundColor: player.color }"
      :title="`在地图上定位 ${player.name}`" :aria-label="`在地图上定位 ${player.name}`"
      @click="emit('locate', player)"
    >
      <!-- chibi 基底 1024²：放大取头部 -->
      <img
        :src="`/assets/niigo/chibi_base/${player.img}.png`" alt=""
        class="absolute max-w-none bg-white" style="width: 244%; left: -69%; top: -12%;"
        :style="player.ko ? 'filter: grayscale(1) brightness(0.5)' : ''"
      />
    </button>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1">
        <span class="truncate text-sm font-bold text-slate-100">{{ player.name }}</span>
        <span class="rounded bg-violet-500/30 px-1 text-[10px] font-bold text-violet-200">Lv{{ player.level }}</span>
        <span v-if="player.ko" class="rounded bg-black/60 px-1 text-[10px] text-slate-300">KO</span>
        <span v-if="player.immune" class="rounded bg-pink-500/30 px-1 text-[10px] text-pink-200">住院</span>
      </div>
      <div class="mt-0.5 flex items-center gap-2 text-[11px]">
        <span class="font-semibold text-yellow-300">🪙 {{ player.coins }}</span>
        <span :class="player.hp <= 3 ? 'text-red-300' : 'text-slate-300'">HP {{ player.hp }}/{{ player.maxHp }}</span>
        <span class="text-slate-400">🃏 {{ player.hand.length }}</span>
      </div>
      <div class="mt-1 h-1 overflow-hidden rounded bg-slate-700">
        <div
          class="h-full rounded transition-all"
          :class="player.hp <= 3 ? 'bg-red-500' : 'bg-emerald-400'"
          :style="{ width: (player.hp / player.maxHp) * 100 + '%' }"
        />
      </div>
    </div>
  </div>
</template>
