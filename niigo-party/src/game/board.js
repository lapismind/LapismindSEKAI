/**
 * src/game/board.js —— 68 格双矩形 45° 互穿棋盘的拓扑数据（规格见 docs/specs/2026-09-26-niigo-party-spec.md §3）
 *
 * 结构：外环 A（横矩形 36 格）+ 内环 B（竖矩形 36 格）互穿，周线交于 4 个交点
 * （中央正方形四角），走到交点可二选一切环。地块分布 180° 中心对称。
 *
 * 坐标 (x, y) 为"棋盘系"直角坐标（未旋转），渲染层负责旋转 45° 呈 X 形。
 * 地块类型不写死在这里：来自 maps/*.layout.json（地图编辑器产出），行为见 tiles.js 注册表。
 * 纯数据模块：不依赖 Vue / DOM，可被服务器端复用。
 */

import layout from './maps/twin-cross-68.layout.json' with { type: 'json' };
import { TILE_TYPES } from './tiles.js';

export const MOVE_DIE = 10; // 移动骰 1d10（规格 v2.6）
export const LEVEL_COST = [15, 25, 35, 45]; // Lv1~Lv4 升级所需星币（累计 120）
export const WIN_LEVEL = 4;
export const SHOP_PRICE = 5;
export const START_COINS = 10;
export const HAND_LIMIT = 10;

// ── 路径生成（含起终点，步长 1）────────────────────────────
function edge(x0, y0, x1, y1) {
  const pts = [];
  if (y0 === y1) {
    const s = x1 > x0 ? 1 : -1;
    for (let i = 0; i <= Math.round(Math.abs(x1 - x0)); i++) pts.push([x0 + s * i, y0]);
  } else {
    const s = y1 > y0 ? 1 : -1;
    for (let i = 0; i <= Math.round(Math.abs(y1 - y0)); i++) pts.push([x0, y0 + s * i]);
  }
  return pts;
}

// 外环 A：东行上边 → 南下右边 → 西行下边 → 北上左边（顺时针）
const A_pts = [
  ...edge(-6.5, 2.5, 6.5, 2.5),
  ...edge(6.5, 2.5, 6.5, -2.5).slice(1),
  ...edge(6.5, -2.5, -6.5, -2.5).slice(1),
  ...edge(-6.5, -2.5, -6.5, 2.5).slice(1, -1),
];

// 交点（中央正方形四角）与其在外环 A 中的序号
const CROSS_IDX = { '(-2.5,2.5)': 4, '(2.5,2.5)': 9, '(2.5,-2.5)': 22, '(-2.5,-2.5)': 27 };
const key = (p) => `(${p[0]},${p[1]})`;

// 内环 B 自有格：整条周线（从交点 27 出发顺时针）生成后剔除 4 个交点
const B_perimeter = [
  ...edge(-2.5, -2.5, -2.5, -6.5).slice(1),   // 南下（不含起点交点 27）
  ...edge(-2.5, -6.5, 2.5, -6.5).slice(1),    // 底边东行（含角 2.5,−6.5）
  ...edge(2.5, -6.5, 2.5, 6.5).slice(1),      // 东边北上（含交点 12、9）
  ...edge(2.5, 6.5, -2.5, 6.5).slice(1),      // 顶边西行（含角 −2.5,6.5）
  ...edge(-2.5, 6.5, -2.5, -2.5).slice(1, -1),// 西边南下（含交点 4，不含终点 27）
];
const CROSS_KEY = new Set(Object.keys(CROSS_IDX));
const B_own_pts = B_perimeter.filter((p) => !CROSS_KEY.has(key(p)));

// ── 地块类型：来自布局文件（地图编辑器 /editor 读写它；拓扑坐标仍由本文件生成，不可编辑）──
// 格号顺序：外环 A 0..35（按 A_pts），内环 B 自有格 36..67（按 B_own_pts）
export const LAYOUT = layout;
if (!Array.isArray(layout.types) || layout.types.length !== A_pts.length + B_own_pts.length) {
  throw new Error(`布局 ${layout.id} 应有 ${A_pts.length + B_own_pts.length} 格，实际 ${layout.types?.length}`);
}

// ── 组装 ───────────────────────────────────────────────────
export const TILES = [...A_pts, ...B_own_pts].map((p, i) => ({
  i,
  type: layout.types[i],
  x: p[0],
  y: p[1],
}));

const TILE_BY_KEY = new Map(TILES.map((t) => [key([t.x, t.y]), t]));
export const LOOP_A = A_pts.map((p) => TILE_BY_KEY.get(key(p)).i);
// B 环整周（含 4 交点；27 在西边末端，补到尾部使环闭合：…67 → 27 → 36…）
export const LOOP_B = [...B_perimeter.map((p) => TILE_BY_KEY.get(key(p)).i), 27];

// 交点：i → { A: 下一格, B: 下一格 }
export const CROSSES = {
  4: { A: 5, B: 64 },
  9: { A: 10, B: 52 },
  22: { A: 23, B: 48 },
  27: { A: 28, B: 36 },
};

export const IS_CROSS = (i) => i in CROSSES;

/** 沿 loop 从 i 出发的下一格（普通格隐式环内下一格；交点由调用方先选环） */
export function nextTile(i, loop) {
  if (IS_CROSS(i)) return CROSSES[i][loop];
  const loopArr = loop === 'B' ? LOOP_B : LOOP_A;
  const at = loopArr.indexOf(i);
  if (at < 0) return undefined; // 该格不属于此环（调用方应改用 successors）
  return loopArr[(at + 1) % loopArr.length];
}

// 有向 后继表：从 LOOP_A / LOOP_B 的环序生成（交点天然有两条出边）。
// directedDistance / 射程判定一律以它为准——不得对任意格滥用 nextTile(i, 任一环)。
const SUCC = (() => {
  const m = new Map();
  const add = (i, j) => {
    if (!m.has(i)) m.set(i, []);
    if (!m.get(i).includes(j)) m.get(i).push(j);
  };
  for (const arr of [LOOP_A, LOOP_B]) {
    for (let k = 0; k < arr.length; k++) add(arr[k], arr[(k + 1) % arr.length]);
  }
  return m;
})();

/** 格 i 沿行进方向的合法后继（交点 2 条，普通格 1 条） */
export function successors(i) {
  return SUCC.get(i) ?? [];
}

// 无向邻接：每格在所属环上的前后两格（普通格 2 个，交点 4 个——两环各前后一格）。
// 移动按"朝向"走：记住上一格 prev，普通格只有一条不掉头的出路；
// 交点是十字路口，不掉头的出路有 3 条（直行 / 左转 / 右转）。
const NEI = (() => {
  const m = new Map();
  const add = (a, b) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!m.has(x)) m.set(x, []);
      if (!m.get(x).includes(y)) m.get(x).push(y);
    }
  };
  for (const arr of [LOOP_A, LOOP_B]) {
    for (let k = 0; k < arr.length; k++) add(arr[k], arr[(k + 1) % arr.length]);
  }
  return m;
})();

/** 格 i 的全部相邻格（不分方向） */
export function neighbors(i) {
  return NEI.get(i) ?? [];
}

/** 沿 loop 正向行进时 i 的上一格（用作默认朝向；i 不在该环上返回 undefined） */
export function loopPrev(i, loop) {
  const arr = loop === 'B' ? LOOP_B : LOOP_A;
  const at = arr.indexOf(i);
  return at < 0 ? undefined : arr[(at - 1 + arr.length) % arr.length];
}

/** 从 prev 走进 i 之后，下一步能去的格（不许原路掉头）：普通格 1 个，交点 3 个 */
export function exits(i, prev) {
  return neighbors(i).filter((j) => j !== prev);
}

/** 格 i 所属环；交点返回 null（两环皆是） */
export function ringOfTile(i) {
  const onA = LOOP_A.includes(i);
  const onB = LOOP_B.includes(i);
  if (onA && onB) return null;
  return onA ? 'A' : 'B';
}

/** 中心对称格（传送门落点） */
export function mirrorTile(i) {
  const t = TILES[i];
  const mk = key([-t.x, -t.y]);
  return TILE_BY_KEY.get(mk).i;
}

/** 有向图最近距离（沿行进方向，经交点可换环）；用于卡牌射程判定 */
export function directedDistance(from, to) {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  let d = 0;
  while (frontier.length && d < 68) {
    d++;
    const next = [];
    for (const i of frontier) {
      for (const j of successors(i)) {
        if (j === to) return d;
        if (!seen.has(j)) { seen.add(j); next.push(j); }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** 格子到屏幕坐标（渲染层再统一旋转 45°、缩放） */
export function tilePos(i) {
  const t = TILES[i];
  return { x: t.x, y: t.y };
}

// 兼容旧引用：颜色 / 短标签从地块注册表派生（src/game/tiles.js）
export const TILE_COLORS = Object.fromEntries(Object.entries(TILE_TYPES).map(([k, d]) => [k, d.color]));
export const TILE_LABEL = Object.fromEntries(Object.entries(TILE_TYPES).map(([k, d]) => [k, d.label]));
