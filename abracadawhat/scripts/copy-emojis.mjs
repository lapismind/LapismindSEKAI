#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const src = join(import.meta.dirname, '..', '..', 'packages', 'chat-kit', 'emojis')
const dest = join(import.meta.dirname, '..', 'dist', 'chat-kit', 'emojis')

console.log('Copying emojis from', src, 'to', dest)

// Create destination directory
mkdirSync(dest, { recursive: true })

// Copy all subdirectories except 'cb'
for (const name of readdirSync(src)) {
  if (name === 'cb') {
    console.log('Skipping cb folder (disabled)')
    continue
  }
  const srcPath = join(src, name)
  const destPath = join(dest, name)
  if (statSync(srcPath).isDirectory()) {
    console.log('  Copying folder:', name)
    cpSync(srcPath, destPath, { recursive: true })
  }
}

console.log('Emoji copy complete')
