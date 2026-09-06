import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
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

function payload(overrides = {}) {
  return {
    schemaVersion: 2,
    reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
    game: 'abracadawhat', roomId: 'REAL-D1',
    startedAt: '2026-09-07T00:00:00.000Z', finishedAt: '2026-09-07T00:10:00.000Z', rounds: 2,
    standings: [
      { playerId: 'p1', nickname: '一号', rank: 1, score: 8, scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }, spellCounts: { 1: 1 }, kills: 1, dragonKills: 1, deaths: 0, suicides: 0, roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 }, maxTurnCastCount: 2, maxTurnDistinctSpells: 2 },
      { playerId: 'p2', nickname: '二号', rank: 2, score: 2, scoreBySource: { roundWinPoints: 0, survivalPoints: 1, secretPoints: 1 }, spellCounts: {}, kills: 0, dragonKills: 0, deaths: 1, suicides: 0, roundWins: 0, roundWinsByReason: { kill: 0, all_spells: 0 }, maxTurnCastCount: 0, maxTurnDistinctSpells: 0 },
    ], facts: [], stories: [], ...overrides,
  }
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (child.exitCode != null) throw new Error(`wrangler dev exited ${child.exitCode}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).status === 404) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('wrangler dev did not become ready')
}

test('real isolated local D1 executes persistence conflict rollback pending repair and exact rows', { timeout: 60000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sekai-real-d1-'))
  const persistTo = path.join(root, 'state')
  const configPath = path.join(root, 'wrangler.jsonc')
  const port = 19731
  await writeFile(configPath, JSON.stringify({
    name: 'sekai-d1-persistence-test',
    main: path.join(authDir, 'tests', 'fixtures', 'd1-persistence-worker.js'),
    compatibility_date: '2025-06-01',
    d1_databases: [{ binding: 'DB', database_name: 'sekai-db', database_id: '93010df2-58d0-4858-ac1c-f3e9f07343ac' }],
  }))
  let child
  let stdout = ''
  let stderr = ''
  try {
    for (const file of ['./tests/fixtures/pre-005-clean.sql', './migrations/005_abracadawhat_match_v2.sql']) {
      const result = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, `--file=${file}`])
      assert.equal(result.status, 0, result.stderr || result.stdout)
    }
    child = spawn(process.execPath, [wranglerCli, 'dev', '--local', '--config', configPath, '--persist-to', persistTo, '--port', String(port)], {
      cwd: authDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    try {
      await waitFor(`http://127.0.0.1:${port}/ready`, child)
    } catch (error) {
      throw new Error(`${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`)
    }
    const post = (body) => fetch(`http://127.0.0.1:${port}/persist`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

    const first = await post(payload())
    const firstBody = await first.json()
    assert.equal(first.status, 200, JSON.stringify({ firstBody, stdout, stderr }))
    const retry = await post(payload())
    assert.equal(retry.status, 200)
    const retryBody = await retry.json()
    assert.equal(retryBody.matchId, firstBody.matchId)
    assert.deepEqual(retryBody.newAchievements, [])
    assert.equal((await post(payload({ rounds: 3 }))).status, 409)

    let query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT report_status, COUNT(mp.id) AS players FROM matches m LEFT JOIN match_players mp ON mp.match_id=m.id WHERE m.report_id IS NOT NULL GROUP BY m.id;', '--json'])
    assert.deepEqual(rows(query), [{ report_status: 'complete', players: 2 }])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT player_id, achievement_key, COUNT(*) AS n FROM achievements GROUP BY player_id, achievement_key ORDER BY player_id, achievement_key;', '--json'])
    assert.deepEqual(rows(query), [{ player_id: 'p1', achievement_key: 'different_paths', n: 1 }])

    const trigger = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=CREATE TRIGGER fail_p2 BEFORE INSERT ON match_players WHEN NEW.player_id = \'p2\' BEGIN SELECT RAISE(ABORT, \'forced\'); END;', '--json'])
    assert.equal(trigger.status, 0, trigger.stderr || trigger.stdout)
    const failing = payload({ reportId: 'abracadawhat:223e4567-e89b-42d3-a456-426614174000' })
    assert.equal((await post(failing)).status, 500)
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT m.report_status, COUNT(mp.id) AS players FROM matches m LEFT JOIN match_players mp ON mp.match_id=m.id WHERE m.report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\' GROUP BY m.id;', '--json'])
    assert.deepEqual(rows(query), [{ report_status: 'pending', players: 0 }])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT COUNT(*) AS visible_players FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE m.report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\' AND m.report_status=\'complete\';', '--json'])
    assert.deepEqual(rows(query), [{ visible_players: 0 }])

    assert.equal(wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=DROP TRIGGER fail_p2;']).status, 0)
    assert.equal((await post(failing)).status, 200)
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT player_id, secrets_taken, rounds_survived, dragon_fails FROM match_players WHERE match_id=(SELECT id FROM matches WHERE report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\') ORDER BY player_id;', '--json'])
    assert.deepEqual(rows(query), [
      { player_id: 'p1', secrets_taken: 0, rounds_survived: 0, dragon_fails: 0 },
      { player_id: 'p2', secrets_taken: 0, rounds_survived: 0, dragon_fails: 0 },
    ])

    const corrupt = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=UPDATE match_players SET secrets_taken=9, rounds_survived=9, dragon_fails=9 WHERE player_id=\'p1\' AND match_id=(SELECT id FROM matches WHERE report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\'); INSERT INTO match_players (match_id, player_id) SELECT id, \'p-extra\' FROM matches WHERE report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\';'])
    assert.equal(corrupt.status, 0, corrupt.stderr || corrupt.stdout)
    assert.equal((await post(failing)).status, 200)
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT player_id, nickname, score, is_champion, kills, deaths, spells_cast, secrets_taken, rounds_survived, dragon_fails, suicides, dragon_kills, round_wins, round_win_points, survival_points, secret_points, round_wins_by_reason, max_turn_cast_count, max_turn_distinct_spells FROM match_players WHERE match_id=(SELECT id FROM matches WHERE report_id=\'abracadawhat:223e4567-e89b-42d3-a456-426614174000\') ORDER BY player_id;', '--json'])
    assert.deepEqual(rows(query), [
      { player_id: 'p1', nickname: '一号', score: 8, is_champion: 1, kills: 1, deaths: 0, spells_cast: '{"1":1}', secrets_taken: 0, rounds_survived: 0, dragon_fails: 0, suicides: 0, dragon_kills: 1, round_wins: 2, round_win_points: 6, survival_points: 1, secret_points: 1, round_wins_by_reason: '{"kill":1,"all_spells":1}', max_turn_cast_count: 2, max_turn_distinct_spells: 2 },
      { player_id: 'p2', nickname: '二号', score: 2, is_champion: 0, kills: 0, deaths: 1, spells_cast: '{}', secrets_taken: 0, rounds_survived: 0, dragon_fails: 0, suicides: 0, dragon_kills: 0, round_wins: 0, round_win_points: 0, survival_points: 1, secret_points: 1, round_wins_by_reason: '{"kill":0,"all_spells":0}', max_turn_cast_count: 0, max_turn_distinct_spells: 0 },
    ])
  } finally {
    if (child?.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    await rm(root, { recursive: true, force: true })
  }
})
