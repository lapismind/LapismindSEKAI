// 出包魔法师资料页展示模型：只消费 Auth 返回的最近战报，不重新推导服务端事实。
// 玩家可见故事星级只能是 ★★★★/★★★/★★/★，内部 tier 字母永不进入展示。

const STORY_STARS = Object.assign(Object.create(null), {
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

const SPELL_NAMES = {
  1: '古代巨龙',
  2: '黑暗幽灵',
  3: '甜蜜的梦',
  4: '猫头鹰',
  5: '闪电暴风雨',
  6: '暴风雪',
  7: '火球',
  8: '魔法药水',
}

/** 内部故事等级 → 可见星串；非法 tier 返回 null，绝不输出 S/A/B/C 字母 */
export function storyStars(tier) {
  return typeof tier === 'string' && Object.hasOwn(STORY_STARS, tier)
    ? STORY_STARS[tier]
    : null
}

function findPlayer(standings, playerId) {
  return standings.find((player) => (player.playerId ?? player.id) === playerId) ?? null
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

// 固定 story key 渲染器：只处理已批准的白名单 key，未知 key 或数据不完整一律返回 null。
function formatReportStory(story, standings) {
  if (!story || typeof story !== 'object' || TIER_BY_KEY[story.key] !== story.tier) return null
  const player = findPlayer(standings, story.playerId)
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
      const spell = SPELL_NAMES[data.spellId]
      if (!positiveInteger(data.round) || !positiveInteger(data.killCount) || !spell) return null
      return {
        stars,
        title: '龙息清场',
        body: `${player.nickname}在第 ${data.round} 轮用${spell}一次击倒 ${data.killCount} 名对手。`,
      }
    }
    case 'low_hp_kill': {
      const spell = SPELL_NAMES[data.spellId]
      const target = findPlayer(standings, data.targetPlayerId)
      if (!positiveInteger(data.round) || data.actorHp !== 1 || !positiveInteger(data.targetHpBefore) || !spell || !target) return null
      return {
        stars,
        title: '残血反击',
        body: `${player.nickname}在第 ${data.round} 轮仅剩 1 点生命时，用${spell}击倒了受击前有 ${data.targetHpBefore} 点生命的${target.nickname}。`,
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

function reportOwnerId(report) {
  const standings = Array.isArray(report.standings) ? report.standings : []
  const owner = standings.find((standing) => standing.rank === report.rank)
  return owner?.playerId ?? null
}

/**
 * 把 Auth 返回的最近战报转换为展示卡片。
 * - 保持服务端排序，最多 10 条；
 * - 只保留本玩家自己的故事（服务端已按玩家保存，这里按名次反解归属再过滤一次）；
 * - 未知 story key 或数据不完整的故事被忽略；
 * - 不生成任何伪报告，游客/空态由调用方按 isGuest 和卡片数决定文案。
 */
export function buildReportCards(reports = []) {
  return reports.slice(0, 10).map((report) => {
    const standings = Array.isArray(report.standings) ? report.standings : []
    const ownerId = reportOwnerId(report)
    const playerContext = standings.map(({ playerId, nickname }) => ({ id: playerId, nickname }))
    const stories = (Array.isArray(report.stories) ? report.stories : [])
      .filter((story) => !ownerId || (story && story.playerId === ownerId))
      .map((story) => formatReportStory(story, playerContext))
      .filter(Boolean)
    return {
      matchId: report.matchId,
      game: report.game,
      rank: report.rank,
      score: report.score,
      rounds: report.rounds,
      playerCount: report.playerCount,
      finishedAt: report.finishedAt,
      standings: standings.map(({ playerId, nickname, rank, score }) => ({ playerId, nickname, rank, score })),
      stories,
      unlockedKeys: Array.isArray(report.unlockedKeys) ? report.unlockedKeys.slice() : [],
    }
  })
}
