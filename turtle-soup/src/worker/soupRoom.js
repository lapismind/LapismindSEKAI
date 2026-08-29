/**
 * worker/soupRoom.js
 * SoupRoom —— 每局一个 Durable Object 实例。
 *
 * 房间机制：
 * - 房主 = 第一个进入房间的人
 * - 房主选择：主持模式（AI / 真人）+ 本局人数上限
 * - 真人模式：房主本人当主持人，其余人是玩家（人数上限含主持人）
 * - AI 模式：全员玩家，Room 调 AI 判定
 * - 房主离开 → 房主顺位给下一个进入的人
 *
 * Hibernation 要点（复用 card-game 教训）：
 * - 连接状态用 socket.serializeAttachment({ playerId }) 持久化
 * - 遍历连接用 ctx.getWebSockets()
 * - 不依赖任何内存 Map 存连接
 */

import { callAIJudge } from '../ai/aiHost'
import { parseAIJudge, keywordFallback, JUDGE } from '../game/judge'

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8
const QUESTION_THROTTLE_MS = 3000 // 提问节流：3 秒内只允许一个玩家提问

export class SoupRoom {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.roomId = ctx.name
    // 串行队列：DO 的 storage 读写是异步的，并发请求必须按序执行，
    // 否则多条消息可能交错导致状态错乱（判定与提问配对错误）
    this.queue = Promise.resolve()
  }

  /** 把操作排入串行队列，保证房间状态一致 */
  enqueue(task) {
    this.queue = this.queue.then(task, task)
    return this.queue
  }

  async fetch(req) {
    const upgrade = req.headers.get('Upgrade')
    if (upgrade === 'websocket') {
      return this.handleWebSocketUpgrade(req)
    }
    return new Response('Not found', { status: 404 })
  }

  /** 处理 WebSocket 升级：加入房间，若为空则成为房主 */
  async handleWebSocketUpgrade(req) {
    const url = new URL(req.url)
    const nickname = url.searchParams.get('nickname') || '玩家'
    // 会话优先：Worker 验证会话后注入 x-sekai-session-player-id 头（覆盖客户端自报值），
    // 无会话时回退 URL 参数（旧 token 路径 / 未配置 SESSION_SECRET 的开发环境）
    const sessionPlayerId = req.headers.get('x-sekai-session-player-id')
    const playerId = sessionPlayerId || url.searchParams.get('playerId') || crypto.randomUUID()
    const avatarId = url.searchParams.get('avatarId') || '0'

    const state = await this.getState()

    // 同 ID 重连：复用身份
    const existing = state.players.find((p) => p.id === playerId)
    if (!existing) {
      // 玩家名额满，或游戏已开始 → 自动转观战（观战不占玩家名额，可无限）
      const gameStarted = state.phase !== 'waiting'
      const isSpectator = this.isPlayerFull(state) || gameStarted
      const player = {
        id: playerId,
        nickname,
        avatarId,
        isHost: !isSpectator && state.players.length === 0, // 第一个玩家当房主（观战不算）
        role: isSpectator ? 'spectator' : 'player', // player | spectator | host-moderator
        isModerator: false,
        isSpectator,
        joinedAt: Date.now(),
        connected: true,
      }
      state.players.push(player)
      await this.saveState(state)
    } else {
      existing.connected = true
      existing.nickname = nickname
      if (avatarId) existing.avatarId = avatarId
      await this.saveState(state)
    }

    const [client, server] = Object.values(new WebSocketPair())
    server.serializeAttachment({ playerId })
    this.ctx.acceptWebSocket(server)

    this.broadcast({
      type: 'player_joined',
      data: { playerId, nickname, hostId: this.getHostId(state) },
    })
    this.broadcastState()
    this.sendStateTo(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(socket, message) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return
    let msg
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }
    // 所有涉及房间状态的操作串行执行，避免并发竞态
    await this.enqueue(async () => {
      switch (msg.type) {
        case 'set_host_config':
          await this.handleSetHostConfig(playerId, msg.data)
          break
        case 'apply_moderator':
          await this.handleApplyModerator(playerId, msg.data)
          break
        case 'set_spectator':
          await this.handleSetSpectator(playerId, msg.data)
          break
        case 'select_puzzle':
          await this.handleSelectPuzzle(playerId, msg.data)
          break
        case 'start_game':
          await this.handleStartGame(playerId)
          break
        case 'ask_question':
          await this.handleAskQuestion(socket, playerId, msg.data)
          break
        case 'moderator_judge':
          await this.handleModeratorJudge(playerId, msg.data)
          break
        case 'guess_answer':
          await this.handleGuessAnswer(socket, playerId, msg.data)
          break
        case 'reveal':
          await this.handleReveal(playerId)
          break
        case 'review_note':
          await this.handleReviewNote(playerId, msg.data)
          break
        case 'ai_hint':
          await this.handleAIHint(socket, playerId)
          break
        case 'add_puzzle':
          await this.handleAddPuzzle(playerId, msg.data)
          break
        case 'chat':
          this.broadcast({ type: 'chat', data: { playerId, text: msg.data?.text } })
          break
        default:
          break
      }
    })
  }

  async webSocketClose(socket) {
    const { playerId } = socket.deserializeAttachment() ?? {}
    if (!playerId) return

    const state = await this.getState()
    const idx = state.players.findIndex((p) => p.id === playerId)
    if (idx === -1) return
    const leaving = state.players[idx]

    // 未开局：直接移除；开局后：标记离线（简单处理，断线重连可恢复）
    if (state.phase === 'waiting') {
      const wasHost = leaving.isHost
      const wasModerator = leaving.isModerator
      state.players.splice(idx, 1)
      state.moderatorApplicants = (state.moderatorApplicants ?? []).filter((id) => id !== playerId)
      if (wasHost && state.players.length > 0) {
        await this.ensureHost(state) // 房主顺位给最早加入的玩家（排除观战）
      }
      if (wasModerator && state.players.length > 0) {
        // 主持人退出：未开局则清空主持人，等开局时重新选
        for (const p of state.players) {
          if (p.isSpectator) continue
          p.isModerator = false
          p.role = 'player'
        }
      }
      await this.saveState(state)
      this.broadcast({
        type: 'player_left',
        data: { playerId, hostId: this.getHostId(state) },
      })
      this.broadcastState()
      return
    }

    // 开局后主持人退出：剩余玩家随机接替
    if (leaving.isModerator && state.players.length > 1) {
      const candidates = state.players.filter((p) => p.id !== playerId && p.connected !== false)
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)]
        pick.isModerator = true
        pick.role = 'moderator'
        leaving.isModerator = false
        leaving.role = 'player'
        this.broadcast({ type: 'moderator_changed', data: { moderatorId: pick.id } })
      }
    }

    leaving.connected = false
    await this.saveState(state)
    this.broadcast({ type: 'player_left', data: { playerId, hostId: this.getHostId(state) } })
    this.broadcastState()
  }

  /** 房主设置主持模式、人数上限、问题次数限制 */
  async handleSetHostConfig(playerId, data) {
    const state = await this.getState()
    if (!this.isHost(state, playerId)) return
    if (state.phase !== 'waiting') return

    const mode = data?.mode === 'human' ? 'human' : 'ai'
    // AI 模式最低 1 人（单人玩），真人模式最低 2 人
    const minPlayers = mode === 'ai' ? 1 : MIN_PLAYERS
    const maxPlayers = Math.max(minPlayers, Math.min(MAX_PLAYERS, Number(data?.maxPlayers) || minPlayers))

    // 问题次数限制：null 表示不限；数字表示全场最多可提的问题数
    const rawLimit = data?.questionLimit
    let questionLimit = null
    if (rawLimit !== null && rawLimit !== undefined && rawLimit !== '') {
      const n = Number(rawLimit)
      if (!Number.isNaN(n) && n > 0) {
        questionLimit = Math.floor(n)
      }
    }

    state.mode = mode
    state.maxPlayers = maxPlayers
    state.questionLimit = questionLimit
    // 模式切换时重置主持人选择（等待重新报名；观战不参与）
    for (const p of state.players) {
      if (p.isSpectator) continue
      p.isModerator = false
      p.role = 'player'
    }
    state.moderatorApplicants = []
    await this.saveState(state)
    this.broadcastState()
  }

  /** 玩家报名/取消报名当主持人（仅真人模式、等待阶段） */
  async handleApplyModerator(playerId, data) {
    const state = await this.getState()
    if (state.mode !== 'human' || state.phase !== 'waiting') return
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return

    state.moderatorApplicants = state.moderatorApplicants ?? []
    const want = data?.apply === true
    if (want) {
      if (!state.moderatorApplicants.includes(playerId)) {
        state.moderatorApplicants.push(playerId)
      }
    } else {
      state.moderatorApplicants = state.moderatorApplicants.filter((id) => id !== playerId)
    }
    await this.saveState(state)
    this.broadcastState()
  }

  /** 玩家手动切换观战/玩家身份 */
  async handleSetSpectator(playerId, data) {
    const state = await this.getState()
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return

    const wantSpectator = data?.spectator === true
    const isSpectator = player.isSpectator ?? false

    if (wantSpectator === isSpectator) return // 状态没变化

    if (wantSpectator) {
      // 玩家 → 观战（随时可）
      player.isSpectator = true
      player.role = 'spectator'
      player.isModerator = false // 观战不能当主持人
      player.isHost = false // 观战不能当房主，房主顺位
      state.moderatorApplicants = (state.moderatorApplicants ?? []).filter((id) => id !== playerId)
      await this.saveState(state)
      // 若离开的是房主，房主顺位给下一个玩家
      await this.ensureHost(state)
    } else {
      // 观战 → 玩家（仅等待阶段且有空位）
      if (state.phase !== 'waiting') {
        this.sendToByPlayerId(playerId, { type: 'error', data: { message: '游戏中不能加入，等下一局' } })
        return
      }
      if (this.isPlayerFull(state)) {
        this.sendToByPlayerId(playerId, { type: 'error', data: { message: '玩家已满，无法加入' } })
        return
      }
      player.isSpectator = false
      player.role = 'player'
      if (!this.getHostId(state)) {
        player.isHost = true // 没房主时自动补位
      }
      await this.saveState(state)
    }

    this.broadcast({ type: 'player_joined', data: { playerId, hostId: this.getHostId(state) } })
    this.broadcastState()
  }

  /** 房主顺位：当前房主离开后，给最早加入的玩家 */
  async ensureHost(state) {
    const hasHost = this.getHostId(state)
    if (hasHost) return
    const next = state.players
      .filter((p) => !p.isSpectator)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0]
    if (next) {
      next.isHost = true
      next.role = 'player'
    }
    await this.saveState(state)
  }
  async handleSelectPuzzle(playerId, data) {
    const state = await this.getState()
    if (!this.isHost(state, playerId)) return
    const puzzleId = data?.puzzleId
    if (!puzzleId) return

    // 从 PuzzleLib 取谜题（含汤底）
    const puzzle = await this.fetchPuzzle(puzzleId)
    if (!puzzle) {
      this.sendToByPlayerId(playerId, { type: 'error', data: { message: '谜题不存在' } })
      return
    }
    state.puzzle = puzzle
    state.puzzleId = puzzleId
    await this.saveState(state)
    this.broadcastState()
  }

  /** 房主开局 */
  async handleStartGame(playerId) {
    const state = await this.getState()
    if (!this.isHost(state, playerId)) return
    if (state.phase !== 'waiting') return
    if (!state.puzzle) {
      this.sendToByPlayerId(playerId, { type: 'error', data: { message: '请先选择谜题' } })
      return
    }
    // 开局人数：AI 模式 1 人即可（单人玩），真人模式需满员
    const playerCount = state.players.filter((p) => !p.isSpectator).length
    if (state.mode === 'ai' && playerCount < 1) {
      this.sendToByPlayerId(playerId, { type: 'error', data: { message: '至少需要 1 名玩家' } })
      return
    }
    if (state.mode === 'human' && !this.isFull(state)) {
      this.sendToByPlayerId(playerId, { type: 'error', data: { message: `真人模式需满 ${state.maxPlayers} 人才能开局` } })
      return
    }

    // 真人模式：开局前选定主持人（报名者优先，多人随机，无人则随机抽；观战不参与）
    if (state.mode === 'human') {
      for (const p of state.players) {
        if (p.isSpectator) continue
        p.isModerator = false
        p.role = 'player'
      }
      const applicants = (state.moderatorApplicants ?? []).filter((id) => {
        const p = state.players.find((x) => x.id === id)
        return p && !p.isSpectator
      })
      let moderatorId = null
      if (applicants.length > 0) {
        moderatorId = applicants[Math.floor(Math.random() * applicants.length)]
      } else {
        const pool = state.players.filter((p) => !p.isSpectator && p.connected !== false)
        if (pool.length > 0) {
          moderatorId = pool[Math.floor(Math.random() * pool.length)].id
        }
      }
      if (moderatorId) {
        const moderator = state.players.find((p) => p.id === moderatorId)
        moderator.isModerator = true
        moderator.role = 'moderator'
      }
    }

    state.phase = 'playing'
    state.questionCount = 0
    state.questionsExhausted = false
    state.messages = []
    state.lastQuestionAt = null
    state.ended = false
    await this.saveState(state)
    this.broadcastState()
  }

  /** 玩家提问 */
  async handleAskQuestion(socket, playerId, data) {
    const state = await this.getState()
    if (state.phase !== 'playing' || state.ended) return
    const player = state.players.find((p) => p.id === playerId)
    if (!player || player.isSpectator) {
      this.sendTo(socket, { type: 'error', data: { message: '观战中不能提问' } })
      return
    }
    const question = String(data?.text ?? '').trim()
    if (!question || question.length > 200) return

    // 问题次数限制检查
    if (state.questionLimit && state.questionCount >= state.questionLimit) {
      this.sendTo(socket, {
        type: 'error',
        data: { message: `问题已用尽（上限 ${state.questionLimit} 次），请等待揭底` },
      })
      return
    }

    // 提问节流：3 秒内只允许一个玩家提问
    const now = Date.now()
    if (state.lastQuestionAt && now - state.lastQuestionAt < QUESTION_THROTTLE_MS) {
      const wait = Math.ceil((QUESTION_THROTTLE_MS - (now - state.lastQuestionAt)) / 1000)
      this.sendTo(socket, {
        type: 'error',
        data: { message: `请稍等 ${wait} 秒再提问` },
      })
      return
    }
    state.lastQuestionAt = now

    state.questionCount += 1
    state.messages.push({ from: playerId, text: question, kind: 'question', at: Date.now() })

    const limit = state.questionLimit
    if (limit && state.questionCount >= limit) {
      state.questionsExhausted = true
    }

    let judge = JUDGE.IRRELEVANT
    let reason = ''
    let source = 'ai'

    if (state.mode === 'human') {
      // 真人模式：转发给主持人，由主持人判定（不在这里判）
      state.pendingQuestion = { from: playerId, text: question }
      await this.saveState(state)
      this.broadcastState()
      this.sendToByPlayerId(
        this.getModeratorId(state),
        { type: 'moderator_question', data: { question, from: playerId } },
      )
      return
    }

    // AI 模式：调 AI 判定，失败则关键词兜底
    try {
      const raw = await callAIJudge(question, state.puzzle, this.env)
      const parsed = parseAIJudge(raw)
      judge = parsed.judge
      reason = parsed.reason
    } catch (e) {
      source = 'fallback'
      const fb = keywordFallback(question, state.puzzle.keywords ?? [])
      judge = fb.judge
      reason = fb.reason + `（AI 不可用: ${e.message?.slice(0, 60)}）`
    }

    state.messages.push({ from: 'moderator', judge, reason, source, forPlayer: playerId, at: Date.now() })
    await this.saveState(state)
    this.broadcastState()
  }

  /** 真人主持人判定 */
  async handleModeratorJudge(playerId, data) {
    const state = await this.getState()
    if (state.phase !== 'playing') return
    if (!this.isModerator(state, playerId)) return
    const judge = data?.judge
    if (!Object.values(JUDGE).includes(judge)) return

    // 真人模式：主持人确认玩家答案正确 → 结束游戏
    if (judge === JUDGE.CORRECT && state.pendingGuess) {
      state.phase = 'ended'
      state.ended = true
      state.winnerId = state.pendingGuess.from
      state.revealed = true
      state.messages.push({
        from: 'moderator',
        judge: JUDGE.CORRECT,
        reason: `${state.players.find((p) => p.id === state.pendingGuess.from)?.nickname ?? ''} 猜中了汤底！`,
        source: 'human',
        forPlayer: state.pendingGuess.from,
        at: Date.now(),
      })
      state.pendingGuess = null
      await this.saveState(state)
      this.broadcastState()
      return
    }

    state.messages.push({
      from: 'moderator',
      judge,
      reason: String(data?.reason ?? '').trim(),
      source: 'human',
      forPlayer: state.pendingQuestion?.from ?? null,
      at: Date.now(),
    })
    state.pendingQuestion = null
    if (judge === JUDGE.NO && state.pendingGuess) {
      state.messages.push({
        from: 'moderator',
        judge: JUDGE.NO,
        reason: '答案不对，继续推理',
        source: 'system',
        at: Date.now(),
      })
      state.pendingGuess = null
    }
    await this.saveState(state)
    this.broadcastState()
  }

  /** 玩家提交最终答案（猜中即结束） */
  async handleGuessAnswer(socket, playerId, data) {
    const state = await this.getState()
    if (state.phase !== 'playing' || state.ended) return
    const text = String(data?.text ?? '').trim()
    if (!text) return

    let correct = false
    if (state.mode === 'ai') {
      try {
        const raw = await callAIJudge(
          `（这是玩家给出的最终答案）${text}`,
          state.puzzle,
          this.env,
        )
        const parsed = parseAIJudge(raw)
        correct = parsed.judge === JUDGE.CORRECT
      } catch {
        correct = keywordFallback(text, state.puzzle.keywords ?? []).judge === JUDGE.YES
      }
    } else {
      // 真人模式：由主持人手动确认
      state.pendingGuess = { from: playerId, text }
      this.sendToByPlayerId(this.getModeratorId(state), {
        type: 'guess_proposed',
        data: { from: playerId, text },
      })
      await this.saveState(state)
      return
    }

    if (correct) {
      state.phase = 'ended'
      state.ended = true
      state.winnerId = playerId
      state.messages.push({ from: 'moderator', judge: JUDGE.CORRECT, reason: '答案正确！', source: 'system', at: Date.now() })
    } else {
      state.messages.push({ from: 'moderator', judge: JUDGE.NO, reason: '不对，再想想', source: 'system', at: Date.now() })
    }
    await this.saveState(state)
    this.broadcastState()
  }

  /** 主持人揭底 */
  async handleReveal(playerId) {
    const state = await this.getState()
    if (state.phase !== 'playing' && state.phase !== 'ended') return
    const isModerator = this.isModerator(state, playerId)
    const isHost = this.isHost(state, playerId)
    if (!isModerator && !isHost) return

    state.phase = 'ended'
    state.ended = true
    state.revealed = true
    await this.saveState(state)
    this.broadcastState()
  }

  /** 复盘：共享笔记，所有人可见 */
  async handleReviewNote(playerId, data) {
    const state = await this.getState()
    if (state.phase !== 'playing' && state.phase !== 'ended') return
    const text = String(data?.text ?? '').trim()
    if (!text || text.length > 500) return

    state.reviewNotes = state.reviewNotes ?? []
    state.reviewNotes.push({
      from: playerId,
      text,
      at: Date.now(),
      kind: data?.kind === 'ai' ? 'ai' : 'note',
    })
    await this.saveState(state)
    this.broadcastState()
  }

  /** 复盘：AI 辅助提示（仅主持人/房主可触发），结果作为 AI 笔记广播 */
  async handleAIHint(socket, playerId) {
    const state = await this.getState()
    if (state.phase !== 'playing' && state.phase !== 'ended') return
    const isModerator = this.isModerator(state, playerId)
    const isHost = this.isHost(state, playerId)
    if (!isModerator && !isHost) return
    if (!state.puzzle) return

    // 组装已问问题（供 AI 参考玩家思路）
    const questions = state.messages
      .filter((m) => m.kind === 'question')
      .slice(-20)
      .map((m) => m.text)

    const hint = await this.callAIHint(state.puzzle, questions)
    state.reviewNotes = state.reviewNotes ?? []
    state.reviewNotes.push({
      from: 'ai',
      text: `💡 AI复盘提示：${hint}`,
      at: Date.now(),
      kind: 'ai',
    })
    await this.saveState(state)
    this.broadcastState()
  }

  /** 组装 AI 复盘提示 prompt 并调用 */
  async callAIHint(puzzle, questions) {
    const prompt = [
      '你是"大肥鱼"，一位海龟汤游戏大师，主持过上千局游戏。',
      '现在请作为复盘顾问，根据玩家已问的问题，给出 1~2 条不剧透汤底核心真相的提示，帮助玩家继续推理。',
      '',
      `【汤面】${puzzle.story}`,
      `【汤底真相】${puzzle.answer}`,
      '',
      questions.length > 0 ? `【玩家已问的问题】\n${questions.join('\n')}` : '【玩家已问的问题】暂无',
      '',
      '要求：提示要具体、可操作，指向玩家可能忽略的关键细节，但不能直接说出答案或关键转折。只输出提示文本本身。',
    ].join('\n')

    const baseUrl = this.env.AI_BASE_URL || 'https://opencode.ai/zen/go/v1'
    const model = this.env.AI_MODEL || 'deepseek-v4-flash'
    const apiKey = this.env.AI_API_KEY
    if (!apiKey) throw new Error('AI_API_KEY 未配置')

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请给出复盘提示。' },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
    })
    if (!res.ok) {
      throw new Error(`AI 调用失败 ${res.status}`)
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('AI 返回格式异常')
    return content.trim()
  }

  // ---- 辅助 ----

  getHostId(state) {
    return state.players.find((p) => p.isHost)?.id ?? null
  }

  getModeratorId(state) {
    // 真人模式：只返回真正被选中的主持人（开局时从报名者中选出），房主未报名不会自动成为主持人
    if (state.mode === 'human') {
      return state.players.find((p) => p.isModerator)?.id ?? null
    }
    return null // AI 模式无真人主持人
  }

  isHost(state, playerId) {
    return state.players.find((p) => p.id === playerId)?.isHost ?? false
  }

  isModerator(state, playerId) {
    return state.players.find((p) => p.id === playerId)?.isModerator ?? false
  }

  /** 玩家名额是否已满（观战不占玩家名额） */
  isPlayerFull(state) {
    const playerCount = state.players.filter((p) => !p.isSpectator).length
    return playerCount >= (state.maxPlayers ?? MIN_PLAYERS)
  }

  /** 开局条件：玩家人数达到上限（观战不参与开局） */
  isFull(state) {
    const playerCount = state.players.filter((p) => !p.isSpectator).length
    return playerCount >= (state.maxPlayers ?? MIN_PLAYERS)
  }

  async fetchPuzzle(puzzleId) {
    const id = this.env.PUZZLE_LIB.idFromName('global')
    const stub = this.env.PUZZLE_LIB.get(id)
    const res = await stub.fetch(
      new Request(`https://internal/api/puzzles/${puzzleId}`),
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.puzzle ?? null
  }

  async getState() {
    const state = await this.ctx.storage.get('state')
    if (state) return state
    const fresh = {
      players: [],
      phase: 'waiting', // waiting | playing | ended
      mode: 'ai', // ai | human
      maxPlayers: MAX_PLAYERS,
      questionLimit: null, // null 表示不限
      questionsExhausted: false,
      moderatorApplicants: [], // 真人模式：报名当主持人的玩家 id 列表
      puzzle: null,
      puzzleId: null,
      questionCount: 0,
      messages: [], // {from, text/judge/reason, kind, source, at}
      pendingGuess: null, // 真人模式：待主持人确认的答案
      reviewNotes: [], // 复盘共享笔记
      winnerId: null,
      revealed: false,
    }
    await this.ctx.storage.put('state', fresh)
    return fresh
  }

  async saveState(state) {
    await this.ctx.storage.put('state', state)
  }

  broadcastState() {
    void this.getState().then((state) => {
      for (const socket of this.ctx.getWebSockets()) {
        this.sendStateTo(socket, state)
      }
    })
  }

  sendStateTo(socket, stateOverride) {
    void this.getState().then((state) => {
      const { playerId } = socket.deserializeAttachment() ?? {}
      if (!playerId) return
      this.sendTo(socket, {
        type: 'game_state',
        data: this.viewFor(playerId, stateOverride ?? state),
      })
    })
  }

  viewFor(playerId, state) {
    const isModerator = state.players.find((p) => p.id === playerId)?.isModerator ?? false
    const isHost = state.players.find((p) => p.id === playerId)?.isHost ?? false
    return {
      phase: state.phase,
      roomId: this.roomId,
      myPlayerId: playerId,
      mode: state.mode,
      maxPlayers: state.maxPlayers,
      puzzle: state.puzzle
        ? {
            id: state.puzzle.id,
            title: state.puzzle.title,
            story: state.puzzle.story,
            difficulty: state.puzzle.difficulty,
            // 汤底只在结束后公开
            answer: state.phase === 'ended' ? state.puzzle.answer : null,
          }
        : null,
      hostId: this.getHostId(state),
      moderatorId: this.getModeratorId(state),
      moderatorApplicants: state.moderatorApplicants ?? [],
      amI: { isHost, isModerator, isSpectator: (state.players.find((p) => p.id === playerId)?.isSpectator ?? false) },
      players: state.players
        .filter((p) => !p.isSpectator)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          avatarId: p.avatarId ?? '0',
          isHost: p.isHost,
          isModerator: p.isModerator,
          role: p.role,
          connected: p.connected,
        })),
      spectators: state.players
        .filter((p) => p.isSpectator)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          avatarId: p.avatarId ?? '0',
          connected: p.connected,
        })),
      messages: state.messages,
      reviewNotes: state.reviewNotes ?? [],
      questionCount: state.questionCount,
      questionLimit: state.questionLimit,
      questionsExhausted: state.questionsExhausted,
      winnerId: state.winnerId,
      revealed: state.revealed,
    }
  }

  broadcast(message) {
    for (const socket of this.ctx.getWebSockets()) {
      this.sendTo(socket, message)
    }
  }

  sendTo(socket, message) {
    try {
      socket.send(JSON.stringify(message))
    } catch {
      /* socket 可能已断开 */
    }
  }

  sendToByPlayerId(playerId, message) {
    for (const socket of this.ctx.getWebSockets()) {
      const { playerId: pid } = socket.deserializeAttachment() ?? {}
      if (pid === playerId) {
        this.sendTo(socket, message)
        break
      }
    }
  }
}
