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

const overlayMarks = computed(() => props.state.overlays.map((o) => {
  const [x, y] = SCREEN_TILES[o.tile].c;
  return { ...o, x, y };
}));

// ── 十字路口：三个方向箭头（直行 / 左转 / 右转）──
const branch = computed(() => (props.state.pending?.type === 'branch' ? props.state.pending : null));
const ARROW_COLOR = { 直行: '#fde047', 左转: '#93c5fd', 右转: '#f9a8d4' };
const branchArrows = computed(() => {
  const b = branch.value;
  if (!b) return [];
  const [x, y] = SCREEN_TILES[b.tile].c;
  const [px, py] = SCREEN_TILES[b.from].c;
  const inX = x - px, inY = y - py;              // 进路口的方向
  return b.options.map((next) => {
    const [tx, ty] = SCREEN_TILES[next].c;
    const dx = tx - x, dy = ty - y;
    const cross = inX * dy - inY * dx;           // 屏幕 y 向下：cross > 0 = 右转
    const dot = inX * dx + inY * dy;
    const name = dot > 0 && Math.abs(cross) < Math.abs(dot) * 0.5 ? '直行' : cross > 0 ? '右转' : '左转';
    const ang = Math.atan2(dy, dx);
    const ax = x + dx * 0.95, ay = y + dy * 0.95;
    const head = [
      `${ax},${ay}`,
      `${ax - 40 * Math.cos(ang + 0.45)},${ay - 40 * Math.sin(ang + 0.45)}`,
      `${ax - 40 * Math.cos(ang - 0.45)},${ay - 40 * Math.sin(ang - 0.45)}`,
    ].join(' ');
    return { next, name, color: ARROW_COLOR[name], x, y, ax, ay, head,
             mx: x + dx * 0.6, my: y + dy * 0.6, lx: x + dx * 1.4, ly: y + dy * 1.4 };
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
  const scale = Math.max(r.width / vw, r.height / vh);  // 与 preserveAspectRatio="slice" 一致
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
    preserveAspectRatio="xMidYMid slice"
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

    <!-- 十字路口：三个方向，点箭头选路 -->
    <g v-for="ar in branchArrows" :key="'br' + ar.next" class="cursor-pointer" @click="clickBranch(ar.next)">
      <line :x1="ar.x" :y1="ar.y" :x2="ar.ax" :y2="ar.ay" :stroke="ar.color" stroke-width="10"
            stroke-dasharray="18 12" stroke-linecap="round" />
      <polygon :points="ar.head" :fill="ar.color" stroke="#111827" stroke-width="3" />
      <circle :cx="ar.mx" :cy="ar.my" r="36" :fill="ar.color" stroke="#111827" stroke-width="5" />
      <text :x="ar.mx" :y="ar.my + 10" text-anchor="middle" font-size="26" font-weight="900" fill="#111827">{{ ar.name }}</text>
      <text :x="ar.lx" :y="ar.ly + 9" text-anchor="middle" font-size="24" font-weight="800" fill="#ffffff"
            stroke="#111827" stroke-width="6" paint-order="stroke">{{ ar.next }} · {{ defOf(ar.next).name }}</text>
    </g>
  </svg>
</template>
