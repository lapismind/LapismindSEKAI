<script setup>
/**
 * GameScreen.vue —— 热座对局主界面：全屏地图 + 游戏内 HUD
 *   左上：缩放三挡 + 玩家状态条（点头像定位，含 buff/debuff）   右上：回合信息 / 日志 / 齿轮（快速模式）
 *   左下：当前玩家立绘（点击看技能）+ 主动技能释放标
 *   正下：扇形手牌（最多 10 张，带倾角、轻浮动）  右下：d10 骰子 / 回合操作
 *   屏幕中央：掷骰大字、特效横幅、事件通知（自动消失）；弹窗：商店 / 遭遇与战斗
 *   只把真正的决定交给玩家；纯展示环节（掷 D6、结算、通知、结束回合）按 store.pace 自动推进
 *   默认"放大"挡并对准当前玩家：地图玩家习惯拖拽，全图挡不能拖
 */
import { computed, ref, watch } from 'vue';
import { useGameStore } from '@/stores/game.js';
import { TILES, tileDistance, LEVEL_COST } from '@/game/board.js';
import { tileDef } from '@/game/tiles.js';
import { CARDS } from '@/game/cards.js';
import { SCREEN_W, SCREEN_H, SCREEN_TILES } from '@/game/screen.js';
import BoardMap from '@/components/BoardMap.vue';
import PlayerCard from '@/components/PlayerCard.vue';
import BattleOverlay from '@/components/BattleOverlay.vue';
import EventPopup from '@/components/EventPopup.vue';
import HandFan from '@/components/HandFan.vue';
import PortraitPanel from '@/components/PortraitPanel.vue';

const store = useGameStore();
const s = computed(() => store.s);
const cur = computed(() => store.current);

// ── 视口：三挡缩放 + 拖拽平移 + 定位 ──
const ZOOMS = [1, 2.2, 3.2]; // 全图（完整显示整张底图）/ 放大（默认，约半张棋盘）/ 特写
const zoomLevel = ref(1);
const view = ref({ cx: SCREEN_W / 2, cy: SCREEN_H / 2, zoom: ZOOMS[1] });
function clampView(v) {
  const w = SCREEN_W / v.zoom, h = SCREEN_H / v.zoom;
  return {
    zoom: v.zoom,
    cx: Math.min(SCREEN_W - w / 2, Math.max(w / 2, v.cx)),
    cy: Math.min(SCREEN_H - h / 2, Math.max(h / 2, v.cy)),
  };
}
function setZoom(level, center) {
  zoomLevel.value = level;
  const c = center ?? { cx: view.value.cx, cy: view.value.cy };
  view.value = clampView({ ...c, zoom: ZOOMS[level] });
}
function onPan(c) { view.value = clampView({ ...c, zoom: view.value.zoom }); }
const locating = ref(null);
function locate(p) {
  const [cx, cy] = SCREEN_TILES[p.tile].c;
  setZoom(Math.max(zoomLevel.value, 1), { cx, cy });
  locating.value = p.id;
  setTimeout(() => { if (locating.value === p.id) locating.value = null; }, 1200);
}
// 开局与换人时镜头对准当前玩家（放大挡才有意义）
function focusCurrent() {
  if (!cur.value || zoomLevel.value === 0) return;
  const [cx, cy] = SCREEN_TILES[cur.value.tile].c;
  view.value = clampView({ cx, cy, zoom: view.value.zoom });
}
focusCurrent();
watch(() => s.value?.current, focusCurrent);
// 放大时镜头跟随正在移动的玩家
watch(() => cur.value?.tile, (t) => {
  if (t == null || zoomLevel.value === 0 || !store.moving) return;
  const [cx, cy] = SCREEN_TILES[t].c;
  view.value = clampView({ cx, cy, zoom: view.value.zoom });
});

// ── 无效点击的轻提示 ──
const toast = ref(null);
let toastTimer = null;
function notify(text) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = null; }, 1800);
}

const phaseText = { roll: '等待掷骰', moving: '移动中', action: '行动中', battle: '战斗中', over: '已结束' };

// ── 掷骰大字 ──
const rollBig = ref(null); // { value, key }
watch(() => s.value?.lastRoll?.seq, (seq) => {
  if (!seq) return;
  rollBig.value = { value: s.value.lastRoll.value, key: seq };
  setTimeout(() => { if (rollBig.value?.key === seq) rollBig.value = null; }, store.pace.rollShow + 250);
});

// ── 行动阶段：手牌与效果牌指向 ──
const selectedCard = ref(null); // {id, need: 'opponent'|'tile'}
/** 指向型效果牌的合法目标：非自己、未 KO、未住院、在射程内（与引擎校验同一口径） */
function targetsFor(id) {
  if (!s.value) return [];
  const range = CARDS[id]?.range;
  return s.value.players.filter((p) => p.id !== cur.value.id && !p.ko && !p.immune
    && (!range || tileDistance(cur.value.tile, p.tile) <= range));
}
const targets = computed(() => (selectedCard.value?.need === 'opponent' ? targetsFor(selectedCard.value.id) : []));
const rangeTiles = computed(() => {
  if (!s.value || selectedCard.value?.need !== 'tile') return [];
  const card = CARDS[selectedCard.value.id];
  return TILES
    .filter((t) => t.i !== cur.value.tile
      && tileDistance(cur.value.tile, t.i) <= card.range
      && !s.value.overlays.some((o) => o.tile === t.i))
    .map((t) => t.i);
});
// 出牌时机：掷骰前（落地后自动轮到下一位，没有「结束回合」）
const canAct = computed(() => s.value?.phase === 'roll' && !s.value.pending && !store.moving);
const cardPlayable = (id) => canAct.value && CARDS[id]?.kind !== 'battle'
  && !(CARDS[id]?.kind === 'effect' && cur.value.effectPlayed);
function useSkill() { notify('主动技能待技能设计轮实装（规格 §5.3）'); }
const popupPlayer = computed(() => s.value?.players.find((p) => p.id === store.popups[0]?.playerId) ?? null);
const shopStock = computed(() => (s.value?.pending?.type === 'shop' ? s.value.pending.stock : []));

function clickHandCard(id) {
  const card = CARDS[id];
  if (!canAct.value) { notify('掷骰前才能出牌'); return; }
  if (card.kind === 'battle') { notify('战斗牌要在战斗里才能用'); return; }
  if (card.kind === 'effect') {
    if (cur.value.effectPlayed) { notify('本回合的效果牌已经用过了'); return; }
    if (card.target === 'opponent') {
      const ts = targetsFor(id);
      if (!ts.length) { notify(card.range ? `${card.range} 格内没有可指定的目标` : '没有可指定的目标（住院 / KO 免疫）'); return; }
      if (ts.length === 1) { store.playCard(id, { targetId: ts[0].id }); selectedCard.value = null; return; } // 唯一目标：不必再选
      selectedCard.value = { id, need: 'opponent' };
      return;
    }
    if (card.target === 'tile') {
      selectedCard.value = { id, need: 'tile' };
      notify('在地图上点选高亮的格子');
      return;
    }
  }
  store.playCard(id, {});
  selectedCard.value = null;
}
function confirmTarget(targetId) {
  store.playCard(selectedCard.value.id, { targetId });
  selectedCard.value = null;
}
function onTileClick(i) {
  if (selectedCard.value?.need !== 'tile' || !rangeTiles.value.includes(i)) return;
  store.playCard(selectedCard.value.id, { tileIdx: i });
  selectedCard.value = null;
}
const cardName = (id) => CARDS[id]?.name ?? id;

const rollChoices = Array.from({ length: 10 }, (_, i) => i + 1);

// ── 特效横幅 ──
const fxText = computed(() => {
  const f = store.lastFx;
  if (!f || f.consumed) return null;
  const p = s.value.players.find((x) => x.id === f.playerId);
  return { text: { ko: `${p?.name ?? ''} 被 KO！`, revive: `${p?.name ?? ''} 复活！`, teleport: '传送门跃迁！', levelup: `${p?.name ?? ''} 升级！` }[f.type] ?? '' };
});

const showLog = ref(false);
const showSettings = ref(false);
const curTileDef = computed(() => (cur.value ? tileDef(TILES[cur.value.tile].type) : null));
</script>

<template>
  <div v-if="s" class="fixed inset-0 overflow-hidden bg-slate-950 text-slate-200">
    <!-- 地图（全屏） -->
    <BoardMap
      :state="s" :view="view" :highlight-tiles="rangeTiles" :coin-drops="store.coinDrops"
      class="absolute inset-0"
      @choose-branch="store.chooseBranch($event)" @pan="onPan" @tile-click="onTileClick"
    />

    <!-- 左上：缩放三挡 + 玩家状态条 -->
    <div class="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
      <div class="pointer-events-auto flex w-fit overflow-hidden rounded-lg border border-white/15 bg-slate-900/75 shadow-lg backdrop-blur-md" role="group" aria-label="地图缩放">
        <button
          v-for="(z, k) in ZOOMS" :key="k"
          class="px-3 py-1.5 text-xs font-bold transition-colors"
          :class="zoomLevel === k ? 'bg-yellow-300 text-slate-900' : 'text-slate-200 hover:bg-white/10'"
          :aria-pressed="zoomLevel === k"
          @click="setZoom(k)"
        >{{ ['全图', '放大', '特写'][k] }}</button>
      </div>
      <PlayerCard
        v-for="p in s.players" :key="p.id" :player="p"
        :is-current="p.id === cur.id"
        :class="locating === p.id ? 'animate-pulse' : ''"
        @locate="locate"
      />
    </div>

    <!-- 右上：回合信息 + 日志 -->
    <div class="absolute right-3 top-3 z-20 flex w-72 flex-col items-end gap-2">
      <div class="rounded-xl border border-white/15 bg-slate-900/75 px-3 py-2 text-right shadow-lg backdrop-blur-md">
        <div class="text-xs text-slate-400">第 {{ Math.min(s.round, 25) }}/25 轮 · {{ phaseText[s.phase] }}</div>
        <div class="text-base font-black" :style="{ color: cur.color }">{{ cur.name }} 的回合</div>
        <div class="text-[11px] text-slate-400">
          {{ cur.level >= 4 ? '已满级' : `下一级需 ${LEVEL_COST[cur.level]} 币` }}
          · 脚下：{{ curTileDef?.name }}
        </div>
      </div>
      <div class="flex gap-1.5">
        <button
          class="rounded-lg border border-white/15 bg-slate-900/75 px-3 py-1 text-xs text-slate-300 shadow backdrop-blur-md hover:bg-slate-800"
          :aria-expanded="showLog" @click="showLog = !showLog"
        >{{ showLog ? '收起日志' : '日志' }}</button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-slate-900/75 text-base text-slate-200 shadow backdrop-blur-md hover:bg-slate-800"
          :aria-expanded="showSettings" aria-label="设置" title="设置" @click="showSettings = !showSettings"
        >⚙</button>
      </div>
      <div v-if="showSettings" class="w-full rounded-xl border border-white/15 bg-slate-900/90 p-3 text-sm shadow-lg backdrop-blur-md" role="group" aria-label="设置">
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span class="block font-bold text-slate-100">快速模式</span>
            <span class="block text-[11px] text-slate-400">加快棋子移动、结算停顿、事件通知与战斗节奏</span>
          </span>
          <input type="checkbox" class="h-5 w-5 accent-yellow-400" :checked="store.fast" @change="store.setFast($event.target.checked)" />
        </label>
      </div>
      <div v-if="showLog" class="h-64 w-full overflow-y-auto rounded-xl border border-white/15 bg-black/70 p-2 text-[11px] leading-relaxed text-slate-300 backdrop-blur-md">
        <p v-for="(l, i) in store.log" :key="i" :class="l.text.startsWith('──') ? 'text-slate-100' : ''">
          <span class="text-slate-500">[R{{ l.r }}]</span> {{ l.text }}
        </p>
      </div>
    </div>

    <!-- 左下：立绘 + 主动技能释放标 -->
    <div class="absolute bottom-3 left-3 z-20">
      <PortraitPanel :player="cur" :can-act="canAct" @use-skill="useSkill" />
    </div>

    <!-- 正下：扇形手牌 + 出牌提示 -->
    <div class="pointer-events-none absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
      <div v-if="selectedCard?.need === 'opponent'" class="pointer-events-auto mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/85 px-3 py-2 shadow-lg backdrop-blur-md">
        <span class="text-[11px] text-slate-300">「{{ cardName(selectedCard.id) }}」选择目标：</span>
        <button
          v-for="t in targets" :key="t.id"
          class="rounded bg-red-500/25 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/45"
          @click="confirmTarget(t.id)"
        >{{ t.name }}（{{ t.tile }} 号格 · {{ t.coins }} 币）</button>
        <button class="text-[11px] text-slate-400 underline" @click="selectedCard = null">取消</button>
      </div>
      <div v-else-if="selectedCard?.need === 'tile'" class="pointer-events-auto mb-2 flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/85 px-3 py-2 text-[11px] text-slate-200 shadow-lg backdrop-blur-md">
        在地图上点选高亮格放置「{{ cardName(selectedCard.id) }}」（{{ CARDS[selectedCard.id].range }} 格内，{{ rangeTiles.length }} 个可选）
        <button class="text-slate-400 underline" @click="selectedCard = null">取消</button>
      </div>
      <div class="pointer-events-none mb-0.5 rounded-full bg-slate-900/70 px-3 py-0.5 text-[11px] text-slate-300">
        手牌 {{ cur.hand.length }}/10
        <template v-if="canAct"> · <span :class="cur.effectPlayed ? 'text-slate-500' : 'text-emerald-300'">{{ cur.effectPlayed ? '效果牌已用' : '可用 1 张效果牌' }}</span></template>
      </div>
      <div class="pointer-events-auto -mb-6">
        <HandFan :hand="cur.hand" :playable="cardPlayable" :selected-id="selectedCard?.id ?? null" @play="clickHandCard" />
      </div>
    </div>

    <!-- 右下：d10 骰子 / 回合操作 -->
    <div class="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      <!-- 遥控骰子：自选点数 -->
      <div v-if="s.pending?.type === 'chooseRoll'" class="rounded-xl border border-white/15 bg-slate-900/85 p-2 shadow-lg backdrop-blur-md">
        <p class="px-1 text-xs text-slate-300">遥控骰子：选择移动点数</p>
        <div class="mt-1.5 grid grid-cols-5 gap-1.5">
          <button
            v-for="v in rollChoices" :key="v"
            class="h-9 w-9 rounded-lg bg-slate-700 text-sm font-bold hover:bg-yellow-300 hover:text-slate-900"
            @click="store.roll(v)"
          >{{ v }}</button>
        </div>
      </div>

      <template v-else-if="s.phase === 'over'">
        <div class="rounded-xl border border-yellow-300/60 bg-slate-900/90 px-4 py-3 text-center shadow-lg">
          <p class="text-lg font-black text-yellow-300">🏆 {{ s.players.find((p) => p.id === s.winner)?.name }} 获胜！</p>
          <button
            class="mt-2 w-full rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-yellow-300"
            @click="store.view = 'setup'; store.picked = []"
          >再来一局</button>
        </div>
      </template>

      <template v-else>
        <p v-if="s.phase === 'moving' || store.moving" class="rounded-lg bg-slate-900/80 px-3 py-1 text-xs text-slate-300 shadow">
          移动中…剩余 {{ s.remaining }} 步
        </p>
        <p v-else-if="s.pending?.type === 'branch'" class="rounded-lg bg-slate-900/80 px-3 py-1 text-xs text-yellow-200 shadow">
          十字路口：在地图上选方向
        </p>
        <!-- d10 按钮：风筝形十面骰轮廓 -->
        <button
          class="dice-btn group relative h-28 w-24 drop-shadow-xl disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!store.canRoll"
          :aria-label="cur.extraRoll ? '疾行：再掷一次 d10' : '掷 d10 移动骰'"
          @click="store.roll()"
        >
          <svg viewBox="0 0 100 116" class="h-full w-full transition-transform group-enabled:group-hover:-rotate-6 group-enabled:group-hover:scale-105">
            <polygon points="50,4 96,46 50,112 4,46" fill="#fde047" stroke="#1f2430" stroke-width="5" stroke-linejoin="round" />
            <polygon points="50,4 70,52 50,68 30,52" fill="#fff7b0" stroke="#1f2430" stroke-width="3" stroke-linejoin="round" />
            <polyline points="4,46 30,52 50,68 70,52 96,46" fill="none" stroke="#1f2430" stroke-width="3" stroke-linejoin="round" />
            <line x1="50" y1="68" x2="50" y2="112" stroke="#1f2430" stroke-width="3" />
            <text x="50" y="47" text-anchor="middle" font-size="20" font-weight="900" fill="#1f2430">d10</text>
          </svg>
          <span class="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/90 px-2 py-0.5 text-[11px] font-bold text-yellow-200">
            {{ cur.extraRoll ? '疾行再掷' : '掷骰' }}
          </span>
        </button>
      </template>
    </div>

    <!-- 屏幕中央：掷骰大字 -->
    <div v-if="rollBig" :key="rollBig.key" class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-live="polite">
      <div class="roll-big text-center">
        <div class="text-[11rem] font-black leading-none text-yellow-300 drop-shadow-[0_6px_0_rgba(31,36,48,0.9)]"
             style="-webkit-text-stroke: 6px #1f2430;">{{ rollBig.value }}</div>
        <div class="mt-1 text-lg font-bold text-white drop-shadow">{{ cur.name }} 前进 {{ rollBig.value }} 步</div>
      </div>
    </div>

    <!-- 特效横幅 -->
    <transition name="fade">
      <div v-if="fxText && !rollBig" class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
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

    <!-- 事件窗口（落在事件类地块时，排队逐个弹出） -->
    <EventPopup
      v-if="store.popups.length && !rollBig" :key="store.popups.length + ':' + store.popups[0].title"
      :popup="store.popups[0]" :player="popupPlayer" :duration="store.pace.popup" @skip="store.skipPopup()"
    />


    <!-- 商店 -->
    <div v-if="s.pending?.type === 'shop'" class="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <div class="w-full max-w-md rounded-xl border border-orange-500/40 bg-slate-900 p-5">
        <p class="text-lg font-bold text-slate-100">商店（5 星币/张）· 现有 {{ cur.coins }} 币</p>
        <p v-if="s.pending.free" class="mt-0.5 text-xs text-emerald-300">已免费拿到「{{ cardName(s.pending.free) }}」</p>
        <div class="mt-3 space-y-2">
          <div v-for="(id, i) in shopStock" :key="i" class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2">
            <span class="text-sm text-slate-200">{{ cardName(id) }}<span class="ml-2 text-[11px] text-slate-500">{{ CARDS[id]?.desc }}</span></span>
            <button
              :disabled="cur.coins < 5 || cur.hand.length >= 10"
              class="rounded bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40"
              @click="store.buy(id)"
            >购买</button>
          </div>
        </div>
        <button class="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600" @click="store.closeShop()">不买了</button>
      </div>
    </div>

    <!-- 遭遇 → 进战过场 → 战斗：同一个游戏内大窗口（组件不重建，过场动画才能从遭遇态接上） -->
    <BattleOverlay
      v-if="s.battle || s.pending?.type === 'battleOffer'" :state="s"
      @accept="store.acceptBattle()" @decline="store.declineBattle()"
      @select="(side, id) => store.selectBattleCard(side, id)" @lock="store.lockBattleSide($event)"
      @defense="store.chooseDefense($event)" @ready="store.battleReady()"
    />

    <!-- 轻提示 -->
    <transition name="fade">
      <div v-if="toast" class="absolute bottom-56 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-xl">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.roll-big { animation: roll-pop 1.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
@keyframes roll-pop {
  0%   { opacity: 0; transform: scale(0.3) rotate(-18deg); }
  18%  { opacity: 1; transform: scale(1.15) rotate(4deg); }
  30%  { transform: scale(1) rotate(0); }
  80%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.85) translateY(-30px); }
}
@media (prefers-reduced-motion: reduce) {
  .roll-big { animation: none; }
}
</style>
