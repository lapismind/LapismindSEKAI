import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
if (args.includes('--remote')) {
  console.error('ABORT: this preflight helper is local-only. Review remote data with an approved read-only process before migration.')
  process.exit(2)
}
if (!args.includes('--local')) {
  console.error('ABORT: pass --local. This helper never defaults to a remote database.')
  process.exit(2)
}

const persistIndex = args.indexOf('--persist-to')
const persistTo = persistIndex >= 0 ? args[persistIndex + 1] : null
if (persistIndex >= 0 && !persistTo) {
  console.error('ABORT: --persist-to requires a directory.')
  process.exit(2)
}

const authDir = fileURLToPath(new URL('..', import.meta.url))
const wranglerCli = path.join(authDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const query = readFileSync(path.join(authDir, 'operations', 'preflight', '005-match-player-duplicates.sql'), 'utf8')
const commandArgs = ['d1', 'execute', 'sekai-db', '--local', '--json', `--command=${query}`]
if (persistTo) commandArgs.splice(4, 0, '--persist-to', persistTo)

const result = spawnSync(process.execPath, [wranglerCli, ...commandArgs], {
  cwd: authDir,
  encoding: 'utf8',
})
if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'ABORT: duplicate preflight query failed.')
  process.exit(2)
}

let output
try {
  output = JSON.parse(result.stdout)
} catch {
  console.error('ABORT: could not parse Wrangler JSON output.')
  process.exit(2)
}
const duplicates = output.flatMap((entry) => entry.results || [])
if (duplicates.length > 0) {
  console.error('ABORT: historical duplicate (match_id, player_id) rows found. Review them manually; never delete or merge historical data automatically.')
  for (const row of duplicates) {
    console.error(`match_id=${row.match_id} player_id=${row.player_id} duplicate_count=${row.duplicate_count}`)
  }
  process.exit(2)
}

console.log('PASS: no historical duplicate (match_id, player_id) rows found. Migration 005 may be reviewed for application.')
