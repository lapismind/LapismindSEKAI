<script setup>
/** PlayerCard.vue —— 单个玩家的状态条 */
defineProps({
  player: { type: Object, required: true },
  isCurrent: { type: Boolean, default: false },
});
</script>

<template>
  <div
    class="rounded-lg border p-3 transition-colors"
    :class="isCurrent ? 'border-yellow-300/80 bg-slate-800/80' : 'border-slate-700 bg-slate-900/60'"
  >
    <div class="flex items-center gap-2">
      <img
        :src="`/assets/niigo/chibi_base/${player.img}.png`"
        :alt="player.name" class="h-9 w-9 rounded-full object-cover"
        :style="{ backgroundColor: player.color + '55' }"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-medium text-slate-100">{{ player.name }}</span>
          <span v-if="player.ko" class="rounded bg-black/60 px-1 text-[10px] text-slate-400">KO</span>
          <span v-if="player.immune" class="rounded bg-pink-500/30 px-1 text-[10px] text-pink-200">免疫</span>
        </div>
        <div class="text-[11px] text-slate-400">Lv{{ player.level }} · {{ player.tile }} 号格</div>
      </div>
      <div class="text-right">
        <div class="text-sm font-semibold text-yellow-300">{{ player.coins }} 币</div>
        <div class="text-[11px]" :class="player.hp <= 3 ? 'text-red-400' : 'text-slate-300'">
          HP {{ player.hp }}/{{ player.maxHp }}
        </div>
      </div>
    </div>
    <div class="mt-2 h-1.5 overflow-hidden rounded bg-slate-700">
      <div
        class="h-full rounded transition-all"
        :class="player.hp <= 3 ? 'bg-red-500' : 'bg-emerald-500'"
        :style="{ width: (player.hp / player.maxHp) * 100 + '%' }"
      />
    </div>
    <div class="mt-1.5 flex gap-1">
      <span
        v-for="c in player.hand" :key="c"
        class="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
      >{{ c }}</span>
      <span v-if="!player.hand.length" class="text-[10px] text-slate-600">（无手牌）</span>
    </div>
  </div>
</template>
