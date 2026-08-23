/**
 * game/judgeFx.js
 * 判定动图反馈映射 —— 每种判定对应一张奶茶鼠动图。
 *
 * 动图文件名约定：
 * - yes.gif        → 回答"是"
 * - no.gif         → 回答"否"
 * - or.gif         → 回答"是也不是"（模糊）
 * - nonsense.gif   → 回答"无关"
 * - win.gif        → 猜中/通关
 */

import { JUDGE } from './judge'

// Vite 打包时自动处理资源 URL（import.meta.glob eager 会内联 hash 路径）
const gifs = import.meta.glob('../assets/*.gif', { eager: true, import: 'default' })

const FILE_MAP = {
  [JUDGE.YES]: 'yes.gif',
  [JUDGE.NO]: 'no.gif',
  [JUDGE.AMBIGUOUS]: 'or.gif',
  [JUDGE.IRRELEVANT]: 'nonsense.gif',
  [JUDGE.CORRECT]: 'win.gif',
}

export const JUDGE_FX = Object.fromEntries(
  Object.entries(FILE_MAP).map(([judge, file]) => [judge, gifs[`../assets/${file}`] ?? null]),
)

/** 判断某条消息是否有对应动图 */
export function judgeHasFx(judge) {
  return judge in FILE_MAP
}
