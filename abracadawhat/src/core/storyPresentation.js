const STARS_BY_TIER = Object.assign(Object.create(null), {
  S: '★★★★',
  A: '★★★',
  B: '★★',
  C: '★',
})

const TIER_BY_KEY = {
  comeback_win: 'S',
  dragon_multi_kill: 'S',
  low_hp_kill: 'A',
  turn_clear_streak: 'A',
  secret_score: 'B',
  round_win_routes: 'B',
  all_spell_types: 'C',
  voluntary_stop: 'C',
}

export function storyStars(tier) {
  return typeof tier === 'string' && Object.hasOwn(STARS_BY_TIER, tier)
    ? STARS_BY_TIER[tier]
    : null
}

function findPlayer(context, playerId) {
  return context?.players?.find(player => (player.id ?? player.playerId) === playerId) ?? null
}

function findSpell(context, spellId) {
  return context?.spells?.find(spell => spell.id === spellId) ?? null
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

export function formatStory(story, context) {
  if (!story || typeof story !== 'object' || TIER_BY_KEY[story.key] !== story.tier) return null
  const player = findPlayer(context, story.playerId)
  const data = story.data
  if (!player || !data || typeof data !== 'object') return null
  const stars = storyStars(story.tier)

  switch (story.key) {
    case 'comeback_win':
      if (![data.playerScoreBefore, data.opponentScoreBefore, data.finalScore].every(Number.isInteger)) return null
      return {
        stars,
        title: '比分翻盘',
        body: `${player.nickname}曾以 ${data.playerScoreBefore} 比 ${data.opponentScoreBefore} 落后，最终以 ${data.finalScore} 分夺冠。`,
      }
    case 'dragon_multi_kill': {
      const spell = findSpell(context, data.spellId)
      if (!positiveInteger(data.round) || !positiveInteger(data.killCount) || !spell) return null
      return {
        stars,
        title: '龙息清场',
        body: `${player.nickname}在第 ${data.round} 轮用${spell.name}一次击倒 ${data.killCount} 名对手。`,
      }
    }
    case 'low_hp_kill': {
      const spell = findSpell(context, data.spellId)
      const target = findPlayer(context, data.targetPlayerId)
      if (!positiveInteger(data.round) || data.actorHp !== 1 || !positiveInteger(data.targetHpBefore) || !spell || !target) return null
      return {
        stars,
        title: '残血反击',
        body: `${player.nickname}在第 ${data.round} 轮仅剩 1 点生命时，用${spell.name}击倒了受击前有 ${data.targetHpBefore} 点生命的${target.nickname}。`,
      }
    }
    case 'turn_clear_streak':
      if (!positiveInteger(data.round) || !positiveInteger(data.successCount) || data.reason !== 'all_spells') return null
      return {
        stars,
        title: '连续施法',
        body: `${player.nickname}在第 ${data.round} 轮连续成功施法 ${data.successCount} 次，并以清空手牌结束本轮。`,
      }
    case 'secret_score':
      if (!positiveInteger(data.secretCount) || data.secretPoints !== data.secretCount) return null
      return {
        stars,
        title: '秘密牌得分',
        body: `${player.nickname}带着 ${data.secretCount} 张秘密牌存活到轮末，并获得 ${data.secretPoints} 分。`,
      }
    case 'round_win_routes':
      if (!positiveInteger(data.kill) || !positiveInteger(data.allSpells)) return null
      return {
        stars,
        title: '两种胜法',
        body: `${player.nickname}本场靠击杀赢下 ${data.kill} 轮，也靠清空手牌赢下 ${data.allSpells} 轮。`,
      }
    case 'all_spell_types':
      if (!Array.isArray(data.spellIds) || data.spellIds.some((spellId, index) => spellId !== index + 1)) return null
      return {
        stars,
        title: '八系魔法',
        body: `${player.nickname}本场成功使用了全部 8 种魔法。`,
      }
    case 'voluntary_stop':
      if (!positiveInteger(data.round) || !positiveInteger(data.successCount) || !positiveInteger(data.distinctCount)) return null
      return {
        stars,
        title: '主动收手',
        body: `${player.nickname}在第 ${data.round} 轮连续成功施法 ${data.successCount} 次、使用 ${data.distinctCount} 种魔法后主动结束行动。`,
      }
    default:
      return null
  }
}
