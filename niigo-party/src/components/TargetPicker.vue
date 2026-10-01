<script setup>
/**
 * TargetPicker.vue —— 指向对手的效果牌选目标：头像大按钮
 * 头像用 chibi 基底 1024² 取头部（裁剪参数与 PlayerCard 一致），
 * 悬停浮起、角色色描边。单目标时 GameScreen 直接打出，不会进到这里。
 */
defineProps({
  cardName: { type: String, required: true },
  targets: { type: Array, required: true }, // 玩家对象（引擎校验同一口径筛出的合法目标）
});
const emit = defineEmits(['select', 'cancel']);
</script>

<template>
  <div
    class="pointer-events-auto rounded-2xl border border-white/15 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md"
    role="dialog" aria-label="选择目标"
  >
    <div class="mb-2 flex items-center justify-between gap-6">
      <p class="text-xs font-bold text-slate-200">「{{ cardName }}」选择目标</p>
      <button class="text-[11px] text-slate-400 underline hover:text-slate-200" @click="emit('cancel')">取消</button>
    </div>
    <div class="flex justify-center gap-3">
      <button
        v-for="t in targets" :key="t.id"
        class="group flex w-24 flex-col items-center gap-1 rounded-xl border-2 border-white/10 bg-slate-800/60 px-2 py-2.5 transition hover:-translate-y-1 hover:bg-slate-700/70 focus-visible:outline-2 focus-visible:outline-yellow-300"
        :aria-label="`指定 ${t.name}（${t.tile} 号格）`"
        @click="emit('select', t.id)"
      >
        <span
          class="relative h-14 w-14 overflow-hidden rounded-full border-2 shadow-md transition group-hover:border-yellow-300"
          :style="{ borderColor: t.color, backgroundColor: t.color }"
        >
          <img
            :src="`/assets/niigo/chibi_base/${t.img}.png`" alt=""
            class="absolute max-w-none bg-white" style="width: 244%; left: -69%; top: -12%;"
          />
        </span>
        <span class="max-w-full truncate text-xs font-bold text-slate-100">{{ t.name }}</span>
        <span class="text-[10px] text-slate-400">{{ t.tile }} 号格 · 🪙{{ t.coins }} · HP{{ t.hp }}</span>
      </button>
    </div>
  </div>
</template>
