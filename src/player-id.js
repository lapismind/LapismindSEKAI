/**
 * playerId 生成 —— p + 时间戳(36进制) + 随机后缀，会话内唯一。
 */

export function generatePlayerId() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `p${ts}${rand}`
}

export function isValidPlayerId(id) {
  return typeof id === 'string' && id.startsWith('p') && id.length > 1
}
