/**
 * generate-emoji-manifest.js
 * 扫描 emojis/ 目录，生成 src/emoji-manifest.json
 * 排除 cb 文件夹
 */
import { readdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// 与 copy-emojis.mjs 保持一致，统一用 import.meta.dirname 定位（Node 20.11+）
const rootDir = join(import.meta.dirname, '..')
const emojisDir = join(rootDir, 'emojis')
const outputPath = join(rootDir, 'src', 'emoji-manifest.json')

const SKIP_FOLDERS = ['cb']

function generateManifest() {
  if (!existsSync(emojisDir)) {
    console.error('emojis directory not found:', emojisDir)
    process.exit(1)
  }

  const folders = readdirSync(emojisDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !SKIP_FOLDERS.includes(d.name))
    .map(d => d.name)
    .sort((a, b) => {
      const na = parseInt(a)
      const nb = parseInt(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
      if (!isNaN(na)) return -1
      if (!isNaN(nb)) return 1
      return a.localeCompare(b)
    })

  const manifest = {}

  for (const folder of folders) {
    const folderPath = join(emojisDir, folder)
    const files = readdirSync(folderPath)
      .filter(f => f.endsWith('.png') || f.endsWith('.gif') || f.endsWith('.jpg') || f.endsWith('.webp'))
      .sort()

    manifest[folder] = files.map(file => ({
      file,
      path: `/chat-kit/emojis/${folder}/${file}`
    }))
  }

  writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8')
  
  let total = 0
  for (const folder of Object.keys(manifest)) {
    total += manifest[folder].length
  }
  console.log(`Generated manifest: ${Object.keys(manifest).length} folders, ${total} emojis`)
}

generateManifest()
