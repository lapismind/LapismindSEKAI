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
  { key: 'first_cast', stars: 1, name: '初试啼声', desc: '累计施法达到 1 次（完成首次成功施法即解锁）' },
  { key: 'first_kill', stars: 1, name: '开张', desc: '累计击杀达到 1 次' },
  { key: 'potion_addict', stars: 1, name: '药罐子', desc: '累计施放增益/治疗类魔法（8 系）达到 10 次' },
  { key: 'spell_collector', stars: 1, name: '图鉴收集家', desc: '累计使用过 8 个不同系别的魔法各至少 1 次' },

  // ---------- 二星（6）----------
  { key: 'meteor', stars: 2, name: '流星火雨', desc: '单局内连续 3 轮施放火系魔法（7 系）' },
  { key: 'frost', stars: 2, name: '霜天', desc: '单局内连续 3 轮施放冰系魔法（6 系）' },
  { key: 'weather_child', stars: 2, name: '天气之子', desc: '同一回合内同时施放雷、雪、火三系魔法（5/6/7 系）' },
  { key: 'night_walker', stars: 2, name: '夜行侠', desc: '累计施放暗影/夜行类魔法（2 系）达到 20 次' },
  { key: 'last_breath', stars: 2, name: '一线生机', desc: '在仅剩 1 点生命值时赢下当前回合' },
  { key: 'secret_rich', stars: 2, name: '秘密富翁', desc: '单回合结束时同时持有至少 3 张秘密牌' },

  // ---------- 三星（7）----------
  { key: 'comeback', stars: 3, name: '绝地反击', desc: '击败一名生命值明显高于你的目标（以弱胜强）' },
  { key: 'double_kill', stars: 3, name: '双杀现场', desc: '单次施法（非龙息）在同一回合造成 2 次击杀' },
  { key: 'pacifist_king', stars: 3, name: '卡牌大师', desc: '全程未造成任何击杀却获得最终冠军' },
  { key: 'untouchable', stars: 3, name: '稳如老狗', desc: '全程未被击倒（0 次阵亡）并夺得冠军' },
  { key: 'hundred_casts', stars: 3, name: '百法齐鸣', desc: '累计施法达到 100 次' },
  { key: 'dragon_clown', stars: 3, name: '奶龙大王', desc: '累计龙息失败与自杀各达到 10 次' },
  { key: 'all_rounded', stars: 3, name: '齿轮全转', desc: '8 个系别每个累计施放均达到 5 次' },
  { key: 'dragon_triple_total', stars: 3, name: '三星龙', desc: '单场对局中累计击杀 3 条龙' },

  // ---------- 四星（7）----------
  { key: 'not_approved', stars: 4, name: '我不同意', desc: '在明显落后局面下完成翻盘逆转' },
  { key: 'opening_blast', stars: 4, name: '开幕雷击', desc: '开幕回合即召唤 3 连龙息' },
  { key: 'elemental', stars: 4, name: '元素反应', desc: '任意回合内同时凑齐雷、雪、火三系魔法（5/6/7 系）' },
  { key: 'dragon_veteran', stars: 4, name: '驭龙老炮', desc: '累计施放龙息类魔法（1 系）达到 30 次' },
  { key: 'god_of_kill', stars: 4, name: '杀神', desc: '累计击杀达到 50 次' },
  { key: 'match_master', stars: 4, name: '常胜将军', desc: '累计夺冠达到 50 次' },
  { key: 'dragon_triple_one', stars: 4, name: '龙来', desc: '单次施法（龙息）在同一回合造成 3 次击杀' },

  // ---------- 彩蛋（6）----------
  { key: 'egg_first_round_suicide', stars: 0, name: '出生即退场', desc: '开局首回合即阵亡退场' },
  { key: 'egg_gentle', stars: 0, name: '独善其身', desc: '全程只施放增益/治疗魔法（3、8 系）且 0 击杀' },
  { key: 'egg_full_then_dead', stars: 0, name: '回光返照', desc: '经历残血→满血复活后，紧接着在同一局内被击杀' },
  { key: 'egg_social_death', stars: 0, name: '社死现场', desc: '单回合内施法失败次数达到 3 次' },
  { key: 'egg_no_secret_win', stars: 0, name: '白板登基', desc: '一张秘密牌都没摸到却夺得冠军' },
]

// 成就所属游戏（用于展馆按游戏分组收束）
export const GAMES = {
  abracadawhat: '出包魔法师',
}

// 给所有成就补上默认归属（后续新游戏在 ACHIEVEMENT_DEFS 里显式写 game 即可）
ACHIEVEMENT_DEFS.forEach((d) => { if (!d.game) d.game = 'abracadawhat' })

// 累计次数型成就的目标值：达到即解锁；前端据此画百分比进度。
// 不在表内的视为「单局达成」类，不显示百分比。
export const ACHIEVEMENT_TARGETS = {
  first_cast: 1,
  first_kill: 1,
  potion_addict: 10,        // 8 系魔法施放 ≥10
  spell_collector: 8,       // 集齐 8 系
  night_walker: 20,         // 2 系施放 ≥20
  hundred_casts: 100,       // 累计施法 ≥100
  dragon_clown: 10,         // 龙失败 & 自杀各需 ≥10，进度取两者较小值
  dragon_veteran: 30,       // 1 系施放 ≥30
  god_of_kill: 50,          // 累计击杀 ≥50
  match_master: 50,         // 累计夺冠 ≥50
}

// 从跨场累计数据计算当前进度（仅累计型成就使用）
export function progressFromCareer(key, career) {
  const c = career || {}
  const spell = (id) => (c.spellCounts && c.spellCounts[id]) || 0
  switch (key) {
    case 'first_cast': return c.totalCasts || 0
    case 'first_kill': return c.totalKills || 0
    case 'potion_addict': return spell(8)
    case 'spell_collector': return new Set(Object.keys(c.spellCounts || {}).map(Number)).size
    case 'night_walker': return spell(2)
    case 'hundred_casts': return c.totalCasts || 0
    case 'dragon_clown': return Math.min(c.dragonFails || 0, c.suicides || 0)
    case 'dragon_veteran': return spell(1)
    case 'god_of_kill': return c.totalKills || 0
    case 'match_master': return c.totalWins || 0
    default: return 0
  }
}

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
