<script setup>
/**
 * EventPopup.vue —— 落在事件类地块时的游戏内事件通知（插画缺省时显示占位框）
 * 纯通知：不需要确认，停留 duration 毫秒后由 store 自动换下一条；点一下可提前跳过。
 * popup = { title, text, tone: 'good' | 'bad' | 'info', art, playerId }
 */
import { computed } from 'vue';

const props = defineProps({
  popup: { type: Object, required: true },
  player: { type: Object, default: null },
  duration: { type: Number, required: true }, // 毫秒，与 store 的自动轮播同步
});
const emit = defineEmits(['skip']);

const TONE = {
  good: { ring: 'border-emerald-300', chip: 'bg-emerald-400 text-slate-900', bar: 'bg-emerald-400', label: '好事' },
  bad: { ring: 'border-red-400', chip: 'bg-red-500 text-white', bar: 'bg-red-400', label: '坏事' },
  info: { ring: 'border-sky-300', chip: 'bg-sky-400 text-slate-900', bar: 'bg-sky-400', label: '事件' },
};
const tone = computed(() => TONE[props.popup.tone] ?? TONE.info);
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4" role="status" aria-live="polite">
    <button
      class="event-pop pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border-4 bg-slate-900 text-left shadow-2xl"
      :class="tone.ring" :title="'点击跳过'" @click="emit('skip')"
    >
      <!-- 插画位：缺省占位 -->
      <div class="relative flex h-36 items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
        <div class="flex h-[80%] w-[88%] flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/35 text-white/60">
          <span class="text-3xl">🖼</span>
          <span class="mt-1 text-xs">事件插画缺省 · {{ popup.art ?? '—' }}</span>
        </div>
        <span class="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-black" :class="tone.chip">{{ tone.label }}</span>
      </div>
      <div class="p-4">
        <div class="flex items-center gap-2">
          <span v-if="player" class="h-3 w-3 rounded-full" :style="{ backgroundColor: player.color }" />
          <span class="text-xl font-black text-slate-100">{{ popup.title }}</span>
        </div>
        <p class="mt-1.5 text-sm leading-relaxed text-slate-300">{{ popup.text }}</p>
      </div>
      <!-- 剩余停留时间 -->
      <div class="h-1 bg-slate-700"><div class="bar h-full" :class="tone.bar" :style="{ animationDuration: duration + 'ms' }" /></div>
    </button>
  </div>
</template>

<style scoped>
.event-pop { animation: pop-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both; }
@keyframes pop-in {
  from { opacity: 0; transform: translateY(24px) scale(0.9); }
  to   { opacity: 1; transform: none; }
}
.bar { animation-name: drain; animation-timing-function: linear; animation-fill-mode: both; }
@keyframes drain { from { width: 100%; } to { width: 0%; } }
@media (prefers-reduced-motion: reduce) { .event-pop { animation: none; } }
</style>
