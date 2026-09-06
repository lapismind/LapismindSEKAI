export async function computeCareer(playerId, env) {
  const aggregate = await env.DB.prepare(
    `WITH complete_rows AS (
       SELECT mp.*,
         CASE WHEN json_valid(mp.spells_cast) THEN mp.spells_cast ELSE '{}' END AS safe_spells,
         CASE WHEN json_valid(mp.round_wins_by_reason) THEN mp.round_wins_by_reason ELSE '{}' END AS safe_reasons
       FROM match_players mp JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = ? AND m.report_status = 'complete'
     )
     SELECT
       COUNT(*) AS matchesCompleted,
       SUM(is_champion) AS championships,
       SUM(round_wins) AS roundWins,
       SUM((
         SELECT COALESCE(SUM(
           CASE
             WHEN je.key IN ('1', '2', '3', '4', '5', '6', '7', '8')
               AND je.type = 'integer' AND je.value >= 0
             THEN je.value ELSE 0
           END
         ), 0)
         FROM json_each(complete_rows.safe_spells) je
       )) AS totalCasts,
       SUM(kills) AS kills,
       SUM(dragon_kills) AS dragonKills,
       SUM(deaths) AS deaths,
       SUM(suicides) AS suicides,
       MAX(max_turn_cast_count) AS maxTurnCastCount,
       SUM(CASE
         WHEN json_type(safe_reasons, '$.kill') = 'integer'
           AND json_extract(safe_reasons, '$.kill') >= 0
         THEN json_extract(safe_reasons, '$.kill') ELSE 0
       END) AS killRoundWins,
       SUM(CASE
         WHEN json_type(safe_reasons, '$.all_spells') = 'integer'
           AND json_extract(safe_reasons, '$.all_spells') >= 0
         THEN json_extract(safe_reasons, '$.all_spells') ELSE 0
       END) AS allSpellsRoundWins
     FROM complete_rows`
  ).bind(playerId).first()

  const { results = [] } = await env.DB.prepare(
    `WITH complete_rows AS (
       SELECT CASE WHEN json_valid(mp.spells_cast) THEN mp.spells_cast ELSE '{}' END AS safe_spells
       FROM match_players mp JOIN matches m ON m.id = mp.match_id
       WHERE mp.player_id = ? AND m.report_status = 'complete'
     )
     SELECT CAST(je.key AS INTEGER) AS spellId, SUM(je.value) AS cnt
     FROM complete_rows, json_each(complete_rows.safe_spells) je
     WHERE je.key IN ('1', '2', '3', '4', '5', '6', '7', '8')
       AND je.type = 'integer' AND je.value > 0
     GROUP BY je.key
     ORDER BY spellId`
  ).bind(playerId).all()

  const spellCounts = {}
  let favoriteSpellId = null
  let favoriteCount = -1
  for (const row of results) {
    const spellId = Number(row.spellId)
    const count = Number(row.cnt)
    spellCounts[spellId] = count
    if (count > favoriteCount || (count === favoriteCount && spellId < favoriteSpellId)) {
      favoriteSpellId = spellId
      favoriteCount = count
    }
  }

  return {
    matchesCompleted: aggregate?.matchesCompleted || 0,
    championships: aggregate?.championships || 0,
    roundWins: aggregate?.roundWins || 0,
    totalCasts: aggregate?.totalCasts || 0,
    spellCounts,
    kills: aggregate?.kills || 0,
    dragonKills: aggregate?.dragonKills || 0,
    deaths: aggregate?.deaths || 0,
    suicides: aggregate?.suicides || 0,
    favoriteSpellId,
    spellTypesUsed: results.length,
    maxTurnCastCount: aggregate?.maxTurnCastCount || 0,
    roundWinsByReason: {
      kill: aggregate?.killRoundWins || 0,
      all_spells: aggregate?.allSpellsRoundWins || 0,
    },
  }
}
