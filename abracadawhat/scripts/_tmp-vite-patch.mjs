import { readFileSync, writeFileSync } from 'node:fs'

const filePath = 'D:/LapismindSEKAI/abracadawhat/vite.config.js'
const content = readFileSync(filePath, 'utf8')

// Add alias entries after the '@' alias line
const lines = content.split('\n')
const aliasIdx = lines.findIndex(l => l.includes("'@':"))
if (aliasIdx >= 0) {
  const additions = [
    '      // Deduplicate pinia/vue for file: linked sub-packages',
    "      pinia: path.resolve(__dirname, 'node_modules/pinia'),",
    "      vue: path.resolve(__dirname, 'node_modules/vue'),",
    "      'pinia/': path.resolve(__dirname, 'node_modules/pinia/'),",
    "      'vue/': path.resolve(__dirname, 'node_modules/vue/'),",
  ]
  lines.splice(aliasIdx + 1, 0, ...additions)
  writeFileSync(filePath, lines.join('\n'))
  console.log('Patched vite.config.js with', additions.length, 'alias entries')
} else {
  console.error('Could not find alias entry in vite.config.js')
}
