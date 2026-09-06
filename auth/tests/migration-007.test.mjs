import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const authDir = path.resolve(import.meta.dirname, '..')
const wranglerCli = path.join(authDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

function wrangler(args) {
  return spawnSync(process.execPath, [wranglerCli, ...args], { cwd: authDir, encoding: 'utf8' })
}

function rows(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout).flatMap((entry) => entry.results || [])
}

test('007 creates the exact personal report table and recent index and is locally idempotent', async () => {
  const migrationName = '007_player_match_reports.sql'
  const migrationNames = await readdir(path.join(authDir, 'migrations'))
  assert.ok(migrationNames.includes(migrationName), 'migration 007 must exist before local execution')

  const persistTo = await mkdtemp(path.join(tmpdir(), 'sekai-d1-migration-007-'))
  try {
    for (const file of [
      './tests/fixtures/pre-005-clean.sql',
      './migrations/005_abracadawhat_match_v2.sql',
      './migrations/006_legendary_achievement_aliases.sql',
      `./migrations/${migrationName}`,
      `./migrations/${migrationName}`,
    ]) {
      const result = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, `--file=${file}`])
      assert.equal(result.status, 0, result.stderr || result.stdout)
    }

    const columns = rows(wrangler([
      'd1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo,
      '--command=PRAGMA table_info(player_match_reports);', '--json',
    ])).map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }))
    assert.deepEqual(columns, [
      { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
      { name: 'match_id', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'player_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'game', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'rank', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'score', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'rounds', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'player_count', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'standings_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'stories_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'unlocked_keys_json', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'finished_at', type: 'TEXT', notnull: 1, pk: 0 },
    ])

    const indexes = rows(wrangler([
      'd1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo,
      "--command=SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='player_match_reports' ORDER BY name;", '--json',
    ]))
    assert.equal(indexes.length, 2)
    assert.match(indexes.find((row) => row.name === 'sqlite_autoindex_player_match_reports_1')?.sql ?? '', /^$/)
    assert.match(indexes.find((row) => row.name === 'idx_player_match_reports_recent')?.sql ?? '', /\(player_id, game, finished_at DESC, id DESC\)/)
  } finally {
    await rm(persistTo, { recursive: true, force: true })
  }
})

test('007 and schema contain no forbidden personal-report columns', async () => {
  const sources = await Promise.all([
    readFile(path.join(authDir, 'migrations', '007_player_match_reports.sql'), 'utf8'),
    readFile(path.join(authDir, 'schema.sql'), 'utf8'),
  ])
  for (const source of sources) {
    const reportDefinition = source.match(/CREATE TABLE IF NOT EXISTS player_match_reports[\s\S]+?\);/)?.[0] ?? ''
    assert.ok(reportDefinition)
    assert.doesNotMatch(reportDefinition, /\b(chat|emoji|ip|device|hand|action)s?\b/i)
  }
})
