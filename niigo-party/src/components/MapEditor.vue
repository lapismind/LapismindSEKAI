<script setup>
/**
 * MapEditor.vue —— 地图编辑器（仅 dev：地址加 #editor 进入）
 *
 * 在 2.5D 底图上点格子放地块。拓扑（格子位置 / 两环 / 交点）固定，只编辑"每格放什么"。
 * 保存 → POST /__niigo/layout（vite dev 中间件，写回 src/game/maps/twin-cross-68.layout.json），
 * 保存后刷新游戏即生效。校验与游戏共用 validateLayout。
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import { LAYOUT, LOOP_A, LOOP_B, mirrorTile, ringOfTile } from '@/game/board.js';
import { TILE_TYPES, PLACEABLE_TYPES, tileDef } from '@/game/tiles.js';
import { validateLayout } from '@/game/layout.js';
import { SCREEN_W, SCREEN_H, SCREEN_TILES, BOARD_BG, polyPoints } from '@/game/screen.js';

const topo = { mirrorTile, ringOfTile, LOOP_A, LOOP_B };
const DRAFT_KEY = 'niigo-party-editor-draft';

const saved = ref([...LAYOUT.types]);           // 磁盘上的版本
const types = ref(loadDraft() ?? [...LAYOUT.types]);
const brush = ref('coin');
const mirror = ref(true);                        // 中心对称联动
const hover = ref(null);
const showNumbers = ref(true);
const history = ref([]);                         // 撤销栈（每步存整份 types）
const status = ref(null);                        // {kind:'ok'|'err', text}

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    return Array.isArray(d) && d.length === LAYOUT.types.length ? d : null;
  } catch { return null; }
}
watch(types, (v) => localStorage.setItem(DRAFT_KEY, JSON.stringify(v)), { deep: true });

const result = computed(() => validateLayout(types.value, topo));
const dirty = computed(() => types.value.some((t, i) => t !== saved.value[i]));
const changed = computed(() => new Set(types.value.map((t, i) => (t !== saved.value[i] ? i : -1)).filter((i) => i >= 0)));

const cells = Object.keys(SCREEN_TILES).map(Number).map((i) => ({ i, c: SCREEN_TILES[i].c, points: polyPoints(i) }));

function paint(i) {
  if (types.value[i] === 'cross') { flash('err', `${i} 号格是交点，由拓扑固定，不能改`); return; }
  const targets = mirror.value ? [...new Set([i, mirrorTile(i)])] : [i];
  if (targets.every((k) => types.value[k] === brush.value)) return;
  history.value.push([...types.value]);
  if (history.value.length > 100) history.value.shift();
  const next = [...types.value];
  for (const k of targets) if (next[k] !== 'cross') next[k] = brush.value;
  types.value = next;
}
function pickFrom(i) { if (types.value[i] !== 'cross') brush.value = types.value[i]; }
function undo() { const prev = history.value.pop(); if (prev) types.value = prev; }
function revert() { history.value.push([...types.value]); types.value = [...saved.value]; }

let flashTimer = null;
function flash(kind, text) {
  status.value = { kind, text };
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { status.value = null; }, 3500);
}

async function save() {
  if (result.value.errors.length) { flash('err', '有错误，先修正再保存'); return; }
  try {
    const res = await fetch('/__niigo/layout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ types: types.value }),
    });
    const body = await res.json();
    if (!res.ok) { flash('err', body.errors?.join('；') ?? body.error ?? `保存失败（${res.status}）`); return; }
    saved.value = [...types.value];
    localStorage.removeItem(DRAFT_KEY);
    flash('ok', '已保存到 twin-cross-68.layout.json，刷新游戏即生效');
  } catch (e) {
    flash('err', `保存失败：${e.message}（只有 npm run dev 时可保存）`);
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ id: LAYOUT.id, types: types.value }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'twin-cross-68.layout.json'; a.click();
  URL.revokeObjectURL(a.href);
}

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
}
window.addEventListener('keydown', onKey);
onUnmounted(() => window.removeEventListener('keydown', onKey));
function backToGame() { location.hash = ''; }

const hoverInfo = computed(() => {
  if (hover.value === null) return null;
  const i = hover.value; const t = types.value[i];
  return { i, def: tileDef(t), ring: ringOfTile(i) ?? '交点', mirror: mirrorTile(i), was: saved.value[i] !== t ? tileDef(saved.value[i]).name : null };
});
</script>

<template>
  <div class="flex min-h-screen bg-slate-950 text-slate-200">
    <!-- 左：调色板 -->
    <aside class="w-60 shrink-0 space-y-3 border-r border-slate-800 p-3">
      <div>
        <h1 class="text-base font-black text-slate-100">地图编辑器</h1>
        <p class="text-[11px] text-slate-500">twin-cross-68 · 左键放置 · 右键吸取 · Ctrl+Z 撤销 · Ctrl+S 保存</p>
      </div>
      <div class="space-y-1">
        <button
          v-for="k in PLACEABLE_TYPES" :key="k"
          class="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left"
          :class="brush === k ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 hover:border-slate-600'"
          :title="TILE_TYPES[k].desc"
          @click="brush = k"
        >
          <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-black text-slate-900"
                :style="{ backgroundColor: TILE_TYPES[k].color }">{{ TILE_TYPES[k].label }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm text-slate-100">{{ TILE_TYPES[k].name }}</span>
            <span class="block truncate text-[10px] text-slate-500">{{ TILE_TYPES[k].desc }}</span>
          </span>
          <span class="text-xs tabular-nums text-slate-400">{{ result.stats?.count[k] ?? 0 }}</span>
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="mirror" type="checkbox" class="accent-amber-400" /> 中心对称联动
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="showNumbers" type="checkbox" class="accent-amber-400" /> 显示格号
      </label>
    </aside>

    <!-- 中：棋盘 -->
    <main class="relative flex-1 p-2">
      <svg :viewBox="`0 0 ${SCREEN_W} ${SCREEN_H}`" class="h-[calc(100vh-1rem)] w-full select-none" @contextmenu.prevent>
        <image :href="BOARD_BG" x="0" y="0" :width="SCREEN_W" :height="SCREEN_H" preserveAspectRatio="none" opacity="0.85" />
        <g v-for="c in cells" :key="c.i" class="cursor-pointer"
           @click="paint(c.i)" @contextmenu.prevent="pickFrom(c.i)"
           @mouseenter="hover = c.i" @mouseleave="hover = null">
          <polygon :points="c.points" :fill="tileDef(types[c.i]).color" fill-opacity="0.55"
                   :stroke="hover === c.i ? '#ffffff' : changed.has(c.i) ? '#fb923c' : 'rgba(255,255,255,0.5)'"
                   :stroke-width="hover === c.i || changed.has(c.i) ? 6 : 2" stroke-linejoin="round" />
          <text :x="c.c[0]" :y="c.c[1] + 9" text-anchor="middle" font-size="28" font-weight="900" fill="#1f2430"
                stroke="#ffffff" stroke-width="5" paint-order="stroke" style="pointer-events: none">{{ tileDef(types[c.i]).label }}</text>
          <text v-if="showNumbers" :x="c.c[0]" :y="c.c[1] + 36" text-anchor="middle" font-size="17" font-weight="700"
                fill="#ffffff" stroke="#111827" stroke-width="4" paint-order="stroke" style="pointer-events: none">{{ c.i }}</text>
        </g>
        <!-- 悬停时标出中心对称格 -->
        <polygon v-if="hover !== null && mirror" :points="polyPoints(mirrorTile(hover))" fill="none"
                 stroke="#22d3ee" stroke-width="5" stroke-dasharray="12 8" style="pointer-events: none" />
      </svg>
      <div v-if="hoverInfo" class="pointer-events-none absolute left-4 top-4 rounded-lg bg-slate-900/90 px-3 py-2 text-xs shadow-xl">
        <div class="font-bold text-slate-100">{{ hoverInfo.i }} 号格 · {{ hoverInfo.def.name }}</div>
        <div class="text-slate-400">{{ hoverInfo.def.desc }}</div>
        <div class="text-slate-500">环：{{ hoverInfo.ring }} · 对称格：{{ hoverInfo.mirror }}</div>
        <div v-if="hoverInfo.was" class="text-orange-300">原为：{{ hoverInfo.was }}</div>
      </div>
    </main>

    <!-- 右：校验 / 统计 / 保存 -->
    <aside class="w-72 shrink-0 space-y-3 border-l border-slate-800 p-3 text-sm">
      <div class="flex gap-2">
        <button class="flex-1 rounded-lg bg-amber-500 px-3 py-2 font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
                :disabled="!dirty || result.errors.length > 0" @click="save">保存</button>
        <button class="rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 disabled:opacity-40" :disabled="!history.length" @click="undo">撤销</button>
        <button class="rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600 disabled:opacity-40" :disabled="!dirty" @click="revert">还原</button>
      </div>
      <button class="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500" @click="exportJson">导出 JSON</button>
      <p class="text-xs text-slate-500">
        {{ dirty ? `未保存改动 ${changed.size} 格（橙框），草稿已自动暂存在浏览器` : '与磁盘一致' }}
      </p>
      <div v-if="status" class="rounded-lg px-3 py-2 text-xs"
           :class="status.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'">{{ status.text }}</div>

      <div>
        <h2 class="text-xs font-bold text-slate-400">校验</h2>
        <p v-if="!result.errors.length && !result.warnings.length" class="mt-1 text-xs text-emerald-400">全部通过</p>
        <p v-for="e in result.errors" :key="e" class="mt-1 text-xs text-red-400">✖ {{ e }}</p>
        <p v-for="w in result.warnings" :key="w" class="mt-1 text-xs text-amber-300">⚠ {{ w }}</p>
      </div>

      <div v-if="result.stats">
        <h2 class="text-xs font-bold text-slate-400">分环统计（交点不计）</h2>
        <table class="mt-1 w-full text-xs">
          <thead><tr class="text-slate-500"><th class="text-left font-normal">地块</th><th class="font-normal">外环 A</th><th class="font-normal">内环 B</th></tr></thead>
          <tbody>
            <tr v-for="k in PLACEABLE_TYPES" :key="k" class="border-t border-slate-800">
              <td class="py-0.5">{{ TILE_TYPES[k].name }}</td>
              <td class="text-center tabular-nums">{{ result.stats.byRing.A[k] ?? '' }}</td>
              <td class="text-center tabular-nums">{{ result.stats.byRing.B[k] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <a href="#" class="block text-xs text-slate-500 underline" @click.prevent="backToGame">← 回到游戏</a>
    </aside>
  </div>
</template>
