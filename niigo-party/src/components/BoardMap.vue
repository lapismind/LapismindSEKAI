<script setup>
/**
 * BoardMap.vue —— 2.5D 底图棋盘：环境底图 + SVG 叠层（格子热区 / 地块标记 / 棋子 / 路口方向）
 * 坐标一律来自 screen.js（Blender 同相机导出），不从底图像素推导。
 *
 * 视口：view = { cx, cy, zoom }（viewBox 中心与放大倍数），由父组件持有；
 * 拖拽平移时 emit('pan', {cx, cy})，父组件负责夹在底图范围内。
 */
import { computed, ref } from 'vue';
import { TILES, IS_CROSS } from '@/game/board.js';
import { tileDef } from '@/game/tiles.js';
import { SCREEN_W, SCREEN_H, SCREEN_TILES, BOARD_BG, polyPoints } from '@/game/screen.js';

const props = defineProps({
  state: { type: Object, required: true },
  view: { type: Object, required: true },            // { cx, cy, zoom }
  showMarks: { type: Boolean, default: true },        // 地块标记（底图地砖未上色期间的识别手段）
  highlightTiles: { type: Array, default: () => [] }, // 可选格（效果牌放置）
  coinDrops: { type: Array, default: () => [] },      // 头顶掉金币 [{id, playerId, amount}]
});
const emit = defineEmits(['chooseBranch', 'pan', 'tileClick']);

const R = 34;     // 棋子头像半径（viewBox 单位，格子屏幕宽约 103）
const STEM = 30;  // 徽章立杆高度
// chibi 基底图 1024²，头部约在 (290,50) 起 420×420 的方框里；缩放后让这块正好填满头像圆
const HEAD = { x: 290, y: 50, size: 420 };
const HS = (2 * R) / HEAD.size;

const viewBox = computed(() => {
  const w = SCREEN_W / props.view.zoom, h = SCREEN_H / props.view.zoom;
  return `${props.view.cx - w / 2} ${props.view.cy - h / 2} ${w} ${h}`;
});

const tiles = TILES.map((t) => ({ ...t, c: SCREEN_TILES[t.i].c, points: polyPoints(t.i) }));
const defOf = (i) => tileDef(TILES[i].type);
const highlightSet = computed(() => new Set(props.highlightTiles));

const curPlayer = computed(() => props.state.players[props.state.current]);

const tokens = computed(() => {
  const byTile = new Map();
  for (const p of props.state.players) {
    if (!byTile.has(p.tile)) byTile.set(p.tile, []);
    byTile.get(p.tile).push(p);
  }
  const out = [];
  for (const [tile, ps] of byTile) {
    const [cx, cy] = SCREEN_TILES[tile].c;
    ps.forEach((p, k) => {
      // 同格多人：沿屏幕横向错开，远的（画面上方）先画
      const off = (k - (ps.length - 1) / 2) * 34;
      const y = cy + Math.abs(off) * 0.25;
      out.push({ p, x: cx + off, y, hy: y - STEM - R, isCurrent: p.id === curPlayer.value.id, ko: p.ko });
    });
  }
  return out.sort((a, b) => a.y - b.y);
});

// 金币从玩家头顶落下：每次掉落若干枚（随金额多少），错开下落时机与左右位置
const drops = computed(() => props.coinDrops.map((d) => {
  const tk = tokens.value.find((t) => t.p.id === d.playerId);
  if (!tk) return null;
  const n = Math.min(9, 3 + Math.floor(d.amount / 6));
  const coins = Array.from({ length: n }, (_, k) => ({
    k, dx: ((k * 37) % 70) - 35, delay: `${k * 70}ms`, spin: k % 2 ? 1 : -1,
  }));
  return { ...d, x: tk.x, top: tk.hy - R - 10, coins };
}).filter(Boolean));

const overlayMarks = computed(() => props.state.overlays.map((o) => {
  const [x, y] = SCREEN_TILES[o.tile].c;
  return { ...o, x, y };
}));

// ── 十字路口：脚底三个方向箭头 ──
const branch = computed(() => (props.state.pending?.type === 'branch' ? props.state.pending : null));
const branchArrows = computed(() => {
  const b = branch.value;
  if (!b) return [];
  const [x, y] = SCREEN_TILES[b.tile].c;
  return b.options.map((next) => {
    const [tx, ty] = SCREEN_TILES[next].c;
    const ang = (Math.atan2(ty - y, tx - x) * 180) / Math.PI;
    return { next, x, y, ang };
  });
});
// ── 拖拽平移（位移超过阈值才算拖拽，避免吞掉点击）──
const svgEl = ref(null);
let drag = null;
let dragged = false;
function onDown(e) {
  if (e.button !== 0) return;
  drag = { x: e.clientX, y: e.clientY, cx: props.view.cx, cy: props.view.cy, moved: false };
  dragged = false;
}
function onMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  dragged = true;
  const r = svgEl.value.getBoundingClientRect();
  const vw = SCREEN_W / props.view.zoom, vh = SCREEN_H / props.view.zoom;
  const scale = props.view.zoom > 1 ? Math.max(r.width / vw, r.height / vh) : Math.min(r.width / vw, r.height / vh); // slice / meet
  emit('pan', { cx: drag.cx - dx / scale, cy: drag.cy - dy / scale });
}
function onUp() { drag = null; }
const clickTile = (i) => { if (!dragged) emit('tileClick', i); };
const clickBranch = (n) => { if (!dragged) emit('chooseBranch', n); };
</script>

<template>
  <svg
    ref="svgEl" :viewBox="viewBox" class="block h-full w-full touch-none select-none"
    :class="view.zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''"
    :preserveAspectRatio="view.zoom > 1 ? 'xMidYMid slice' : 'xMidYMid meet'"
    @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onUp"
  >
    <!-- 底图外围铺暮色，平移到边缘或窗口比例不同时不露黑边 -->
    <rect x="-3000" y="-3000" width="8400" height="7800" fill="#dcc3e0" />
    <image :href="BOARD_BG" x="0" y="0" :width="SCREEN_W" :height="SCREEN_H" preserveAspectRatio="none" />

    <!-- 格子热区：悬停显示地块说明；当前格 / 可选格描边 -->
    <g>
      <polygon
        v-for="t in tiles" :key="'h' + t.i" :points="t.points"
        :fill="highlightSet.has(t.i) ? 'rgba(253,224,71,0.35)' : 'transparent'"
        :stroke="highlightSet.has(t.i) ? '#fde047' : curPlayer?.tile === t.i ? '#ffffff' : 'transparent'"
        stroke-width="5" stroke-linejoin="round"
        :class="highlightSet.has(t.i) ? 'cursor-pointer' : ''"
        @click="clickTile(t.i)"
      ><title>{{ t.i }} 号格 · {{ defOf(t.i).name }}：{{ defOf(t.i).desc }}</title></polygon>
    </g>

    <!-- 地块标记：格子上方的小圆徽章（不铺满格子，偏几像素也不扎眼） -->
    <g v-if="showMarks" style="pointer-events: none">
      <g v-for="t in tiles" :key="'m' + t.i" :transform="`translate(${t.c[0]}, ${t.c[1] - 26})`">
        <circle :r="IS_CROSS(t.i) ? 15 : 19" :fill="defOf(t.i).color" stroke="#ffffff" stroke-width="4" opacity="0.95" />
        <text y="7" text-anchor="middle" font-size="20" font-weight="800" fill="#1f2430">{{ defOf(t.i).label }}</text>
      </g>
    </g>

    <!-- 陷阱 / 路障 -->
    <g v-for="(o, i) in overlayMarks" :key="'ov' + i" style="pointer-events: none">
      <circle :cx="o.x + 30" :cy="o.y + 6" r="15" fill="#111827" stroke="#f87171" stroke-width="3" />
      <text :x="o.x + 30" :y="o.y + 13" text-anchor="middle" font-size="18" fill="#f87171">⚠</text>
    </g>

    <!-- 棋子：圆形头像徽章立在格子上（chibi 基底是白底 RGB，没有 alpha，所以裁进圆里） -->
    <defs>
      <clipPath v-for="tk in tokens" :id="'tk-' + tk.p.id" :key="'c' + tk.p.id" clipPathUnits="userSpaceOnUse">
        <circle :cx="tk.x" :cy="tk.hy" :r="R" />
      </clipPath>
    </defs>
    <g v-for="tk in tokens" :key="tk.p.id" style="pointer-events: none">
      <ellipse :cx="tk.x" :cy="tk.y + 4" rx="22" ry="8" fill="rgba(30,20,50,0.4)" />
      <line :x1="tk.x" :y1="tk.y + 2" :x2="tk.x" :y2="tk.y - STEM" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
      <circle
        v-if="tk.isCurrent" :cx="tk.x" :cy="tk.hy" :r="R + 11"
        fill="none" stroke="#fde047" stroke-width="6" class="animate-pulse"
      />
      <circle :cx="tk.x" :cy="tk.hy" :r="R + 5" :fill="tk.ko ? '#6b7280' : tk.p.color" stroke="#ffffff" stroke-width="4" />
      <circle :cx="tk.x" :cy="tk.hy" :r="R" fill="#ffffff" />
      <image
        :x="tk.x - R - HEAD.x * HS" :y="tk.hy - R - HEAD.y * HS" :width="1024 * HS" :height="1024 * HS"
        :href="`/assets/niigo/chibi_base/${tk.p.img}.png`" :clip-path="`url(#tk-${tk.p.id})`"
        :style="tk.ko ? 'filter: grayscale(1) brightness(0.5)' : ''"
      />
    </g>

    <!-- 头顶掉金币 + 金额 -->
    <g v-for="d in drops" :key="'cd' + d.id" style="pointer-events: none" :transform="`translate(${d.x}, ${d.top})`">
      <g v-for="c in d.coins" :key="c.k" class="coin-fall" :style="{ animationDelay: c.delay }">
        <g :transform="`translate(${c.dx}, 0)`">
          <ellipse rx="15" ry="15" fill="#f5b400" stroke="#8a5a00" stroke-width="3" />
          <ellipse rx="9" ry="9" fill="none" stroke="#ffe27a" stroke-width="2.5" />
          <text y="6" text-anchor="middle" font-size="15" font-weight="900" fill="#8a5a00">¥</text>
        </g>
      </g>
      <text class="coin-amount" y="-40" text-anchor="middle" font-size="40" font-weight="900" fill="#fde047"
            stroke="#1f2430" stroke-width="7" paint-order="stroke">+{{ d.amount }}</text>
    </g>

    <!-- 十字路口：脚底三个方向箭头，点箭头选路 -->
    <g v-for="ar in branchArrows" :key="'br' + ar.next" class="branch-arrow cursor-pointer" :data-branch="ar.next"
       :transform="`translate(${ar.x}, ${ar.y}) scale(1, 0.62) rotate(${ar.ang})`" @click="clickBranch(ar.next)">
      <!-- 透明点击区 -->
      <rect x="26" y="-26" width="70" height="52" fill="transparent" />
      <polygon style="pointer-events: none" points="34,-10 64,-10 64,-22 92,0 64,22 64,10 34,10" fill="#fde047" stroke="#1f2430" stroke-width="5" stroke-linejoin="round" />
    </g>
  </svg>
</template>

<style scoped>
/* 金币：从头顶上方落到棋子脚边，落地后淡出 */
/* 路口箭头：轻微呼吸，提示可点 */
.branch-arrow polygon { animation: arrow-pulse 1s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 50%; }
@keyframes arrow-pulse { 50% { transform: translateX(6px); } }
.branch-arrow:hover polygon { fill: #ffffff; } /* 点击区是静态 rect，动画不影响点中 */
.coin-fall { animation: coin-fall 1.1s cubic-bezier(0.45, 0, 0.8, 0.6) both; }
@keyframes coin-fall {
  0%   { opacity: 0; transform: translateY(-120px); }
  12%  { opacity: 1; }
  78%  { opacity: 1; transform: translateY(95px); }
  100% { opacity: 0; transform: translateY(110px); }
}
.coin-amount { animation: coin-amount 1.5s ease-out both; }
@keyframes coin-amount {
  0%   { opacity: 0; transform: translateY(20px) scale(0.6); }
  20%  { opacity: 1; transform: translateY(0) scale(1.1); }
  75%  { opacity: 1; transform: translateY(-14px) scale(1); }
  100% { opacity: 0; transform: translateY(-30px); }
}
@media (prefers-reduced-motion: reduce) {
  .coin-fall { animation: none; opacity: 0; }
  .coin-amount { animation: none; }
  .branch-arrow polygon { animation: none; }
}
</style>
