/**
 * worker/puzzleLib.js
 * PuzzleLib —— 全局单例 Durable Object，管理谜题库。
 *
 * - 内置谜题：来自 puzzles.js 模块（随 Worker 部署）
 * - 自定义谜题：玩家录入，存 DO storage
 * - 只读接口供前端浏览；Room DO 发起游戏时通过本实例获取谜题
 */

import { getBuiltinPuzzles } from './puzzles'
import { generateLogicProfile } from '../ai/logicProfile'

export class PuzzleLib {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
  }

  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    // GET /api/puzzles —— 内置 + 自定义谜题列表（不含汤底，防剧透）
    if (req.method === 'GET' && path === '/api/puzzles') {
      const custom = (await this.ctx.storage.get('custom')) ?? []
      const builtin = getBuiltinPuzzles().map((p) => this.publicPuzzle(p))
      const customPublic = custom.map((p) => this.publicPuzzle(p))
      return this.json({ puzzles: [...builtin, ...customPublic] })
    }

    // GET /api/puzzles/:id —— 单个谜题（含汤底，供 Room DO 取用，需鉴权由上层决定）
    if (req.method === 'GET' && path.startsWith('/api/puzzles/')) {
      const id = path.split('/').pop()
      const builtin = getBuiltinPuzzles().find((p) => p.id === id)
      if (builtin) return this.json({ puzzle: builtin })
      const custom = (await this.ctx.storage.get('custom')) ?? []
      const found = custom.find((p) => p.id === id)
      if (found) return this.json({ puzzle: found })
      return new Response('not found', { status: 404 })
    }

    // POST /api/puzzles —— 录入自定义谜题
    if (req.method === 'POST' && path === '/api/puzzles') {
      let body
      try {
        body = await req.json()
      } catch {
        return new Response('bad json', { status: 400 })
      }
      const validated = this.validatePuzzle(body)
      if (!validated.ok) {
        return this.json({ error: validated.reason }, 400)
      }
      // 自定义谜题：用 AI 生成逻辑档案（失败降级，不阻塞提交）
      if (!validated.puzzle.logicProfile) {
        const profile = await generateLogicProfile(validated.puzzle, this.env)
        if (profile) {
          validated.puzzle.logicProfile = profile
        }
      }
      const custom = (await this.ctx.storage.get('custom')) ?? []
      custom.push(validated.puzzle)
      await this.ctx.storage.put('custom', custom)
      return this.json({ puzzle: this.publicPuzzle(validated.puzzle) })
    }

    // POST /api/feedback —— 用户反馈（存 DO storage，无身份要求）
    if (req.method === 'POST' && path === '/api/feedback') {
      let body
      try {
        body = await req.json()
      } catch {
        return new Response('bad json', { status: 400 })
      }
      const content = String(body?.content ?? '').trim()
      const contact = String(body?.contact ?? '').trim().slice(0, 100)
      if (!content) {
        return this.json({ error: '反馈内容不能为空' }, 400)
      }
      const feedbacks = (await this.ctx.storage.get('feedback')) ?? []
      feedbacks.push({
        id: `fb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        content: content.slice(0, 2000),
        contact,
        at: Date.now(),
      })
      await this.ctx.storage.put('feedback', feedbacks)
      return this.json({ ok: true })
    }

    return new Response('not found', { status: 404 })
  }

  /** 校验并规范化谜题输入 */
  validatePuzzle(input) {
    const title = String(input?.title ?? '').trim()
    const story = String(input?.story ?? '').trim()
    const answer = String(input?.answer ?? '').trim()
    if (!title || !story || !answer) {
      return { ok: false, reason: '标题、汤面、汤底均为必填' }
    }
    const keywords = Array.isArray(input?.keywords)
      ? input.keywords.map((k) => String(k).trim()).filter(Boolean)
      : []
    const puzzle = {
      id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      story,
      answer,
      keywords,
      difficulty: Number(input?.difficulty) || 3,
      custom: true,
    }
    return { ok: true, puzzle }
  }

  /** 对外公开的谜题（隐藏汤底与关键词，防止玩家剧透） */
  publicPuzzle(p) {
    return {
      id: p.id,
      title: p.title,
      story: p.story,
      difficulty: p.difficulty,
      custom: !!p.custom,
    }
  }

  json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}
