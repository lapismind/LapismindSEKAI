import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

const projectRoot = join(import.meta.dirname, '..')
const manifestPath = join(projectRoot, '..', 'packages', 'chat-kit', 'src', 'emoji-manifest.json')

test('production build contains every enabled chat emoji', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  for (const [folder, emojis] of Object.entries(manifest)) {
    if (folder === 'cb') continue

    for (const emoji of emojis) {
      const output = join(projectRoot, 'dist', 'chat-kit', 'emojis', folder, emoji.file)
      await assert.doesNotReject(access(output), `Missing built emoji: ${folder}/${emoji.file}`)
    }
  }
})
