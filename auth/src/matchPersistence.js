import { hashMatchReport } from './matchReports.js'
import { ACHIEVEMENT_DEFS, evaluateAchievements, projectAchievement } from './achievements.js'

const KNOWN_ACHIEVEMENT_KEYS = new Set(ACHIEVEMENT_DEFS.map((definition) => definition.key))

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

  const unlocked = await evaluateAchievements(report)
  const achievementStatements = unlocked.map((entry) => db.prepare(
    'INSERT OR IGNORE INTO achievements (player_id, achievement_key, match_id) VALUES (?, ?, ?)'
  ).bind(entry.playerId, entry.key, match.id))
  const insertResults = achievementStatements.length > 0 ? await db.batch(achievementStatements) : []
  const newAchievements = unlocked.flatMap((entry, index) => {
    if ((insertResults[index]?.meta?.changes || 0) < 1) return []
    const projected = projectAchievement(ACHIEVEMENT_DEFS.find((definition) => definition.key === entry.key), {
      unlocked: true,
      includeUnlockState: false,
    })
    return projected ? [{ playerId: entry.playerId, ...projected }] : []
  })

  const savedReports = await persistPlayerMatchReports(db, report, match.id)

  return { matchId: match.id, reportId: report.reportId, savedReports, newAchievements }
}

async function persistPlayerMatchReports(db, report, matchId) {
  const playerIds = report.standings.map((row) => row.playerId)
  let persistentPlayerIds
  let unlockedRows
  try {
    const placeholders = playerIds.map(() => '?').join(', ')
    const [users, achievements] = await Promise.all([
      db.prepare(`SELECT player_id FROM users WHERE player_id IN (${placeholders})`).bind(...playerIds).all(),
      db.prepare('SELECT player_id, achievement_key FROM achievements WHERE match_id = ? ORDER BY id').bind(matchId).all(),
    ])
    persistentPlayerIds = new Set(users.results.map((row) => row.player_id))
    unlockedRows = achievements.results
  } catch (error) {
    console.error('personal report lookup failed:', error)
    return []
  }

  const standingsJson = JSON.stringify(report.standings.map(({ playerId, nickname, rank, score }) => ({
    playerId, nickname, rank, score,
  })))
  const savedReports = []
  for (const standing of report.standings) {
    if (!persistentPlayerIds.has(standing.playerId)) continue
    const storiesJson = JSON.stringify(report.stories.filter((story) => story.playerId === standing.playerId).slice(0, 3))
    const unlockedKeysJson = JSON.stringify([...new Set(unlockedRows
      .filter((row) => row.player_id === standing.playerId && KNOWN_ACHIEVEMENT_KEYS.has(row.achievement_key))
      .map((row) => row.achievement_key))].sort())
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO player_match_reports
            (match_id, player_id, game, rank, score, rounds, player_count,
             standings_json, stories_json, unlocked_keys_json, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(match_id, player_id) DO UPDATE SET
             game = excluded.game, rank = excluded.rank, score = excluded.score,
             rounds = excluded.rounds, player_count = excluded.player_count,
             standings_json = excluded.standings_json, stories_json = excluded.stories_json,
             unlocked_keys_json = excluded.unlocked_keys_json,
             finished_at = excluded.finished_at`
        ).bind(
          matchId, standing.playerId, report.game, standing.rank, standing.score,
          report.rounds, report.standings.length, standingsJson, storiesJson,
          unlockedKeysJson, report.finishedAt,
        ),
        db.prepare(
          `DELETE FROM player_match_reports
           WHERE player_id = ? AND game = ? AND id NOT IN (
             SELECT id FROM player_match_reports
             WHERE player_id = ? AND game = ?
             ORDER BY finished_at DESC, id DESC LIMIT 10
           )`
        ).bind(standing.playerId, report.game, standing.playerId, report.game),
      ])
      const stored = await db.prepare(
        'SELECT id FROM player_match_reports WHERE match_id = ? AND player_id = ?'
      ).bind(matchId, standing.playerId).first()
      if (stored) savedReports.push(standing.playerId)
    } catch (error) {
      console.error(`personal report storage failed for ${standing.playerId}:`, error)
    }
  }
  return savedReports
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
