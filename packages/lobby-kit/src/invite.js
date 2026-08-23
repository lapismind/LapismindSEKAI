/**
 * 邀请链接 —— 纯函数，不依赖 Vue / Router。
 *
 * 游戏侧集成示例：
 *   import { buildInviteUrl, copyToClipboard, readRoomCodeFromUrl } from '@lapismind/lobby-kit'
 *
 *   // 复制邀请链接（RoomView 里）
 *   const url = buildInviteUrl(window.location.origin, roomId)
 *   const ok = await copyToClipboard(url)
 *
 *   // 大厅读取 URL 里的房间码
 *   const code = readRoomCodeFromUrl() // null 或大写后的房间码
 */

/**
 * 构建邀请链接。
 * @param {string} origin - 站点 origin
 * @param {string} roomId - 房间码
 * @param {{ paramName?: string }} [opts]
 * @returns {string} 完整 URL 字符串
 */
export function buildInviteUrl(origin, roomId, opts = {}) {
  const paramName = opts.paramName ?? 'room'
  const url = new URL(origin)
  url.searchParams.set(paramName, String(roomId).toUpperCase())
  return url.toString()
}

/**
 * 从当前页面 URL 读取房间码（大写化）。没有则返回 null。
 * @param {{ paramName?: string }} [opts]
 * @returns {string | null}
 */
export function readRoomCodeFromUrl(opts = {}) {
  if (typeof window === 'undefined' || !window.location) return null
  const paramName = opts.paramName ?? 'room'
  const raw = new URLSearchParams(window.location.search).get(paramName)
  return raw ? raw.trim().toUpperCase() : null
}

/**
 * 写剪贴板；clipboard API 不可用时抛错由调用方兜底。返回 true 表示成功。
 */
export async function copyToClipboard(text) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('clipboard unavailable')
  }
  await navigator.clipboard.writeText(text)
  return true
}
