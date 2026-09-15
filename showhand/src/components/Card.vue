<script setup>
/**
 * Card.vue —— 扑克牌。
 *
 * 三种面：
 *   concealed  「闷」：闷牌者还没看的那张牌。服务端根本不下发牌面，
 *              所以这里只能渲染一个明确的占位符，不能显示任何花色点数。
 *   hidden     牌背：别人的暗牌
 *   face-up    正面：明牌，或自己的暗牌（revealed 时加光圈）
 */
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, required: true }, // { suit, rank, hidden, concealed, revealed }
  size: { type: String, default: 'md' }, // sm | md | lg
})

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLOR = { s: 'text-ink', h: 'text-red-600', d: 'text-red-600', c: 'text-ink' }
const RANK_LABEL = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' }

const isConcealed = computed(() => props.card.concealed === true)
const isDark = computed(() => props.card.hidden === true && !isConcealed.value)
const isRevealed = computed(() => !props.card.hidden && !isConcealed.value && props.card.revealed)
const label = computed(() => RANK_LABEL[props.card.rank] ?? String(props.card.rank))
const symbol = computed(() => SUIT_SYMBOL[props.card.suit] ?? '')
const colorClass = computed(() => SUIT_COLOR[props.card.suit] ?? 'text-ink')

const sizeClass = computed(() => ({
  sm: 'h-10 w-7 rounded text-[10px]',
  md: 'h-14 w-10 rounded-md text-xs',
  lg: 'h-20 w-14 rounded-lg text-base',
})[props.size])
</script>

<template>
  <!-- 闷：还没看牌，服务端没给牌面 -->
  <div
    v-if="isConcealed"
    class="relative flex items-center justify-center border-2 border-dashed border-brand-400 bg-gradient-to-br from-brand-100 to-brand-200 font-bold text-brand-700 shadow-sm"
    :class="sizeClass"
    title="闷牌中：你没有看这张牌"
  >
    <span class="leading-none" :class="size === 'sm' ? 'text-[10px]' : 'text-sm'">闷</span>
  </div>

  <!-- 牌背：别人的暗牌 -->
  <div
    v-else-if="isDark"
    class="relative flex items-center justify-center border border-brand-800 bg-gradient-to-br from-brand-700 to-brand-900 text-brand-200 shadow transition-transform duration-150 hover:z-50 hover:scale-150"
    :class="sizeClass"
  >
    <span class="text-lg">?</span>
  </div>

  <!-- 正面 -->
  <div
    v-else
    class="relative flex flex-col items-center justify-between bg-white p-0.5 shadow transition-transform duration-150 hover:z-50 hover:scale-150"
    :class="[sizeClass, colorClass, isRevealed ? 'card-revealed border-2 border-brand-400' : 'border border-line']"
  >
    <span class="font-num font-bold leading-none">{{ label }}</span>
    <span class="leading-none">{{ symbol }}</span>
  </div>
</template>

<style scoped>
/* 自己的暗牌：缓慢柔和的呼吸光圈，提示"这张只有你看得到" */
.card-revealed {
  animation: revealed-glow 2.4s ease-in-out infinite;
}

@keyframes revealed-glow {
  0%,
  100% {
    box-shadow: 0 0 0 1px rgba(136, 136, 204, 0.35), 0 0 5px rgba(118, 118, 184, 0.28);
  }
  50% {
    box-shadow: 0 0 0 2px rgba(136, 136, 204, 0.6), 0 0 11px rgba(118, 118, 184, 0.45);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-revealed {
    animation: none;
    box-shadow: 0 0 0 2px rgba(136, 136, 204, 0.5);
  }
}
</style>
