export const STORY_TIERS = ['S', 'A', 'B', 'C']

const MAX_ROUND = 100
const MAX_SCORE = 1_500
const MAX_TURN_CASTS = 36
const MAX_SECRET_POINTS = 12

const RULES = {
  comeback_win: { key: 'comeback_win', tier: 'S', clean: cleanComebackWin, strength: comebackStrength },
  dragon_multi_kill: { key: 'dragon_multi_kill', tier: 'S', clean: cleanDragonMultiKill, strength: numericStrength('killCount') },
  low_hp_kill: { key: 'low_hp_kill', tier: 'A', clean: cleanLowHpKill, strength: numericStrength('targetHpBefore') },
  turn_clear_streak: { key: 'turn_clear_streak', tier: 'A', clean: cleanTurnClearStreak, strength: numericStrength('successCount') },
  survivor_secret_stack: { key: 'secret_score', tier: 'B', clean: cleanSecretScore, strength: numericStrength('secretCount') },
  round_win_routes: { key: 'round_win_routes', tier: 'B', clean: cleanRoundWinRoutes, strength: routeStrength },
  all_spell_types: { key: 'all_spell_types', tier: 'C', clean: cleanAllSpellTypes, strength: () => [] },
  voluntary_stop: { key: 'voluntary_stop', tier: 'C', clean: cleanVoluntaryStop, strength: voluntaryStopStrength },
}

const KEY_ORDER = Object.fromEntries(Object.values(RULES).map((rule, index) => [rule.key, index]))
const TIER_ORDER = Object.fromEntries(STORY_TIERS.map((tier, index) => [tier, index]))

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

function isPlayerId(value) {
  return typeof value === 'string' && value.startsWith('p') && value.length <= 64
}

function cleanComebackWin(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { playerScoreBefore, opponentScoreBefore, finalScore } = data
  if (!isIntegerBetween(playerScoreBefore, 0, 3)) return null
  if (!isIntegerBetween(opponentScoreBefore, 7, MAX_SCORE)) return null
  if (!isIntegerBetween(finalScore, 8, MAX_SCORE) || finalScore <= opponentScoreBefore) return null
  return { playerScoreBefore, opponentScoreBefore, finalScore }
}

function cleanDragonMultiKill(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { round, spellId, killCount } = data
  if (!isIntegerBetween(round, 1, MAX_ROUND) || spellId !== 1 || !isIntegerBetween(killCount, 3, 4)) return null
  return { round, spellId: 1, killCount }
}

function cleanLowHpKill(data, playerId) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { round, spellId, actorHp, targetHpBefore, targetPlayerId } = data
  if (!isIntegerBetween(round, 1, MAX_ROUND) || !isIntegerBetween(spellId, 1, 8)) return null
  if (actorHp !== 1 || !isIntegerBetween(targetHpBefore, 3, 6)) return null
  if (!isPlayerId(targetPlayerId) || targetPlayerId === playerId) return null
  return { round, spellId, actorHp: 1, targetHpBefore, targetPlayerId }
}

function cleanTurnClearStreak(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { round, successCount, reason } = data
  if (!isIntegerBetween(round, 1, MAX_ROUND) || !isIntegerBetween(successCount, 4, MAX_TURN_CASTS) || reason !== 'all_spells') return null
  return { round, successCount, reason: 'all_spells' }
}

function cleanSecretScore(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { secretCount } = data
  if (!isIntegerBetween(data.round, 1, MAX_ROUND) || !isIntegerBetween(secretCount, 3, MAX_SECRET_POINTS)) return null
  return { secretPoints: secretCount, secretCount }
}

function cleanRoundWinRoutes(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { kill, allSpells } = data
  if (!isIntegerBetween(kill, 1, MAX_ROUND) || !isIntegerBetween(allSpells, 1, MAX_ROUND)) return null
  return { kill, allSpells }
}

function cleanAllSpellTypes(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.spellIds)) return null
  const spellIds = [...data.spellIds].sort((left, right) => left - right)
  if (spellIds.length !== 8 || spellIds.some((spellId, index) => spellId !== index + 1)) return null
  return { spellIds }
}

function cleanVoluntaryStop(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const { round, successCount, distinctCount } = data
  if (!isIntegerBetween(round, 1, MAX_ROUND) || !isIntegerBetween(successCount, 2, MAX_TURN_CASTS)) return null
  if (!isIntegerBetween(distinctCount, 1, 8) || distinctCount > successCount) return null
  return { round, successCount, distinctCount }
}

function numericStrength(key) {
  return (data) => [data[key]]
}

function comebackStrength(data) {
  return [
    data.opponentScoreBefore - data.playerScoreBefore,
    data.finalScore - data.opponentScoreBefore,
    data.finalScore,
  ]
}

function routeStrength(data) {
  return [data.kill + data.allSpells, data.kill, data.allSpells]
}

function voluntaryStopStrength(data) {
  return [data.successCount, data.distinctCount]
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareStrength(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function preferCandidate(candidate, existing) {
  const strength = compareStrength(candidate.strength, existing.strength)
  if (strength !== 0) return strength > 0
  return compareText(JSON.stringify(candidate.story.data), JSON.stringify(existing.story.data)) < 0
}

function compareStories(left, right) {
  return TIER_ORDER[left.tier] - TIER_ORDER[right.tier]
    || KEY_ORDER[left.key] - KEY_ORDER[right.key]
    || compareText(left.playerId, right.playerId)
    || (left.data.round ?? 0) - (right.data.round ?? 0)
    || compareText(JSON.stringify(left.data), JSON.stringify(right.data))
}

export function selectMatchStories(facts, limit = 3) {
  if (!Array.isArray(facts)) return []
  const selected = new Map()

  for (const fact of facts) {
    if (!fact || typeof fact !== 'object' || Array.isArray(fact) || !isPlayerId(fact.playerId)) continue
    const rule = RULES[fact.key]
    if (!rule) continue
    const data = rule.clean(fact.data, fact.playerId)
    if (!data) continue

    const story = { key: rule.key, playerId: fact.playerId, tier: rule.tier, data }
    const candidate = { story, strength: rule.strength(data) }
    const family = `${story.key}\u0000${story.playerId}`
    const existing = selected.get(family)
    if (!existing || preferCandidate(candidate, existing)) selected.set(family, candidate)
  }

  const count = Number.isInteger(limit) ? Math.max(0, Math.min(3, limit)) : 3
  return [...selected.values()].map(({ story }) => story).sort(compareStories).slice(0, count)
}
