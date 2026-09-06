import assert from 'node:assert/strict'
import worker from '../src/index.js'
import { ACHIEVEMENT_DEFS } from '../src/achievements.js'
import { C1_ACTIVE_ACHIEVEMENT_RESPONSE } from './fixtures/c1-achievement-response.mjs'

// ---- 假 D1：只覆盖 worker 用到的 SQL 形状 ----
function makeFakeDB() {
  const users = new Map() // id -> row
  const comments = []
  const achievements = [] // { player_id, achievement_key, unlocked_at }
  const matches = [] // { id, report_status }
  const matchPlayers = [] // persisted row shape used by career tests
  const loginAttempts = [] // { key, created_at }
  let nextUserId = 1
  let nextCommentId = 1
  return {
    users,
    comments,
    achievements,
    matches,
    matchPlayers,
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
          if (sql.startsWith('SELECT nickname, avatar_id')) {
            const u = users.get(api.args[0])
            return u ? { ...u } : null
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
          if (sql.includes('COUNT(*)') && !sql.includes('match_players')) {
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
            const playerId = api.args[0]
            const completeIds = new Set(matches.filter((match) => match.report_status === 'complete').map((match) => match.id))
            const rows = matchPlayers.filter((row) => row.player_id === playerId && completeIds.has(row.match_id))
            return {
              matchesCompleted: rows.length,
              championships: rows.reduce((sum, row) => sum + (row.is_champion || 0), 0),
              roundWins: rows.reduce((sum, row) => sum + (row.round_wins || 0), 0),
              totalCasts: rows.reduce((sum, row) => sum + Object.values(JSON.parse(row.spells_cast || '{}')).reduce((a, b) => a + b, 0), 0),
              kills: rows.reduce((sum, row) => sum + (row.kills || 0), 0),
              dragonKills: rows.reduce((sum, row) => sum + (row.dragon_kills || 0), 0),
              deaths: rows.reduce((sum, row) => sum + (row.deaths || 0), 0),
              suicides: rows.reduce((sum, row) => sum + (row.suicides || 0), 0),
              maxTurnCastCount: rows.reduce((max, row) => Math.max(max, row.max_turn_cast_count || 0), 0),
              killRoundWins: rows.reduce((sum, row) => sum + (JSON.parse(row.round_wins_by_reason || '{}').kill || 0), 0),
              allSpellsRoundWins: rows.reduce((sum, row) => sum + (JSON.parse(row.round_wins_by_reason || '{}').all_spells || 0), 0),
              totalKills: rows.reduce((sum, row) => sum + (row.kills || 0), 0),
              totalWins: rows.reduce((sum, row) => sum + (row.is_champion || 0), 0),
              dragonFails: rows.reduce((sum, row) => sum + (row.dragon_fails || 0), 0),
            }
          }
          throw new Error('fake db: unsupported first: ' + sql)
        },
        async run() {
          if (sql.includes('SET display_name')) {
            users.get(api.args[1]).display_name = api.args[0]
            return { meta: { changes: 1 } }
          }
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
          if (sql.includes('FROM achievements a LEFT JOIN matches')) {
            const pid = api.args[0]
            return {
              results: achievements
                .filter((r) => r.player_id === pid)
                .filter((r) => r.match_id == null || r.report_status !== 'pending')
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
                nickname: (users.get(c.user_id)?.display_name || users.get(c.user_id)?.nickname) ?? 'unknown',
                avatar_id: users.get(c.user_id)?.avatar_id ?? null,
                avatar_url: null,
              }))
            return { results: rows.slice(api.args[2], api.args[2] + api.args[1]) }
          }
          if (sql.includes('json_each')) {
            const playerId = api.args[0]
            const completeIds = new Set(matches.filter((match) => match.report_status === 'complete').map((match) => match.id))
            const counts = new Map()
            for (const row of matchPlayers.filter((item) => item.player_id === playerId && completeIds.has(item.match_id))) {
              for (const [spellId, count] of Object.entries(JSON.parse(row.spells_cast || '{}'))) {
                counts.set(spellId, (counts.get(spellId) || 0) + count)
              }
            }
            return { results: [...counts].map(([spellId, cnt]) => ({ spellId, cnt })) }
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
    MATCH_REPORT_SECRET: 'match-report-secret',
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

// ---- 成就展馆：active 全量、legacy 仅已解锁、hidden 通用遮罩；未登录 401 ----
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
  const activeDefs = ACHIEVEMENT_DEFS.filter((definition) => definition.status === 'active')
  assert.equal(emptyData.total, activeDefs.length, 'total 只统计本次返回的 active 目录')
  assert.equal(emptyData.total, 10, 'active 传奇总数稳定为 10')
  assert.equal(emptyData.unlockedCount, 0, '新游客零解锁')
  assert.equal(emptyData.legacyUnlockedCount, 0, '新游客零旧版纪念')
  assert.deepEqual(emptyData.career, {
    matchesCompleted: 0,
    championships: 0,
    roundWins: 0,
    totalCasts: 0,
    spellCounts: {},
    kills: 0,
    dragonKills: 0,
    deaths: 0,
    suicides: 0,
    favoriteSpellId: null,
    spellTypesUsed: 0,
    maxTurnCastCount: 0,
    roundWinsByReason: { kill: 0, all_spells: 0 },
  }, '空历史返回完整稳定的 career 默认值')
  assert.deepEqual(emptyData.achievements.map((achievement) => achievement.key).sort(), activeDefs.map((definition) => definition.key).sort())
  assert.ok(emptyData.achievements.every((a) => a.unlocked === false), '未解锁标记一致')
  assert.ok(emptyData.achievements.every((a) => a.status === 'active'), 'active 状态显式返回')
  assert.ok(emptyData.achievements.every((a) => a.difficulty === a.stars), 'stars 仅作为 difficulty 的等值过渡别名')
  assert.ok(emptyData.achievements.every((a) => !('legacy' in a)), 'active 不伪装成 legacy')
  assert.ok(emptyData.achievements.every((a) => !('target' in a) && !('progress' in a)), '传奇目录不暴露旧累计进度')

  // 旧版解锁仅在本人确实解锁且关联比赛 complete 时返回；pending 仍隔离。
  env.DB.achievements.push(
    { player_id: guestData.user.playerId, achievement_key: 'first_cast', unlocked_at: '2026-08-27 10:00:00' },
    { player_id: guestData.user.playerId, achievement_key: 'last_breath', unlocked_at: '2026-08-27 10:05:00', match_id: 1, report_status: 'complete' },
    { player_id: guestData.user.playerId, achievement_key: 'dragon_veteran', unlocked_at: '2026-08-27 10:10:00', match_id: 2, report_status: 'pending' },
    { player_id: guestData.user.playerId, achievement_key: 'magic_staircase', unlocked_at: '2026-08-27 10:11:00', match_id: 3, report_status: 'pending' },
    { player_id: guestData.user.playerId, achievement_key: 'stale_unknown', unlocked_at: '2026-08-27 10:12:00' },
  )
  const unlocked = await worker.fetch(
    new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }),
    env,
  )
  const unlockedData = await unlocked.json()
  assert.equal(unlockedData.total, 10, 'legacy 和未知行不改变 active 总数')
  assert.equal(unlockedData.unlockedCount, 1, '只统计已解锁 active 传奇')
  assert.equal(unlockedData.legacyUnlockedCount, 1, '单独统计已返回的已解锁 legacy')
  const byKey = Object.fromEntries(unlockedData.achievements.map((a) => [a.key, a]))
  assert.equal(byKey.first_cast.unlocked, true, 'first_cast 已解锁')
  assert.equal(byKey.first_cast.legacy, true, '旧解锁标记为 legacy')
  assert.equal(byKey.first_cast.status, 'legacy')
  assert.equal(byKey.first_cast.difficulty, byKey.first_cast.stars)
  assert.ok(!('target' in byKey.first_cast) && !('progress' in byKey.first_cast), 'legacy 不暴露未完成进度或目标')
  assert.equal(byKey.last_breath.unlocked, true, 'active 解锁正常返回')
  assert.equal(byKey.magic_staircase.unlocked, false, 'pending match 关联 active 成就保持锁定')
  assert.equal('dragon_veteran' in byKey, false, 'pending match 关联 legacy 成就保持不可见')
  assert.equal('stale_unknown' in byKey, false, '未知数据库 key 不进入目录投影')
  assert.equal(byKey.first_cast.unlockedAt, '2026-08-27 10:00:00', '带回解锁时间')

  const hiddenDefinition = { key: 'test_hidden', game: 'abracadawhat', name: '隐藏真名', desc: '隐藏真描述', difficulty: 4, status: 'hidden' }
  ACHIEVEMENT_DEFS.push(hiddenDefinition)
  try {
    const lockedHidden = await worker.fetch(
      new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }),
      env,
    ).then((response) => response.json())
    assert.equal(lockedHidden.total, 10, '未来 hidden 不计入 active 传奇总数')
    assert.equal(lockedHidden.unlockedCount, 1, '锁定 hidden 不计入 active 解锁数')
    assert.equal(lockedHidden.legacyUnlockedCount, 1)
    assert.deepEqual(lockedHidden.achievements.find((achievement) => achievement.key === 'test_hidden'), {
      key: 'test_hidden',
      status: 'hidden',
      unlocked: false,
      name: '？？？',
      desc: '？？？',
    })

    env.DB.achievements.push({ player_id: guestData.user.playerId, achievement_key: 'test_hidden', unlocked_at: '2026-08-27 10:15:00' })
    const revealedHidden = await worker.fetch(
      new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }),
      env,
    ).then((response) => response.json())
    assert.equal(revealedHidden.total, 10, '已解锁 hidden 仍不改变 active 传奇总数')
    assert.equal(revealedHidden.unlockedCount, 1, '已解锁 hidden 仍不计入 active 解锁数')
    assert.equal(revealedHidden.legacyUnlockedCount, 1)
    assert.deepEqual(revealedHidden.achievements.find((achievement) => achievement.key === 'test_hidden'), {
      key: 'test_hidden',
      game: 'abracadawhat',
      name: '隐藏真名',
      desc: '隐藏真描述',
      difficulty: 4,
      stars: 4,
      status: 'hidden',
      unlocked: true,
      unlockedAt: '2026-08-27 10:15:00',
    })
  } finally {
    ACHIEVEMENT_DEFS.pop()
  }
}

console.log('worker achievements tests passed')

// ---- 法师档案：只聚合完整比赛，兼容 v1 默认，并按较小 spellId 打破最爱魔法平局 ----
{
  const env = makeEnv()
  const guest = await worker.fetch(new Request('https://auth.qmzhj.top/api/guest', { method: 'POST' }), env)
  const guestData = await guest.json()
  const cookie = cookieOf(guest)
  const playerId = guestData.user.playerId

  env.DB.matches.push(
    { id: 1, report_status: 'complete' },
    { id: 2, report_status: 'complete' },
    { id: 3, report_status: 'complete' },
    { id: 4, report_status: 'pending' },
  )
  env.DB.matchPlayers.push(
    { match_id: 1, player_id: playerId, is_champion: 1, kills: 4, dragon_kills: 3, deaths: 1, suicides: 0, spells_cast: '{"1":2,"3":3}', round_wins: 2, round_wins_by_reason: '{"kill":1,"all_spells":1}', max_turn_cast_count: 4 },
    { match_id: 2, player_id: playerId, is_champion: 0, kills: 2, dragon_kills: 0, deaths: 2, suicides: 1, spells_cast: '{"1":2,"2":4}', round_wins: 1, round_wins_by_reason: '{"kill":1,"all_spells":0}', max_turn_cast_count: 3 },
    { match_id: 3, player_id: playerId, is_champion: 0, kills: 1, deaths: 1, suicides: 0, spells_cast: '{"3":1,"8":0}' },
    { match_id: 4, player_id: playerId, is_champion: 1, kills: 100, dragon_kills: 100, deaths: 100, suicides: 100, spells_cast: '{"8":100}', round_wins: 100, round_wins_by_reason: '{"kill":100,"all_spells":100}', max_turn_cast_count: 100 },
  )

  const response = await worker.fetch(new Request('https://auth.qmzhj.top/api/achievements', { headers: { cookie } }), env)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.deepEqual(data.career, {
    matchesCompleted: 3,
    championships: 1,
    roundWins: 3,
    totalCasts: 12,
    spellCounts: { 1: 4, 2: 4, 3: 4 },
    kills: 7,
    dragonKills: 3,
    deaths: 4,
    suicides: 1,
    favoriteSpellId: 1,
    spellTypesUsed: 3,
    maxTurnCastCount: 4,
    roundWinsByReason: { kill: 2, all_spells: 1 },
  })
  assert.equal(data.career.kills, 7, 'kills 已含 dragonKills，不得再次相加')
  assert.deepEqual(Object.keys(data.career).sort(), [
    'championships', 'deaths', 'dragonKills', 'favoriteSpellId', 'kills', 'matchesCompleted',
    'maxTurnCastCount', 'roundWins', 'roundWinsByReason', 'spellCounts', 'spellTypesUsed', 'suicides', 'totalCasts',
  ].sort(), 'career 只返回 C3 约定字段')
}

console.log('worker career profile tests passed')

// ---- v1 postMatch 新解锁使用与 GET 相同的外部成就投影，供 B5 直接渲染 stars ----
{
  const env = makeEnv()
  const achievementInserts = []
  env.DB = {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { statement.args = args; return statement },
        async run() {
          if (sql.startsWith('INSERT INTO matches')) return { meta: { last_row_id: 1, changes: 1 } }
          if (sql.startsWith('INSERT INTO match_players')) return { meta: { changes: 1 } }
          if (sql.startsWith('INSERT OR IGNORE INTO achievements')) {
            achievementInserts.push([...statement.args])
            return { meta: { changes: 1 } }
          }
          throw new Error('achievement projection fake db: unsupported run: ' + sql)
        },
        async first() {
          if (sql.includes('SUM(') && sql.includes('match_players')) {
            return { totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0 }
          }
          throw new Error('achievement projection fake db: unsupported first: ' + sql)
        },
        async all() {
          if (sql.includes('json_each')) return { results: [] }
          throw new Error('achievement projection fake db: unsupported all: ' + sql)
        },
      }
      return statement
    },
  }

  const response = await worker.fetch(new Request('https://auth.qmzhj.top/api/matches', {
    method: 'POST',
    headers: { authorization: 'Bearer match-report-secret', 'content-type': 'application/json' },
    body: JSON.stringify({
      game: 'abracadawhat',
      roomId: 'R-C1',
      rounds: 1,
      players: [
        { playerId: 'p1', nickname: '一号', roundWonAtHp1: true, spellsCast: {} },
        { playerId: 'p2', nickname: '二号', spellsCast: {} },
      ],
    }),
  }), env)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(achievementInserts, [['p1', 'last_breath', 1]])
  assert.deepEqual(body.newAchievements, [C1_ACTIVE_ACHIEVEMENT_RESPONSE])
}

console.log('worker postMatch achievement projection tests passed')

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

// ---- 修改昵称：登录用户落库 display_name，游客 401，参数校验 ----
{
  const env = makeEnv()
  // 造一个账号用户（display_name 为空）
  env.DB.users.set(1, {
    id: 1, provider: 'account', github_id: null, password_hash: null,
    player_id: 'pu1-abc', nickname: 'alice', avatar_url: null, avatar_id: null, display_name: null,
  })
  const { createSessionToken } = await import('@lapismind/lobby-kit')
  const token = await createSessionToken({ playerId: 'pu1-abc', provider: 'account', userId: 1, nickname: 'alice' }, SECRET)
  const cookie = `session=${token}`

  // 游客 → 401
  const guestRes = await worker.fetch(new Request('https://auth.qmzhj.top/api/me/nickname', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: 'x' }),
  }), env)
  assert.equal(guestRes.status, 401, '游客不可改昵称')

  // 空 / 超长 → 400
  const bad = await worker.fetch(new Request('https://auth.qmzhj.top/api/me/nickname', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ nickname: '   ' }),
  }), env)
  assert.equal(bad.status, 400, '空昵称拒绝')
  const tooLong = await worker.fetch(new Request('https://auth.qmzhj.top/api/me/nickname', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ nickname: 'x'.repeat(25) }),
  }), env)
  assert.equal(tooLong.status, 400, '超长昵称拒绝')

  // 正常修改：display_name 落库，登录名不动
  const ok = await worker.fetch(new Request('https://auth.qmzhj.top/api/me/nickname', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ nickname: '爱丽丝' }),
  }), env)
  assert.equal(ok.status, 200)
  const okData = await ok.json()
  assert.equal(okData.user.displayName, '爱丽丝', '返回 displayName')
  assert.equal(okData.user.nickname, 'alice', '登录名不变')
  const me = await worker.fetch(new Request('https://auth.qmzhj.top/api/me', { headers: { cookie } }), env)
  const meData = await me.json()
  assert.equal(meData.user.displayName, '爱丽丝', '/api/me 带 displayName')
}

console.log('worker nickname tests passed')

// ---- 战绩上报：路由必须使用 2-5 人的 v1 清洗规则 ----
{
  const env = makeEnv()
  env.DB = {
    prepare(sql) {
      const statement = {
        bind() { return statement },
        async run() {
          if (sql.startsWith('INSERT INTO matches')) return { meta: { last_row_id: 1, changes: 1 } }
          if (sql.startsWith('INSERT INTO match_players')) return { meta: { changes: 1 } }
          if (sql.startsWith('INSERT OR IGNORE INTO achievements')) return { meta: { changes: 0 } }
          throw new Error('match report fake db: unsupported run: ' + sql)
        },
        async first() {
          if (sql.includes('SUM(') && sql.includes('match_players')) {
            return { totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0 }
          }
          throw new Error('match report fake db: unsupported first: ' + sql)
        },
        async all() {
          if (sql.includes('json_each')) return { results: [] }
          throw new Error('match report fake db: unsupported all: ' + sql)
        },
      }
      return statement
    },
  }
  const players = Array.from({ length: 6 }, (_, i) => ({
    playerId: `p${i + 1}`,
    nickname: `玩家${i + 1}`,
  }))
  const res = await worker.fetch(new Request('https://auth.qmzhj.top/api/matches', {
    method: 'POST',
    headers: {
      authorization: 'Bearer match-report-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ game: 'abracadawhat', roomId: 'R1', rounds: 1, players }),
  }), env)

  assert.equal(res.status, 400, '超过 5 名玩家必须由统一清洗器拒绝')
}

console.log('worker match-report tests passed')

// ---- v2 战绩重试：复用 matchId，玩家行和成就写入都只发生一次 ----
{
  const env = makeEnv()
  const matches = []
  const matchPlayers = []
  const achievementInserts = []
  let nextMatchId = 1
  env.DB = {
    matches,
    matchPlayers,
    achievementInserts,
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { statement.args = args; return statement },
        async first() {
          if (sql.includes('FROM matches WHERE report_id = ?')) {
            const row = matches.find((match) => match.report_id === statement.args[0])
            return row ? { id: row.id, report_hash: row.report_hash, report_status: row.report_status, expected_players: row.expected_players } : null
          }
          if (sql.includes('SUM(') && sql.includes('match_players')) {
            return { totalCasts: 0, totalKills: 0, totalWins: 0, dragonFails: 0, suicides: 0 }
          }
          throw new Error('v2 match report fake db: unsupported first: ' + sql)
        },
        async run() {
          if (sql.startsWith('INSERT OR IGNORE INTO matches')) {
            const [reportId, reportHash, game, roomId, rounds, expectedPlayers, finishedAt] = statement.args
            const existing = matches.find((match) => match.report_id === reportId)
            if (existing) return { meta: { changes: 0, last_row_id: 0 } }
            const row = { id: nextMatchId++, report_id: reportId, report_hash: reportHash, report_status: 'pending', expected_players: expectedPlayers, game, room_id: roomId, rounds, finished_at: finishedAt }
            matches.push(row)
            return { meta: { changes: 1, last_row_id: row.id } }
          }
          if (sql.startsWith('INSERT INTO match_players')) {
            const [matchId, playerId] = statement.args
            const existing = matchPlayers.findIndex((row) => row.match_id === matchId && row.player_id === playerId)
            const row = { match_id: matchId, player_id: playerId, args: [...statement.args] }
            if (existing >= 0) matchPlayers[existing] = row
            else matchPlayers.push(row)
            return { meta: { changes: 1 } }
          }
          if (sql.startsWith("UPDATE matches SET report_status = 'complete'")) {
            matches.find((match) => match.id === statement.args[0]).report_status = 'complete'
            return { meta: { changes: 1 } }
          }
          if (sql.startsWith('DELETE FROM match_players')) {
            const [matchId, ...expectedPlayerIds] = statement.args
            for (let index = matchPlayers.length - 1; index >= 0; index--) {
              const row = matchPlayers[index]
              if (row.match_id === matchId && !expectedPlayerIds.includes(row.player_id)) matchPlayers.splice(index, 1)
            }
            return { meta: { changes: 1 } }
          }
          if (sql.startsWith('INSERT OR IGNORE INTO achievements')) {
            achievementInserts.push([...statement.args])
            return { meta: { changes: 0 } }
          }
          throw new Error('v2 match report fake db: unsupported run: ' + sql)
        },
        async all() {
          if (sql.startsWith('SELECT player_id, nickname')) {
            return { results: matchPlayers.filter((row) => row.match_id === statement.args[0]).map((row) => ({
              player_id: row.args[1], nickname: row.args[2], score: row.args[3], is_champion: row.args[4],
              kills: row.args[5], deaths: row.args[6], spells_cast: row.args[7],
              secrets_taken: row.args[8], rounds_survived: row.args[9], dragon_fails: row.args[10], suicides: row.args[11],
              dragon_kills: row.args[12], round_wins: row.args[13], round_win_points: row.args[14],
              survival_points: row.args[15], secret_points: row.args[16], round_wins_by_reason: row.args[17],
              max_turn_cast_count: row.args[18], max_turn_distinct_spells: row.args[19],
            })).sort((a, b) => a.player_id.localeCompare(b.player_id)) }
          }
          if (sql.includes('json_each')) return { results: [] }
          throw new Error('v2 match report fake db: unsupported all: ' + sql)
        },
      }
      return statement
    },
    async batch(statements) {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      return results
    },
  }

  const payload = {
    schemaVersion: 2,
    reportId: 'abracadawhat:123e4567-e89b-42d3-a456-426614174000',
    game: 'abracadawhat',
    roomId: 'R2',
    startedAt: '2026-09-07T00:00:00.000Z',
    finishedAt: '2026-09-07T00:10:00.000Z',
    rounds: 2,
    standings: [
      { playerId: 'p1', nickname: '一号', rank: 1, score: 8, scoreBySource: { roundWinPoints: 6, survivalPoints: 1, secretPoints: 1 }, spellCounts: { 1: 1 }, kills: 1, dragonKills: 1, deaths: 0, suicides: 0, roundWins: 2, roundWinsByReason: { kill: 1, all_spells: 1 }, maxTurnCastCount: 2, maxTurnDistinctSpells: 2 },
      { playerId: 'p2', nickname: '二号', rank: 2, score: 2, scoreBySource: { roundWinPoints: 0, survivalPoints: 1, secretPoints: 1 }, spellCounts: {}, kills: 0, dragonKills: 0, deaths: 1, suicides: 0, roundWins: 0, roundWinsByReason: { kill: 0, all_spells: 0 }, maxTurnCastCount: 0, maxTurnDistinctSpells: 0 },
    ],
    facts: [],
    stories: [],
  }
  const post = () => worker.fetch(new Request('https://auth.qmzhj.top/api/matches', {
    method: 'POST',
    headers: { authorization: 'Bearer match-report-secret', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }), env)

  const first = await post()
  const firstBody = await first.json()
  const second = await post()
  const secondBody = await second.json()

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(secondBody.matchId, firstBody.matchId, '同一 reportId 必须返回同一内部 matchId')
  assert.equal(firstBody.reportId, payload.reportId)
  assert.equal(secondBody.reportId, payload.reportId)
  assert.deepEqual(firstBody.savedReports, [])
  assert.equal(matches.length, 1, '只创建一个 matches 行')
  assert.equal(matchPlayers.length, 2, '每名玩家只创建一个 career 行')
  assert.deepEqual(achievementInserts, [
    ['p1', 'different_paths', firstBody.matchId],
    ['p1', 'different_paths', firstBody.matchId],
  ], 'C2 只在 complete 后尝试 active 成就写入，重复上报由 INSERT OR IGNORE 去重')
}

console.log('worker v2 idempotency tests passed')

// ---- career 查询必须排除 pending v2 match，避免失败批次产生可见累计 ----
{
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/index.js', import.meta.url), 'utf8'))
  const careerQueries = [...source.matchAll(/FROM match_players mp[^`]+/g)].map((match) => match[0])
  assert.ok(careerQueries.length >= 3, '找到上报和资料页 career 查询')
  assert.ok(careerQueries.every((query) => query.includes("report_status = 'complete'")), '所有 career 查询只累计 complete match')
}

console.log('worker pending-career isolation tests passed')

// ---- achievements linked to pending matches stay hidden; null/legacy match ids remain visible ----
{
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/index.js', import.meta.url), 'utf8'))
  assert.match(source, /FROM achievements a LEFT JOIN matches m ON m\.id = a\.match_id/)
  assert.match(source, /a\.match_id IS NULL OR m\.report_status = 'complete'/)
}

console.log('worker pending-achievement isolation tests passed')
