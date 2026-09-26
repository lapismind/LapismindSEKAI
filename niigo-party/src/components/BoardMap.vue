<script setup>
/**
 * BoardMap.vue —— SVG 棋盘：环线 + 格子 + 玩家贴片
 * 棋盘系坐标旋转 45° 呈 X 形（与手绘稿一致）。
 */
import { computed } from 'vue';
import { TILES, LOOP_A, LOOP_B, TILE_COLORS, TILE_LABEL, IS_CROSS, CROSSES } from '@/game/board.js';

const props = defineProps({
  state: { type: Object, required: true },
});

const S2 = Math.SQRT1_2;
const SCALE = 46;
const rot = (x, y) => [((x - y) * S2) * SCALE, ((x + y) * S2) * SCALE];

const cells = TILES.map((t) => {
  const [sx, sy] = rot(t.x, t.y);
  return { ...t, sx, sy };
});
const lineA = LOOP_A.map((i) => { const c = cells[i]; return `${c.sx},${c.sy}`; }).join(' ');
const lineB = LOOP_B.map((i) => { const c = cells[i]; return `${c.sx},${c.sy}`; }).join(' ');

const tokens = computed(() => {
  const byTile = new Map();
  for (const p of props.state.players) {
    if (!byTile.has(p.tile)) byTile.set(p.tile, []);
    byTile.get(p.tile).push(p);
  }
  const out = [];
  for (const [tile, ps] of byTile) {
    const c = cells[tile];
    ps.forEach((p, k) => {
      const ang = (k / Math.max(ps.length, 1)) * Math.PI * 2 - Math.PI / 2;
      out.push({
        p, x: c.sx + Math.cos(ang) * 17, y: c.sy + Math.sin(ang) * 17,
        isCurrent: p.id === props.state.players[props.state.current].id,
      });
    });
  }
  return out;
});

const overlayMarks = computed(() => props.state.overlays.map((o) => {
  const c = cells[o.tile];
  return { ...o, sx: c.sx, sy: c.sy - 24 };
}));

const branchHint = computed(() => {
  const p = props.state.players[props.state.current];
  return props.state.pending?.type === 'branch' ? p.tile : null;
});
const branchTargets = computed(() => {
  if (branchHint.value === null) return null;
  return CROSSES[branchHint.value];
});
const cellStroke = (t) => {
  if (t.type === 'cross') return '#fde047';
  if (branchHint.value === t.i) return '#22d3ee';
  if (props.state.players[props.state.current]?.tile === t.i) return '#ffffff';
  return 'rgba(229,231,235,0.55)';
};
const cellWidth = (t) => (t.type === 'cross' ? 3 : 1.5);
</script>

<template>
  <svg viewBox="-330 -330 660 660" class="w-full h-full select-none">
    <!-- 环线 -->
    <polyline :points="lineA" fill="none" stroke="#3d4d68" stroke-width="3" stroke-linejoin="round" />
    <polyline :points="lineB" fill="none" stroke="#4d3d68" stroke-width="3" stroke-linejoin="round" />

    <!-- 格子 -->
    <g v-for="c in cells" :key="c.i">
      <rect
        :x="c.sx - 15" :y="c.sy - 15" width="30" height="30" rx="6"
        :fill="TILE_COLORS[c.type]" :stroke="cellStroke(c)" :stroke-width="cellWidth(c)"
      />
      <text :x="c.sx" :y="c.sy - 1" text-anchor="middle" font-size="10" fill="#1f2430" font-weight="600">{{ c.i }}</text>
      <text :x="c.sx" :y="c.sy + 10" text-anchor="middle" font-size="9" fill="#1f2430">{{ TILE_LABEL[c.type] }}</text>
    </g>

    <!-- 陷阱/路障标记 -->
    <g v-for="(o, i) in overlayMarks" :key="'ov' + i">
      <circle :cx="o.sx + 14" :cy="o.sy + 14" r="6" fill="#111827" stroke="#f87171" stroke-width="1.5" />
      <text :x="o.sx + 14" :y="o.sy + 17.5" text-anchor="middle" font-size="8" fill="#f87171">⚠</text>
    </g>

    <!-- 玩家贴片 -->
    <g v-for="tk in tokens" :key="tk.p.id">
      <circle :cx="tk.x" :cy="tk.y" r="14" :fill="tk.p.color" opacity="0.35"
              :stroke="tk.isCurrent ? '#fde047' : 'transparent'" stroke-width="2" />
      <image
        :x="tk.x - 13" :y="tk.y - 13" width="26" height="26"
        :href="`/assets/niigo/chibi_base/${tk.p.img}.png`"
        :class="{ 'animate-pulse': tk.isCurrent }"
      />
    </g>
  </svg>
</template>
