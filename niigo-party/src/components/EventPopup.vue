<script setup>
/**
 * EventPopup.vue —— 角色遭遇事件时的特写窗口
 * 左侧大头像（chibi 头部裁剪，角色色描边 + 调性辉光）+ 台词气泡（占位电子音朗读），
 * 右侧事件标题 / 正文 / 插画占位位。纯展示：不需要确认，停留时长由 store 控制；
 * 点一下可提前跳过。popup = { title, text, tone: 'good'|'bad'|'info', art, playerId, line }
 */
import { computed } from 'vue';

const props = defineProps({
  popup: { type: Object, required: true },
  player: { type: Object, default: null },
  duration: { type: Number, required: true }, // 毫秒，与 store 的自动轮播同步
});
const emit = defineEmits(['skip']);

const TONE = {
  good: { ring: 'border-emerald-300', chip: 'bg-emerald-400 text-slate-900', bar: 'bg-emerald-400', glow: '#34d399', label: '好事' },
  bad: { ring: 'border-red-400', chip: 'bg-red-500 text-white', bar: 'bg-red-400', glow: '#f87171', label: '坏事' },
  info: { ring: 'border-sky-300', chip: 'bg-sky-400 text-slate-900', bar: 'bg-sky-400', glow: '#38bdf8', label: '事件' },
};
const tone = computed(() => TONE[props.popup.tone] ?? TONE.info);
const accent = computed(() => props.player?.color ?? tone.value.glow);
const glow = computed(() => `0 0 26px ${tone.value.glow}66, 0 0 8px ${accent.value}99`);
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4" role="status" aria-live="polite">
    <button
      class="event-pop pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-2xl border-4 bg-slate-900 text-left shadow-2xl"
      :class="tone.ring" title="点击跳过" @click="emit('skip')"
    >
      <!-- 调性色晕染 -->
      <div class="absolute inset-0" :style="{ background: `linear-gradient(115deg, ${tone.glow}2e, transparent 55%)` }" />

      <div class="relative flex gap-4 p-4">
        <!-- 角色特写：大头像 -->
        <div class="flex w-28 shrink-0 flex-col items-center gap-1.5">
          <span
            class="relative h-24 w-24 overflow-hidden rounded-full border-4 shadow-lg"
            :style="{ borderColor: accent, backgroundColor: accent, boxShadow: glow }"
          >
            <img
              v-if="player"
              :src="`/assets/niigo/chibi_base/${player.img}.png`" alt=""
              class="absolute max-w-none bg-white" style="width: 244%; left: -69%; top: -12%;"
            />
            <span v-else class="absolute inset-0 flex items-center justify-center text-3xl">❓</span>
          </span>
          <span class="max-w-full truncate text-sm font-black text-slate-100">{{ player?.name ?? '' }}</span>
          <span class="rounded-full px-2 py-0.5 text-[10px] font-black" :class="tone.chip">{{ tone.label }}</span>
        </div>

        <!-- 台词气泡 + 事件内容 -->
        <div class="min-w-0 flex-1">
          <div
            v-if="popup.line"
            class="speech-bubble relative mb-2.5 rounded-xl bg-slate-800/95 px-3.5 py-2 shadow"
            title="语音为合成电子音占位，真声素材就位后替换"
          >
            <p class="text-sm font-bold leading-snug text-slate-100">「{{ popup.line }}」</p>
            <p class="mt-0.5 text-right text-[10px] text-slate-500">🔊 合成电子音 · 占位</p>
          </div>
          <p class="text-lg font-black leading-tight text-slate-100">{{ popup.title }}</p>
          <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ popup.text }}</p>
          <!-- 插画位：缺省占位（缩小放右下，等事件插画素材） -->
          <div class="mt-2.5 flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-white/50">
            <span class="text-xs">事件插画缺省 · {{ popup.art ?? '—' }}</span>
          </div>
        </div>
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
.speech-bubble::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 18px;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 8px solid rgb(30 41 59 / 0.95);
}
@media (prefers-reduced-motion: reduce) { .event-pop { animation: none; } }
</style>
