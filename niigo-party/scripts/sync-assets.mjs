/**
 * sync-assets.mjs —— 从素材仓库同步美术素材到 public/assets/
 *
 * 为什么要有这一步（见 AGENTS.md 的跨仓库约定）：
 *   - 美术真源在**另一个仓库**：`C:\Projects\AI-game\niigo\`
 *   - 本仓库**不提交素材**（体积大、且素材可能被别的游戏复用）
 *   - 所以 dev / build 前同步一次，产物目录 public/assets/ 已 gitignore
 *   （与 packages/design-kit 字体的处理方式一致）
 *
 * 源路径：环境变量 NIIGO_ASSET_SRC，缺省 `../../../AI-game/niigo`
 *
 * ★ 素材缺失不能让 dev/build 挂掉 —— 只警告，退出码 0。
 *   素材是分步产出的，早期必然不全；因为缺素材就起不了开发服务器，本末倒置。
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(HERE, '..')
const DEST_ROOT = join(PROJECT_ROOT, 'public', 'assets', 'niigo')
const SRC_ROOT = resolve(process.env.NIIGO_ASSET_SRC ?? join(PROJECT_ROOT, '../../../AI-game/niigo'))

// 只同步游戏运行时要用的目录；art/02_video_src（源视频）不进运行时
// 00_chibi_base：chibi 定稿基底（MVP 唯一的角色贴片源），2026-09-26 按用户确认加入
const SYNC_DIRS = [
  { from: 'art/00_chibi_base', to: 'chibi_base' },
  { from: 'art/01_portrait', to: 'portrait' },
  { from: 'art/03_frames', to: 'frames' },
  { from: 'art/04_scene', to: 'scene' },
]

async function countFiles(dir) {
  let n = 0
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += await countFiles(join(dir, e.name))
    else n++
  }
  return n
}

async function main() {
  console.log(`[sync-assets] 素材源: ${SRC_ROOT}`)

  if (!existsSync(SRC_ROOT)) {
    console.warn(`[sync-assets] ⚠️  素材源不存在，跳过同步。`)
    console.warn(`[sync-assets]    如果是另一台机器，请设 NIIGO_ASSET_SRC 指向素材仓库。`)
    console.warn(`[sync-assets]    游戏会用占位素材运行，不影响开发。`)
    return
  }

  await mkdir(DEST_ROOT, { recursive: true })

  let total = 0
  for (const { from, to } of SYNC_DIRS) {
    const src = join(SRC_ROOT, from)
    const dest = join(DEST_ROOT, to)

    if (!existsSync(src)) {
      console.log(`[sync-assets] · ${from} → 还没有内容，跳过`)
      continue
    }

    await rm(dest, { recursive: true, force: true })
    await cp(src, dest, { recursive: true })
    const n = await countFiles(dest)
    total += n
    console.log(`[sync-assets] ✓ ${from} → public/assets/niigo/${to}  (${n} 个文件)`)
  }

  console.log(`[sync-assets] 完成，共 ${total} 个文件`)
}

main().catch((err) => {
  // 同步失败同样不阻塞 —— 不能让素材问题挡住开发
  console.warn(`[sync-assets] ⚠️  同步出错，已跳过：${err.message}`)
})
