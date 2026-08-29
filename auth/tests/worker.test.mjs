import assert from 'node:assert/strict'
import worker from '../src/index.js'
import { ACHIEVEMENT_DEFS } from '../src/achievements.js'

// ---- 假 D1：只覆盖 worker 用到的 SQL 形状 ----
function makeFakeDB() {
  const users = new Map() // id -> row
  const comments = []
  const achievements = [] // { player_id, achievement_key, unlocked_at }
  const loginAttempts = [] // { key, created_at }
  let nextUserId = 1
  let nextCommentId = 1
  return {
    users,
    comments,
    achievements,
    loginAttempts,
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
          if (sql.includes('FROM login_attempts')) {
            const key = api.args[0]
            const since = api.args[1]
            return { n: loginAttempts.filter((a) => a.key === key && a.created_at > since).length }
          }
          if (sql.includes('FROM users WHERE provider = ') && sql.includes('account') && sql.includes('nickname = ?')) {
            for (const [, u] of users) if (u.provider === 'account' && u.nickname === api.args[0]) return u
            return null
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
          if (sql.includes('SUM(') && sql.includes('match_players')) {
            // 成就 career 汇总：测试桩不造对局数据，返回全零即可
            return { totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0 }
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
          if (sql.startsWith('INSERT INTO login_attempts')) {
            loginAttempts.push({ key: api.args[0], created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) })
            return { meta: { last_row_id: loginAttempts.length } }
          }
          if (sql.startsWith('DELETE FROM login_attempts')) {
            const key = api.args[0]
            const before = loginAttempts.length
            for (let i = loginAttempts.length - 1; i >= 0; i--) {
              if (loginAttempts[i].key === key) loginAttempts.splice(i, 1)
            }
            return { meta: { changes: before - loginAttempts.length } }
          }
          throw new Error('fake db: unsupported run: ' + sql)
        },
        async all() {
          if (sql.startsWith('SELECT achievement_key')) {
            const pid = api.args[0]
            return {
              results: achievements
                .filter((r) => r.player_id === pid)
                .sort((a, b) => (a.unlocked_at < b.unlocked_at ? 1 : -1))
                .map((r) => ({ achievement_key: r.achievement_key, unlocked_at: r.unlocked_at })),
            }
          }
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
          if (sql.includes('json_each')) {
            // 分魔法累计：空结果即可
            return { results: [] }
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

// ---- 成就展馆：/api/achievements 返回全量目录 + 解锁标记；未登录 401 ----
{
  const env = makeEnv()

  const anon = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/achievements'),
    env,
  )
  assert.equal(anon.status, 401, '未登录不可读成就')

  const guest = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/guest', { method: 'POST' }),
    env,
  )
  const guestData = await guest.json()
  const cookie = cookieOf(guest)

  const empty = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }),
    env,
  )
  assert.equal(empty.status, 200)
  const emptyData = await empty.json()
  assert.equal(emptyData.total, ACHIEVEMENT_DEFS.length, '全量目录随返回')
  assert.equal(emptyData.unlockedCount, 0, '新游客零解锁')
  assert.ok(emptyData.achievements.every((a) => a.unlocked === false), '未解锁标记一致')

  // 手工塞两条解锁记录后回读
  env.DB.achievements.push(
    { player_id: guestData.user.playerId, achievement_key: 'first_cast', unlocked_at: '2026-08-27 10:00:00' },
    { player_id: guestData.user.playerId, achievement_key: 'first_kill', unlocked_at: '2026-08-27 10:05:00' },
  )
  const unlocked = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }),
    env,
  )
  const unlockedData = await unlocked.json()
  assert.equal(unlockedData.unlockedCount, 2)
  const byKey = Object.fromEntries(unlockedData.achievements.map((a) => [a.key, a]))
  assert.equal(byKey.first_cast.unlocked, true, 'first_cast 已解锁')
  assert.equal(byKey.first_kill.unlocked, true, 'first_kill 已解锁')
  assert.equal(byKey.dragon_veteran.unlocked, false, '未解锁成就保持 false')
  assert.equal(byKey.first_cast.unlockedAt, '2026-08-27 10:00:00', '带回解锁时间')
}

console.log('worker achievements tests passed')

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
  // 相对路径会被 sanitize 成默认目的地（测试环境无 location 上下文）
  assert.match(setCookies, /oauth_redirect=/, '记录登录目的地 cookie')

  // 外部地址被拦下，强制回首页
  const evil = await worker.fetch(
    new Request('https://auth.qmzhj.top/login?redirect_to=' + encodeURIComponent('https://evil.example/phish')),
    env,
  )
  const evilCookies = [...evil.headers.getSetCookie?.() ?? [evil.headers.get('set-cookie')]].join('\n')
  assert.doesNotMatch(evilCookies, /oauth_redirect=https%3A%2F%2Fevil/, '外部跳转被拒绝')
}

console.log('worker login-flow tests passed')

// ---- 密码登录限频：失败计数 + 成功清空 + 锁定 ----
{
  const env = makeEnv()

  // 造一个账号行 + 合法密码哈希（PBKDF2 与实现同参数）
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret123'), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256)
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('')
  env.DB.users.set(1, {
    id: 1, provider: 'account', github_id: null,
    password_hash: saltHex + ':' + hashHex,
    player_id: 'pu1-abcdefgh', nickname: 'lockuser', avatar_url: null, avatar_id: null,
  })

  const tryLogin = async (password) => {
    return worker.fetch(new Request('https://auth.qmzhj.top/api/login-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'lockuser', password }),
    }), env)
  }

  // 5 次错密码：单次 401、计数 5
  for (let i = 0; i < 5; i++) {
    const res = await tryLogin('wrong-pass')
    assert.equal(res.status, 401, `第 ${i + 1} 次错密码 401`)
  }
  assert.equal(env.DB.loginAttempts.length, 5, '失败计数累计 5 条')

  // 中途正确登录成功：200 且清空计数
  const ok = await tryLogin('secret123')
  assert.equal(ok.status, 200, '正确密码可登录')
  assert.equal(env.DB.loginAttempts.length, 0, '成功后清空失败计数')

  // 连续 10 次失败后锁定（第 11 次连正确密码也 429）
  for (let i = 0; i < 10; i++) {
    const res = await tryLogin('wrong-pass')
    assert.equal(res.status, 401, `第 ${i + 1} 次错密码 401`)
  }
  const locked = await tryLogin('secret123')
  const lockedData = await locked.json()
  assert.equal(locked.status, 429, '锁定期内正确密码也被拒')
  assert.equal(lockedData.error, 'too many failed attempts, try later')
}

console.log('worker password-limit tests passed')
