<script setup>
/** SetupScreen.vue —— 开局：热座选角（2~4 人，选素材键即选人） */
import { ref } from 'vue';
import { useGameStore } from '@/stores/game.js';
import { CHARACTERS } from '@/game/characters.js';

const store = useGameStore();
const names = ref({});
const seatNames = ref([]);
const editing = ref(false);

function confirmSeats() {
  seatNames.value = store.picked.map((k, i) => names.value[k] || CHARACTERS[k].name);
  editing.value = false;
  store.start(seatNames.value);
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-200">
    <div class="mx-auto max-w-3xl px-6 py-10">
      <h1 class="text-3xl font-black text-slate-100">niigo-party <span class="text-sm font-normal text-slate-500">M0 热座版</span></h1>
      <p class="mt-2 text-sm text-slate-400">
        25時、ナイトコードで。四人回合制派对游戏 · 68 格互穿棋盘 · 图版层复刻星引擎
      </p>

      <div class="mt-8 flex items-center justify-between">
        <h2 class="text-lg font-bold">选人（{{ store.picked.length }}/4）</h2>
        <span class="text-xs text-slate-500">同一素材键只能选一次；mfy 两形态算两个候选</span>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button
          v-for="(c, key) in CHARACTERS" :key="key"
          class="rounded-xl border p-4 text-left transition-all"
          :class="store.picked.includes(key)
            ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400/50'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'"
          :disabled="!store.picked.includes(key) && store.picked.length >= 4"
          @click="store.togglePick(key)"
        >
          <img
            :src="`/assets/niigo/chibi_base/${c.img}.png`"
            :alt="c.name" class="mx-auto h-24 w-24 rounded-lg object-contain"
            :style="{ backgroundColor: c.color + '33' }"
          />
          <div class="mt-3 text-sm font-semibold text-slate-100">{{ c.name }}</div>
          <div class="mt-1 text-[11px] text-slate-400">
            HP {{ c.hp }} · ATK {{ c.atk }} · DEF {{ c.def }}
          </div>
          <div class="text-[11px] text-slate-500">{{ c.trait }}</div>
        </button>
      </div>

      <!-- 座位名 -->
      <div v-if="store.picked.length >= 2" class="mt-8">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-slate-300">座位与昵称（可留空用默认名）</h3>
          <button class="text-xs text-slate-500 underline" @click="editing = !editing">
            {{ editing ? '收起' : '编辑' }}
          </button>
        </div>
        <div v-if="editing" class="mt-3 space-y-2">
          <div v-for="(k, i) in store.picked" :key="k" class="flex items-center gap-3">
            <span class="w-14 text-xs text-slate-500">座位 {{ i + 1 }}</span>
            <input
              v-model="names[k]"
              :placeholder="CHARACTERS[k].name"
              class="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400"
            />
            <span class="w-40 text-xs text-slate-500">{{ CHARACTERS[k].name }}</span>
          </div>
        </div>
      </div>

      <button
        :disabled="store.picked.length < 2"
        class="mt-8 w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-black text-slate-900 hover:bg-amber-400 disabled:opacity-40"
        @click="confirmSeats"
      >
        {{ store.picked.length < 2 ? `至少选 ${2} 人（热座 2~4 人）` : `开始对局（${store.picked.length} 人）` }}
      </button>

      <p class="mt-6 text-[11px] leading-relaxed text-slate-600">
        M0 范围：掷骰移动（1d10）· 交点切环 · 传送门 · 地块结算 · 战斗（攻防骰 + 3 费战斗牌）·
        KO 抢一半 · 商店 · 升级到 Lv4 分出胜负。联机与人机为后续里程碑。
      </p>
    </div>
  </div>
</template>
