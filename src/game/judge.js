/**
 * game/judge.js
 * 判定逻辑 —— 纯函数，无 UI / 无网络依赖。
 *
 * 两种判定模式：
 * 1. 真人主持：判定由主持人手动选择（是/否/无关），本文件只提供交互辅助。
 * 2. AI 主持：由 LLM 返回结构化判定，本文件提供结果解析与兜底。
 */

export const JUDGE = {
  YES: 'yes',
  NO: 'no',
  IRRELEVANT: 'irrelevant',
  AMBIGUOUS: 'ambiguous', // 是也不是（模糊回答）
  CORRECT: 'correct', // 玩家猜中汤底
  REVEAL: 'reveal', // 主持揭底
}

export const JUDGE_LABEL = {
  [JUDGE.YES]: '是',
  [JUDGE.NO]: '否',
  [JUDGE.IRRELEVANT]: '无关',
  [JUDGE.AMBIGUOUS]: '是也不是',
  [JUDGE.CORRECT]: '猜中！',
  [JUDGE.REVEAL]: '揭底',
}

/**
 * 解析 AI 主持的判定结果。
 * 约定 AI 输出必须是严格的 JSON：{"judge":"yes|no|irrelevant|ambiguous|correct","reason":"一句话"}
 * 兼容 AI 可能输出中文值（是/否/无关/是也不是/猜中）。
 * 解析失败时兜底为 irrelevant，避免整局卡住。
 * @param {string} raw LLM 原始输出
 * @returns {{judge:string, reason:string}}
 */
export function parseAIJudge(raw) {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    const obj = JSON.parse(cleaned)
    const rawJudge = obj.judge
    // 兼容中文值
    const map = {
      是: JUDGE.YES,
      对: JUDGE.YES,
      正确: JUDGE.YES,
      不是: JUDGE.NO,
      否: JUDGE.NO,
      不对: JUDGE.NO,
      无关: JUDGE.IRRELEVANT,
      没关系: JUDGE.IRRELEVANT,
      不重要: JUDGE.IRRELEVANT,
      是也不是: JUDGE.AMBIGUOUS,
      不完全对: JUDGE.AMBIGUOUS,
      猜中: JUDGE.CORRECT,
      猜对了: JUDGE.CORRECT,
    }
    const judge = map[rawJudge] ?? rawJudge
    if (Object.values(JUDGE).includes(judge)) {
      return { judge, reason: obj.reason ?? '' }
    }
  } catch {
    /* 解析失败走兜底 */
  }
  return { judge: JUDGE.IRRELEVANT, reason: '' }
}

/**
 * 兜底规则判定（不依赖 AI）：关键词命中检查。
 * 当 AI 不可用（网络失败/超时）时，用关键词粗判，保证游戏能继续。
 * @param {string} question 玩家提问
 * @param {string[]} keywords 汤底关键词
 * @returns {{judge:string, reason:string}|null} null 表示无法判断（需回退其他策略）
 */
export function keywordFallback(question, keywords) {
  const q = question.toLowerCase()
  for (const kw of keywords) {
    if (q.includes(kw.toLowerCase())) {
      return { judge: JUDGE.YES, reason: `（兜底判定）命中关键词「${kw}」` }
    }
  }
  return { judge: JUDGE.IRRELEVANT, reason: '（兜底判定）未命中关键词' }
}
