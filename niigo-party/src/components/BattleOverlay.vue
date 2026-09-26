<script setup>
/**
 * BattleOverlay.vue —— 战斗结算（规格 §4：进战 → 战位层可交互 → 结算）
 * 进战插画占位：双方 chibi 贴片 + VS 分割（素材到位后替换为拼接插画）。
 */
import { computed } from 'vue';
import { CARDS } from '@/game/cards.js';

const props = defineProps({
  state: { type: Object, required: true },
});
const emit = defineEmits(['playBattle', 'confirm', 'defense', 'close']);

const b = computed(() => props.state.battle);
const attacker = computed(() => props.state.players.find((p) => p.id === b.value.attackerId));
const defender = computed(() => props.state.players.find((p) => p.id === b.value.defenderId));
const isAttackerTurn = computed(() => b.value.phase === 'attack_cards');
const actor = computed(() => (isAttackerTurn.value ? attacker.value : defender.value));
const hand = computed(() => actor.value?.hand ?? []);
const budget = computed(() => (isAttackerTurn.value ? b.value.atkSpent : b.value.defSpent));
const side = computed(() => (isAttackerTurn.value ? 'attack' : 'defense'));
const playable = computed(() => hand.value.filter((id) => {
  const c = CARDS[id];
  return c.kind === 'battle' && c.side === side.value && budget.value + c.cost <= 3;
}));
const rolls = computed(() => (isAttackerTurn.value ? b.value.atkCards : b.value.defCards));
const atk = computed(() => attacker.value);
const def = computed(() => defender.value);
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
    <div class="w-full max-w-3xl rounded-xl border border-red-500/40 bg-slate-900 p-5 shadow-2xl">
      <!-- 进战插画占位：攻守贴片 + VS -->
      <div class="flex items-stretch gap-0 overflow-hidden rounded-lg border border-slate-700">
        <div class="flex-1 bg-gradient-to-br from-red-900/60 to-slate-900 p-4 text-center">
          <img
            :src="`/assets/niigo/chibi_base/${atk.img}.png`"
            class="mx-auto h-20 w-20 rounded-lg object-contain" :alt="atk.name"
          />
          <div class="mt-2 text-sm font-semibold text-slate-100">{{ atk.name }}</div>
          <div class="text-[11px] text-slate-400">攻击方 · ATK {{ atk.atk }} · HP {{ atk.hp }}/{{ atk.maxHp }} · {{ atk.coins }} 币</div>
        </div>
        <div class="flex items-center bg-slate-800 px-4">
          <span class="text-3xl font-black text-red-400">VS</span>
        </div>
        <div class="flex-1 bg-gradient-to-bl from-sky-900/60 to-slate-900 p-4 text-center">
          <img
            :src="`/assets/niigo/chibi_base/${def.img}.png`"
            class="mx-auto h-20 w-20 rounded-lg object-contain" :alt="def.name"
          />
          <div class="mt-2 text-sm font-semibold text-slate-100">{{ def.name }}</div>
          <div class="text-[11px] text-slate-400">防守方 · DEF {{ def.def }} · HP {{ def.hp }}/{{ def.maxHp }} · {{ def.coins }} 币</div>
        </div>
      </div>

      <!-- 阶段一：攻方选战斗牌 -->
      <div v-if="b.phase === 'attack_cards'" class="mt-4">
        <div class="flex items-center justify-between text-sm text-slate-300">
          <span>{{ atk.name }}：打攻击牌（费用 ≤3）</span>
          <span class="text-yellow-300">已用 {{ budget }}/3 费</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="id in playable" :key="id" @click="emit('playBattle', id)"
            class="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/25"
          >{{ CARDS[id].name }}（{{ CARDS[id].min }}~{{ CARDS[id].max }}）</button>
          <span v-if="!playable.length" class="text-sm text-slate-500">没有可打的攻击牌</span>
        </div>
        <div v-if="rolls.length" class="mt-2 text-xs text-slate-400">
          已打：<span v-for="r in rolls" :key="r.id">{{ CARDS[r.id].name }}={{ r.value }} </span>
        </div>
        <button
          @click="emit('confirm')"
          class="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >出完了，进攻 →</button>
      </div>

      <!-- 阶段二：守方选战斗牌 -->
      <div v-else-if="b.phase === 'defense_cards'" class="mt-4">
        <div class="flex items-center justify-between text-sm text-slate-300">
          <span>{{ def.name }}：打防御牌（费用 ≤3）</span>
          <span class="text-yellow-300">已用 {{ budget }}/3 费</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="id in playable" :key="id" @click="emit('playBattle', id)"
            class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-500/25"
          >{{ CARDS[id].name }}（{{ CARDS[id].min }}~{{ CARDS[id].max }}）</button>
          <span v-if="!playable.length" class="text-sm text-slate-500">没有可打的防御牌</span>
        </div>
        <div v-if="rolls.length" class="mt-2 text-xs text-slate-400">
          已打：<span v-for="r in rolls" :key="r.id">{{ CARDS[r.id].name }}={{ r.value }} </span>
        </div>
        <button
          @click="emit('confirm')"
          class="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >出完了，准备防守 →</button>
      </div>

      <!-- 阶段三：守方选择防御 / 躲避 -->
      <div v-else-if="b.phase === 'defend_choice'" class="mt-4 text-center">
        <p class="text-sm text-slate-300">{{ def.name }}，选择应对方式：</p>
        <p class="mt-1 text-xs text-slate-500">
          防御 = 双方点数相减（伤害至少 1）；躲避 = 防骰&gt;攻骰或防骰=6 才成功，失败吃全额
        </p>
        <div class="mt-3 flex justify-center gap-3">
          <button @click="emit('defense', 'defend')" class="rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500">防御</button>
          <button @click="emit('defense', 'dodge')" class="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500">躲避</button>
        </div>
      </div>

      <!-- 结算 -->
      <div v-else-if="b.phase === 'done' && b.outcome" class="mt-4 text-center">
        <div class="text-sm text-slate-300">
          攻方掷 <span class="font-bold text-white">{{ b.outcome.dA }}</span> ·
          守方掷 <span class="font-bold text-white">{{ b.outcome.dD }}</span>
          <template v-if="b.outcome.mode !== 'dodge'">
            · 攻总 <span class="font-bold text-red-300">{{ b.outcome.atkTotal }}</span>
            vs 防总 <span class="font-bold text-sky-300">{{ b.outcome.defTotal }}</span>
          </template>
        </div>
        <div class="mt-2 text-2xl font-black" :class="b.outcome.dmg > 0 ? 'text-red-400' : 'text-emerald-400'">
          {{ b.outcome.dodged ? '闪避成功！' : `伤害 ${b.outcome.dmg}` }}
        </div>
        <div v-if="def.ko" class="mt-1 text-lg font-bold text-yellow-300">
          {{ def.name }} 被 KO！{{ atk.name }} 抢走一半星币，缺席一回合后复活
        </div>
        <button
          @click="emit('close')"
          class="mt-3 rounded-lg bg-slate-700 px-5 py-2 text-sm text-slate-100 hover:bg-slate-600"
        >继续（{{ b.afterLand ? '落地结算' : '走完剩余步数' }}）</button>
      </div>
    </div>
  </div>
</template>
