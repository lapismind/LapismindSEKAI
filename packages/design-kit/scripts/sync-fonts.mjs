#!/usr/bin/env node
/**
 * sync-fonts.mjs —— 把 design-kit 里的字体资产同步到某个项目的 public/fonts/。
 *
 * 为什么需要拷贝而不是直接引用：
 *   Vite / Astro 只把项目的 public/ 目录按原路径静态托管，包目录里的文件
 *   不会自动出现在 /fonts/ 下；@font-face 里的 url() 是运行时请求，
 *   必须落在可访问的路径上。
 *
 * 用法（在消费方项目根目录执行）：
 *   node ../packages/design-kit/scripts/sync-fonts.mjs
 *   node ../../packages/design-kit/scripts/sync-fonts.mjs ./some-app
 *
 * 约定：字体二进制（5MB+）不进 git，只在 design-kit/fonts/ 放一份，
 * 各项目构建/开发前同步、并把产物目录 gitignore —— 与 chat-kit 对
 * emojis/ 的处理一致。
 */
import { cpSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const pkgRoot = join(import.meta.dirname, '..')
const srcDir = join(pkgRoot, 'fonts')

const targetArg = process.argv[2]
const targetRoot = resolve(targetArg ?? process.cwd())
const destDir = join(targetRoot, 'public', 'fonts')

function fail(message) {
  console.error('✗ sync-fonts:', message)
  process.exit(1)
}

if (!existsSync(srcDir)) {
  fail(`字体源目录不存在：${srcDir}\n  字体二进制不入库，请先确认它在本机存在（可从 blog/public/fonts 拷一份过来）。`)
}

const cssFile = join(srcDir, 'lxgwwenkaiscreen.css')
const filesDir = join(srcDir, 'files')
if (!existsSync(cssFile)) fail(`缺少 ${cssFile}`)
if (!existsSync(filesDir)) {
  fail(`缺少 ${filesDir}\n  字体二进制不入库；请把 woff2 子集放到该目录后再同步。`)
}

const subsetCount = readdirSync(filesDir).filter((name) => name.endsWith('.woff2')).length
if (subsetCount === 0) fail(`${filesDir} 里没有 woff2 子集文件`)

if (resolve(destDir) === resolve(srcDir)) {
  fail('目标就是字体源目录本身，无需同步（请在消费方项目根目录执行）。')
}

const before = existsSync(destDir) ? readdirSync(join(destDir, 'files')).length : 0

cpSync(srcDir, destDir, { recursive: true })

const after = readdirSync(join(destDir, 'files')).length
// 未变化时不刷屏，prebuild 里保持安静
if (before === after && before > 0) {
  console.log(`✓ sync-fonts: ${after} 个子集已是最新 → ${destDir}`)
} else {
  console.log(`✓ sync-fonts: ${after} 个子集 → ${destDir}`)
}

// 顺手确认 CSS 存在（拼错路径时早失败，别等到浏览器 404）
if (!statSync(join(destDir, 'lxgwwenkaiscreen.css')).isFile()) {
  fail('同步后找不到 lxgwwenkaiscreen.css')
}
