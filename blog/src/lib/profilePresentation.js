const GAME_NAMES = {
  abracadawhat: '出包魔法师',
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

function achievementItem(achievement) {
  const difficulty = Number.isInteger(achievement.difficulty) && achievement.difficulty > 0
    ? achievement.difficulty
    : 0
  return {
    key: achievement.key,
    name: achievement.name,
    desc: achievement.desc,
    status: achievement.status,
    unlocked: achievement.unlocked === true,
    unlockedAt: achievement.unlockedAt || null,
    difficultyLabel: difficulty ? `难度 ${'★'.repeat(difficulty)}` : '',
  }
}

export function buildAchievementSections(achievements = []) {
  const definitions = [
    { key: 'active', title: '传奇成就', description: '本期十项传奇挑战', filter: achievement => achievement.status === 'active' },
    { key: 'legacy', title: '旧日纪念', description: '曾经获得并保留下来的成就', filter: achievement => achievement.status === 'legacy' && achievement.unlocked === true },
    { key: 'hidden', title: '隐藏成就', description: '未揭晓的条件会保持遮罩', filter: achievement => achievement.status === 'hidden' },
  ]

  return definitions
    .map(section => {
      const items = achievements.filter(section.filter).map(achievementItem)
      return {
        key: section.key,
        title: section.title,
        description: section.description,
        gameName: GAME_NAMES[achievements.find(section.filter)?.game] || '出包魔法师',
        unlockedCount: items.filter(item => item.unlocked).length,
        items,
      }
    })
    .filter(section => section.key === 'active' || section.items.length > 0)
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : '0'
}

export function buildCareerRows(career = {}) {
  const reasons = career.roundWinsByReason || {}
  const spellCounts = career.spellCounts || {}
  const spellBreakdown = Object.entries(spellCounts)
    .map(([spellId, count]) => [Number(spellId), Number(count)])
    .filter(([spellId, count]) => SPELL_NAMES[spellId] && Number.isFinite(count) && count > 0)
    .sort(([left], [right]) => left - right)
    .map(([spellId, count]) => `${SPELL_NAMES[spellId]} ${count}`)
    .join(' · ')

  return [
    { label: '完成比赛数', value: numberValue(career.matchesCompleted) },
    { label: '冠军数', value: numberValue(career.championships) },
    { label: '轮胜数', value: numberValue(career.roundWins) },
    { label: '成功施法总数', value: numberValue(career.totalCasts) },
    { label: '击杀数', value: numberValue(career.kills) },
    { label: '巨龙击杀数', value: numberValue(career.dragonKills) },
    { label: '死亡次数', value: numberValue(career.deaths) },
    { label: '自爆次数', value: numberValue(career.suicides) },
    { label: '使用过的魔法系别', value: `${numberValue(career.spellTypesUsed)} / 8` },
    { label: '单次行动最长连续成功施法', value: numberValue(career.maxTurnCastCount) },
    { label: '最常用魔法', value: SPELL_NAMES[career.favoriteSpellId] || '暂无' },
    { label: '击杀轮胜数', value: numberValue(reasons.kill) },
    { label: '清空手牌轮胜数', value: numberValue(reasons.all_spells) },
    { label: '八系魔法成功次数', value: spellBreakdown || '暂无' },
  ]
}
