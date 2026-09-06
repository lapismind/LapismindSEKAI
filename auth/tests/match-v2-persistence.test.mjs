import assert from 'node:assert/strict'
import { test } from 'node:test'

import worker from '../src/index.js'

function payload(overrides = {}) {
  return {
    schemaVersion: 2,
    reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
    game: 'abracadawhat',
    roomId: 'R2',
    startedAt: '2026-09-07T00:00:00.000Z',
    finishedAt: '2026-09-07T00:10:00.000Z',
    rounds: 2,
    standings: [
      { playerId: 'p1', nickname: '一号', rank: 1, score: 8, scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }, spellCounts: { 1: 1 }, kills: 1, dragonKills: 1, deaths: 0, suicides: 0, roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 }, maxTurnCastCount: 2, maxTurnDistinctSpells: 2 },
      { playerId: 'p2', nickname: '二号', rank: 2, score: 2, scoreBySource: { roundWinPoints: 0, survivalPoints: 1, secretPoints: 1 }, spellCounts: {}, kills: 0, dragonKills: 0, deaths: 1, suicides: 0, roundWins: 0, roundWinsByReason: { kill: 0, all_spells: 0 }, maxTurnCastCount: 0, maxTurnDistinctSpells: 0 },
    ],
    facts: [],
    stories: [],
    ...overrides,
  }
}

function makeTransactionalDB({ failPlayerId = null } = {}) {
  const matches = []
  const players = []
  let nextMatchId = 1

  function statement(sql) {
    return {
      sql,
      args: [],
      bind(...args) { this.args = args; return this },
      async run() { return execute(this) },
      async first() { return first(this) },
      async all() { return all(this) },
    }
  }

  function execute(stmt, state = { matches, players }) {
    const { sql, args } = stmt
    if (sql.startsWith('INSERT OR IGNORE INTO matches')) {
      if (state.matches.some((row) => row.report_id === args[0])) return { meta: { changes: 0 } }
      state.matches.push({ id: nextMatchId++, report_id: args[0], report_hash: args[1], report_status: 'pending', expected_players: args[5] })
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith('INSERT INTO match_players')) {
      const [matchId, playerId] = args
      if (playerId === failPlayerId) throw new Error('forced player failure')
      const index = state.players.findIndex((row) => row.match_id === matchId && row.player_id === playerId)
      const row = { match_id: matchId, player_id: playerId, args: [...args] }
      if (index >= 0) state.players[index] = row
      else state.players.push(row)
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith("UPDATE matches SET report_status = 'complete'")) {
      const match = state.matches.find((row) => row.id === args[0])
      match.report_status = 'complete'
      return { meta: { changes: 1 } }
    }
    if (sql.startsWith('DELETE FROM match_players')) {
      const [matchId, ...expectedPlayerIds] = args
      for (let index = state.players.length - 1; index >= 0; index--) {
        const row = state.players[index]
        if (row.match_id === matchId && !expectedPlayerIds.includes(row.player_id)) state.players.splice(index, 1)
      }
      return { meta: { changes: 1 } }
    }
    throw new Error('unsupported run: ' + sql)
  }

  function first(stmt) {
    if (stmt.sql.startsWith('SELECT id, report_hash, report_status, expected_players FROM matches')) {
      return matches.find((row) => row.report_id === stmt.args[0]) ?? null
    }
    if (stmt.sql.startsWith('SELECT COUNT(*) AS n FROM match_players')) {
      return { n: players.filter((row) => row.match_id === stmt.args[0]).length }
    }
    throw new Error('unsupported first: ' + stmt.sql)
  }

  function all(stmt) {
    if (stmt.sql.startsWith('SELECT player_id, nickname')) {
      return {
        results: players
          .filter((row) => row.match_id === stmt.args[0])
          .map((row) => {
            const args = row.args
            return {
              player_id: args[1], nickname: args[2], score: args[3], is_champion: args[4],
              kills: args[5], deaths: args[6], spells_cast: args[7],
              secrets_taken: args[8], rounds_survived: args[9], dragon_fails: args[10], suicides: args[11],
              dragon_kills: args[12], round_wins: args[13], round_win_points: args[14],
              survival_points: args[15], secret_points: args[16], round_wins_by_reason: args[17],
              max_turn_cast_count: args[18], max_turn_distinct_spells: args[19],
            }
          })
          .sort((a, b) => a.player_id.localeCompare(b.player_id)),
      }
    }
    throw new Error('unsupported all: ' + stmt.sql)
  }

  return {
    matches,
    players,
    prepare: statement,
    async batch(statements) {
      const staged = { matches: structuredClone(matches), players: structuredClone(players) }
      const results = statements.map((stmt) => execute(stmt, staged))
      matches.splice(0, matches.length, ...staged.matches)
      players.splice(0, players.length, ...staged.players)
      return results
    },
  }
}

async function post(db, body) {
  return worker.fetch(new Request('https://auth.qmzhj.top/api/matches', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db, MATCH_REPORT_SECRET: 'test-secret' })
}

test('同 reportId 同规范 payload 并发/重复返回同 matchId 且保持完整两行', async () => {
  const db = makeTransactionalDB()
  const [first, second] = await Promise.all([post(db, payload()), post(db, payload())])
  const firstBody = await first.json()
  const secondBody = await second.json()

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(firstBody.matchId, secondBody.matchId)
  assert.equal(db.matches.length, 1)
  assert.equal(db.matches[0].report_status, 'complete')
  assert.equal(db.players.length, 2)
})

test('同 reportId 不同 payload 返回 409 且不写玩家或改动已完成比赛', async () => {
  const db = makeTransactionalDB()
  const first = await post(db, payload())
  assert.equal(first.status, 200)
  const before = structuredClone({ matches: db.matches, players: db.players })

  const changed = payload({ rounds: 3 })
  const conflict = await post(db, changed)

  assert.equal(conflict.status, 409)
  assert.deepEqual({ matches: db.matches, players: db.players }, before)
})

test('同 reportId 的等价字段顺序得到同一规范 hash 而不冲突', async () => {
  const db = makeTransactionalDB()
  const first = await post(db, payload())
  assert.equal(first.status, 200)

  const reordered = payload()
  reordered.standings.reverse()
  reordered.standings[1].spellCounts = { 1: 1 }
  const second = await post(db, reordered)

  assert.equal(second.status, 200)
  assert.equal((await second.json()).matchId, (await first.json()).matchId)
})

test('hash 相同的 complete 但缺行记录会被检测并用事务批次修复', async () => {
  const db = makeTransactionalDB()
  const first = await post(db, payload())
  assert.equal(first.status, 200)
  db.players.pop()
  assert.equal(db.matches[0].report_status, 'complete')

  const repaired = await post(db, payload())

  assert.equal(repaired.status, 200)
  assert.equal(db.players.length, 2)
  assert.equal(db.matches[0].report_status, 'complete')
})

test('hash 相同会修复遗漏的 legacy 列并删除额外 player 行', async () => {
  const db = makeTransactionalDB()
  const first = await post(db, payload())
  assert.equal(first.status, 200)
  db.players[0].args[8] = 9
  db.players.push({ match_id: 1, player_id: 'p-extra', args: [1, 'p-extra', '额外', 0, 0, 0, 0, '{}', 0, 0, 0, 0, 0, 0, 0, 0, 0, '{}', 0, 0] })

  const repaired = await post(db, payload())

  assert.equal(repaired.status, 200)
  assert.deepEqual(db.players.map((row) => row.player_id).sort(), ['p1', 'p2'])
  assert.equal(db.players.find((row) => row.player_id === 'p1').args[8], 0)
})

test('玩家批量写入失败会回滚全部 career 行并保持 pending 供同 hash 重试修复', async () => {
  const db = makeTransactionalDB({ failPlayerId: 'p2' })
  const failed = await post(db, payload())

  assert.equal(failed.status, 500)
  assert.equal(db.matches.length, 1)
  assert.equal(db.matches[0].report_status, 'pending')
  assert.equal(db.players.length, 0, 'batch 失败不得留下部分 career 行')

  const repaired = makeTransactionalDB()
  repaired.matches.push(...structuredClone(db.matches))
  const retried = await post(repaired, payload())
  assert.equal(retried.status, 200)
  assert.equal(repaired.players.length, 2)
  assert.equal(repaired.matches[0].report_status, 'complete')
})
