/**
 * achievements.js —— 出包魔法师成就判定引擎（纯函数，可单测）。
 *
 * 输入：单场对局聚合数据（见 postMatch 的 payload 格式）
 * 输出：本场新达成的成就 key 列表
 *
 * 设计约定：
 * - 每个成就一个判定函数，接收 (match, career) 两个上下文
 *   - match: 本场聚合（rounds / players / events）
 *   - career: 该玩家跨场次的累计数据（由 Worker 查 D1 得出）
 * - 判定只依赖数据字段，不依赖游戏逻辑，游戏侧只负责上报事实
 * - 新增成就只需往 ACHIEVEMENT_DEFS 里加一条，表结构不变
 */

export const ACHIEVEMENT_DEFS = [
  // ---------- 一星：新手兜底 ----------
  { key: 'first_cast', stars: 1, name: '初试啼声', desc: '欢迎来到魔法学院，请系好安全带' },
  { key: 'first_kill', stars: 1, name: '开张', desc: '第一次让别人血条消失的感觉，上瘾' },
  { key: 'potion_addict', stars: 1, name: '药罐子', desc: '生命在于嗑药' },
  { key: 'spell_collector', stars: 1, name: '图鉴收集家', desc: '八系魔法，浅尝辄止' },

  // ---------- 二星：玩法引导 ----------
  { key: 'weather_child', stars: 2, name: '天气之子', desc: '今日天气：雷、雪、火，不宜出门' },
  { key: 'night_walker', stars: 2, name: '夜行侠', desc: '全场的噩梦，都是我做的' },
  { key: 'last_breath', stars: 2, name: '一线生机', desc: '死神伸了个手，被我打了张欠条' },
  { key: 'secret_rich', stars: 2, name: '秘密富翁', desc: '猫头鹰看了都说内行' },

  // ---------- 三星：单局高光 + 中期积累 ----------
  { key: 'untouchable', stars: 3, name: '稳如老狗', desc: '全程没躺进过坟场，冠军含金量拉满' },
  { key: 'double_kill', stars: 3, name: '双杀现场', desc: '不用龙的连杀，才叫技术' },
  { key: 'hundred_casts', stars: 3, name: '百法齐鸣', desc: '第一百次施法，手已经比脑子快了' },
  { key: 'all_rounded', stars: 3, name: '齿轮全转', desc: '没有偏科的法师，只有偏执的法师' },
  { key: 'dragon_triple_total', stars: 3, name: '三星龙', desc: '龙焰三重奏' },

  // ---------- 四星：传说时刻 ----------
  { key: 'one_hp_king', stars: 4, name: '一滴血王朝', desc: '他们打的是血条，我打的是信仰' },
  { key: 'dragon_veteran', stars: 4, name: '驭龙老炮', desc: '龙见了我都要喊一声师父' },
  { key: 'god_of_kill', stars: 4, name: '杀神', desc: '排行榜上我的名字后面跟着一片墓碑' },
  { key: 'match_master', stars: 4, name: '常胜将军', desc: '五十座奖杯，摆满了我家的祭坛' },
  { key: 'dragon_triple_one', stars: 4, name: '龙来', desc: '龙息所至，寸草不生' },

  // ---------- 彩蛋 ----------
  { key: 'egg_first_round_suicide', stars: 0, name: '出生即退场', desc: '开局一分钟，走完了一生' },
  { key: 'egg_gentle', stars: 0, name: '独善其身', desc: '全场最温柔的法师，也是最没朋友的' },
  { key: 'egg_full_then_dead', stars: 0, name: '回光返照', desc: '满血复活的下一秒，被物理超度' },
  { key: 'egg_triple_fail', stars: 0, name: '社死三连', desc: '咒语背错三次，观众笑晕俩' },
]

/**
 * 判定一场对局中每个玩家达成的成就。
 * @param {object} match - { game, rounds, players: [{playerId, score, isChampion, kills, deaths, spellsCast, secretsTaken, roundsSurvived, finalHp}], events: [...] }
 * @param {function} careerLookup - async (playerId) => { totalCasts, totalKills, totalWins, spellCounts: {1:n,...}, spellTypes: n }
 * @returns {Promise<Array<{playerId, key}>>} 新达成的 (playerId, achievementKey) 对
 */
export async function evaluateAchievements(match, careerLookup) {
  const out = []
  for (const p of match.players) {
    const career = await careerLookup(p.playerId)
    const ctx = { match, p, career }
    const checks = {
      // 一星
      first_cast: career.totalCasts + totalCastsOf(p) >= 1,
      first_kill: career.totalKills + (p.kills || 0) >= 1,
      potion_addict: (career.spellCounts[8] || 0) + (p.spellsCast?.[8] || 0) >= 10,
      spell_collector: Object.keys({...career.spellCounts, ...p.spellsCast}).length >= 8,

      // 二星
      weather_child: roundWeatherComplete(p),
      night_walker: (career.spellCounts[2] || 0) + (p.spellsCast?.[2] || 0) >= 20,
      last_breath: p.roundWonAtHp1 === true,
      secret_rich: p.roundEndSecrets >= 3 && p.roundsSurvived > 0,

      // 三星
      untouchable: p.isChampion && (p.deaths || 0) === 0,
      double_kill: p.roundKillsNonDragon >= 2,
      hundred_casts: career.totalCasts + totalCastsOf(p) >= 100,
      all_rounded: everySpell10Plus(career, p),
      dragon_triple_total: p.dragonKills >= 3,

      // 四星
      one_hp_king: p.isChampion && p.finalHp === 1,
      dragon_veteran: (career.spellCounts[1] || 0) + (p.spellsCast?.[1] || 0) >= 30,
      god_of_kill: career.totalKills + (p.kills || 0) >= 50,
      match_master: career.totalWins + (p.isChampion ? 1 : 0) >= 50,
      dragon_triple_one: p.dragonOneCastKills >= 3,

      // 彩蛋
      egg_first_round_suicide: p.firstRoundSuicide === true,
      egg_gentle: isGentleMage(p),
      egg_full_then_dead: p.hadFullHpThenDied === true,
      egg_triple_fail: p.maxFailsInRound >= 3,
    }
    for (const [key, ok] of Object.entries(checks)) {
      if (ok) out.push({ playerId: p.playerId, key })
    }
  }
  return out
}

function totalCastsOf(p) {
  return Object.values(p.spellsCast || {}).reduce((s, n) => s + n, 0)
}

function roundWeatherComplete(p) {
  // 上报格式：roundSpellCasts: [{round, spellId}]，判定同一轮 5/6/7 各一次
  const rounds = new Set()
  for (const rc of p.roundSpellCasts || []) {
    if (![5, 6, 7].includes(rc.spellId)) continue
    rounds.add(rc.round)
  }
  for (const r of rounds) {
    const ids = new Set((p.roundSpellCasts || []).filter(rc => rc.round === r).map(rc => rc.spellId))
    if ([5, 6, 7].every(id => ids.has(id))) return true
  }
  return false
}

function everySpell10Plus(career, p) {
  for (let id = 1; id <= 8; id++) {
    if ((career.spellCounts[id] || 0) + (p.spellsCast?.[id] || 0) < 10) return false
  }
  return true
}

function isGentleMage(p) {
  const ids = Object.keys(p.spellsCast || {}).map(Number)
  if (ids.length === 0) return false
  return ids.every(id => id === 3 || id === 8) && (p.kills || 0) === 0 && (p.roundKillsNonDragon || 0) === 0
}
