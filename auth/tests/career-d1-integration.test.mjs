import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { createSessionToken } from '@lapismind/lobby-kit'

const authDir = path.resolve(import.meta.dirname, '..')
const wranglerCli = path.join(authDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
const databaseId = '93010df2-58d0-4858-ac1c-f3e9f07343ac'
const sessionSecret = 'career-integration-secret'

function wrangler(args) {
  return spawnSync(process.execPath, [wranglerCli, ...args], { cwd: authDir, encoding: 'utf8' })
}

async function reservePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const port = server.address().port
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitFor(url, child, output) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode != null) throw new Error(`wrangler dev exited ${child.exitCode}\n${output()}`)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) })
      if (response.status === 404) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`wrangler dev did not become ready\n${output()}`)
}

test('real isolated D1 GET achievements safely computes exact career from dirty history', { timeout: 60000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sekai-career-d1-'))
  const persistTo = path.join(root, 'state')
  const configPath = path.join(root, 'wrangler.jsonc')
  const port = await reservePort()
  let child
  let stdout = ''
  let stderr = ''
  try {
    await writeFile(configPath, JSON.stringify({
      name: 'sekai-career-integration-test',
      main: path.join(authDir, 'src', 'index.js'),
      compatibility_date: '2025-06-01',
      vars: { SESSION_SECRET: sessionSecret, MATCH_REPORT_SECRET: 'unused' },
      d1_databases: [{ binding: 'DB', database_name: 'sekai-db', database_id: databaseId }],
    }))

    for (const file of ['./tests/fixtures/pre-005-career.sql', './migrations/005_abracadawhat_match_v2.sql']) {
      const result = wrangler(['d1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo, `--file=${file}`])
      assert.equal(result.status, 0, result.stderr || result.stdout)
    }
    const dirtyRows = wrangler([
      'd1', 'execute', 'sekai-db', '--local', '--persist-to', persistTo,
      `--command=${[
        "INSERT INTO matches (game, room_id, rounds, report_status) VALUES ('abracadawhat','V2',2,'complete'),('abracadawhat','PENDING',9,'pending'),('abracadawhat','BADJSON',1,'complete'),('abracadawhat','DIRTYVALUES',1,'complete');",
        "INSERT INTO match_players (match_id,player_id,nickname,is_champion,kills,deaths,spells_cast,suicides,dragon_kills,round_wins,round_wins_by_reason,max_turn_cast_count) VALUES (3,'p-career','新版',0,5,2,'{\"1\":1,\"2\":2,\"8\":4}',0,3,2,'{\"kill\":1,\"all_spells\":1}',4),(4,'p-career','待定',1,100,100,'{\"8\":100}',100,100,100,'{\"kill\":100,\"all_spells\":100}',100),(5,'p-career','坏 JSON',0,1,1,'not-json',0,0,1,'not-json',2),(6,'p-career','脏值',0,0,0,'{\"1\":-4,\"01\":9,\"2\":1.5,\"3\":\"7\",\"4\":0,\"8\":2,\"9\":100,\"foo\":100}',0,0,0,'{\"kill\":-2,\"all_spells\":1.5,\"other\":10}',3);",
      ].join(' ')}`,
    ])
    assert.equal(dirtyRows.status, 0, dirtyRows.stderr || dirtyRows.stdout)

    child = spawn(process.execPath, [wranglerCli, 'dev', '--local', '--config', configPath, '--persist-to', persistTo, '--port', String(port)], {
      cwd: authDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    await waitFor(`http://127.0.0.1:${port}/ready`, child, () => `stdout:\n${stdout}\nstderr:\n${stderr}`)

    const token = await createSessionToken({ playerId: 'p-career', provider: 'guest' }, sessionSecret)
    const response = await fetch(`http://127.0.0.1:${port}/api/achievements`, {
      headers: { cookie: `session=${token}` },
      signal: AbortSignal.timeout(5000),
    })
    const body = await response.json()
    assert.equal(response.status, 200, JSON.stringify({ body, stdout, stderr }))
    assert.deepEqual(body.career, {
      matchesCompleted: 5,
      championships: 1,
      roundWins: 3,
      totalCasts: 12,
      spellCounts: { 1: 3, 2: 3, 8: 6 },
      kills: 8,
      dragonKills: 3,
      deaths: 4,
      suicides: 1,
      favoriteSpellId: 8,
      spellTypesUsed: 3,
      maxTurnCastCount: 4,
      roundWinsByReason: { kill: 1, all_spells: 1 },
    })
  } finally {
    if (child?.pid) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    await rm(root, { recursive: true, force: true })
  }
})
