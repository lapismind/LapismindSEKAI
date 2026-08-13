/**
 * worker/puzzles.js
 * 内置谜题库 —— 作为模块随 Worker 一起部署。
 * 自定义谜题由 PuzzleLib DO 持久化，运行时与本内置库合并。
 */

import builtin from '../../data/puzzles.json' with { type: 'json' }

/** 返回内置谜题列表（不含自定义谜题，自定义的在 PuzzleLib storage） */
export function getBuiltinPuzzles() {
  return builtin
}
