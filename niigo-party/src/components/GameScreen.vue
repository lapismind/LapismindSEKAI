<script setup>
/**
 * GameScreen.vue —— 热座对局主界面：棋盘 + 玩家面板 + 回合操作 + 各弹窗
 */
import { computed, ref } from 'vue';
import { useGameStore } from '@/stores/game.js';
import { TILES, directedDistance, TILE_LABEL } from '@/game/board.js';
import { CARDS, CARD_IDS } from '@/game/cards.js';
import BoardMap from '@/components/BoardMap.vue';
import PlayerCard from '@/components/PlayerCard.vue';
import BattleOverlay from '@/components/BattleOverlay.vue';

const store = useGameStore();
const s = computed(() => store.s);
const cur = computed(() => store.current);

// ── 行动阶段：手牌与效果牌指向 ──
const selectedCard = ref(null); // {id, need: 'opponent'|'tile'}
const targets = computed(() =>
  s.value ? s.value.players.filter((p) => p.id !== cur.value.id && !p.ko) : []);
const rangeTiles = computed(() => {
  if (!s.value || selectedCard.value?.need !== 'tile') return [];
  const card = CARDS[selectedCard.value.id];
  return TILES
    .filter((t) => t.i !== cur.value.tile
      && directedDistance(cur.value.tile, t.i) <= card.range
      && !s.value.overlays.some((o) => o.tile === t.i))
    .map((t) => t.i);
});
const shopStock = computed(() => s.value?.pending?.type === 'shop' ? s.value.pending.stock : []);

function clickHandCard(id) {
  const card = CARDS[id];
  if (card.kind === 'effect') {
    if (cur.value.effectPlayed) return;
    if (card.target === 'opponent') { selectedCard.value = { id, need: 'opponent' }; return; }
    if (card.target === 'tile') { selectedCard.value = { id, need: 'tile' }; return; }
    store.playCard(id, {});
  } else if (card.kind === 'counter') {
    store.playCard(id, {});
  }
  selectedCard.value = null;
}
function confirmTarget(targetId) {
  store.playCard(selectedCard.value.id, { targetId });
  selectedCard.value = null;
}
function confirmTile(tileIdx) {
  store.playCard(selectedCard.value.id, { tileIdx });
  selectedCard.value = null;
}
const cardName = (id) => CARDS[id]?.name ?? id;

// ── 遥控骰子选点 ──
const rollChoices = Array.from({ length: 10 }, (_, i) => i + 1);

// ── 特效横幅 ──
const fxText = computed(() => {
  const f = store.lastFx;
  if (!f || f.consumed) return null;
  const p = s.value.players.find((x) => x.id === f.playerId);
  return { p, text: { ko: `${p?.name ?? ''} 被 KO！`, revive: `${p?.name ?? ''} 复活！`, teleport: '传送门跃迁！', levelup: `${p?.name ?? ''} 升级！` }[f.type] ?? '' };
});
</script>

<template>
  <div v-if="s" class="min-h-screen bg-slate-950 text-slate-200">
    <!-- 顶部回合条 -->
    <header class="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3">
      <div class="flex items-center gap-3">
        <img
          :src="`/assets/niigo/chibi_base/${cur.img}.png`"
          class="h-10 w-10 rounded-full object-contain" :style="{ backgroundColor: cur.color + '55' }" alt=""
        />
        <div>
          <div class="text-sm text-slate-400">第 {{ s.round }} 轮 · 行动中</div>
          <div class="text-lg font-bold" :style="{ color: cur.color }">{{ cur.name }}</div>
        </div>
      </div>
      <div class="text-right text-xs text-slate-500">
        <div>68 格 · 双矩形 45° 互穿 · 热座 M0</div>
        <div>移动骰 1d10 · 战斗骰 1d6 · 升级 {{ [15, 25, 35, 45][cur.level] }} 币</div>
      </div>
    </header>

    <div class="flex flex-col gap-4 p-4 lg:flex-row">
      <!-- 棋盘 -->
      <div class="relative min-h-[420px] flex-1 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
        <BoardMap :state="s" />

        <!-- 特效横幅 -->
        <transition name="fade">
          <div
            v-if="fxText"
            class="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              class="rounded-xl px-8 py-4 text-3xl font-black shadow-2xl"
              :class="{
                'bg-red-600/90 text-white': store.lastFx.type === 'ko',
                'bg-amber-300/90 text-slate-900': store.lastFx.type === 'revive',
                'bg-violet-500/90 text-white': store.lastFx.type === 'teleport',
                'bg-emerald-400/90 text-slate-900': store.lastFx.type === 'levelup',
              }"
            >{{ fxText.text }}</div>
          </div>
        </transition>
      </div>

      <!-- 侧栏 -->
      <aside class="flex w-full flex-col gap-3 lg:w-96">
        <!-- 玩家列表 -->
        <PlayerCard
          v-for="p in s.players" :key="p.id" :player="p"
          :is-current="p.id === cur.id"
        />

        <!-- 回合操作 -->
        <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <!-- 等待掷骰 -->
          <template v-if="s.phase === 'roll' && !s.pending">
            <p class="text-sm text-slate-400">{{ cur.name }} 掷移动骰（1d10）</p>
            <button
              :disabled="!store.canRoll || store.moving"
              class="mt-2 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-base font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
              @click="store.roll()"
            >🎲 掷骰移动</button>
          </template>

          <!-- 遥控骰子：自选点数 -->
          <template v-else-if="s.pending?.type === 'chooseRoll'">
            <p class="text-sm text-slate-300">遥控骰子：选择移动点数（1~10）</p>
            <div class="mt-2 grid grid-cols-5 gap-1.5">
              <button
                v-for="v in rollChoices" :key="v"
                class="rounded bg-slate-700 py-1.5 text-sm hover:bg-amber-500 hover:text-slate-900"
                @click="store.roll(v)"
              >{{ v }}</button>
            </div>
          </template>

          <!-- 移动中 -->
          <template v-else-if="s.phase === 'moving' || store.moving">
            <p class="animate-pulse text-sm text-slate-400">移动中…剩余 {{ s.remaining }} 步</p>
          </template>

          <!-- 行动阶段 -->
          <template v-else-if="s.phase === 'action' && !s.pending">
            <div class="flex items-center justify-between">
              <p class="text-sm text-slate-300">{{ cur.name }} 的行动</p>
              <span class="text-[11px]" :class="cur.effectPlayed ? 'text-slate-600' : 'text-emerald-400'">
                {{ cur.effectPlayed ? '效果牌已用' : '效果牌可用' }}
              </span>
            </div>
            <button
              v-if="cur.extraRoll"
              class="mt-2 w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
              @click="store.roll()"
            >🎲 疾行：再掷一次</button>
            <button
              class="mt-2 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
              @click="store.endTurn()"
            >结束回合 →</button>
          </template>

          <!-- 游戏结束 -->
          <template v-else-if="s.phase === 'over'">
            <p class="text-center text-lg font-bold text-yellow-300">
              🏆 {{ s.players.find((p) => p.id === s.winner)?.name }} 达到 Lv4 获胜！
            </p>
            <button
              class="mt-2 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400"
              @click="store.view = 'setup'; store.picked = []"
            >再来一局</button>
          </template>
        </div>

        <!-- 手牌（行动阶段可出） -->
        <div class="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <div class="text-xs text-slate-500">
            {{ cur.name }} 的手牌（{{ cur.hand.length }}/10）— 行动阶段点击出牌
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="id in cur.hand" :key="id"
              class="rounded border px-2 py-1 text-[11px]"
              :class="s.phase === 'action' && !s.pending
                ? 'border-slate-500 text-slate-200 hover:border-amber-400 hover:text-amber-300'
                : 'border-slate-800 text-slate-600'"
              :title="CARDS[id]?.desc || ''"
              @click="clickHandCard(id)"
            >{{ cardName(id) }}</button>
            <span v-if="!cur.hand.length" class="text-[11px] text-slate-600">（空）</span>
          </div>
          <!-- 指向对手 -->
          <div v-if="selectedCard?.need === 'opponent'" class="mt-2 border-t border-slate-700 pt-2">
            <p class="text-[11px] text-slate-400">选择目标：</p>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <button
                v-for="t in targets" :key="t.id"
                class="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/40"
                @click="confirmTarget(t.id)"
              >{{ t.name }}（{{ t.tile }} 号格，{{ t.coins }} 币）</button>
              <button class="text-[11px] text-slate-500 underline" @click="selectedCard = null">取消</button>
            </div>
          </div>
          <!-- 指向格 -->
          <div v-if="selectedCard?.need === 'tile'" class="mt-2 border-t border-slate-700 pt-2">
            <p class="text-[11px] text-slate-400">选择放置格（{{ CARDS[selectedCard.id].range }} 格内、无占位）：</p>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <button
                v-for="ti in rangeTiles" :key="ti"
                class="rounded bg-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-600"
              >
                <span @click="confirmTile(ti)">{{ ti }}（{{ TILE_LABEL[TILES[ti].type] }}）</span>
              </button>
              <button class="text-[11px] text-slate-500 underline" @click="selectedCard = null">取消</button>
            </div>
          </div>
        </div>

        <!-- 日志 -->
        <div class="h-48 overflow-y-auto rounded-lg border border-slate-700 bg-black/40 p-2 text-[11px] leading-relaxed text-slate-400">
          <p v-for="(l, i) in store.log" :key="i" :class="l.text.startsWith('──') ? 'text-slate-200' : ''">
            <span class="text-slate-600">[R{{ l.r }}]</span> {{ l.text }}
          </p>
        </div>
      </aside>
    </div>

    <!-- 交点选环 -->
    <div v-if="s.pending?.type === 'branch'" class="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
      <div class="rounded-xl border border-cyan-500/40 bg-slate-900 p-6 text-center">
        <p class="text-lg font-bold text-slate-100">交点：选择路线</p>
        <p class="mt-1 text-xs text-slate-400">外环 = 稳健收益 · 内环 = 高收益高风险</p>
        <div class="mt-4 flex gap-3">
          <button
            class="rounded-lg bg-slate-700 px-6 py-3 text-sm font-medium text-slate-100 hover:bg-slate-600"
            @click="store.chooseBranch('A')"
          >外环 A（顺时针）</button>
          <button
            class="rounded-lg bg-violet-700 px-6 py-3 text-sm font-medium text-slate-100 hover:bg-violet-600"
            @click="store.chooseBranch('B')"
          >内环 B（抄近道）</button>
        </div>
      </div>
    </div>

    <!-- 遭遇对手 -->
    <div v-if="s.pending?.type === 'battleOffer'" class="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
      <div class="rounded-xl border border-red-500/40 bg-slate-900 p-6 text-center">
        <p class="text-lg font-bold text-slate-100">遭遇 {{ s.players.find((p) => p.id === s.pending.defenderId)?.name }}！</p>
        <p class="mt-1 text-xs text-slate-400">战斗胜利不掉币；把对方打 KO 可抢走其一半星币</p>
        <div class="mt-4 flex gap-3">
          <button
            class="rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500"
            @click="store.acceptBattle()"
          >⚔ 战斗</button>
          <button
            class="rounded-lg bg-slate-700 px-6 py-3 text-sm text-slate-200 hover:bg-slate-600"
            @click="store.declineBattle()"
          >放过</button>
        </div>
      </div>
    </div>

    <!-- 商店 -->
    <div v-if="s.pending?.type === 'shop'" class="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
      <div class="w-full max-w-md rounded-xl border border-orange-500/40 bg-slate-900 p-5">
        <p class="text-lg font-bold text-slate-100">商店（5 星币/张）· 现有 {{ cur.coins }} 币</p>
        <div class="mt-3 space-y-2">
          <div
            v-for="(id, i) in shopStock" :key="i"
            class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2"
          >
            <span class="text-sm text-slate-200">{{ cardName(id) }}<span class="ml-2 text-[11px] text-slate-500">{{ CARDS[id]?.desc }}</span></span>
            <button
              :disabled="cur.coins < 5 || cur.hand.length >= 10"
              class="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40"
              @click="store.buy(id)"
            >购买</button>
          </div>
        </div>
        <button
          class="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
          @click="store.closeShop()"
        >离开商店</button>
      </div>
    </div>

    <!-- 战斗 -->
    <BattleOverlay
      v-if="s.battle"
      :state="s"
      @play-battle="store.playBattle($event)"
      @confirm="store.confirmCards()"
      @defense="store.chooseDefense($event)"
      @close="store.closeBattle()"
    />
  </div>
</template>
