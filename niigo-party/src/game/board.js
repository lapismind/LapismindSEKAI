/**
 * src/game/board.js —— 68 格双矩形 45° 互穿棋盘的拓扑数据（规格见 docs/specs/2026-09-26-niigo-party-spec.md §3）
 *
 * 结构：外环 A（横矩形 36 格）+ 内环 B（竖矩形 36 格）互穿，周线交于 4 个交点
 * （中央正方形四角），走到交点可二选一切环。地块分布 180° 中心对称。
 *
 * 坐标 (x, y) 为"棋盘系"直角坐标（未旋转），渲染层负责旋转 45° 呈 X 形。
 * 纯数据模块：不依赖 Vue / DOM，可被服务器端复用。
 */

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

// ── 地块类型表（180° 中心对称，规格 §3.2）──────────────────
const A_TYPES = {
  0: 'start', 1: 'coin', 2: 'card', 3: 'coin', 4: 'cross', 5: 'swift', 6: 'coin',
  7: 'card', 8: 'misfortune', 9: 'cross', 10: 'coin', 11: 'coin', 12: 'card',
  13: 'misfortune', 14: 'shop', 15: 'swift', 16: 'teleport', 17: 'coin',
  18: 'start', 19: 'coin', 20: 'card', 21: 'coin', 22: 'cross', 23: 'swift',
  24: 'coin', 25: 'card', 26: 'misfortune', 27: 'cross', 28: 'coin', 29: 'coin',
  30: 'card', 31: 'misfortune', 32: 'shop', 33: 'swift', 34: 'teleport', 35: 'coin',
};
// B 自有格按上面 B_own_pts 的顺序编号 36..67
const B_TYPES = [
  'misfortune', // 36 (−2.5,−3.5)
  'trial',      // 37 (−2.5,−4.5)
  'card',       // 38 (−2.5,−5.5)
  'misfortune', // 39 (−2.5,−6.5)
  'coinhi',     // 40 (−1.5,−6.5)
  'coinhi',     // 41 (−0.5,−6.5)
  'coinhi',     // 42 (0.5,−6.5)
  'coinhi',     // 43 (1.5,−6.5)
  'hospital',   // 44 (2.5,−6.5)
  'upgrade',    // 45 (2.5,−5.5)
  'misfortune', // 46 (2.5,−4.5)
  'misfortune', // 47 (2.5,−3.5)
  'card',       // 48 (2.5,−1.5) 中央右缘
  'coin',       // 49 (2.5,−0.5)
  'coin',       // 50 (2.5,0.5)
  'card',       // 51 (2.5,1.5)
  'misfortune', // 52 (2.5,3.5)
  'trial',      // 53 (2.5,4.5)
  'card',       // 54 (2.5,5.5)
  'misfortune', // 55 (2.5,6.5)
  'coinhi',     // 56 (1.5,6.5)
  'coinhi',     // 57 (0.5,6.5)
  'coinhi',     // 58 (−0.5,6.5)
  'coinhi',     // 59 (−1.5,6.5)
  'hospital',   // 60 (−2.5,6.5)
  'upgrade',    // 61 (−2.5,5.5)
  'misfortune', // 62 (−2.5,4.5)
  'misfortune', // 63 (−2.5,3.5)
  'card',       // 64 (−2.5,1.5) 中央左缘
  'coin',       // 65 (−2.5,0.5)
  'coin',       // 66 (−2.5,−0.5)
  'card',       // 67 (−2.5,−1.5)
];

// ── 组装 ───────────────────────────────────────────────────
export const TILES = A_pts.map((p, i) => ({
  i,
  type: A_TYPES[i],
  x: p[0],
  y: p[1],
}));
B_own_pts.forEach((p, k) => {
  TILES.push({ i: 36 + k, type: B_TYPES[k], x: p[0], y: p[1] });
});

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
  return loopArr[(at + 1) % loopArr.length];
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
      const outs = IS_CROSS(i) ? Object.values(CROSSES[i]) : [nextTile(i, 'A'), nextTile(i, 'B')];
      for (const j of outs) {
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

export const TILE_COLORS = {
  start: '#3b82f6', upgrade: '#a855f7', shop: '#f97316', card: '#22c55e',
  coin: '#eab308', coinhi: '#f5d020', misfortune: '#ef4444', hospital: '#f9a8d4',
  swift: '#06b6d4', cross: '#fde047', teleport: '#a78bfa', trial: '#fb7185',
};
export const TILE_LABEL = {
  start: '起', upgrade: '级', shop: '店', card: '卡', coin: '财', coinhi: '财',
  misfortune: '祸', hospital: '院', swift: '疾', cross: '交', teleport: '传', trial: '试',
};
