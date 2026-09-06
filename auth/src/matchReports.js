const MAX_ROOM_ID_LENGTH = 64
const MAX_ROUNDS = 100
const MAX_SCORE = 1_500
const MAX_MATCH_EVENTS = 3_600
const MAX_TURNS = 3_600
const MAX_SPELLS_PER_TURN = 36
const MAX_HEALTH = 6
const MAX_ONE_CAST_KILLS = 4
const MAX_TOTAL_KILLS = MAX_ROUNDS * MAX_ONE_CAST_KILLS
const MAX_DEATHS = MAX_ROUNDS
const MAX_SECRETS_TAKEN = MAX_ROUNDS * 12
const MAX_ROUND_SECRETS = 12
const MAX_FAILS_IN_ROUND = 36
const MAX_REPORT_ID_LENGTH = 64
const MAX_FACTS = 100
const MAX_STORIES = 3
const MAX_STRUCTURED_DATA_KEYS = 16
const MAX_STRUCTURED_STRING_LENGTH = 64

const V2_TOP_LEVEL_KEYS = new Set([
  'schemaVersion', 'reportId', 'game', 'roomId', 'startedAt', 'finishedAt',
  'rounds', 'standings', 'facts', 'stories',
])
const V2_STANDING_KEYS = new Set([
  'playerId', 'nickname', 'rank', 'score', 'scoreBySource', 'spellCounts',
  'kills', 'dragonKills', 'deaths', 'suicides', 'roundWins',
  'roundWinsByReason', 'maxTurnCastCount', 'maxTurnDistinctSpells',
])
const SCORE_SOURCE_KEYS = new Set(['roundWinPoints', 'survivalPoints', 'secretPoints'])
const ROUND_WIN_REASON_KEYS = new Set(['kill', 'all_spells'])
const FACT_KEYS = new Set([
  'turn_distinct_spells', 'turn_clear_streak', 'all_spell_types', 'round_win_low_hp',
  'low_hp_kill', 'multi_kill_non_dragon', 'dragon_multi_kill', 'comeback_win',
  'survivor_secret_stack', 'round_win_routes', 'voluntary_stop',
])
const STORY_KEYS = new Set([
  'comeback_win', 'dragon_multi_kill', 'low_hp_kill', 'turn_clear_streak',
  'secret_score', 'round_win_routes', 'all_spell_types', 'voluntary_stop',
])
const STORY_TIERS = new Set(['S', 'A', 'B', 'C'])
const STRUCTURED_DATA_KEYS = new Set([
  'round', 'spellId', 'actorHp', 'targetHpBefore', 'targetPlayerId', 'score',
  'opponentScore', 'count', 'distinctCount', 'secretCount', 'successCount',
  'killCount', 'roundWinPoints', 'survivalPoints', 'secretPoints', 'reason',
])

function isCount(value, max = MAX_MATCH_EVENTS) {
  return Number.isInteger(value) && value >= 0 && value <= max
}

function isCanonicalSpellKey(key) {
  return /^[1-8]$/.test(key)
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key))
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length !== 24 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  return new Date(value).toISOString() === value
}

function cleanExactCounts(value, keys, max = MAX_SCORE) {
  if (!hasOnlyKeys(value, keys) || Object.keys(value).length !== keys.size) return null
  const clean = {}
  for (const key of keys) {
    if (!isCount(value[key], max)) return null
    clean[key] = value[key]
  }
  return clean
}

function cleanStructuredData(value, playerIds) {
  if (!hasOnlyKeys(value, STRUCTURED_DATA_KEYS) || Object.keys(value).length > MAX_STRUCTURED_DATA_KEYS) return null
  const clean = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === 'targetPlayerId') {
      if (typeof item !== 'string' || item.length > MAX_STRUCTURED_STRING_LENGTH || !playerIds.has(item)) return null
    } else if (key === 'reason') {
      if (!['kill', 'all_spells', 'self_destruct'].includes(item)) return null
    } else if (key === 'spellId') {
      if (!Number.isInteger(item) || item < 1 || item > 8) return null
    } else if (key === 'actorHp' || key === 'targetHpBefore') {
      if (!isCount(item, MAX_HEALTH)) return null
    } else if (key === 'round') {
      if (!isCount(item, MAX_ROUNDS)) return null
    } else if (key === 'distinctCount') {
      if (!isCount(item, 8)) return null
    } else if (!isCount(item, MAX_MATCH_EVENTS)) {
      return null
    }
    clean[key] = item
  }
  return clean
}

function cleanFacts(value, playerIds) {
  if (!Array.isArray(value) || value.length > MAX_FACTS) return null
  const clean = []
  for (const fact of value) {
    if (!hasOnlyKeys(fact, new Set(['key', 'playerId', 'data'])) || Object.keys(fact).length !== 3) return null
    if (!FACT_KEYS.has(fact.key) || !playerIds.has(fact.playerId)) return null
    const data = cleanStructuredData(fact.data, playerIds)
    if (!data) return null
    clean.push({ key: fact.key, playerId: fact.playerId, data })
  }
  return clean
}

function cleanStories(value, playerIds) {
  if (!Array.isArray(value) || value.length > MAX_STORIES) return null
  const clean = []
  for (const story of value) {
    if (!hasOnlyKeys(story, new Set(['key', 'playerId', 'tier', 'data'])) || Object.keys(story).length !== 4) return null
    if (!STORY_KEYS.has(story.key) || !playerIds.has(story.playerId) || !STORY_TIERS.has(story.tier)) return null
    const data = cleanStructuredData(story.data, playerIds)
    if (!data) return null
    clean.push({ key: story.key, playerId: story.playerId, tier: story.tier, data })
  }
  return clean
}

function cleanSpellCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  let total = 0
  for (const [key, count] of Object.entries(value)) {
    if (!isCanonicalSpellKey(key) || !isCount(count)) return null
    total += count
    if (total > MAX_MATCH_EVENTS) return null
    clean[key] = count
  }
  return clean
}

function cleanRoundSpellCasts(value) {
  if (!Array.isArray(value) || value.length > MAX_MATCH_EVENTS) return null
  const clean = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || !isCount(entry.round, MAX_ROUNDS)) return null
    if (!Number.isInteger(entry.spellId) || entry.spellId < 1 || entry.spellId > 8) return null
    clean.push({ round: entry.round, spellId: entry.spellId })
  }
  return clean
}

function cleanCastStreaks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  let total = 0
  for (const [key, streak] of Object.entries(value)) {
    if (!isCanonicalSpellKey(key) || !Array.isArray(streak)) return null
    total += streak.length
    if (total > MAX_MATCH_EVENTS || streak.some((result) => typeof result !== 'boolean')) return null
    clean[key] = [...streak]
  }
  return clean
}

function cleanTurnSpellSets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  let total = 0
  if (Object.keys(value).length > MAX_TURNS) return null
  for (const [key, spells] of Object.entries(value)) {
    const turnIndex = Number(key)
    if (!isCount(turnIndex, MAX_TURNS - 1) || String(turnIndex) !== key || !Array.isArray(spells)) return null
    total += spells.length
    if (spells.length > MAX_SPELLS_PER_TURN || total > MAX_MATCH_EVENTS) return null
    if (spells.some((id) => !Number.isInteger(id) || id < 1 || id > 8)) return null
    clean[turnIndex] = [...spells]
  }
  return clean
}

function cleanPlayer(player) {
  if (!player || typeof player !== 'object') return null
  if (typeof player.playerId !== 'string' || !player.playerId.startsWith('p') || player.playerId.length > 64) return null
  if (player.nickname != null && (typeof player.nickname !== 'string' || player.nickname.length > 64)) return null

  const countFields = [
    ['kills', MAX_TOTAL_KILLS],
    ['deaths', MAX_DEATHS],
    ['secretsTaken', MAX_SECRETS_TAKEN],
    ['roundsSurvived', MAX_ROUNDS],
    ['roundEndSecrets', MAX_ROUND_SECRETS],
    ['roundKillsNonDragon', MAX_TOTAL_KILLS],
    ['dragonKills', MAX_TOTAL_KILLS],
    ['maxFailsInRound', MAX_FAILS_IN_ROUND],
    ['dragonFails', MAX_MATCH_EVENTS],
    ['suicides', MAX_DEATHS],
  ]
  for (const [field, max] of countFields) {
    if (player[field] != null && !isCount(player[field], max)) return null
  }
  if (player.score != null && !isCount(player.score, MAX_SCORE)) return null
  if (player.finalHp != null && !isCount(player.finalHp, MAX_HEALTH)) return null
  if (player.currentTurnIndex != null && !isCount(player.currentTurnIndex, MAX_TURNS - 1)) return null
  if (player.dragonOneCastKills != null && !isCount(player.dragonOneCastKills, MAX_ONE_CAST_KILLS)) return null
  if (player.singleCastMultiKillNonDragon != null && !isCount(player.singleCastMultiKillNonDragon, MAX_ONE_CAST_KILLS)) return null

  const spellsCast = cleanSpellCounts(player.spellsCast ?? {})
  const roundSpellCasts = cleanRoundSpellCasts(player.roundSpellCasts ?? [])
  const castStreaks = cleanCastStreaks(player.castStreaks ?? {})
  const turnSpellSets = cleanTurnSpellSets(player.turnSpellSets ?? {})
  if (!spellsCast || !roundSpellCasts || !castStreaks || !turnSpellSets) return null

  return {
    playerId: player.playerId,
    nickname: player.nickname ?? null,
    score: player.score ?? 0,
    isChampion: player.isChampion === true,
    kills: player.kills ?? 0,
    deaths: player.deaths ?? 0,
    spellsCast,
    secretsTaken: player.secretsTaken ?? 0,
    roundsSurvived: player.roundsSurvived ?? 0,
    roundWonAtHp1: player.roundWonAtHp1 === true,
    roundEndSecrets: player.roundEndSecrets ?? 0,
    roundKillsNonDragon: player.roundKillsNonDragon ?? 0,
    dragonKills: player.dragonKills ?? 0,
    dragonOneCastKills: player.dragonOneCastKills ?? 0,
    finalHp: player.finalHp ?? null,
    firstRoundSuicide: player.firstRoundSuicide === true,
    roundSpellCasts,
    maxFailsInRound: player.maxFailsInRound ?? 0,
    hadFullHpThenDied: player.hadFullHpThenDied === true,
    dragonFails: player.dragonFails ?? 0,
    suicides: player.suicides ?? 0,
    castStreaks,
    turnSpellSets,
    currentTurnIndex: player.currentTurnIndex ?? 0,
    killedHighHpTarget: player.killedHighHpTarget === true,
    singleCastMultiKillNonDragon: player.singleCastMultiKillNonDragon ?? 0,
    firstTurnDragon3: player.firstTurnDragon3 === true,
    comebackFromBehind: player.comebackFromBehind === true,
    roundWonNoSecrets: player.roundWonNoSecrets === true,
    hadLowThenFullThenDied: player.hadLowThenFullThenDied === true,
    lowHpSeen: player.lowHpSeen === true,
    castOwlThisMatch: player.castOwlThisMatch === true,
  }
}

function cleanV2Standing(standing, playerCount) {
  if (!hasOnlyKeys(standing, V2_STANDING_KEYS) || Object.keys(standing).length !== V2_STANDING_KEYS.size) return null
  if (typeof standing.playerId !== 'string' || !standing.playerId.startsWith('p') || standing.playerId.length > 64) return null
  if (typeof standing.nickname !== 'string' || standing.nickname.length > 64) return null
  if (!Number.isInteger(standing.rank) || standing.rank < 1 || standing.rank > playerCount) return null
  if (!isCount(standing.score, MAX_SCORE)) return null
  const scoreBySource = cleanExactCounts(standing.scoreBySource, SCORE_SOURCE_KEYS)
  const spellCounts = cleanSpellCounts(standing.spellCounts)
  const roundWinsByReason = cleanExactCounts(standing.roundWinsByReason, ROUND_WIN_REASON_KEYS, MAX_ROUNDS)
  if (!scoreBySource || !spellCounts || !roundWinsByReason) return null
  if (!isCount(standing.kills, MAX_TOTAL_KILLS) || !isCount(standing.dragonKills, MAX_TOTAL_KILLS)) return null
  if (standing.dragonKills > standing.kills) return null
  if (!isCount(standing.deaths, MAX_DEATHS) || !isCount(standing.suicides, MAX_DEATHS)) return null
  if (!isCount(standing.roundWins, MAX_ROUNDS)) return null
  if (!isCount(standing.maxTurnCastCount, MAX_SPELLS_PER_TURN)) return null
  if (!isCount(standing.maxTurnDistinctSpells, 8)) return null

  return {
    playerId: standing.playerId,
    nickname: standing.nickname,
    rank: standing.rank,
    score: standing.score,
    scoreBySource,
    spellCounts,
    kills: standing.kills,
    dragonKills: standing.dragonKills,
    deaths: standing.deaths,
    suicides: standing.suicides,
    roundWins: standing.roundWins,
    roundWinsByReason,
    maxTurnCastCount: standing.maxTurnCastCount,
    maxTurnDistinctSpells: standing.maxTurnDistinctSpells,
  }
}

function sanitizeV2(body) {
  if (!hasOnlyKeys(body, V2_TOP_LEVEL_KEYS) || Object.keys(body).length !== V2_TOP_LEVEL_KEYS.size) {
    return { ok: false, error: 'invalid payload' }
  }
  if (typeof body.reportId !== 'string' || body.reportId.length > MAX_REPORT_ID_LENGTH
      || !/^abracadawhat:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.reportId)) {
    return { ok: false, error: 'invalid reportId' }
  }
  if (body.game !== 'abracadawhat') return { ok: false, error: 'invalid payload' }
  if (typeof body.roomId !== 'string' || body.roomId.length === 0 || body.roomId.length > MAX_ROOM_ID_LENGTH) {
    return { ok: false, error: 'invalid roomId' }
  }
  if (!isIsoTimestamp(body.startedAt) || !isIsoTimestamp(body.finishedAt) || body.finishedAt < body.startedAt) {
    return { ok: false, error: 'invalid timestamp' }
  }
  if (!isCount(body.rounds, MAX_ROUNDS)) return { ok: false, error: 'invalid rounds' }
  if (!Array.isArray(body.standings) || body.standings.length < 2 || body.standings.length > 5) {
    return { ok: false, error: 'invalid standings' }
  }

  const standings = body.standings.map((standing) => cleanV2Standing(standing, body.standings.length))
  if (standings.some((standing) => !standing)) return { ok: false, error: 'invalid standing' }
  if (new Set(standings.map((standing) => standing.playerId)).size !== standings.length) {
    return { ok: false, error: 'duplicate playerId' }
  }
  const ranks = standings.map((standing) => standing.rank).sort((a, b) => a - b)
  if (ranks.some((rank, index) => rank !== index + 1)) return { ok: false, error: 'invalid rank' }

  const playerIds = new Set(standings.map((standing) => standing.playerId))
  const facts = cleanFacts(body.facts, playerIds)
  const stories = cleanStories(body.stories, playerIds)
  if (!facts || !stories) return { ok: false, error: 'invalid facts or stories' }

  return {
    ok: true,
    version: 2,
    report: {
      schemaVersion: 2,
      reportId: body.reportId,
      game: 'abracadawhat',
      roomId: body.roomId,
      startedAt: body.startedAt,
      finishedAt: body.finishedAt,
      rounds: body.rounds,
      standings,
      facts,
      stories,
    },
  }
}

export function sanitizeMatchReport(body) {
  if (body?.schemaVersion === 2) return sanitizeV2(body)
  if (!body || typeof body !== 'object' || (body.schemaVersion != null && body.schemaVersion !== 1) || body.game !== 'abracadawhat') {
    return { ok: false, error: 'invalid payload' }
  }
  if (!Array.isArray(body.players) || body.players.length < 2 || body.players.length > 5) {
    return { ok: false, error: 'invalid players' }
  }
  if (!isCount(body.rounds ?? 0, MAX_ROUNDS)) return { ok: false, error: 'invalid rounds' }
  if (body.roomId != null && (typeof body.roomId !== 'string' || body.roomId.length > MAX_ROOM_ID_LENGTH)) {
    return { ok: false, error: 'invalid roomId' }
  }

  const players = body.players.map(cleanPlayer)
  if (players.some((player) => !player)) return { ok: false, error: 'invalid player' }
  if (new Set(players.map((player) => player.playerId)).size !== players.length) {
    return { ok: false, error: 'duplicate playerId' }
  }
  const telemetryTotals = players.reduce((totals, player) => {
    totals.spellsCast += Object.values(player.spellsCast).reduce((sum, count) => sum + count, 0)
    totals.roundSpellCasts += player.roundSpellCasts.length
    totals.castStreaks += Object.values(player.castStreaks).reduce((sum, streak) => sum + streak.length, 0)
    totals.turnSpellSets += Object.values(player.turnSpellSets).reduce((sum, spells) => sum + spells.length, 0)
    return totals
  }, { spellsCast: 0, roundSpellCasts: 0, castStreaks: 0, turnSpellSets: 0 })
  if (Object.values(telemetryTotals).some((total) => total > MAX_MATCH_EVENTS)) {
    return { ok: false, error: 'report too large' }
  }

  return {
    ok: true,
    version: 1,
    report: {
      game: 'abracadawhat',
      roomId: body.roomId ?? null,
      rounds: body.rounds ?? 0,
      players,
    },
  }
}
