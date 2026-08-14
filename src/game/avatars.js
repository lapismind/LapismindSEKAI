/**
 * game/avatars.js —— 基于 @lapismind/lobby-kit 头像资源。
 * 包提供 26 张 png + 纯数据清单，这里用 Vite 资源导入生成 URL。
 */

import { AVATAR_FILES, AVATAR_COUNT } from '@lapismind/lobby-kit/avatars/list'

const AVATAR_URLS = AVATAR_FILES.map((f) =>
  new URL(`../../node_modules/@lapismind/lobby-kit/avatars/${f}`, import.meta.url).href,
)

/** 根据 avatarId 返回头像 URL，非法返回 null */
export function avatarUrl(avatarId) {
  const n = Number(avatarId)
  if (!Number.isInteger(n) || n < 1 || n > AVATAR_COUNT) return null
  return AVATAR_URLS[n - 1]
}

/** 头像选择列表（用于大厅选择） */
export const avatarChoices = AVATAR_URLS.map((url, i) => ({
  id: String(i + 1),
  url,
}))
