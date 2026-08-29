import assert from 'node:assert/strict'
import { createAuthClient, getSharedAuth } from '../src/auth.js'

// Fake fetch：模拟认证服务的三种状态
function makeFakeFetch() {
  const calls = []
  let mode = 'fresh' // fresh=未登录 | logged-in | unreachable
  let achievementsPayload = null
  return {
    calls,
    setMode(m) { mode = m },
    setAchievements(p) { achievementsPayload = p },
    async fetch(url, opts = {}) {
      calls.push({ url, opts })
      if (mode === 'unreachable') throw new Error('network down')
      if (url.endsWith('/api/achievements')) {
        return {
          ok: true,
          json: async () =>
            achievementsPayload || { achievements: [], unlockedCount: 0, total: 0 },
        }
      }
      if (url.endsWith('/api/me')) {
        return {
          ok: true,
          json: async () =>
            mode === 'logged-in'
              ? { user: { provider: 'github', nickname: 'octocat', avatarUrl: 'https://a/x.png', playerId: 'pu1abc' } }
              : { user: null },
        }
      }
      if (url.endsWith('/api/guest')) {
        return {
          ok: true,
          json: async () => ({ ok: true, user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId: 'pGuest1' } }),
        }
      }
      if (url.endsWith('/logout')) return { ok: true, json: async () => ({ ok: true }) }
      return { ok: false, json: async () => ({}) }
    },
  }
}

{
  const fake = makeFakeFetch()
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: fake.fetch })

  // 未登录 → 自动游客登录
  await auth.init()
  assert.equal(auth.getUser().provider, 'guest')
  assert.ok(auth.isGuest(), 'isGuest 为 true')
  assert.equal(fake.calls.length, 2, '先 /api/me 再 /api/guest')
  assert.equal(fake.calls[0].opts.credentials, 'include', '跨子域带 cookie')

  // 幂等：再次 init 不重复请求
  await auth.init()
  assert.equal(fake.calls.length, 2)
}

{
  // 已登录 GitHub 用户：不触发游客登录，昵称头像正确
  const fake = makeFakeFetch()
  fake.setMode('logged-in')
  const auth = createAuthClient({ fetchImpl: fake.fetch })
  await auth.init()
  assert.equal(auth.getUser().provider, 'github')
  assert.equal(auth.getUser().nickname, 'octocat')
  assert.equal(auth.isGuest(), false)
  assert.equal(fake.calls.length, 1, '已登录只调 /api/me')
}

{
  // 认证服务不可达：静默降级为 null，不抛异常
  const fake = makeFakeFetch()
  fake.setMode('unreachable')
  const auth = createAuthClient({ fetchImpl: fake.fetch })
  await auth.init()
  assert.equal(auth.getUser(), null)
  assert.equal(auth.isGuest(), false)
}

{
  // getAchievements：透传目录与解锁标记
  const fake = makeFakeFetch()
  fake.setAchievements({
    achievements: [
      { key: 'first_cast', name: '初试啼声', desc: '欢迎来到魔法学院，请系好安全带', stars: 1, unlocked: true, unlockedAt: '2026-08-27 10:00:00' },
      { key: 'dragon_veteran', name: '驭龙老炮', desc: '龙见了我都要喊一声师父', stars: 4, unlocked: false, unlockedAt: null },
    ],
    unlockedCount: 1,
    total: 31,
  })
  const auth = createAuthClient({ fetchImpl: fake.fetch })
  const res = await auth.getAchievements()
  assert.equal(res.ok, true)
  assert.equal(res.unlockedCount, 1)
  assert.equal(res.total, 31)
  assert.equal(res.achievements[0].unlocked, true, '已解锁成就带 unlocked=true')
  assert.equal(res.achievements[1].unlocked, false, '未解锁成就带 unlocked=false')
}

{
  // logout 后身份清空；loginWithGithub 拼接 redirect_to
  const fake = makeFakeFetch()
  const auth = createAuthClient({ fetchImpl: fake.fetch })
  await auth.init()
  await auth.logout()
  assert.equal(auth.getUser(), null)
  const url = auth.loginWithGithub('/blog/posts/hello/')
  // Node 环境无 location 全局，无法拼 redirect_to；浏览器里才会带上
  // （本环境 typeof location === 'undefined'，走无参分支）
  if (typeof location === 'undefined') {
    assert.equal(url, 'http://localhost:8787/login')
  } else {
    assert.match(url, /\/login\?redirect_to=/)
  }
}

{
  // setAvatar：登录用户 POST /api/me/avatar 落库，user.avatarId 更新
  const calls = []
  const fakeFetch = async (url, opts = {}) => {
    calls.push({ url, opts })
    if (url.endsWith('/api/me')) {
      return { ok: true, json: async () => ({ user: { provider: 'github', nickname: 'octocat', avatarUrl: 'https://a/x.png', playerId: 'pu1abc' } }) }
    }
    if (url.endsWith('/api/me/avatar')) {
      const body = JSON.parse(opts.body)
      return { ok: true, json: async () => ({ ok: true, user: { provider: 'github', nickname: 'octocat', avatarUrl: 'https://a/x.png', playerId: 'pu1abc', avatarId: body.avatarId } }) }
    }
    return { ok: false, json: async () => ({}) }
  }
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: fakeFetch })
  await auth.init()
  const res = await auth.setAvatar('7')
  assert.equal(res.ok, true)
  assert.equal(auth.getUser().avatarId, '7', 'setAvatar 后 user.avatarId 更新')
  assert.equal(calls.at(-1).opts.method, 'POST')
  assert.equal(JSON.parse(calls.at(-1).opts.body).avatarId, '7')

  // 非法 avatarId 直接拒绝，不发请求
  const res2 = await auth.setAvatar('999')
  assert.equal(res2.ok, false, '超出范围被拒绝')
}

{
  // getIdentity：登录用户返回服务端 playerId + 昵称；游客回读本地头像昵称
  const fake = makeFakeFetch()
  fake.setMode('logged-in')
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: fake.fetch })
  await auth.init()
  const id = auth.getIdentity()
  assert.equal(id.playerId, 'pu1abc', '登录用户用服务端稳定 playerId')
  assert.equal(id.nickname, 'octocat')
  assert.equal(id.avatarId, '0', '未设置头像时缺省 0')
}

{
  // getIdentity：游客场景，localStorage 里的头像/昵称被带出
  const store = { guestAvatarId: '12', guestNickname: '章鱼哥' }
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  }
  const guestFetch = async (url) => {
    if (url.endsWith('/api/me')) return { ok: true, json: async () => ({ user: null }) }
    if (url.endsWith('/api/guest')) return { ok: true, json: async () => ({ ok: true, user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId: 'pGuest1' } }) }
    return { ok: false, json: async () => ({}) }
  }
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: guestFetch })
  await auth.init()
  const id = auth.getIdentity()
  assert.equal(id.playerId, 'pGuest1')
  assert.equal(id.nickname, '章鱼哥', '游客昵称回读 localStorage')
  assert.equal(id.avatarId, '12', '游客头像回读 localStorage')
  delete globalThis.localStorage
}

{
  // refresh：只调 /api/me 更新身份，登录态变更后可拿到最新 user
  const fake = makeFakeFetch()
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: fake.fetch })
  await auth.init()
  assert.equal(auth.getUser().provider, 'guest')
  fake.setMode('logged-in')
  const user = await auth.refresh()
  assert.equal(user.provider, 'github', 'refresh 后读到最新身份')
  assert.equal(auth.getUser().provider, 'github')
  assert.equal(fake.calls.filter((c) => c.url.endsWith('/api/me')).length, 2, 'refresh 只加一次 /api/me')
}

{
  // getSharedAuth：同一页面共用实例，重复调用不重复 init 请求
  const fake = makeFakeFetch()
  const a = getSharedAuth({ baseUrl: 'https://auth.test', fetchImpl: fake.fetch })
  const b = getSharedAuth({ baseUrl: 'https://auth.test', fetchImpl: fake.fetch })
  assert.equal(a, b, '共享实例为同一对象')
  await a.init()
  assert.equal(fake.calls.length, 2, '只有一次 /api/me + /api/guest')
}

{
  // setAvatar：游客用 localStorage 本地存储，不走网络
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  }
  const guestFetch = async (url) => {
    if (url.endsWith('/api/me')) return { ok: true, json: async () => ({ user: null }) }
    if (url.endsWith('/api/guest')) return { ok: true, json: async () => ({ ok: true, user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId: 'pGuest1' } }) }
    return { ok: false, json: async () => ({}) }
  }
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: guestFetch })
  await auth.init()
  const res = await auth.setAvatar('3')
  assert.equal(res.ok, true)
  assert.equal(res.local, true, '游客走本地存储分支')
  assert.equal(auth.getUser().avatarId, '3')
  assert.equal(store.guestAvatarId, '3', '写入 localStorage')
  // 下次 init 应回读
  const auth2 = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: guestFetch })
  await auth2.init()
  assert.equal(auth2.getUser().avatarId, '3', 'init 回读游客本地头像')
  delete globalThis.localStorage
}


{
  // setNickname：游客存 localStorage，本地立即生效；下次 init 回读
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
  }
  const guestFetch = async (url) => {
    if (url.endsWith('/api/me')) return { ok: true, json: async () => ({ user: null }) }
    if (url.endsWith('/api/guest')) return { ok: true, json: async () => ({ ok: true, user: { provider: 'guest', nickname: '游客', avatarUrl: null, playerId: 'pGuest1' } }) }
    return { ok: false, json: async () => ({}) }
  }
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: guestFetch })
  await auth.init()
  const res = await auth.setNickname('小游客')
  assert.equal(res.ok, true)
  assert.equal(res.local, true, '游客走本地存储分支')
  assert.equal(auth.getUser().nickname, '小游客', '本地昵称立即生效')
  assert.equal(store.guestNickname, '小游客', '写入 localStorage')
  const bad = await auth.setNickname('   ')
  assert.equal(bad.ok, false, '空昵称拒绝')
  assert.equal(auth.getUser().nickname, '小游客', '无效昵称不影响本地')
  const auth2 = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: guestFetch })
  await auth2.init()
  assert.equal(auth2.getUser().nickname, '小游客', 'init 回读游客本地昵称')
  delete globalThis.localStorage
}

{
  // setNickname：登录用户 POST /api/me/nickname，回读 displayName、登录名不动
  let nicknameBody = null
  const fakeFetch = async (url, opts = {}) => {
    if (url.endsWith('/api/me')) return { ok: true, json: async () => ({ user: { provider: 'github', nickname: 'octocat', avatarUrl: null, playerId: 'pu1abc' } }) }
    if (url.endsWith('/api/me/nickname')) {
      nicknameBody = JSON.parse(opts.body || '{}')
      return { ok: true, json: async () => ({ ok: true, user: { provider: 'github', nickname: 'octocat', displayName: nicknameBody.nickname, avatarUrl: null, playerId: 'pu1abc' } }) }
    }
    return { ok: false, json: async () => ({}) }
  }
  const auth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl: fakeFetch })
  await auth.init()
  const res = await auth.setNickname('Octo 喵')
  assert.equal(res.ok, true)
  assert.equal(nicknameBody.nickname, 'Octo 喵', 'POST body 携带昵称')
  assert.equal(auth.getUser().displayName, 'Octo 喵', '回读 displayName')
  assert.equal(auth.getUser().nickname, 'octocat', '登录名不变')
}

console.log('auth tests passed')
