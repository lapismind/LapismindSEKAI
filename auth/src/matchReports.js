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

function isCount(value, max = MAX_MATCH_EVENTS) {
  return Number.isInteger(value) && value >= 0 && value <= max
}

function isCanonicalSpellKey(key) {
  return /^[1-8]$/.test(key)
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

export function sanitizeMatchReport(body) {
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
