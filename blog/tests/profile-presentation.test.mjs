import assert from 'node:assert/strict'
import { buildAchievementSections, buildCareerRows } from '../src/lib/profilePresentation.js'

const active = Array.from({ length: 10 }, (_, index) => ({
  key: `active-${index + 1}`,
  game: 'abracadawhat',
  name: `传奇 ${index + 1}`,
  desc: `条件 ${index + 1}`,
  difficulty: index % 4 + 1,
  stars: index % 4 + 1,
  status: 'active',
  unlocked: index < 3,
  unlockedAt: index < 3 ? '2026-09-07 12:00:00' : null,
}))

{
  const sections = buildAchievementSections([
    ...active,
    { key: 'legacy-kept', game: 'abracadawhat', name: '旧日奖杯', desc: '已经取得', difficulty: 2, stars: 2, status: 'legacy', legacy: true, unlocked: true },
    { key: 'legacy-locked', game: 'abracadawhat', name: '不应出现', desc: '不应出现', difficulty: 4, stars: 4, status: 'legacy', legacy: true, unlocked: false },
    { key: 'secret', status: 'hidden', unlocked: false, name: '？？？', desc: '？？？' },
  ])

  assert.equal(sections[0].key, 'active')
  assert.equal(sections[0].title, '传奇成就')
  assert.equal(sections[0].items.length, 10, '十个 active 成就全部展示，包括锁定项')
  assert.equal(sections[0].unlockedCount, 3)
  assert.equal(sections[0].items[0].difficultyLabel, '难度 ★', '明确称为难度')
  assert.equal(sections[0].items[3].difficultyLabel, '难度 ★★★★')
  assert.equal('progress' in sections[0].items[0], false, '展示模型不重算成就进度')
  assert.deepEqual(sections[1].items.map(item => item.key), ['legacy-kept'], '纪念区只展示 API 返回且已解锁的旧成就')
  assert.deepEqual(sections[2].items[0], {
    key: 'secret',
    name: '？？？',
    desc: '？？？',
    status: 'hidden',
    unlocked: false,
    unlockedAt: null,
    difficultyLabel: '',
  }, '隐藏成就只使用 API 已遮罩的数据')
  assert.doesNotMatch(JSON.stringify(sections), /稀有度|storyTier|tier/i)
}

{
  const career = {
    matchesCompleted: 12,
    championships: 3,
    roundWins: 18,
    totalCasts: 96,
    spellCounts: { 1: 2, 6: 20, 8: 7 },
    kills: 14,
    dragonKills: 4,
    deaths: 9,
    suicides: 2,
    favoriteSpellId: 6,
    spellTypesUsed: 3,
    maxTurnCastCount: 5,
    roundWinsByReason: { kill: 11, all_spells: 7 },
  }
  const rows = buildCareerRows(career)

  assert.deepEqual(rows.map(row => row.label), [
    '完成比赛数', '冠军数', '轮胜数', '成功施法总数', '击杀数', '巨龙击杀数',
    '死亡次数', '自爆次数', '使用过的魔法系别', '单次行动最长连续成功施法', '最常用魔法',
    '击杀轮胜数', '清空手牌轮胜数', '八系魔法成功次数',
  ])
  assert.equal(rows.find(row => row.label === '最常用魔法').value, '暴风雪')
  assert.equal(rows.find(row => row.label === '八系魔法成功次数').value, '古代巨龙 2 · 暴风雪 20 · 魔法药水 7')
  assert.deepEqual(career.spellCounts, { 1: 2, 6: 20, 8: 7 }, '输入数据不被修改')
  assert.doesNotMatch(JSON.stringify(rows), /\b[ASBC]\b/, '职业展示不泄漏故事等级字母')
}

{
  const rows = buildCareerRows({
    matchesCompleted: 0,
    championships: 0,
    roundWins: 0,
    totalCasts: 0,
    spellCounts: {},
    kills: 0,
    dragonKills: 0,
    deaths: 0,
    suicides: 0,
    favoriteSpellId: null,
    spellTypesUsed: 0,
    maxTurnCastCount: 0,
    roundWinsByReason: { kill: 0, all_spells: 0 },
  })
  assert.equal(rows.find(row => row.label === '最常用魔法').value, '暂无')
  assert.equal(rows.find(row => row.label === '八系魔法成功次数').value, '暂无')
  assert.equal(rows.find(row => row.label === '使用过的魔法系别').value, '0 / 8')
}

{
  const tieRows = buildCareerRows({
    favoriteSpellId: 1,
    spellCounts: { 1: 4, 2: 4, 3: 4 },
    roundWinsByReason: { kill: 0, all_spells: 0 },
  })
  assert.equal(tieRows.find(row => row.label === '最常用魔法').value, '古代巨龙', '展示 Auth 已按较小 spellId 选出的平局结果')
}

console.log('profile presentation tests passed')
