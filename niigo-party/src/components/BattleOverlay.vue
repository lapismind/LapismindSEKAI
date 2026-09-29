<script setup>
/**
 * BattleOverlay.vue —— 游戏内战斗大窗口（遭遇 → 进战过场 → 战位层）
 *
 * 1. 遭遇：路过/落到对手格，弹对手的受击（防守）插画 → 攻方选「战斗 / 放过」
 * 2. 过场：进攻插画从左侧入场，把受击插画挤到右边（方案 A「VS 斜分屏」，规格 §4.6）
 * 3. 战位层：双方 chibi 面对面，头顶红圈（攻）/ 蓝圈（守）
 *    玩家只做两类决定：选战斗牌（双方同时、互相可见、选定即消耗；攻 9 秒 / 守 10 秒，超时按已选锁定；
 *    没牌可选自动锁定）、防御 / 躲避（10 秒，超时默认防御）。
 *    掷 D6、掷战斗牌、结算、收尾回地图全部由 store 按节奏自动推进（battleTick）：
 *    攻骰 → 红圈出现（骰点）；防骰 → 蓝圈出现（骰点，躲避只比 D6）；掷牌 → 圈增长为实际数值。
 * 插画素材未到位：全部为缺省占位（按玩家色 + chibi）。
 */
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { CARDS } from '@/game/cards.js';
import { battleTotals } from '@/game/engine.js';

const props = defineProps({
  state: { type: Object, required: true },
});
const emit = defineEmits(['accept', 'decline', 'select', 'lock', 'defense', 'ready']);

const TIME = { atk: 9, def: 10, choice: 10 }; // 秒（规格 §4.5）
const INTRO_MS = 1500;

const b = computed(() => props.state.battle);
const offer = computed(() => (props.state.pending?.type === 'battleOffer' ? props.state.pending : null));
const byId = (id) => props.state.players.find((p) => p.id === id);
const attacker = computed(() => byId(b.value?.attackerId) ?? props.state.players[props.state.current]);
const defender = computed(() => byId(b.value?.defenderId ?? offer.value?.defenderId));
const totals = computed(() => battleTotals(props.state));
const hpLow = (p) => p.hp / p.maxHp < 0.5;

// ── 过场：遭遇 → 斜分屏 → 战位层 ──
const split = ref(!!b.value);   // 进攻插画已入场
const intro = ref(false);       // 过场进行中（战位层未出现）
let introTimer = null;
watch(() => !!b.value, (on, was) => {
  if (on && !was) {
    split.value = true;
    intro.value = true;
    introTimer = setTimeout(() => { intro.value = false; startSelectTimers(); emit('ready'); }, INTRO_MS);
  }
});

// ── 限时 ──
const now = ref(Date.now());
const deadline = reactive({ atk: null, def: null, choice: null });
const ticker = setInterval(() => { now.value = Date.now(); }, 200);
onUnmounted(() => { clearInterval(ticker); clearTimeout(introTimer); });
function startSelectTimers() {
  if (b.value?.phase !== 'select') return;
  deadline.atk = Date.now() + TIME.atk * 1000;
  deadline.def = Date.now() + TIME.def * 1000;
}
if (b.value) { startSelectTimers(); emit('ready'); } // F5 恢复：跳过过场，直接计时 / 自动步进
watch(() => b.value?.phase, (ph) => {
  if (ph === 'def_choice') deadline.choice = Date.now() + TIME.choice * 1000;
});
const secLeft = (k) => (deadline[k] == null ? null : Math.max(0, Math.ceil((deadline[k] - now.value) / 1000)));
watch(now, () => {
  const bb = b.value;
  if (!bb || intro.value) return;
  if (bb.phase === 'select') {
    for (const side of ['atk', 'def']) {
      if (!bb[side].locked && deadline[side] != null && now.value >= deadline[side]) emit('lock', side);
    }
  } else if (bb.phase === 'def_choice' && deadline.choice != null && now.value >= deadline.choice) {
    emit('defense', 'defend');
  }
});

// ── 选牌 ──
const SIDE_KIND = { atk: 'attack', def: 'defense' };
const sidePlayer = (side) => (side === 'atk' ? attacker.value : defender.value);
function options(side) {
  const bb = b.value;
  if (!bb || bb.phase !== 'select' || bb[side].locked) return [];
  const seen = new Set();
  return sidePlayer(side).hand.filter((id) => {
    const c = CARDS[id];
    if (c.kind !== 'battle' || c.side !== SIDE_KIND[side] || bb[side].spent + c.cost > 3 || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
const countInHand = (side, id) => sidePlayer(side).hand.filter((x) => x === id).length;

// ── 阶段提示 ──
const hint = computed(() => {
  const bb = b.value;
  if (!bb) return '';
  const A = attacker.value.name, D = defender.value.name;
  return {
    select: '双方同时选战斗牌：选定即消耗、不能撤回，双方都能看到',
    atk_d6: `${A} 掷攻骰…`,
    def_choice: `${D} 看过攻骰，选择 防御 或 躲避`,
    def_d6: bb.mode === 'dodge' ? `${D} 躲避：防骰需要 > ${bb.atk.d6} 或掷出 6…` : `${D} 掷防骰…`,
    card_roll: bb.mode === 'dodge' ? `躲避失败！${A} 掷攻击牌，${D} 吃满伤害` : '双方掷战斗牌…',
    done: '',
  }[bb.phase];
});
const outcomeText = computed(() => {
  const o = b.value?.outcome;
  if (!o) return null;
  if (o.dodged) return { big: '闪避成功！', cls: 'text-emerald-500' };
  return { big: `伤害 ${o.dmg}`, cls: 'text-red-500' };
});
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[2px]">
    <div class="battle-win w-full max-w-5xl overflow-hidden rounded-3xl border-4 border-white/90 bg-slate-900 shadow-2xl" role="dialog" aria-label="战斗">

      <!-- ── 插画层：遭遇时只有受击插画；进战后进攻插画入场把它挤到右边 ── -->
      <div class="illu relative overflow-hidden bg-slate-800" :class="b && !intro ? 'h-24' : 'h-80'">
        <!-- 受击（防守）插画 -->
        <div class="illu-def absolute inset-0" :class="{ split }"
             :style="{ background: `linear-gradient(135deg, #e0f2fe, ${defender.color})` }">
          <div class="absolute inset-y-0 right-0 flex w-full items-center justify-center" :class="{ 'split-shift': split }">
            <img :src="`/assets/niigo/chibi_base/${defender.img}.png`" alt=""
                 class="h-[135%] max-w-none -scale-x-100 object-contain mix-blend-multiply" />
          </div>
          <span class="absolute bottom-3 right-4 rounded bg-black/45 px-2 py-0.5 text-[11px] text-white/85">
            受击插画缺省 · {{ defender.name }}（{{ hpLow(defender) ? '濒危' : '健康' }}版）
          </span>
        </div>
        <!-- 进攻插画 -->
        <div class="illu-atk absolute inset-0" :class="{ split }"
             :style="{ background: `linear-gradient(225deg, #ffe4e6, ${attacker.color})` }">
          <div class="absolute inset-y-0 left-0 flex w-[62%] items-center justify-center">
            <img :src="`/assets/niigo/chibi_base/${attacker.img}.png`" alt=""
                 class="h-[135%] max-w-none object-contain mix-blend-multiply" />
          </div>
          <span class="absolute bottom-3 left-4 rounded bg-black/45 px-2 py-0.5 text-[11px] text-white/85">进攻插画缺省 · {{ attacker.name }}</span>
        </div>
        <!-- 分割线 + VS -->
        <div v-if="split" class="vs-line pointer-events-none absolute inset-0">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
            <line x1="62" y1="0" x2="38" y2="100" stroke="#fff" stroke-width="1.2" vector-effect="non-scaling-stroke" style="stroke-width: 6px" />
          </svg>
          <span class="vs-badge absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-slate-900 px-4 py-1 text-4xl font-black italic text-yellow-300 ring-4 ring-white">VS</span>
        </div>
      </div>

      <!-- ── 遭遇：战斗 / 放过 ── -->
      <div v-if="offer && !b" class="p-5 text-center">
        <p class="text-2xl font-black text-slate-100">遭遇 {{ defender.name }}！</p>
        <p class="mt-1 text-sm text-slate-400">
          {{ defender.name }} · HP {{ defender.hp }}/{{ defender.maxHp }} · DEF {{ defender.def }} · {{ defender.coins }} 币
          ——战斗胜利不掉币；把对方打 KO 可抢走其一半星币
        </p>
        <div class="mt-4 flex justify-center gap-3">
          <button class="rounded-xl bg-red-600 px-8 py-3 text-base font-black text-white hover:bg-red-500" @click="emit('accept')">⚔ 发起进攻</button>
          <button class="rounded-xl bg-slate-700 px-8 py-3 text-base text-slate-200 hover:bg-slate-600" @click="emit('decline')">放过</button>
        </div>
      </div>

      <!-- ── 过场中 ── -->
      <div v-else-if="b && intro" class="p-5 text-center">
        <p class="intro-text text-2xl font-black text-yellow-300">进 战！</p>
      </div>

      <!-- ── 战位层 ── -->
      <div v-else-if="b" class="grid grid-cols-[15rem_1fr_15rem] gap-3 p-4">
        <!-- 攻方选牌 -->
        <section v-for="side in ['atk']" :key="side" class="rounded-2xl border-2 border-red-400/60 bg-red-500/10 p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-black text-red-300">进攻 · {{ attacker.name }}</span>
            <span v-if="b.phase === 'select' && !b.atk.locked && secLeft('atk') != null"
                  class="rounded-full bg-red-500 px-2 text-xs font-black tabular-nums text-white">{{ secLeft('atk') }}s</span>
            <span v-else-if="b.atk.locked && b.phase === 'select'" class="text-[11px] text-red-200">已锁定 · 等对方</span>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">已用 {{ b.atk.spent }}/3 费</p>
          <div class="mt-2 flex min-h-8 flex-wrap gap-1.5">
            <span v-for="(c, k) in b.atk.cards" :key="k" class="rounded-lg border border-red-300 bg-red-500/30 px-2 py-1 text-xs font-bold text-red-50">
              {{ CARDS[c.id].name }}<template v-if="c.value != null"> = {{ c.value }}</template><template v-else>（{{ CARDS[c.id].min }}~{{ CARDS[c.id].max }}）</template>
            </span>
            <span v-if="!b.atk.cards.length" class="text-xs text-slate-500">未选牌</span>
          </div>
          <template v-if="b.phase === 'select' && !b.atk.locked">
            <div class="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              <button v-for="id in options('atk')" :key="id"
                      class="rounded-lg border border-red-400/60 bg-slate-800 px-2 py-1 text-xs text-red-100 hover:bg-red-500/30"
                      @click="emit('select', 'atk', id)">{{ CARDS[id].name }}<span class="text-slate-400"> ×{{ countInHand('atk', id) }}</span></button>
              <span v-if="!options('atk').length" class="text-xs text-slate-500">没有可选的攻击牌</span>
            </div>
            <button class="mt-2 w-full rounded-lg bg-red-600 py-1.5 text-sm font-bold text-white hover:bg-red-500" @click="emit('lock', 'atk')">{{ b.atk.cards.length ? '就这些' : '不出牌' }}</button>
          </template>
        </section>

        <!-- 战位：两人面对面 + 头顶圈 -->
        <section class="stage relative flex min-h-[22rem] flex-col items-center justify-end overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-rose-50 to-amber-100 px-4 pb-3">
          <p v-if="hint" class="absolute inset-x-3 top-3 z-10 rounded-lg bg-slate-900/80 px-3 py-1.5 text-center text-sm font-bold text-slate-100">{{ hint }}</p>

          <div class="relative flex w-full items-end justify-around">
            <!-- 攻方 -->
            <div class="relative flex flex-col items-center">
              <div class="absolute -top-24 flex flex-col items-center">
                <div v-if="totals.red" :key="'r' + totals.red.value" class="ring-pop flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-500 text-3xl font-black text-white shadow-lg">{{ totals.red.value }}</div>
                <div v-if="totals.red" class="mt-1 whitespace-nowrap rounded bg-white/80 px-1.5 text-[10px] font-bold text-red-700">{{ totals.red.parts.map((p) => `${p[0]} ${p[1]}`).join(' + ') }}</div>
              </div>
              <img :src="`/assets/niigo/chibi_base/${attacker.img}.png`" alt="" class="h-40 object-contain mix-blend-multiply" />
              <div class="w-24"><div class="h-1.5 overflow-hidden rounded bg-slate-300"><div class="h-full bg-emerald-500" :style="{ width: attacker.hp / attacker.maxHp * 100 + '%' }" /></div>
                <p class="text-center text-[11px] font-bold text-slate-700">HP {{ attacker.hp }} · ATK {{ attacker.atk }}</p></div>
            </div>
            <!-- 守方（镜像朝左） -->
            <div class="relative flex flex-col items-center" :class="{ 'hit-shake': b.phase === 'done' && b.outcome?.dmg > 0 }">
              <div class="absolute -top-24 flex flex-col items-center">
                <div v-if="totals.blue" :key="'b' + totals.blue.value" class="ring-pop flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-sky-500 text-3xl font-black text-white shadow-lg">{{ totals.blue.value }}</div>
                <div v-if="totals.blue" class="mt-1 whitespace-nowrap rounded bg-white/80 px-1.5 text-[10px] font-bold text-sky-700">{{ totals.blue.parts.map((p) => `${p[0]} ${p[1]}`).join(' + ') }}</div>
              </div>
              <img :src="`/assets/niigo/chibi_base/${defender.img}.png`" alt="" class="h-40 -scale-x-100 object-contain mix-blend-multiply"
                   :style="defender.ko ? 'filter: grayscale(1)' : ''" />
              <div class="w-24"><div class="h-1.5 overflow-hidden rounded bg-slate-300"><div class="h-full transition-all" :class="hpLow(defender) ? 'bg-red-500' : 'bg-emerald-500'" :style="{ width: defender.hp / defender.maxHp * 100 + '%' }" /></div>
                <p class="text-center text-[11px] font-bold text-slate-700">HP {{ defender.hp }} · DEF {{ defender.def }}</p></div>
              <span v-if="b.mode" class="absolute -right-2 top-4 rounded-full px-2 py-0.5 text-[11px] font-black"
                    :class="b.mode === 'dodge' ? 'bg-emerald-500 text-white' : 'bg-sky-600 text-white'">{{ b.mode === 'dodge' ? '躲避' : '防御' }}</span>
            </div>
          </div>

          <!-- 结算 -->
          <div v-if="b.phase === 'done' && outcomeText" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p class="outcome-pop text-6xl font-black drop-shadow-[0_4px_0_rgba(255,255,255,0.9)]" :class="outcomeText.cls">{{ outcomeText.big }}</p>
            <p v-if="defender.ko" class="mt-2 rounded-lg bg-slate-900/85 px-3 py-1 text-sm font-bold text-yellow-300">{{ defender.name }} 被 KO！{{ attacker.name }} 抢走一半星币</p>
          </div>
        </section>

        <!-- 守方选牌 / 应对 -->
        <section class="rounded-2xl border-2 border-sky-400/60 bg-sky-500/10 p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-black text-sky-300">防守 · {{ defender.name }}</span>
            <span v-if="b.phase === 'select' && !b.def.locked && secLeft('def') != null"
                  class="rounded-full bg-sky-500 px-2 text-xs font-black tabular-nums text-white">{{ secLeft('def') }}s</span>
            <span v-else-if="b.phase === 'def_choice' && secLeft('choice') != null"
                  class="rounded-full bg-sky-500 px-2 text-xs font-black tabular-nums text-white">{{ secLeft('choice') }}s</span>
            <span v-else-if="b.def.locked && b.phase === 'select'" class="text-[11px] text-sky-200">已锁定 · 等对方</span>
          </div>
          <p class="mt-1 text-[11px] text-slate-400">已用 {{ b.def.spent }}/3 费<template v-if="b.mode === 'dodge'"> · 躲避：防御牌不生效</template></p>
          <div class="mt-2 flex min-h-8 flex-wrap gap-1.5">
            <span v-for="(c, k) in b.def.cards" :key="k" class="rounded-lg border border-sky-300 px-2 py-1 text-xs font-bold"
                  :class="b.mode === 'dodge' ? 'bg-slate-700 text-slate-400 line-through' : 'bg-sky-500/30 text-sky-50'">
              {{ CARDS[c.id].name }}<template v-if="c.value != null"> = {{ c.value }}</template><template v-else>（{{ CARDS[c.id].min }}~{{ CARDS[c.id].max }}）</template>
            </span>
            <span v-if="!b.def.cards.length" class="text-xs text-slate-500">未选牌</span>
          </div>
          <template v-if="b.phase === 'select' && !b.def.locked">
            <div class="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
              <button v-for="id in options('def')" :key="id"
                      class="rounded-lg border border-sky-400/60 bg-slate-800 px-2 py-1 text-xs text-sky-100 hover:bg-sky-500/30"
                      @click="emit('select', 'def', id)">{{ CARDS[id].name }}<span class="text-slate-400"> ×{{ countInHand('def', id) }}</span></button>
              <span v-if="!options('def').length" class="text-xs text-slate-500">没有可选的防御牌</span>
            </div>
            <button class="mt-2 w-full rounded-lg bg-sky-600 py-1.5 text-sm font-bold text-white hover:bg-sky-500" @click="emit('lock', 'def')">{{ b.def.cards.length ? '就这些' : '不出牌' }}</button>
          </template>
          <div v-if="b.phase === 'def_choice'" class="mt-3 grid grid-cols-2 gap-2">
            <button class="rounded-xl bg-sky-600 py-2.5 text-sm font-black text-white hover:bg-sky-500" title="伤害 = 攻总 − 防总（最小 1）" @click="emit('defense', 'defend')">🛡 防御</button>
            <button class="rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white hover:bg-emerald-500" :title="`防骰 > ${b.atk.d6} 或掷出 6 才躲开，失败吃满伤害`" @click="emit('defense', 'dodge')">💨 躲避</button>
            <p class="col-span-2 text-[11px] leading-snug text-slate-400">防御：双方再掷战斗牌，伤害 = 攻总 − 防总（最少 1）。躲避：防骰 &gt; {{ b.atk.d6 }} 或 = 6 就躲开；失败吃满攻击。超时默认防御。</p>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<style scoped>
.battle-win { animation: win-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
@keyframes win-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }

.illu { transition: height 500ms ease; }
/* 进攻插画：从左侧入场，占左侧斜分区 */
.illu-atk { clip-path: polygon(0 0, 62% 0, 38% 100%, 0 100%); transform: translateX(-110%); transition: transform 700ms cubic-bezier(0.2, 0.9, 0.3, 1.1); }
.illu-atk.split { transform: none; }
/* 受击插画：原本铺满，被挤到右侧斜分区 */
.illu-def { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); transition: clip-path 700ms cubic-bezier(0.2, 0.9, 0.3, 1.1); }
.illu-def.split { clip-path: polygon(62% 0, 100% 0, 100% 100%, 38% 100%); }
.split-shift { transform: translateX(26%); transition: transform 700ms cubic-bezier(0.2, 0.9, 0.3, 1.1); }
.vs-badge { animation: vs-pop 500ms 500ms cubic-bezier(0.2, 0.9, 0.3, 1.6) both; }
@keyframes vs-pop { from { opacity: 0; transform: translate(-50%, -50%) scale(2.4) rotate(-12deg); } to { opacity: 1; transform: translate(-50%, -50%); } }
.intro-text { animation: vs-pop2 700ms ease-out both; letter-spacing: 0.5em; }
@keyframes vs-pop2 { from { opacity: 0; letter-spacing: 1.5em; } to { opacity: 1; letter-spacing: 0.5em; } }

.ring-pop { animation: ring-pop 420ms cubic-bezier(0.2, 0.9, 0.3, 1.6) both; }
@keyframes ring-pop { from { transform: scale(0.3); opacity: 0; } to { transform: none; opacity: 1; } }
.outcome-pop { animation: ring-pop 500ms cubic-bezier(0.2, 0.9, 0.3, 1.6) both; }
.hit-shake { animation: shake 420ms ease-in-out 2; }
@keyframes shake { 0%, 100% { transform: none; } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }

@media (prefers-reduced-motion: reduce) {
  .battle-win, .vs-badge, .intro-text, .ring-pop, .outcome-pop, .hit-shake { animation: none; }
  .illu, .illu-atk, .illu-def, .split-shift { transition: none; }
}
</style>
