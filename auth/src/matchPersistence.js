import { hashMatchReport } from './matchReports.js'

export class ReportConflictError extends Error {
  constructor() {
    super('reportId payload conflict')
    this.code = 'REPORT_CONFLICT'
  }
}

export async function persistV2MatchReport(db, report) {
  const reportHash = await hashMatchReport(report)
  await db.prepare(
    `INSERT OR IGNORE INTO matches
      (report_id, report_hash, report_status, game, room_id, rounds, expected_players, finished_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`
  ).bind(report.reportId, reportHash, report.game, report.roomId, report.rounds, report.standings.length, report.finishedAt).run()

  const match = await loadMatch(db, report.reportId)
  if (!match) throw new Error('v2 match insert did not produce a row')
  if (match.report_hash !== reportHash || match.expected_players !== report.standings.length) {
    throw new ReportConflictError()
  }

  const expectedRows = report.standings.map(storedV2Player).sort((a, b) => a.player_id.localeCompare(b.player_id))
  const beforeRows = await loadStoredV2Players(db, match.id)
  if (match.report_status !== 'complete' || JSON.stringify(beforeRows) !== JSON.stringify(expectedRows)) {
    const statements = report.standings.map((row) => playerUpsert(db, match.id, row))
    const placeholders = report.standings.map(() => '?').join(', ')
    statements.push(db.prepare(
      `DELETE FROM match_players WHERE match_id = ? AND player_id NOT IN (${placeholders})`
    ).bind(match.id, ...report.standings.map((row) => row.playerId)))
    statements.push(db.prepare(
      `UPDATE matches SET report_status = 'complete'
       WHERE id = ? AND report_hash = ?`
    ).bind(match.id, reportHash))
    await db.batch(statements)
  }

  const [completedMatch, storedRows] = await Promise.all([
    loadMatch(db, report.reportId),
    loadStoredV2Players(db, match.id),
  ])
  if (completedMatch?.report_status !== 'complete' || completedMatch.report_hash !== reportHash
      || completedMatch.expected_players !== report.standings.length
      || JSON.stringify(storedRows) !== JSON.stringify(expectedRows)) {
    throw new Error('v2 match incomplete after write')
  }

  return { matchId: match.id, reportId: report.reportId, savedReports: [], newAchievements: [] }
}

function playerUpsert(db, matchId, row) {
  return db.prepare(
    `INSERT INTO match_players
      (match_id, player_id, nickname, score, is_champion, kills, deaths, spells_cast,
       secrets_taken, rounds_survived, dragon_fails, suicides, dragon_kills, round_wins,
       round_win_points, survival_points, secret_points, round_wins_by_reason,
       max_turn_cast_count, max_turn_distinct_spells)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(match_id, player_id) DO UPDATE SET
       nickname = excluded.nickname, score = excluded.score, is_champion = excluded.is_champion,
       kills = excluded.kills, deaths = excluded.deaths, spells_cast = excluded.spells_cast,
       secrets_taken = excluded.secrets_taken, rounds_survived = excluded.rounds_survived,
       dragon_fails = excluded.dragon_fails, suicides = excluded.suicides,
       dragon_kills = excluded.dragon_kills, round_wins = excluded.round_wins,
       round_win_points = excluded.round_win_points, survival_points = excluded.survival_points,
       secret_points = excluded.secret_points, round_wins_by_reason = excluded.round_wins_by_reason,
       max_turn_cast_count = excluded.max_turn_cast_count,
       max_turn_distinct_spells = excluded.max_turn_distinct_spells`
  ).bind(
    matchId, row.playerId, row.nickname, row.score, row.rank === 1 ? 1 : 0,
    row.kills, row.deaths, JSON.stringify(row.spellCounts), 0, 0, 0, row.suicides,
    row.dragonKills, row.roundWins, row.scoreBySource.roundWinPoints,
    row.scoreBySource.survivalPoints, row.scoreBySource.secretPoints,
    JSON.stringify(row.roundWinsByReason), row.maxTurnCastCount, row.maxTurnDistinctSpells,
  )
}

function loadMatch(db, reportId) {
  return db.prepare(
    'SELECT id, report_hash, report_status, expected_players FROM matches WHERE report_id = ?'
  ).bind(reportId).first()
}

function storedV2Player(row) {
  return {
    player_id: row.playerId,
    nickname: row.nickname,
    score: row.score,
    is_champion: row.rank === 1 ? 1 : 0,
    kills: row.kills,
    deaths: row.deaths,
    spells_cast: JSON.stringify(row.spellCounts),
    secrets_taken: 0,
    rounds_survived: 0,
    dragon_fails: 0,
    suicides: row.suicides,
    dragon_kills: row.dragonKills,
    round_wins: row.roundWins,
    round_win_points: row.scoreBySource.roundWinPoints,
    survival_points: row.scoreBySource.survivalPoints,
    secret_points: row.scoreBySource.secretPoints,
    round_wins_by_reason: JSON.stringify(row.roundWinsByReason),
    max_turn_cast_count: row.maxTurnCastCount,
    max_turn_distinct_spells: row.maxTurnDistinctSpells,
  }
}

async function loadStoredV2Players(db, matchId) {
  const stored = await db.prepare(
    `SELECT player_id, nickname, score, is_champion, kills, deaths, spells_cast,
            secrets_taken, rounds_survived, dragon_fails, suicides, dragon_kills, round_wins,
            round_win_points, survival_points, secret_points, round_wins_by_reason,
            max_turn_cast_count, max_turn_distinct_spells
     FROM match_players WHERE match_id = ? ORDER BY player_id`
  ).bind(matchId).all()
  return stored.results
}
