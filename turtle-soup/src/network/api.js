/**
 * network/api.js
 * REST 调用 —— 谜题库（PuzzleLib DO）。
 */

async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `请求失败: ${res.status}`)
  }
  return res.json()
}

export const api = {
  /** 谜题列表（不含汤底） */
  listPuzzles() {
    return request('/api/puzzles')
  },
  /** 录入自定义谜题 */
  addPuzzle(puzzle) {
    return request('/api/puzzles', { method: 'POST', body: JSON.stringify(puzzle) })
  },
  /** 提交反馈 */
  feedback(data) {
    return request('/api/feedback', { method: 'POST', body: JSON.stringify(data) })
  },
}
