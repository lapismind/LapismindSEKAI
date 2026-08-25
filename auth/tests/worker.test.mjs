import assert from 'node:assert/strict'
import worker from '../src/index.js'

// ---- 假 D1：只覆盖 worker 用到的 SQL 形状 ----
function makeFakeDB() {
  const users = new Map() // id -> row
  const comments = []
  let nextUserId = 1
  let nextCommentId = 1
  return {
    users,
    comments,
    prepare(sql) {
      const api = {
        args: [],
        bind(...args) {
          api.args = args
          return api
        },
        async first() {
          if (sql.includes('FROM users WHERE github_id')) {
            for (const [id, u] of users) if (u.github_id === api.args[0]) return { id }
            return null
          }
          if (sql === 'SELECT id FROM users WHERE id = ?' || sql.startsWith('SELECT id FROM users')) {
            return users.has(api.args[0]) ? { id: api.args[0] } : null
          }
          if (sql.startsWith('SELECT github_id, nickname')) {
            const u = users.get(api.args[0])
            return u ? { ...u } : null
          }
          if (sql.includes('COUNT(*)')) {
            // 列表总数：按 page_path；限流计数：按 user_id + 时间窗
            const n =
              api.args.length === 1
                ? comments.filter((c) => c.page_path === api.args[0]).length
                : comments.filter((c) => c.user_id === api.args[0] && c.created_at > api.args[1]).length
            return { n }
          }
          if (sql.includes('FROM comments WHERE user_id')) {
            const uid = api.args[0]
            const since = api.args[1]
            return { n: comments.filter((c) => c.user_id === uid && c.created_at > since).length }
          }
          throw new Error('fake db: unsupported first: ' + sql)
        },
        async run() {
          if (sql.startsWith('UPDATE users SET')) {
            const [nickname, avatarUrl, id] = api.args
            Object.assign(users.get(id), { nickname, avatar_url: avatarUrl })
            return { meta: { changes: 1 } }
          }
          if (sql.startsWith('INSERT INTO users')) {
            const [, githubId, nickname, avatarUrl] = api.args
            users.set(nextUserId, { github_id: githubId, nickname, avatar_url: avatarUrl })
            return { meta: { last_row_id: nextUserId++ } }
          }
          if (sql.startsWith('INSERT INTO comments')) {
            comments.push({ id: nextCommentId, user_id: api.args[0], page_path: api.args[1], content: api.args[2], created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) })
            return { meta: { last_row_id: nextCommentId++ } }
          }
          throw new Error('fake db: unsupported run: ' + sql)
        },
        async all() {
          if (sql.startsWith('SELECT c.id')) {
            const pagePath = api.args[0]
            const rows = comments
              .filter((c) => c.page_path === pagePath)
              .sort((a, b) => b.id - a.id)
              .map((c) => ({
                id: c.id,
                content: c.content,
                created_at: c.created_at,
                nickname: users.get(c.user_id)?.nickname ?? 'unknown',
                avatar_url: null,
              }))
            return { results: rows.slice(api.args[2], api.args[2] + api.args[1]) }
          }
          throw new Error('fake db: unsupported all: ' + sql)
        },
      }
      return api
    },
  }
}

const SECRET = 'test-secret'
function makeEnv() {
  return {
    SESSION_SECRET: SECRET,
    GITHUB_CLIENT_ID: 'cid',
    GITHUB_CLIENT_SECRET: 'csec',
    ADMIN_GITHUB_ID: '',
    DB: makeFakeDB(),
  }
}

function cookieOf(res) {
  return res.headers.get('set-cookie').split(';')[0]
}

// ---- 游客登录 → /api/me 回读身份 ----
{
  const env = makeEnv()
  const req = new Request('https://auth.qmzhj.top/api/guest', { method: 'POST' })
  const res = await worker.fetch(req, env)
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.user.provider, 'guest')
  assert.ok(data.user.playerId.startsWith('p'))
  const cookie = cookieOf(res)
  assert.match(cookie, /^session=/)

  const meRes = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/me', { headers: { cookie } }),
    env,
  )
  const me = await meRes.json()
  assert.equal(me.user.provider, 'guest')
  assert.equal(me.user.playerId, data.user.playerId, '刷新后身份保持')
}

// ---- 评论：未登录 401 → 登录后可发 → 超过 5 条触发 429 ----
{
  const env = makeEnv()
  // 未登录发帖被拒
  const anon = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/comments', {
      method: 'POST',
      body: JSON.stringify({ page_path: '/blog/x/', content: 'hi' }),
    }),
    env,
  )
  assert.equal(anon.status, 401)
  const anonData = await anon.json()
  assert.equal(anonData.needLogin, true)

  // 手工签一个 GitHub 会话（跳过真实 OAuth）
  const { createSessionToken } = await import('@lapismind/lobby-kit')
  const upsert = await worker.fetch(new Request('https://x/'), makeEnv()) // 占位避免未使用告警
  void upsert

  // 先往假 DB 里造用户行
  const insertApi = env.DB.prepare('INSERT INTO users (provider, github_id, nickname, avatar_url) VALUES (?, ?, ?, ?)').bind('github', '10086', 'octocat', null)
  await insertApi.run()
  const userId = 1
  const token = await createSessionToken({ playerId: 'pu' + userId.toString(36), provider: 'github' }, SECRET)
  const cookie = `session=${token}`

  // 正常发帖
  for (let i = 0; i < 5; i++) {
    const res = await worker.fetch(
      new Request('https://auth.qmzhj.top/api/comments', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ page_path: '/blog/x/', content: `评论 ${i}` }),
      }),
      env,
    )
    assert.equal(res.status, 200, `第 ${i + 1} 条应成功`)
  }
  // 第 6 条触发限流
  const limited = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/comments', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ page_path: '/blog/x/', content: '第6条' }),
    }),
    env,
  )
  assert.equal(limited.status, 429, '同分钟第 6 条触发限流')

  // 内容超长被拒（该用户已撞限流，但参数校验在限流检查之前，应返回 400 而非 429）
  const tooLong = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/comments', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ page_path: '/blog/x/', content: 'x'.repeat(501) }),
    }),
    env,
  )
  assert.equal(tooLong.status, 400, '内容校验先于限流检查')

  // 公开读取列表
  const list = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/comments?page_path=%2Fblog%2Fx%2F'),
    env,
  )
  assert.equal(list.status, 200)
  const listData = await list.json()
  assert.equal(listData.total, 5)
  assert.equal(listData.comments.length, 5, '分页默认 20 内返回全部')
}

console.log('worker smoke tests passed')

// ---- /login：state cookie + redirect 目的地 cookie + 开放重定向防护 ----
{
  const env = makeEnv()
  const res = await worker.fetch(
    new Request('https://auth.qmzhj.top/login?redirect_to=%2Fblog%2Fsome-post%2F'),
    env,
  )
  assert.equal(res.status, 302)
  assert.match(res.headers.get('location'), /^https:\/\/github\.com\/login\/oauth\/authorize\?/)
  const setCookies = [...res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]].join('\n')
  assert.match(setCookies, /oauth_state=/, '种下 state cookie')
  assert.match(setCookies, /oauth_redirect=%2Fblog%2Fsome-post%2F/, '记录登录目的地')

  // 外部地址被拦下，强制回首页
  const evil = await worker.fetch(
    new Request('https://auth.qmzhj.top/login?redirect_to=' + encodeURIComponent('https://evil.example/phish')),
    env,
  )
  const evilCookies = [...evil.headers.getSetCookie?.() ?? [evil.headers.get('set-cookie')]].join('\n')
  assert.doesNotMatch(evilCookies, /oauth_redirect=https%3A%2F%2Fevil/, '外部跳转被拒绝')
}

console.log('worker login-flow tests passed')
