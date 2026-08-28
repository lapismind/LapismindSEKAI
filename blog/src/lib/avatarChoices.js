// 本地头像资源清单：从 lobby-kit 的 avatars 目录收集 1-26 号头像，
// 供个人资料页头像选择、Header 头像岛共用。Vite 在构建期解析 glob 并产出正确资源 URL。
const modules = import.meta.glob(
  '../../node_modules/@lapismind/lobby-kit/avatars/*.png',
  { eager: true, import: 'default' }
)

export const avatarChoices = Object.entries(modules)
  .map(([path, mod]) => {
    const id = path.match(/(\d+)\.png$/)?.[1]
    return { id, url: typeof mod === 'string' ? mod : mod?.src || mod }
  })
  .filter((a) => a.id && a.id !== '0') // 0 号是游客占位，不进可选列表
  .sort((a, b) => Number(a.id) - Number(b.id))

const urlMap = new Map(avatarChoices.map((a) => [a.id, a.url]))

/** 按 avatarId 取本地头像 URL；非法 id 返回 null（调用方回退到默认头像） */
export function avatarUrlById(id) {
  const n = Number(id)
  if (!Number.isInteger(n) || n < 1 || n > avatarChoices.length) return null
  return urlMap.get(String(n)) || null
}
