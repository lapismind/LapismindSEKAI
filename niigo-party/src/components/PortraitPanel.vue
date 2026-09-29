<script setup>
/**
 * PortraitPanel.vue —— 左下角当前玩家立绘（缺省时用 chibi 占位）+ 主动技能释放标
 * 点立绘：弹出技能信息（主动 / 被动 + 基础数值）。
 * 技能结算尚未实装（规格 §5.3 待技能设计轮），释放标先做成可见但提示"未实装"。
 */
import { computed, ref } from 'vue';
import { CHARACTERS } from '@/game/characters.js';

const props = defineProps({
  player: { type: Object, required: true },
  canAct: { type: Boolean, default: false },
});
const emit = defineEmits(['useSkill']);

const ch = computed(() => CHARACTERS[props.player.charKey]);
const art = computed(() => (ch.value.portrait
  ? `/assets/niigo/portrait/${ch.value.portrait}.png`
  : `/assets/niigo/chibi_base/${props.player.img}.png`));
const showInfo = ref(false);
</script>

<template>
  <div class="relative">
    <button
      class="group relative block h-64 w-48 overflow-hidden rounded-2xl border-2 border-white/80 shadow-2xl focus-visible:outline-3 focus-visible:outline-yellow-300"
      :style="{ background: `linear-gradient(180deg, ${player.color}55, #0f172aee 85%)` }"
      :aria-label="`查看 ${player.name} 的技能`"
      @click="showInfo = true"
    >
      <!-- chibi 基底是白底 RGB：multiply 让白底融进背景 -->
      <img :src="art" alt="" class="absolute inset-x-0 -bottom-2 mx-auto h-[118%] max-w-none object-contain mix-blend-multiply transition-transform group-hover:scale-105"
           :style="player.ko ? 'filter: grayscale(1) brightness(0.6)' : ''" />
      <span v-if="!ch.portrait" class="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80">立绘缺省</span>
      <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent px-3 pb-2 pt-6 text-left">
        <span class="block text-sm font-black text-white">{{ player.name }}</span>
        <span class="block text-[11px] text-slate-300">点击查看技能</span>
      </span>
    </button>

    <!-- 主动技能释放标：立绘右下 -->
    <button
      class="absolute -right-10 bottom-3 flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-400 to-fuchsia-600 text-white shadow-xl transition-transform hover:scale-110 focus-visible:outline-3 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      :disabled="!canAct"
      :title="`主动技能「${ch.skills.active.name}」：${ch.skills.active.desc}`"
      :aria-label="`释放主动技能 ${ch.skills.active.name}`"
      @click="emit('useSkill')"
    >
      <span class="text-xl leading-none">✦</span>
      <span class="mt-0.5 max-w-14 truncate text-[9px] font-bold">{{ ch.skills.active.name }}</span>
    </button>

    <!-- 技能信息 -->
    <div v-if="showInfo" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="showInfo = false">
      <div class="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl" role="dialog" :aria-label="`${player.name} 的技能`">
        <div class="flex items-center gap-3">
          <div class="h-14 w-14 overflow-hidden rounded-full border-2 border-white" :style="{ backgroundColor: player.color }">
            <img :src="`/assets/niigo/chibi_base/${player.img}.png`" alt="" class="relative max-w-none bg-white" style="width: 244%; left: -69%; top: -12%;" />
          </div>
          <div>
            <div class="text-lg font-black text-slate-100">{{ player.name }}</div>
            <div class="text-xs text-slate-400">HP {{ ch.hp }} · ATK {{ ch.atk }} · DEF {{ ch.def }} · {{ ch.trait }}</div>
          </div>
        </div>
        <div class="mt-4 space-y-2">
          <div class="rounded-xl border border-violet-400/40 bg-violet-500/10 p-3">
            <div class="text-[11px] font-bold text-violet-300">主动技能</div>
            <div class="text-base font-black text-slate-100">{{ ch.skills.active.name }}</div>
            <div class="text-sm text-slate-300">{{ ch.skills.active.desc }}</div>
          </div>
          <div class="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
            <div class="text-[11px] font-bold text-slate-400">被动技能</div>
            <div class="text-base font-black text-slate-100">{{ ch.skills.passive.name }}</div>
            <div class="text-sm text-slate-300">{{ ch.skills.passive.desc }}</div>
          </div>
        </div>
        <p class="mt-3 text-[11px] text-slate-500">技能结算待技能设计轮实装（规格 §5.3），目前只做展示。</p>
        <button class="mt-4 w-full rounded-lg bg-slate-700 py-2 text-sm text-slate-100 hover:bg-slate-600" @click="showInfo = false">关闭</button>
      </div>
    </div>
  </div>
</template>
