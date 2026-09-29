/**
 * src/game/layout.js —— 地块布局的校验与统计（地图编辑器 + 单测共用，纯函数）
 *
 * 布局 = 68 个格号 → 地块类型（maps/*.layout.json 的 types 数组）。
 * 拓扑（格子坐标、两环、交点）由 board.js 生成，布局只决定"每格放什么"。
 *
 * errors：会让对局跑不通或违背拓扑的，保存前必须清零
 * warnings：设计约定（中心对称、起始点 ×2 …），允许有意打破，只提示
 */
import { TILE_TYPES } from './tiles.js';

export const CROSS_TILES = [4, 9, 22, 27];

/**
 * @param {string[]} types      长度 68
 * @param {object} topo         { mirrorTile, ringOfTile, LOOP_A, LOOP_B }
 */
export function validateLayout(types, topo) {
  const errors = [];
  const warnings = [];
  const n = topo.LOOP_A.length + topo.LOOP_B.length - CROSS_TILES.length;

  if (!Array.isArray(types) || types.length !== n) {
    errors.push(`应有 ${n} 格，实际 ${types?.length ?? 0}`);
    return { errors, warnings, stats: null };
  }
  types.forEach((t, i) => {
    if (!TILE_TYPES[t]) errors.push(`${i} 号格：未知地块类型「${t}」`);
  });
  for (const i of CROSS_TILES) {
    if (types[i] !== 'cross') errors.push(`${i} 号格是交点，必须保持「交点」`);
  }
  types.forEach((t, i) => {
    if (t === 'cross' && !CROSS_TILES.includes(i)) errors.push(`${i} 号格不是交点，不能放「交点」`);
  });

  const count = {};
  for (const t of types) count[t] = (count[t] ?? 0) + 1;
  if (!count.start && !count.upgrade) errors.push('没有起始点或升级格：无法升级，对局无法获胜');

  // ── 设计约定（警告）──
  const asym = [];
  types.forEach((t, i) => {
    const m = topo.mirrorTile(i);
    if (i < m && types[m] !== t) asym.push(`${i}↔${m}`);
  });
  if (asym.length) warnings.push(`中心对称被打破 ${asym.length} 处：${asym.join('、')}`);
  if ((count.start ?? 0) !== 2) warnings.push(`起始点应为 2 个（现 ${count.start ?? 0}）`);
  // 传送门按设计成对放在中心对称位置（落点即另一扇门，引擎每次移动只跳一次）
  if ((count.teleport ?? 0) % 2) warnings.push(`传送门为奇数（${count.teleport}），跳跃网不成对`);

  // ── 分环统计 ──
  const byRing = { A: {}, B: {} };
  types.forEach((t, i) => {
    const r = topo.ringOfTile(i);
    if (!r) return; // 交点属于两环，不计
    byRing[r][t] = (byRing[r][t] ?? 0) + 1;
  });

  return { errors, warnings, stats: { count, byRing } };
}
