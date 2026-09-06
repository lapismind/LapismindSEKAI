const MAX_INTEGER = 1_000_000

function isCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_INTEGER
}

function cleanSpellCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  for (const [key, count] of Object.entries(value)) {
    const spellId = Number(key)
    if (!Number.isInteger(spellId) || spellId < 1 || spellId > 8 || !isCount(count)) return null
    clean[spellId] = count
  }
  return clean
}

function cleanRoundSpellCasts(value) {
  if (!Array.isArray(value) || value.length > MAX_INTEGER) return null
  const clean = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || !isCount(entry.round)) return null
    if (!Number.isInteger(entry.spellId) || entry.spellId < 1 || entry.spellId > 8) return null
    clean.push({ round: entry.round, spellId: entry.spellId })
  }
  return clean
}

function cleanCastStreaks(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  for (const [key, streak] of Object.entries(value)) {
    const spellId = Number(key)
    if (!Number.isInteger(spellId) || spellId < 1 || spellId > 8 || !Array.isArray(streak)) return null
    if (streak.length > MAX_INTEGER || streak.some((result) => typeof result !== 'boolean')) return null
    clean[spellId] = [...streak]
  }
  return clean
}

function cleanTurnSpellSets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const clean = {}
  for (const [key, spells] of Object.entries(value)) {
    const turnIndex = Number(key)
    if (!isCount(turnIndex) || String(turnIndex) !== key || !Array.isArray(spells)) return null
    if (spells.length > MAX_INTEGER || spells.some((id) => !Number.isInteger(id) || id < 1 || id > 8)) return null
    clean[turnIndex] = [...spells]
  }
  return clean
}

function cleanPlayer(player) {
  if (!player || typeof player !== 'object') return null
  if (typeof player.playerId !== 'string' || !player.playerId.startsWith('p') || player.playerId.length > 64) return null
  if (player.nickname != null && (typeof player.nickname !== 'string' || player.nickname.length > 64)) return null

  const countFields = [
    'score', 'kills', 'deaths', 'secretsTaken', 'roundsSurvived', 'roundEndSecrets',
    'roundKillsNonDragon', 'dragonKills', 'dragonOneCastKills', 'maxFailsInRound',
    'dragonFails', 'suicides', 'singleCastMultiKillNonDragon', 'currentTurnIndex',
  ]
  for (const field of countFields) {
    if (player[field] != null && !isCount(player[field])) return null
  }
  if (player.finalHp != null && !isCount(player.finalHp)) return null

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
  if (!isCount(body.rounds ?? 0)) return { ok: false, error: 'invalid rounds' }
  if (body.roomId != null && typeof body.roomId !== 'string') return { ok: false, error: 'invalid roomId' }

  const players = body.players.map(cleanPlayer)
  if (players.some((player) => !player)) return { ok: false, error: 'invalid player' }

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
