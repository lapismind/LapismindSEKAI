/**
 * 协议信封 —— 消息统一为 { type, data }。
 * 具体消息类型由各游戏自己的 protocol 定义，本模块只保证信封格式。
 */

export function makeMessage(type, data = {}) {
  return { type, data }
}

export function isServerMessageValid(raw) {
  if (!raw || typeof raw !== 'object') return false
  if (Array.isArray(raw)) return false
  if (typeof raw.type !== 'string') return false
  return raw.data === undefined || (typeof raw.data === 'object' && raw.data !== null && !Array.isArray(raw.data))
}
