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
    ], facts: [], stories: [
      { key: 'voluntary_stop', playerId: 'p1', tier: 'C', data: { round: 1, successCount: 3, distinctCount: 2 } },
      { key: 'voluntary_stop', playerId: 'p2', tier: 'C', data: { round: 2, successCount: 2, distinctCount: 2 } },
    ], ...overrides,
  }
}

function reportId(sequence) {
  return `abracadawhat:${sequence.toString(16).padStart(8, '0')}-e89b-42d3-a456-426614174000`
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (child.exitCode != null) throw new Error(`wrangler dev exited ${child.exitCode}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).status === 404) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('wrangler dev did not become ready')
}

test('real isolated local D1 executes persistence conflict rollback pending repair and exact rows', { timeout: 120000 }, async () => {
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
    for (const file of [
      './tests/fixtures/pre-005-clean.sql',
      './migrations/005_abracadawhat_match_v2.sql',
      './migrations/006_legendary_achievement_aliases.sql',
      './migrations/007_player_match_reports.sql',
    ]) {
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
    assert.deepEqual(firstBody.savedReports, ['p1'])
    const retry = await post(payload())
    assert.equal(retry.status, 200)
    const retryBody = await retry.json()
    assert.equal(retryBody.matchId, firstBody.matchId)
    assert.deepEqual(retryBody.newAchievements, [])
    assert.deepEqual(retryBody.savedReports, ['p1'])
    assert.equal((await post(payload({ rounds: 3 }))).status, 409)

    let query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT report_status, COUNT(mp.id) AS players FROM matches m LEFT JOIN match_players mp ON mp.match_id=m.id WHERE m.report_id IS NOT NULL GROUP BY m.id;', '--json'])
    assert.deepEqual(rows(query), [{ report_status: 'complete', players: 2 }])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT player_id, achievement_key, COUNT(*) AS n FROM achievements GROUP BY player_id, achievement_key ORDER BY player_id, achievement_key;', '--json'])
    assert.deepEqual(rows(query), [{ player_id: 'p1', achievement_key: 'different_paths', n: 1 }])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=SELECT player_id, game, rank, score, rounds, player_count, standings_json, stories_json, unlocked_keys_json, finished_at FROM player_match_reports ORDER BY id;', '--json'])
    assert.deepEqual(rows(query), [{
      player_id: 'p1', game: 'abracadawhat', rank: 1, score: 8, rounds: 2, player_count: 2,
      standings_json: '[{"playerId":"p1","nickname":"一号","rank":1,"score":8},{"playerId":"p2","nickname":"二号","rank":2,"score":2}]',
      stories_json: '[{"key":"voluntary_stop","playerId":"p1","tier":"C","data":{"round":1,"successCount":3,"distinctCount":2}}]',
      unlocked_keys_json: '["different_paths"]', finished_at: '2026-09-07T00:10:00.000Z',
    }])

    const forbidden = await post({ ...payload({ reportId: reportId(99) }), chats: [{ text: 'secret' }], emojis: ['x'], ip: '127.0.0.1', device: 'phone', hands: [], actions: [] })
    assert.equal(forbidden.status, 400)
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=SELECT standings_json || stories_json || unlocked_keys_json AS stored_json FROM player_match_reports WHERE player_id='p1';", '--json'])
    assert.doesNotMatch(rows(query)[0].stored_json, /chat|emoji|127\.0\.0\.1|device|hand|action/i)

    const corruptReport = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=UPDATE player_match_reports SET rank=9, score=999, standings_json='corrupt', stories_json='corrupt', unlocked_keys_json='corrupt' WHERE match_id=2 AND player_id='p1';"])
    assert.equal(corruptReport.status, 0, corruptReport.stderr || corruptReport.stdout)
    assert.equal((await post(payload())).status, 200)
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=SELECT rank, score, standings_json, stories_json, unlocked_keys_json FROM player_match_reports WHERE match_id=2 AND player_id='p1';", '--json'])
    assert.deepEqual(rows(query), [{
      rank: 1, score: 8,
      standings_json: '[{"playerId":"p1","nickname":"一号","rank":1,"score":8},{"playerId":"p2","nickname":"二号","rank":2,"score":2}]',
      stories_json: '[{"key":"voluntary_stop","playerId":"p1","tier":"C","data":{"round":1,"successCount":3,"distinctCount":2}}]',
      unlocked_keys_json: '["different_paths"]',
    }])

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

    const otherGame = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=INSERT INTO player_match_reports (match_id,player_id,game,rank,score,rounds,player_count,standings_json,stories_json,unlocked_keys_json,finished_at) VALUES (1,'p1','other-game',1,1,1,2,'[]','[]','[]','2020-01-01T00:00:00.000Z');"])
    assert.equal(otherGame.status, 0, otherGame.stderr || otherGame.stdout)
    for (let sequence = 1; sequence <= 10; sequence++) {
      const day = String(sequence + 7).padStart(2, '0')
      const response = await post(payload({
        reportId: reportId(sequence), roomId: `RET-${sequence}`,
        startedAt: `2026-09-${day}T00:00:00.000Z`, finishedAt: `2026-09-${day}T00:10:00.000Z`,
      }))
      const body = await response.json()
      assert.equal(response.status, 200, JSON.stringify(body))
      assert.deepEqual(body.savedReports, ['p1'])
    }
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=SELECT game, COUNT(*) AS n, MIN(finished_at) AS oldest, MAX(finished_at) AS newest FROM player_match_reports WHERE player_id='p1' GROUP BY game ORDER BY game;", '--json'])
    assert.deepEqual(rows(query), [
      { game: 'abracadawhat', n: 10, oldest: '2026-09-08T00:10:00.000Z', newest: '2026-09-17T00:10:00.000Z' },
      { game: 'other-game', n: 1, oldest: '2020-01-01T00:00:00.000Z', newest: '2020-01-01T00:00:00.000Z' },
    ])
    const evictedRetry = await post(payload())
    assert.equal(evictedRetry.status, 200)
    assert.deepEqual((await evictedRetry.json()).savedReports, [], '保留策略立即淘汰的旧报告不得宣称已保存')

    const registerP2 = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=INSERT INTO users (provider,github_id,player_id,nickname) VALUES ('github','d1-user-2','p2','持久二号');"])
    assert.equal(registerP2.status, 0, registerP2.stderr || registerP2.stdout)
    const reportTrigger = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=CREATE TRIGGER fail_personal_report BEFORE INSERT ON player_match_reports WHEN NEW.player_id = 'p2' BEGIN SELECT RAISE(ABORT, 'forced report failure'); END;"])
    assert.equal(reportTrigger.status, 0, reportTrigger.stderr || reportTrigger.stdout)
    const reportFailurePayload = payload({
      reportId: reportId(100), roomId: 'REPORT-FAIL',
      startedAt: '2026-10-01T00:00:00.000Z', finishedAt: '2026-10-01T00:10:00.000Z',
      facts: [{ key: 'round_win_low_hp', playerId: 'p1', data: { round: 2, actorHp: 1, reason: 'kill' } }],
    })
    const reportFailure = await post(reportFailurePayload)
    const reportFailureBody = await reportFailure.json()
    assert.equal(reportFailure.status, 200, JSON.stringify(reportFailureBody))
    assert.deepEqual(reportFailureBody.newAchievements.map((entry) => entry.key), ['last_breath'])
    assert.deepEqual(reportFailureBody.savedReports, ['p1'])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=SELECT report_status FROM matches WHERE report_id='abracadawhat:00000064-e89b-42d3-a456-426614174000'; SELECT achievement_key FROM achievements WHERE player_id='p1' AND match_id=(SELECT id FROM matches WHERE report_id='abracadawhat:00000064-e89b-42d3-a456-426614174000'); SELECT COUNT(*) AS reports FROM player_match_reports WHERE match_id=(SELECT id FROM matches WHERE report_id='abracadawhat:00000064-e89b-42d3-a456-426614174000');", '--json'])
    assert.deepEqual(rows(query), [{ report_status: 'complete' }, { achievement_key: 'last_breath' }, { reports: 1 }])
    assert.equal(wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, '--command=DROP TRIGGER fail_personal_report;']).status, 0)
    const repairedReport = await post(reportFailurePayload)
    const repairedReportBody = await repairedReport.json()
    assert.equal(repairedReport.status, 200)
    assert.deepEqual(repairedReportBody.newAchievements, [])
    assert.deepEqual(repairedReportBody.savedReports, ['p1', 'p2'])
    query = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, "--command=SELECT player_id, unlocked_keys_json, COUNT(*) AS n FROM player_match_reports WHERE match_id=(SELECT id FROM matches WHERE report_id='abracadawhat:00000064-e89b-42d3-a456-426614174000') GROUP BY player_id, unlocked_keys_json ORDER BY player_id;", '--json'])
    assert.deepEqual(rows(query), [
      { player_id: 'p1', unlocked_keys_json: '["last_breath"]', n: 1 },
      { player_id: 'p2', unlocked_keys_json: '[]', n: 1 },
    ])
  } finally {
    if (child?.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    await rm(root, { recursive: true, force: true })
  }
})
