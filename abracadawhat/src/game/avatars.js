import { AVATAR_FILES, AVATAR_COUNT } from '@lapismind/lobby-kit/avatars/list'

const AVATAR_URLS = AVATAR_FILES.map((f) =>
  new URL(`../../node_modules/@lapismind/lobby-kit/avatars/${f}`, import.meta.url).href,
)

// 默认头像：用户未选择时显示这张（0.png）
export const DEFAULT_AVATAR_URL = new URL(
  `../../node_modules/@lapismind/lobby-kit/avatars/0.png`,
  import.meta.url,
).href

export function avatarUrl(avatarId) {
  const n = Number(avatarId)
  // 0 或非法值一律回退到默认头像，保证界面上永远有形象
  if (!Number.isInteger(n) || n < 0 || n > AVATAR_COUNT) return DEFAULT_AVATAR_URL
  if (n === 0) return DEFAULT_AVATAR_URL
  return AVATAR_URLS[n - 1]
}

// 九宫格第一格就是默认头像（未选择时高亮它）
export const avatarChoices = [
  { id: '0', url: DEFAULT_AVATAR_URL },
  ...AVATAR_URLS.map((url, i) => ({ id: String(i + 1), url })),
]
