import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatStory, storyStars } from '../src/core/storyPresentation.js'

const context = {
  players: [
    { id: 'p1', nickname: '青羽' },
    { id: 'p2', nickname: '赤焰' },
  ],
  spells: [
    { id: 1, name: '古代巨龙' },
    { id: 7, name: '火球' },
  ],
}

test('内部故事级别只映射为四种精确星串', () => {
  assert.equal(storyStars('S'), '★★★★')
  assert.equal(storyStars('A'), '★★★')
  assert.equal(storyStars('B'), '★★')
  assert.equal(storyStars('C'), '★')
  assert.equal(storyStars('D'), null)
  assert.equal(storyStars(null), null)
})

test('固定故事使用服务端事实生成中文展示且不泄露内部级别', () => {
  const cases = [
    {
      story: { key: 'comeback_win', playerId: 'p1', tier: 'S', data: { playerScoreBefore: 2, opponentScoreBefore: 7, finalScore: 9 } },
      expected: { stars: '★★★★', title: '比分翻盘', body: '青羽曾以 2 比 7 落后，最终以 9 分夺冠。' },
    },
    {
      story: { key: 'dragon_multi_kill', playerId: 'p1', tier: 'S', data: { round: 3, spellId: 1, killCount: 3 } },
      expected: { stars: '★★★★', title: '龙息清场', body: '青羽在第 3 轮用古代巨龙一次击倒 3 名对手。' },
    },
    {
      story: { key: 'low_hp_kill', playerId: 'p1', tier: 'A', data: { round: 4, spellId: 7, actorHp: 1, targetHpBefore: 3, targetPlayerId: 'p2' } },
      expected: { stars: '★★★', title: '残血反击', body: '青羽在第 4 轮仅剩 1 点生命时，用火球击倒了受击前有 3 点生命的赤焰。' },
    },
    {
      story: { key: 'turn_clear_streak', playerId: 'p1', tier: 'A', data: { round: 2, successCount: 4, reason: 'all_spells' } },
      expected: { stars: '★★★', title: '连续施法', body: '青羽在第 2 轮连续成功施法 4 次，并以清空手牌结束本轮。' },
    },
    {
      story: { key: 'secret_score', playerId: 'p1', tier: 'B', data: { secretPoints: 3, secretCount: 3 } },
      expected: { stars: '★★', title: '秘密牌得分', body: '青羽带着 3 张秘密牌存活到轮末，并获得 3 分。' },
    },
    {
      story: { key: 'round_win_routes', playerId: 'p1', tier: 'B', data: { kill: 1, allSpells: 2 } },
      expected: { stars: '★★', title: '两种胜法', body: '青羽本场靠击杀赢下 1 轮，也靠清空手牌赢下 2 轮。' },
    },
    {
      story: { key: 'all_spell_types', playerId: 'p1', tier: 'C', data: { spellIds: [1, 2, 3, 4, 5, 6, 7, 8] } },
      expected: { stars: '★', title: '八系魔法', body: '青羽本场成功使用了全部 8 种魔法。' },
    },
    {
      story: { key: 'voluntary_stop', playerId: 'p1', tier: 'C', data: { round: 5, successCount: 3, distinctCount: 2 } },
      expected: { stars: '★', title: '主动收手', body: '青羽在第 5 轮连续成功施法 3 次、使用 2 种魔法后主动结束行动。' },
    },
  ]

  for (const { story, expected } of cases) {
    const formatted = formatStory(story, context)
    assert.deepEqual(formatted, expected)
    assert.doesNotMatch(JSON.stringify(formatted), /\b[ＳSＡAＢBＣC]\b/)
  }
})

test('未知故事、非法级别或无法解析的事实不会生成展示文案', () => {
  assert.equal(formatStory({ key: 'unknown', playerId: 'p1', tier: 'S', data: {} }, context), null)
  assert.equal(formatStory({ key: 'comeback_win', playerId: 'p1', tier: 'D', data: {} }, context), null)
  assert.equal(formatStory({ key: 'comeback_win', playerId: 'p1', tier: 'C', data: { playerScoreBefore: 2, opponentScoreBefore: 7, finalScore: 9 } }, context), null)
  assert.equal(formatStory({ key: 'all_spell_types', playerId: 'p1', tier: 'C', data: { spellIds: [1, 1, 2, 3, 4, 5, 6, 7] } }, context), null)
  assert.equal(formatStory({ key: 'low_hp_kill', playerId: 'missing', tier: 'A', data: {} }, context), null)
  assert.equal(formatStory(null, context), null)
})
