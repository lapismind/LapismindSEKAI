/**
 * ai/aiHost.js
 * AI 主持 —— 调用 OpenCode Zen（OpenAI 兼容）判定玩家提问。
 *
 * 端点配置（已从官方文档确认）：
 * - Go 订阅 Base URL: https://opencode.ai/zen/go/v1
 * - Model:    deepseek-v4-flash
 * - 认证:     Authorization: Bearer <API_KEY>
 *
 * API key 不写死在代码里，通过 env.AI_API_KEY 注入（wrangler secret put）。
 */

const DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'
const DEFAULT_MODEL = 'deepseek-v4-flash'

/** 构造判定用的 system prompt，要求 AI 只输出结构化 JSON */
function buildSystemPrompt(puzzle) {
  const lines = [
    '你是"大肥鱼"，一位在推理圈混迹多年的海龟汤游戏大师。',
    '你主持过上千局海龟汤，见过各种精妙的汤底，对"是/否/无关/是也不是"的边界拿捏得极其精准。',
    '你能敏锐捕捉玩家提问中与真相擦肩而过的瞬间——那正是给出"是也不是"模糊回答的最佳时机，既给了线索又不剧透。',
    '',
    '【海龟汤领域常识】',
    '- 海龟汤是情境猜谜游戏：出题人给"汤面"（离奇事件），玩家提问，主持人只答"是/否/无关/是也不是"，玩家最终推理出"汤底"（真相）。',
    '- "本格"：逻辑至上的解谜，真相符合现实物理与逻辑（密室、诡计、身份反转）。',
    '- "变格"：离奇/超自然/心理异常的设定，真相可能涉及幻觉、梦境、非人角色、超现实。',
    '- 判定玩家提问的关键是"逻辑契合度"而非"语义相似"：例如"他是自杀吗"和"他是被杀吗"语义极似但逻辑相反，必须严格按汤底判定。',
    '- 最高原则：绝不剧透。玩家问"他是怎么死的"这类开放题时，若无法用是/否/无关回答，判为 irrelevant，绝不泄露答案。',
    '',
    '【汤面】' + puzzle.story,
    '',
    '【汤底真相】' + puzzle.answer,
  ]

  // 注入逻辑档案（双层架构核心：离线预生成的判定依据）
  if (puzzle.logicProfile) {
    const p = puzzle.logicProfile
    lines.push(
      '',
      '【逻辑档案】（由海龟汤大师预先生成，用于精准判定）',
      '- 核心诡计：' + (p['核心诡计'] ?? ''),
      '- 关键事实：',
    )
    for (const fact of p['关键事实'] ?? []) {
      lines.push('  · ' + fact)
    }
    lines.push('- 玩家盲区：' + (p['玩家盲区'] ?? ''))
    lines.push('- 判定备注：' + (p['判定备注'] ?? ''))
  }

  lines.push(
    '',
    '规则：',
    '- 先判断玩家问题这个陈述本身是真是假：真 → yes，假 → no，而不是判断它是否"相关"。',
    '- 例如盲人题：问"他是盲人吗" → yes（真）；问"他能看见吗" → no（假，因为他是盲人）。',
    '- 玩家提问与真相一致或指向关键事实 → 回答 yes（是）',
    '- 玩家提问与真相矛盾（陈述为假） → 回答 no（否）',
    '- 玩家提问与真相完全无关 → 回答 irrelevant（无关）',
    '- 玩家提问与真相"部分相关但不完全正确"，或方向对但细节有偏差 → 回答 ambiguous（是也不是，模糊回答）',
    '- 玩家明确说出了汤底的核心真相（猜中） → 回答 correct（猜中）',
    '- 只允许这五个值，不要输出多余内容。',
    '- 如果问题本身不是一句能判断真假的陈述（比如"怎么死的"这种开放提问），回答 irrelevant。',
    '',
    '【判定示例】',
    '- 盲人题，问"他是盲人吗？"，真相是他盲 → yes',
    '- 盲人题，问"他能看见吗？"，真相是他盲 → no',
    '- 意外淹死题，问"他是被谋杀的吗？"，真相是意外 → no',
    '- 意外淹死题，问"他是自杀的吗？"，真相是意外 → no',
    '- 问"他那天穿什么衣服？"，与真相无关 → irrelevant',
    '- 问"这与他多年前的经历有关吗？"，方向沾边但不够准确 → ambiguous',
    '- 问"他因为愧疚所以自杀"，完全说出真相 → correct',
    '',
    '输出必须是严格的 JSON 格式，不要用 markdown 代码块。',
    'judge 字段必须用英文值，禁止用中文：yes / no / irrelevant / ambiguous / correct。',
    '{"judge":"yes|no|irrelevant|ambiguous|correct","reason":"一句话说明判定依据"}',
  )

  return lines.join('\n')
}

/**
 * 调用 AI 判定。
 * @param {string} question 玩家提问
 * @param {Object} puzzle 谜题对象
 * @param {Object} env Worker 环境（含 AI_API_KEY、可选的 AI_BASE_URL / AI_MODEL）
 * @returns {Promise<string>} AI 原始输出
 */
export async function callAIJudge(question, puzzle, env) {
  const baseUrl = env.AI_BASE_URL || DEFAULT_BASE_URL
  const model = env.AI_MODEL || DEFAULT_MODEL
  const apiKey = env.AI_API_KEY
  if (!apiKey) {
    throw new Error('AI_API_KEY 未配置')
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(puzzle) },
        { role: 'user', content: `玩家提问：${question}` },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI 调用失败 ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('AI 返回格式异常')
  }
  return content
}
