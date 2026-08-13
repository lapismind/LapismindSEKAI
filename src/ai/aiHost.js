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
  return [
    '你是一场海龟汤游戏的主持人。',
    '玩家会向你提问，你要根据"汤底真相"判断玩家的问题是真、是假、还是与真相无关。',
    '',
    '【汤面】' + puzzle.story,
    '',
    '【汤底真相】' + puzzle.answer,
    '',
    '规则：',
    '- 玩家提问与真相一致或指向关键事实 → 回答 yes（是）',
    '- 玩家提问与真相矛盾 → 回答 no（否）',
    '- 玩家提问与真相完全无关 → 回答 irrelevant（无关）',
    '- 玩家提问与真相"部分相关但不完全正确"，或方向对但细节有偏差 → 回答 ambiguous（是也不是，模糊回答）',
    '- 玩家明确说出了汤底的核心真相（猜中） → 回答 correct（猜中）',
    '- 只允许这五个值，不要输出多余内容。',
    '- 如果问题本身不是一句能判断真假的陈述（比如闲聊），回答 irrelevant。',
    '',
    '输出必须是严格的 JSON 格式，不要用 markdown 代码块：',
    '{"judge":"yes|no|irrelevant|correct","reason":"一句话说明判定依据"}',
  ].join('\n')
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
      max_tokens: 200,
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
