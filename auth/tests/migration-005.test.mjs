import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const authDir = path.resolve(import.meta.dirname, '..')
const wranglerCli = path.join(authDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

function run(args) {
  return spawnSync(process.execPath, [wranglerCli, ...args], {
    cwd: authDir,
    encoding: 'utf8',
  })
}

test('005 preflight detects historical duplicates and fixture does not run migration blindly', async () => {
  const persistTo = await mkdtemp(path.join(tmpdir(), 'sekai-d1-preflight-'))
  try {
    const fixture = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--file=./tests/fixtures/pre-005-duplicates.sql'])
    assert.equal(fixture.status, 0, fixture.stderr || fixture.stdout)

    const preflight = spawnSync(process.execPath, ['./scripts/preflight-005.mjs', '--local', '--persist-to', persistTo], {
      cwd: authDir,
      encoding: 'utf8',
      shell: false,
    })
    assert.equal(preflight.status, 2)
    assert.match(preflight.stdout + preflight.stderr, /p-duplicate/)
    assert.match(preflight.stdout + preflight.stderr, /ABORT/i)

    const columns = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=PRAGMA table_info(matches);', '--json'])
    assert.equal(columns.status, 0, columns.stderr || columns.stdout)
    assert.doesNotMatch(columns.stdout, /report_id/, 'preflight failure must leave 005 unapplied')
  } finally {
    await rm(persistTo, { recursive: true, force: true })
  }
})

test('005 preflight SQL is read-only and contains no automatic cleanup', async () => {
  const sql = await import('node:fs/promises').then((fs) => fs.readFile(path.join(authDir, 'migrations', 'preflight-005-match-player-duplicates.sql'), 'utf8'))
  const executableSql = sql.replace(/^\s*--.*$/gm, '')
  assert.match(executableSql, /HAVING COUNT\(\*\) > 1/)
  assert.doesNotMatch(executableSql, /\b(DELETE|UPDATE|INSERT|REPLACE|DROP|ALTER)\b/i)
})

test('005 preflight passes clean pre-005 schema and migration adds hash/completeness constraints', async () => {
  const persistTo = await mkdtemp(path.join(tmpdir(), 'sekai-d1-migration-'))
  try {
    const fixture = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--file=./tests/fixtures/pre-005-clean.sql'])
    assert.equal(fixture.status, 0, fixture.stderr || fixture.stdout)

    const preflight = spawnSync(process.execPath, ['./scripts/preflight-005.mjs', '--local', '--persist-to', persistTo], {
      cwd: authDir,
      encoding: 'utf8',
      shell: false,
    })
    assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout)
    assert.match(preflight.stdout, /PASS/)

    const migration = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--file=./migrations/005_abracadawhat_match_v2.sql'])
    assert.equal(migration.status, 0, migration.stderr || migration.stdout)

    const schema = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT name, sql FROM sqlite_master WHERE name IN (\'matches\', \'match_players\', \'idx_matches_report_id\', \'idx_match_players_match_player\') ORDER BY name;', '--json'])
    assert.equal(schema.status, 0, schema.stderr || schema.stdout)
    assert.match(schema.stdout, /report_hash/)
    assert.match(schema.stdout, /report_status/)
    assert.match(schema.stdout, /expected_players/)
    assert.match(schema.stdout, /idx_matches_report_id/)
    assert.match(schema.stdout, /idx_match_players_match_player/)
  } finally {
    await rm(persistTo, { recursive: true, force: true })
  }
})
