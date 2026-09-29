<script setup>
/**
 * BoardMap.vue —— 2.5D 底图棋盘：环境底图 + SVG 叠层（格子热区 / 地块标记 / 棋子 / 选环箭头）
 * 坐标一律来自 screen.js（Blender 同相机导出），不从底图像素推导。
 */
import { computed } from 'vue';
import { TILES, CROSSES } from '@/game/board.js';
import { tileDef } from '@/game/tiles.js';
import { SCREEN_W, SCREEN_H, SCREEN_TILES, BOARD_BG, polyPoints } from '@/game/screen.js';

const props = defineProps({
  state: { type: Object, required: true },
  showMarks: { type: Boolean, default: true }, // 地块标记（底图地砖未上色期间的识别手段）
});
const emit = defineEmits(['chooseBranch']);

const R = 34;     // 棋子头像半径（viewBox 单位，格子屏幕宽约 103）
const STEM = 30;  // 徽章立杆高度
// chibi 基底图 1024²，头部约在 (290,50) 起 420×420 的方框里；缩放后让这块正好填满头像圆
const HEAD = { x: 290, y: 50, size: 420 };
const HS = (2 * R) / HEAD.size;

const tiles = TILES.map((t) => ({ ...t, c: SCREEN_TILES[t.i].c, points: polyPoints(t.i), def: tileDef(t.type) }));

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

const branchTile = computed(() => (props.state.pending?.type === 'branch' ? curPlayer.value.tile : null));
const branchArrows = computed(() => {
  if (branchTile.value === null) return [];
  const [fx, fy] = SCREEN_TILES[branchTile.value].c;
  return ['A', 'B'].map((loop) => {
    const [tx, ty] = SCREEN_TILES[CROSSES[branchTile.value][loop]].c;
    const dx = tx - fx, dy = ty - fy;
    const ang = Math.atan2(dy, dx);
    const ax = fx + dx * 0.9, ay = fy + dy * 0.9;
    const head = [0, 2.6, -2.6].map((d, k) => (k === 0
      ? `${ax},${ay}`
      : `${ax - 34 * Math.cos(ang + d / 6)},${ay - 34 * Math.sin(ang + d / 6)}`)).join(' ');
    return {
      loop, fx, fy, ax, ay, head,
      mx: fx + dx * 0.6, my: fy + dy * 0.6,
      color: loop === 'A' ? '#93c5fd' : '#c4b5fd',
      name: loop === 'A' ? '外环' : '内环',
    };
  });
});
</script>

<template>
  <svg :viewBox="`0 0 ${SCREEN_W} ${SCREEN_H}`" class="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
    <image :href="BOARD_BG" x="0" y="0" :width="SCREEN_W" :height="SCREEN_H" preserveAspectRatio="none" />

    <!-- 格子热区：悬停显示地块说明；当前格描边 -->
    <g>
      <polygon
        v-for="t in tiles" :key="'h' + t.i" :points="t.points"
        :fill="t.i === branchTile ? 'rgba(34,211,238,0.25)' : 'transparent'"
        :stroke="curPlayer?.tile === t.i ? '#ffffff' : 'transparent'" stroke-width="5" stroke-linejoin="round"
      ><title>{{ t.i }} 号格 · {{ t.def.name }}：{{ t.def.desc }}</title></polygon>
    </g>

    <!-- 地块标记：格子上方的小圆徽章（不铺满格子，偏几像素也不扎眼） -->
    <g v-if="showMarks" style="pointer-events: none">
      <g v-for="t in tiles" :key="'m' + t.i" :transform="`translate(${t.c[0]}, ${t.c[1] - 26})`">
        <circle r="19" :fill="t.def.color" stroke="#ffffff" stroke-width="4" opacity="0.95" />
        <text y="7" text-anchor="middle" font-size="20" font-weight="800" fill="#1f2430">{{ t.def.label }}</text>
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

    <!-- 交点选环：两条方向箭头，点击选路 -->
    <g v-for="ar in branchArrows" :key="'br' + ar.loop" class="cursor-pointer" @click="emit('chooseBranch', ar.loop)">
      <line :x1="ar.fx" :y1="ar.fy" :x2="ar.ax" :y2="ar.ay" :stroke="ar.color" stroke-width="9" stroke-dasharray="16 12" />
      <polygon :points="ar.head" :fill="ar.color" />
      <circle :cx="ar.mx" :cy="ar.my" r="34" :fill="ar.color" stroke="#111827" stroke-width="5" />
      <text :x="ar.mx" :y="ar.my + 12" text-anchor="middle" font-size="34" font-weight="900" fill="#111827">{{ ar.loop }}</text>
      <text :x="ar.mx" :y="ar.my - 44" text-anchor="middle" font-size="26" font-weight="700" :fill="ar.color"
            stroke="#111827" stroke-width="6" paint-order="stroke">{{ ar.name }}</text>
    </g>
  </svg>
</template>
