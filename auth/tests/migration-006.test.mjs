import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const authDir = path.resolve(import.meta.dirname, '..')
const wranglerCli = path.join(authDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

function run(args) {
  return spawnSync(process.execPath, [wranglerCli, ...args], { cwd: authDir, encoding: 'utf8' })
}

function rows(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout).flatMap((entry) => entry.results || [])
}

test('006 copies only approved aliases and is idempotent after explicit pre-005 and 005 setup', async () => {
  const persistTo = await mkdtemp(path.join(tmpdir(), 'sekai-d1-c3-migration-'))
  try {
    for (const file of [
      './tests/fixtures/pre-005-c3.sql',
      './migrations/005_abracadawhat_match_v2.sql',
      './migrations/006_legendary_achievement_aliases.sql',
      './migrations/006_legendary_achievement_aliases.sql',
    ]) {
      const result = run(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, `--file=${file}`])
      assert.equal(result.status, 0, result.stderr || result.stdout)
    }

    const result = run([
      'd1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo,
      '--command=SELECT player_id, achievement_key, match_id, unlocked_at FROM achievements ORDER BY player_id, achievement_key;',
      '--json',
    ])
    assert.deepEqual(rows(result), [
      { player_id: 'p-c3', achievement_key: 'comeback', match_id: 1, unlocked_at: '2026-08-01 00:00:02' },
      { player_id: 'p-c3', achievement_key: 'double_kill', match_id: 1, unlocked_at: '2026-08-01 00:00:03' },
      { player_id: 'p-c3', achievement_key: 'dragon_sweep', match_id: 1, unlocked_at: '2026-08-01 00:00:04' },
      { player_id: 'p-c3', achievement_key: 'dragon_triple_one', match_id: 1, unlocked_at: '2026-08-01 00:00:04' },
      { player_id: 'p-c3', achievement_key: 'elemental', match_id: 1, unlocked_at: '2026-08-01 00:00:01' },
      { player_id: 'p-c3', achievement_key: 'first_cast', match_id: 1, unlocked_at: '2026-08-01 00:00:09' },
      { player_id: 'p-c3', achievement_key: 'last_breath', match_id: 1, unlocked_at: '2026-08-01 00:00:07' },
      { player_id: 'p-c3', achievement_key: 'magic_staircase', match_id: 1, unlocked_at: '2026-08-01 00:00:01' },
      { player_id: 'p-c3', achievement_key: 'not_approved', match_id: 1, unlocked_at: '2026-08-01 00:00:05' },
      { player_id: 'p-c3', achievement_key: 'pincer_finish', match_id: 1, unlocked_at: '2026-08-01 00:00:03' },
      { player_id: 'p-c3', achievement_key: 'refuse_ending', match_id: 1, unlocked_at: '2026-08-01 00:00:05' },
      { player_id: 'p-c3', achievement_key: 'secret_investor', match_id: 1, unlocked_at: '2026-08-01 00:00:06' },
      { player_id: 'p-c3', achievement_key: 'secret_rich', match_id: 1, unlocked_at: '2026-08-01 00:00:06' },
      { player_id: 'p-c3', achievement_key: 'spell_collector', match_id: 1, unlocked_at: '2026-08-01 00:00:08' },
      { player_id: 'p-c3', achievement_key: 'weak_over_strong', match_id: 1, unlocked_at: '2026-08-01 00:00:02' },
      { player_id: 'p-existing', achievement_key: 'elemental', match_id: 1, unlocked_at: '2026-08-02 00:00:01' },
      { player_id: 'p-existing', achievement_key: 'magic_staircase', match_id: 1, unlocked_at: '2026-08-03 00:00:01' },
    ])
  } finally {
    await rm(persistTo, { recursive: true, force: true })
  }
})

test('006 contains only additive approved alias copies and no destructive or inferred backfill', async () => {
  const sql = await readFile(path.join(authDir, 'migrations', '006_legendary_achievement_aliases.sql'), 'utf8')
  const executableSql = sql.replace(/^\s*--.*$/gm, '')
  assert.doesNotMatch(executableSql, /\b(DELETE|UPDATE|REPLACE|DROP|ALTER)\b/i)
  assert.equal((executableSql.match(/INSERT OR IGNORE INTO achievements/gi) || []).length, 6)
  for (const [oldKey, newKey] of [
    ['elemental', 'magic_staircase'],
    ['comeback', 'weak_over_strong'],
    ['double_kill', 'pincer_finish'],
    ['dragon_triple_one', 'dragon_sweep'],
    ['not_approved', 'refuse_ending'],
    ['secret_rich', 'secret_investor'],
  ]) {
    assert.match(executableSql, new RegExp(`'${newKey}'[\\s\\S]+achievement_key = '${oldKey}'`))
  }
  assert.doesNotMatch(executableSql, /spell_collector|one_breath|different_paths/)
})
