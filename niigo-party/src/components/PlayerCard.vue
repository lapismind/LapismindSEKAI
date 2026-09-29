<script setup>
/**
 * PlayerCard.vue —— 地图左上角的玩家状态条（HUD）；点头像在地图上定位该玩家
 * 第二行是 buff / debuff 徽章：反制牌预置（保护屏障、以牙还牙）、住院免疫、遥控骰子、疾行、KO 等。
 */
import { computed } from 'vue';

const props = defineProps({
  player: { type: Object, required: true },
  isCurrent: { type: Boolean, default: false },
});
const emit = defineEmits(['locate']);

/** 从玩家状态派生出要显示的状态徽章；good = buff，bad = debuff */
const statuses = computed(() => {
  const p = props.player;
  const out = [];
  if (p.ko) out.push({ key: 'ko', icon: '💫', name: 'KO', desc: '缺席一回合后原地复活、HP 回满；期间免疫所有事件', good: false });
  if (p.immune) out.push({ key: 'immune', icon: '🏥', name: '住院', desc: '到下次自己回合前：不受伤害、不可被效果牌指定、不可被挑战', good: true });
  if (p.status?.shield > 0) out.push({ key: 'shield', icon: '🛡', name: '保护屏障', count: p.status.shield, desc: '下次被效果牌指定时无效', good: true });
  if (p.status?.reflect > 0) out.push({ key: 'reflect', icon: '🔁', name: '以牙还牙', count: p.status.reflect, desc: '下次被效果牌指定时反弹给使用者', good: true });
  if (p.fixedRollPending) out.push({ key: 'dice', icon: '🎯', name: '遥控骰子', desc: '下次移动点数自选 1~10', good: true });
  if (p.extraRoll) out.push({ key: 'swift', icon: '⏩', name: '疾行', desc: '本回合可再掷一次移动骰', good: true });
  if (p.hp > 0 && p.hp <= 3 && !p.ko) out.push({ key: 'low', icon: '❤', name: '濒危', desc: `HP 只剩 ${p.hp}`, good: false });
  return out;
});
</script>

<template>
  <div
    class="pointer-events-auto flex w-64 items-center gap-2 rounded-xl border px-2 py-1.5 shadow-lg backdrop-blur-md transition-colors"
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
      <!-- buff / debuff -->
      <ul v-if="statuses.length" class="mt-1 flex flex-wrap gap-1" aria-label="状态">
        <li
          v-for="st in statuses" :key="st.key"
          class="flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-bold"
          :class="st.good ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100' : 'border-red-300/60 bg-red-500/25 text-red-100'"
          :title="`${st.name}：${st.desc}`"
        >
          <span aria-hidden="true">{{ st.icon }}</span>{{ st.name }}<template v-if="st.count > 1">×{{ st.count }}</template>
        </li>
      </ul>
    </div>
  </div>
</template>
