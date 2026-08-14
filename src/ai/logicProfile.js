/**
 * ai/logicProfile.js
 * 生成海龟汤谜题的 Logic Profile（逻辑档案）。
 *
 * 双层架构：离线/入库时生成精炼版档案，实时判定时注入 prompt。
 * 档案包含：核心诡计、关键事实、玩家盲区、判定备注。
 */

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'
const DEFAULT_MODEL = 'deepseek-v4-flash'

const PROFILE_PROMPT = [
  '你是一位海龟汤游戏大师"大肥鱼"，主持过上千局游戏，擅长拆解谜题的逻辑结构。',
  '请为下面这道海龟汤谜题生成一份精炼的"逻辑档案"，帮助主持人准确判定玩家的提问。',
  '',
  '【汤面】{story}',
  '',
  '【汤底真相】{answer}',
  '',
  '请分析这道汤的核心逻辑，输出严格的 JSON（不要 markdown 代码块）：',
  '{',
  '  "核心诡计": "一句话概括这道汤最关键的逻辑反转或隐藏真相",',
  '  "关键事实": ["5-8条支撑真相的事实，每条是完整陈述句，供主持人判断玩家提问是否命中"],',
  '  "玩家盲区": "玩家最容易被误导的方向，一句话",',
  '  "判定备注": "说明哪些方向的提问应回答是/否/是也不是/无关，格式如：涉及X→是；涉及Y→否；Z方向→无关"',
  '}',
].join('\n')

/** 解析 AI 生成的 profile，失败返回 null */
export function parseLogicProfile(raw) {
  try {
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
    const obj = JSON.parse(cleaned)
    if (obj['核心诡计'] && Array.isArray(obj['关键事实']) && obj['关键事实'].length > 0) {
      return {
        '核心诡计': String(obj['核心诡计']).slice(0, 200),
        '关键事实': obj['关键事实'].slice(0, 10).map((f) => String(f).slice(0, 100)),
        '玩家盲区': String(obj['玩家盲区'] ?? '').slice(0, 200),
        '判定备注': String(obj['判定备注'] ?? '').slice(0, 300),
      }
    }
  } catch {
    /* 解析失败返回 null */
  }
  return null
}

/**
 * 调用 AI 生成谜题逻辑档案。
 * @param {{story:string, answer:string}} puzzle
 * @param {Object} env Worker 环境
 * @returns {Promise<object|null>} 解析后的 profile，失败返回 null
 */
export async function generateLogicProfile(puzzle, env) {
  const baseUrl = env.AI_BASE_URL || DEFAULT_BASE_URL
  const model = env.AI_MODEL || DEFAULT_MODEL
  const apiKey = env.AI_API_KEY
  if (!apiKey) return null

  const prompt = PROFILE_PROMPT
    .replace('{story}', puzzle.story)
    .replace('{answer}', puzzle.answer)

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是海龟汤逻辑档案生成器，只输出指定 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    return parseLogicProfile(content)
  } catch {
    return null
  }
}
