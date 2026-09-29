<script setup>
/**
 * HandFan.vue —— 屏幕正下方的扇形手牌（最多 10 张）
 * 每张牌沿一段圆弧排开、带倾角，并各自轻微浮动（相位错开，不会整排同步起伏）；
 * 悬停的牌抬起、转正、放大。卡面插画缺省：按牌种上色 + 名称 + 说明。
 */
import { computed, ref } from 'vue';
import { CARDS } from '@/game/cards.js';

const props = defineProps({
  hand: { type: Array, required: true },       // 卡牌 id 数组
  playable: { type: Function, required: true },// (id) => boolean
  selectedId: { type: String, default: null },
});
const emit = defineEmits(['play']);

const KIND = {
  battle: { label: '战斗', from: '#fca5a5', to: '#b91c1c' },
  effect: { label: '效果', from: '#86efac', to: '#15803d' },
  counter: { label: '反制', from: '#a5b4fc', to: '#4338ca' },
};
const kindOf = (id) => KIND[CARDS[id]?.kind] ?? KIND.effect;

const hovered = ref(-1);
const cards = computed(() => {
  const n = props.hand.length;
  const spread = Math.min(56, 10 + n * 5.5);         // 整手牌的总张角（度）
  const step = n > 1 ? spread / (n - 1) : 0;
  const gap = Math.max(46, 92 - n * 4.6);             // 相邻牌中心水平间距（px）
  return props.hand.map((id, k) => {
    const t = n > 1 ? k / (n - 1) - 0.5 : 0;          // -0.5 … 0.5
    return {
      id, k,
      angle: -spread / 2 + step * k,
      x: (k - (n - 1) / 2) * gap,
      y: t * t * 90,                                  // 两端下沉，形成弧线
      delay: `${(k * 0.37) % 2.2}s`,
    };
  });
});
</script>

<template>
  <div class="relative h-44 w-[46rem] max-w-[calc(100vw-30rem)]" role="list" aria-label="手牌">
    <div
      v-for="c in cards" :key="c.k + ':' + c.id" role="listitem"
      class="absolute bottom-0 left-1/2"
      :style="{
        transform: hovered === c.k
          ? `translateX(calc(${c.x}px - 50%)) translateY(-54px) rotate(0deg) scale(1.18)`
          : `translateX(calc(${c.x}px - 50%)) translateY(${c.y}px) rotate(${c.angle}deg)`,
        transformOrigin: '50% 120%',
        zIndex: hovered === c.k ? 30 : c.k,
        transition: 'transform 180ms ease-out',
      }"
    >
      <button
        class="card-float group relative block h-40 w-28 rounded-xl border-2 text-left shadow-[0_10px_24px_rgba(0,0,0,0.45)] focus-visible:outline-3 focus-visible:outline-yellow-300"
        :class="[
          selectedId === c.id ? 'border-yellow-300 ring-4 ring-yellow-300/50' : 'border-white/90',
          playable(c.id) ? 'cursor-pointer' : 'cursor-not-allowed saturate-50',
        ]"
        :style="{ animationDelay: c.delay, background: `linear-gradient(160deg, ${kindOf(c.id).from}, ${kindOf(c.id).to})` }"
        :title="CARDS[c.id]?.desc"
        :aria-label="`${CARDS[c.id]?.name}：${CARDS[c.id]?.desc}${playable(c.id) ? '' : '（现在不能用）'}`"
        @mouseenter="hovered = c.k" @mouseleave="hovered = -1" @focus="hovered = c.k" @blur="hovered = -1"
        @click="emit('play', c.id)"
      >
        <span class="absolute left-1.5 top-1.5 rounded bg-black/35 px-1 text-[9px] font-bold text-white">{{ kindOf(c.id).label }}</span>
        <span v-if="CARDS[c.id]?.cost" class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-300 text-[10px] font-black text-slate-900">{{ CARDS[c.id].cost }}</span>
        <!-- 卡面插画缺省 -->
        <span class="mx-2 mt-7 flex h-14 items-center justify-center rounded-md border border-dashed border-white/60 bg-white/15 text-[9px] text-white/80">插画缺省</span>
        <span class="mt-1.5 block px-2 text-[12px] font-black leading-tight text-white drop-shadow">{{ CARDS[c.id]?.name }}</span>
        <span class="mt-0.5 block px-2 text-[9.5px] leading-snug text-white/90">{{ CARDS[c.id]?.desc }}</span>
      </button>
    </div>
    <p v-if="!hand.length" class="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900/70 px-3 py-1 text-xs text-slate-400">（无手牌）</p>
  </div>
</template>

<style scoped>
.card-float { animation: card-bob 2.6s ease-in-out infinite; }
@keyframes card-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.group:hover.card-float, .card-float:focus-visible { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .card-float { animation: none; }
}
</style>
