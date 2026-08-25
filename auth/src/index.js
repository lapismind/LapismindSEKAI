/**
 * sekai-auth —— 统一认证 Worker
 *
 * 路由：
 *   GET  /login        → 跳转 GitHub 授权页（带 state cookie 防 CSRF）
 *   GET  /callback     → OAuth 回调：换 token、拉用户、写 D1、签会话 cookie
 *   POST /api/guest    → 游客登录：generatePlayerId + createSessionToken，不落库
 *   GET  /api/me       → 读会话，返回当前身份
 *   POST /logout       → 清除会话 cookie
 *   GET  /api/comments → 公开评论列表（分页）
 *   POST /api/comments → GitHub 用户发评论（≤500 字，每分钟 ≤5 条）
 *   DELETE /api/comments/:id → 仅管理员（ADMIN_GITHUB_ID）
 */

import { generatePlayerId, createSessionToken, verifyIdentityToken, SESSION_TTL_MS } from '@lapismind/lobby-kit'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_API = 'https://api.github.com/user'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url
    const cors = corsHeaders(request)

    // 预检请求直接放行
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    try {
      if (pathname === '/login') return handleLogin(url, env)
      if (pathname === '/callback') return await handleCallback(request, url, env)
      if (pathname === '/api/guest' && request.method === 'POST') return await handleGuest(env, cors)
      if (pathname === '/api/me') return await handleMe(request, env, cors)
      if (pathname === '/logout' && request.method === 'POST') return handleLogout(cors)
      if (pathname === '/api/comments' && request.method === 'GET') return await listComments(url, env, cors)
      if (pathname === '/api/comments' && request.method === 'POST') return await postComment(request, env, cors)
      const delMatch = pathname.match(/^\/api\/comments\/(\d+)$/)
      if (delMatch && request.method === 'DELETE') return await deleteComment(request, delMatch[1], env, cors)

      return json({ error: 'not found' }, 404, cors)
    } catch (err) {
      console.error('auth worker error:', err)
      return json({ error: 'internal error' }, 500, cors)
    }
  },
}

// ---------- 工具 ----------

const ALLOWED_ORIGIN_RE = /https:\/\/([a-z0-9-]+\.)?qmzhj\.top$/

function corsHeaders(request) {
  const origin = request.headers.get('origin') || ''
  // 只允许 qmzhj.top 及其子域跨域携带 cookie 访问
  if (ALLOWED_ORIGIN_RE.test(origin)) {
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    }
  }
  return {}
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

function sessionCookie(token) {
  // HttpOnly + Secure + SameSite=Lax；domain 带前导点让 blog/soup/showhand 子域共享
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `session=${token}; Domain=.qmzhj.top; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

const DEFAULT_DEST = 'https://blog.qmzhj.top/'

// 开放重定向防护：只允许 qmzhj.top 及其子域的完整 URL（拦截外域与协议相对写法）
function sanitizeRedirect(dest) {
  if (!dest) return DEFAULT_DEST
  try {
    const u = new URL(dest, 'https://blog.qmzhj.top')
    const host = u.hostname
    const allowed = host === 'qmzhj.top' || host.endsWith('.qmzhj.top')
    return allowed ? u.href : DEFAULT_DEST
  } catch {
    return DEFAULT_DEST
  }
}

function clearCookie() {
  return 'session=; Domain=.qmzhj.top; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
}

async function getSession(request, env) {
  const cookieHeader = request.headers.get('cookie') || ''
  const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/)
  if (!m) return null
  const identity = await verifyIdentityToken(m[1], env.SESSION_SECRET)
  return identity || null
}

// ---------- 第一阶段：登录流程 ----------

function handleLogin(url, env) {
  const state = crypto.randomUUID()
  // 登录目的地存短期 cookie：GitHub 回调只回传 code/state，不会带回自定义参数
  const redirectTo = sanitizeRedirect(url.searchParams.get('redirect_to'))
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: new URL('/callback', url.origin).toString(),
    scope: 'read:user',
    state,
  })
  // state 存 cookie，callback 时比对防 CSRF（10 分钟有效）
  const headers = new Headers({ Location: `${GITHUB_AUTHORIZE_URL}?${params}` })
  headers.append('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  headers.append('Set-Cookie', `oauth_redirect=${encodeURIComponent(redirectTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  return new Response(null, { status: 302, headers })
}

async function handleCallback(request, url, env) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  // 浏览器会自动带上 /login 时种下的 oauth_state cookie
  const cookieState = (request.headers.get('cookie') || '').match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1]

  if (!code || !state || !cookieState || state !== cookieState) {
    return json({ error: 'invalid state' }, 400)
  }

  // 授权码换 access token
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL('/callback', url.origin).toString(),
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    // 排查用：把 GitHub 的具体错误打进日志（不暴露给前端）
    console.error('token exchange failed:', JSON.stringify(tokenData))
    return json({ error: 'token exchange failed' }, 401)
  }

  // 拉 GitHub 用户信息
  const userRes = await fetch(GITHUB_USER_API, {
    headers: { authorization: `Bearer ${tokenData.access_token}`, 'user-agent': 'sekai-auth' },
  })
  const ghUser = await userRes.json()
  if (!ghUser.id) return json({ error: 'failed to fetch user' }, 401)

  // upsert users 表
  let row = await env.DB.prepare(
    'SELECT id FROM users WHERE github_id = ?'
  ).bind(String(ghUser.id)).first()
  if (row) {
    await env.DB.prepare('UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?')
      .bind(ghUser.login || ghUser.name || `user-${ghUser.id}`, ghUser.avatar_url || null, row.id).run()
  } else {
    const result = await env.DB.prepare(
      'INSERT INTO users (provider, github_id, nickname, avatar_url) VALUES (?, ?, ?, ?)'
    ).bind('github', String(ghUser.id), ghUser.login || ghUser.name || `user-${ghUser.id}`, ghUser.avatar_url || null).run()
    row = { id: result.meta.last_row_id }
  }

  // 会话 token 与游客同构，playerId 稳定绑定用户行
  // 用 '-' 做定界符：解析时按第一个 '-' 截断，避免随机后缀被贪婪正则吞进 id
  const playerId = 'pu' + row.id.toString(36) + '-' + crypto.randomUUID().slice(0, 8).replaceAll('-', 'x')
  const token = await createSessionToken({ playerId, provider: 'github' }, env.SESSION_SECRET)

  const rawDest = request.headers.get('cookie')?.match(/(?:^|;\s*)oauth_redirect=([^;]+)/)?.[1]
  const safeDest = rawDest ? sanitizeRedirect(decodeURIComponent(rawDest)) : DEFAULT_DEST
  const headers = new Headers({ Location: safeDest })
  headers.append('Set-Cookie', sessionCookie(token))
  headers.append('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Max-Age=0')
  headers.append('Set-Cookie', 'oauth_redirect=; Path=/; HttpOnly; Max-Age=0')
  return new Response(null, { status: 302, headers })
}

async function handleGuest(env, cors = {}) {
  const playerId = generatePlayerId()
  const token = await createSessionToken({ playerId, provider: 'guest' }, env.SESSION_SECRET)
  return json(
    { ok: true, user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId } },
    200,
    { 'Set-Cookie': sessionCookie(token), ...cors },
  )
}

async function handleMe(request, env, cors = {}) {
  const session = await getSession(request, env)
  if (!session) return json({ user: null }, 200, cors)

  if (session.provider === 'guest') {
    return json({ user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId: session.playerId } }, 200, cors)
  }

  // GitHub 用户从 D1 补全昵称头像；playerId 由 token 保证稳定
  // 非贪婪：只取到第一个 '-' 之前的部分（旧格式无 '-'，保持原样兼容）
  const m = session.playerId.match(/^pu([0-9a-z]+?)(?:-|$)/) || session.playerId.match(/^pu([0-9a-z]+)/)
  const userId = m ? parseInt(m[1], 36) : null
  let nickname = null, avatarUrl = null, githubId = null
  if (userId) {
    const row = await env.DB.prepare('SELECT github_id, nickname, avatar_url FROM users WHERE id = ?').bind(userId).first()
    if (row) ({ github_id: githubId, nickname, avatar_url: avatarUrl } = row)
  }
  return json({ user: { provider: 'github', nickname, avatarUrl, playerId: session.playerId, userId, githubId } }, 200, cors)
}

function handleLogout(cors = {}) {
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(), ...cors })
}

// ---------- 第二阶段：评论接口 ----------

const COMMENT_MAX_LEN = 500
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 5

async function listComments(url, env, cors = {}) {
  const pagePath = url.searchParams.get('page_path')
  if (!pagePath) return json({ error: 'missing page_path' }, 400)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('page_size') || '20', 10) || 20))

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.content, c.created_at, u.nickname, u.avatar_url
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.page_path = ?
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ? OFFSET ?`
  ).bind(pagePath, pageSize, (page - 1) * pageSize).all()

  const total = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM comments WHERE page_path = ?'
  ).bind(pagePath).first()

  return json({
    comments: results.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      nickname: r.nickname,
      avatarUrl: r.avatar_url,
    })),
    total: total.n,
    page,
    pageSize,
  }, 200, cors)
}

async function postComment(request, env, cors = {}) {
  const session = await getSession(request, env)
  if (!session || session.provider !== 'github') {
    return json({ error: 'login required', needLogin: true }, 401, cors)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400, cors)
  }
  const pagePath = typeof body.page_path === 'string' ? body.page_path.slice(0, 512) : ''
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, COMMENT_MAX_LEN + 1) : ''
  if (!pagePath || !content || content.length > COMMENT_MAX_LEN) {
    return json({ error: `content required, max ${COMMENT_MAX_LEN} chars` }, 400, cors)
  }

  const m = session.playerId.match(/^pu([0-9a-z]+?)(?:-|$)/) || session.playerId.match(/^pu([0-9a-z]+)/)
  const userId = m ? parseInt(m[1], 36) : null
  if (!userId) return json({ error: 'invalid session' }, 401, cors)
  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
  if (!user) return json({ error: 'invalid session' }, 401, cors)

  // 频率限制：同一用户每分钟最多 5 条（用 D1 计数）
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19)
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?"
  ).bind(userId, since).first()
  if (recent.n >= RATE_LIMIT_MAX) {
    return json({ error: 'rate limited, try later' }, 429, cors)
  }

  const result = await env.DB.prepare(
    'INSERT INTO comments (user_id, page_path, content) VALUES (?, ?, ?)'
  ).bind(userId, pagePath, content).run()

  return json({
    ok: true,
    comment: {
      id: result.meta.last_row_id,
      content,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      nickname: null, // 前端可从 /api/me 拿到自己的昵称
    },
  }, 200, cors)
}

async function deleteComment(request, commentId, env, cors = {}) {
  const session = await getSession(request, env)
  if (!session || session.provider !== 'github' || !env.ADMIN_GITHUB_ID) {
    return json({ error: 'forbidden' }, 403, cors)
  }
  const m = session.playerId.match(/^pu([0-9a-z]+?)(?:-|$)/) || session.playerId.match(/^pu([0-9a-z]+)/)
  const userId = m ? parseInt(m[1], 36) : null
  if (!userId) return json({ error: 'forbidden' }, 403, cors)
  const user = await env.DB.prepare('SELECT github_id FROM users WHERE id = ?').bind(userId).first()
  if (!user || String(user.github_id) !== String(env.ADMIN_GITHUB_ID)) {
    return json({ error: 'forbidden' }, 403, cors)
  }
  const result = await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run()
  if (!result.meta.changes) return json({ error: 'not found' }, 404)
  return json({ ok: true }, 200, cors)
}
