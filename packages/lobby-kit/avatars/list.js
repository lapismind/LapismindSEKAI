/**
 * 头像清单 —— 纯数据（文件名），供各游戏侧用 Vite 资源导入后使用。
 *
 * 游戏侧集成示例：
 *   import { AVATAR_FILES, AVATAR_COUNT } from '@lapismind/lobby-kit/avatars/list'
 *   // Vite 下：
 *   const urls = AVATAR_FILES.map(f => new URL(`/avatars/${f}`, import.meta.url).href)
 *   // 或直接 import：
 *   import avatar1 from '@lapismind/lobby-kit/avatars/1.png'
 *
 * avatarId 约定：'1'~'26'（1 起），'0' 或缺省时为占位。
 */

export const AVATAR_FILES = Array.from({ length: 26 }, (_, i) => `${i + 1}.png`)

export const AVATAR_COUNT = AVATAR_FILES.length

/** 校验 avatarId 是否在合法范围 */
export function isValidAvatarId(avatarId) {
  const n = Number(avatarId)
  return Number.isInteger(n) && n >= 1 && n <= AVATAR_COUNT
}
