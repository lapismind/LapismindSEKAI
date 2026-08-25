/**
 * achievements.js —— 出包魔法师成就判定引擎 v2（纯函数，可单测）。
 *
 * 30 个成就：星级 24 + 彩蛋 6（一滴血王朝已移除）。
 * 输入上下文：
 *   match  —— 单场聚合（rounds / players / events 由 DO 上报）
 *   p      —— 该玩家的本场数据
 *   career —— 跨场次累计（Worker 查 D1 得出）
 * 新增成就只需往 ACHIEVEMENT_DEFS 加一条 + 在 CHECKS 里加判定。
 */

export const ACHIEVEMENT_DEFS = [
  // ---------- 一星（4）----------
  { key: 'first_cast', stars: 1, name: '初试啼声', desc: '欢迎来到魔法学院，请系好安全带' },
  { key: 'first_kill', stars: 1, name: '开张', desc: '第一次让别人血条消失的感觉，上瘾' },
  { key: 'potion_addict', stars: 1, name: '药罐子', desc: '生命在于嗑药' },
  { key: 'spell_collector', stars: 1, name: '图鉴收集家', desc: '八系魔法，浅尝辄止' },

  // ---------- 二星（6）----------
  { key: 'meteor', stars: 2, name: '流星火雨', desc: '下一位受害者已排队，请出示血条' },
  { key: 'frost', stars: 2, name: '霜天', desc: '西伯利亚寒流，精准投递' },
  { key: 'weather_child', stars: 2, name: '天气之子', desc: '今日天气：雷、雪、火，不宜出门' },
  { key: 'night_walker', stars: 2, name: '夜行侠', desc: '全场的噩梦，都是我做的' },
  { key: 'last_breath', stars: 2, name: '一线生机', desc: '死神伸了个手，被我打了张欠条' },
  { key: 'secret_rich', stars: 2, name: '秘密富翁', desc: '猫头鹰看了都说内行' },

  // ---------- 三星（7）----------
  { key: 'comeback', stars: 3, name: '绝地反击', desc: '一滴血，一口龙息，一个王朝' },
  { key: 'double_kill', stars: 3, name: '双杀现场', desc: '不用龙的连杀，才叫技术' },
  { key: 'pacifist_king', stars: 3, name: '卡牌大师', desc: '全程未拔剑，登基那天满朝文武无话可说' },
  { key: 'untouchable', stars: 3, name: '稳如老狗', desc: '全程没躺进过坟场，冠军含金量拉满' },
  { key: 'hundred_casts', stars: 3, name: '百法齐鸣', desc: '第一百次施法，手已经比脑子快了' },
  { key: 'dragon_clown', stars: 3, name: '奶龙大王', desc: '龙的传人，专治队友' },
  { key: 'all_rounded', stars: 3, name: '齿轮全转', desc: '没有偏科的法师，只有偏执的法师' },
  { key: 'dragon_triple_total', stars: 3, name: '三星龙', desc: '龙焰三重奏' },

  // ---------- 四星（7）----------
  { key: 'not_approved', stars: 4, name: '我不同意', desc: '你们数到七就庆祝？我还没同意' },
  { key: 'opening_blast', stars: 4, name: '开幕雷击', desc: '开幕即终幕，谢幕的是其他人' },
  { key: 'elemental', stars: 4, name: '元素反应', desc: '雷雪火齐发，物理老师看了沉默' },
  { key: 'dragon_veteran', stars: 4, name: '驭龙老炮', desc: '龙见了我都要喊一声师父' },
  { key: 'god_of_kill', stars: 4, name: '杀神', desc: '排行榜上我的名字后面跟着一片墓碑' },
  { key: 'match_master', stars: 4, name: '常胜将军', desc: '五十座奖杯，摆满了我家的祭坛' },
  { key: 'dragon_triple_one', stars: 4, name: '龙来', desc: '龙息所至，寸草不生' },

  // ---------- 彩蛋（6）----------
  { key: 'egg_first_round_suicide', stars: 0, name: '出生即退场', desc: '开局一分钟，走完了一生' },
  { key: 'egg_gentle', stars: 0, name: '独善其身', desc: '全场最温柔的法师，也是最没朋友的' },
  { key: 'egg_full_then_dead', stars: 0, name: '回光返照', desc: '满血复活的下一秒，被物理超度' },
  { key: 'egg_social_death', stars: 0, name: '社死现场', desc: '这一轮的观众席，笑声就没停过' },
  { key: 'egg_no_secret_win', stars: 0, name: '白板登基', desc: '一张秘密牌都没摸，照样坐上了王座' },
]

// 判定表：key → (ctx) => boolean
// ctx = { p, match, career }
const CHECKS = {
  // 一星
  first_cast: ({ p, career }) => career.totalCasts + castsOf(p) >= 1,
  first_kill: ({ p, career }) => career.totalKills + (p.kills || 0) >= 1,
  potion_addict: ({ p, career }) => spellCount(career, p, 8) >= 10,
  spell_collector: ({ p, career }) => new Set([...Object.keys(career.spellCounts), ...Object.keys(p.spellsCast || {})]).size >= 8,

  // 二星
  meteor: ({ p }) => maxStreak(p.castStreaks?.[7]) >= 3,
  frost: ({ p }) => maxStreak(p.castStreaks?.[6]) >= 3,
  weather_child: ({ p }) => {
    const byRound = {}
    for (const rc of p.roundSpellCasts || []) {
      if ([5, 6, 7].includes(rc.spellId)) (byRound[rc.round] ??= new Set()).add(rc.spellId)
    }
    return Object.values(byRound).some(s => [5, 6, 7].every(id => s.has(id)))
  },
  night_walker: ({ p, career }) => spellCount(career, p, 2) >= 20,
  last_breath: ({ p }) => p.roundWonAtHp1 === true,
  secret_rich: ({ p }) => p.roundEndSecrets >= 3,

  // 三星
  comeback: ({ p }) => p.killedHighHpTarget === true,
  double_kill: ({ p }) => p.singleCastMultiKillNonDragon >= 2,
  pacifist_king: ({ p }) => p.isChampion && (p.kills || 0) === 0,
  untouchable: ({ p }) => p.isChampion && (p.deaths || 0) === 0,
  hundred_casts: ({ p, career }) => career.totalCasts + castsOf(p) >= 100,
  dragon_clown: ({ p, career }) =>
    (career.dragonFails || 0) + (p.dragonFails || 0) >= 10 &&
    (career.suicides || 0) + (p.suicides || 0) >= 10,
  all_rounded: ({ p, career }) => {
    for (let id = 1; id <= 8; id++) {
      if (spellCount(career, p, id) < 5) return false
    }
    return true
  },
  dragon_triple_total: ({ p }) => (p.dragonKills || 0) >= 3,

  // 四星
  not_approved: ({ p }) => p.comebackFromBehind === true,
  opening_blast: ({ p }) => p.firstTurnDragon3 === true,
  elemental: ({ p }) => {
    for (const set of Object.values(p.turnSpellSets || {})) {
      if ([5, 6, 7].every(id => set.includes(id))) return true
    }
    return false
  },
  dragon_veteran: ({ p, career }) => spellCount(career, p, 1) >= 30,
  god_of_kill: ({ p, career }) => career.totalKills + (p.kills || 0) >= 50,
  match_master: ({ p, career }) => career.totalWins + (p.isChampion ? 1 : 0) >= 50,
  dragon_triple_one: ({ p }) => (p.dragonOneCastKills || 0) >= 3,

  // 彩蛋
  egg_first_round_suicide: ({ p }) => p.firstRoundSuicide === true,
  egg_gentle: ({ p }) => {
    const ids = Object.keys(p.spellsCast || {}).map(Number)
    if (ids.length === 0) return false
    return ids.every(id => id === 3 || id === 8) && (p.kills || 0) === 0
  },
  egg_full_then_dead: ({ p }) => p.hadLowThenFullThenDied === true,
  egg_social_death: ({ p }) => (p.maxFailsInRound || 0) >= 3,
  egg_no_secret_win: ({ p }) => p.roundWonNoSecrets === true,
}

/**
 * @param {object} match - { players: [...], events? }
 * @param {function} careerLookup - async (playerId) => career
 * @returns {Promise<Array<{playerId, key}>>}
 */
export async function evaluateAchievements(match, careerLookup) {
  const out = []
  for (const p of match.players) {
    const career = await careerLookup(p.playerId)
    const ctx = { p, match, career }
    for (const [key, check] of Object.entries(CHECKS)) {
      try {
        if (check(ctx)) out.push({ playerId: p.playerId, key })
      } catch { /* 单条判定异常不拖垮整场 */ }
    }
  }
  return out
}

// ---------- 工具 ----------

function castsOf(p) {
  return Object.values(p.spellsCast || {}).reduce((s, n) => s + n, 0)
}

function spellCount(career, p, id) {
  return (career.spellCounts[id] || 0) + (p.spellsCast?.[id] || 0)
}

/** castStreaks[spellId] = [true, true, false, true, true, true] → 最长连续 true 段 */
function maxStreak(arr) {
  if (!Array.isArray(arr)) return 0
  let best = 0, cur = 0
  for (const v of arr) {
    cur = v ? cur + 1 : 0
    if (cur > best) best = cur
  }
  return best
}
