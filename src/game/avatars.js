/**
 * game/avatars.js —— 基于 @lapismind/lobby-kit 头像资源。
 * 包提供 0-26 共 27 张 png（0 为默认占位），Vite 资源导入生成 URL。
 */

import { AVATAR_FILES, AVATAR_COUNT } from '@lapismind/lobby-kit/avatars/list'

// 0.png 为默认占位头像，排在选择列表首位
const DEFAULT_AVATAR_URL = new URL(
  `../../node_modules/@lapismind/lobby-kit/avatars/0.png`,
  import.meta.url,
).href

const AVATAR_URLS = [
  DEFAULT_AVATAR_URL,
  ...AVATAR_FILES.map((f) =>
    new URL(`../../node_modules/@lapismind/lobby-kit/avatars/${f}`, import.meta.url).href,
  ),
]

/** 根据 avatarId 返回头像 URL，'0' 为默认，非法值也回落到默认 */
export function avatarUrl(avatarId) {
  const n = Number(avatarId)
  // '0' 或非法值统一回落到默认头像
  if (!Number.isInteger(n) || n < 0 || n > AVATAR_COUNT) return DEFAULT_AVATAR_URL
  return AVATAR_URLS[n]
}

/** 头像选择列表（用于大厅选择） */
export const avatarChoices = AVATAR_URLS.map((url, i) => ({
  id: String(i),
  url,
}))




