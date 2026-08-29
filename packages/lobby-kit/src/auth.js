/**
 * 统一认证客户端 —— 纯逻辑工厂（fetch 注入可单测）。
 *
 * 用法：
 *   const auth = createAuthClient({ baseUrl: 'https://auth.qmzhj.top' })
 *   await auth.init()        // 页面加载时调一次：/api/me，未登录自动游客
 *   auth.getUser()           // { provider, nickname, avatarUrl, playerId } | null
 *   auth.loginWithGithub()   // 跳转 GitHub 授权
 *   auth.register(name, password)     // 用户名密码注册（游客会话下注册 = 升级，战绩保留）
 *   auth.loginWithPassword(name, password)
 *   auth.getAchievements()            // 当前玩家的成就展馆数据（全量目录 + 解锁标记）
 *   auth.isGuest()
 *
 * 会话在 HttpOnly cookie 里（domain=.qmzhj.top），跨子域自动携带；
 * 本模块只负责读身份和触发登录，不接触 token 本身。
 */

export function createAuthClient({
  baseUrl = typeof location !== 'undefined' && location.hostname.endsWith('qmzhj.top')
    ? 'https://auth.qmzhj.top'
    : 'http://localhost:8787',
  fetchImpl = globalThis.fetch,
} = {}) {
  let user = null
  let initPromise = null

  async function fetchMe() {
    const res = await fetchImpl(`${baseUrl}/api/me`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user ?? null
  }

  // 游客不落库：头像选择存在 localStorage，init 时回读到 user 上
  function readGuestAvatar() {
    try {
      if (typeof localStorage === 'undefined') return null
      const saved = localStorage.getItem('guestAvatarId')
      if (saved && /^\d+$/.test(saved) && Number(saved) >= 1 && Number(saved) <= 26) return saved
    } catch { /* localStorage 不可用时静默跳过 */ }
    return null
  }

  // 游客不落库：昵称同样存 localStorage，init 时回读到 user 上
  function readGuestNickname() {
    try {
      if (typeof localStorage === 'undefined') return null
      const saved = localStorage.getItem('guestNickname')
      if (saved && saved.trim()) return saved.trim().slice(0, 24)
    } catch { /* localStorage 不可用时静默跳过 */ }
    return null
  }
  async function guestLogin() {
    const res = await fetchImpl(`${baseUrl}/api/guest`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.user ?? null
  }

  function init() {
    // 幂等：并发调用共享同一次请求
    if (!initPromise) {
      initPromise = (async () => {
        try {
          user = await fetchMe()
          if (!user) user = await guestLogin()
          // 游客本地头像回读（不影响网络身份）
          if (user && user.provider === 'guest') {
            const saved = readGuestAvatar()
            if (saved) user.avatarId = saved
            const nick = readGuestNickname()
            if (nick) user.nickname = nick
          }
        } catch {
          user = null // 认证服务不可达时静默降级为未登录
        }
        return user
      })()
    }
    return initPromise
  }

  function getUser() {
    return user
  }

  function loginWithGithub(redirectTo) {
    const params = new URLSearchParams()
    // 传完整 URL：登录成功后 Worker 校验属于 *.qmzhj.top 才放行，避免相对路径拼错域名
    if (redirectTo && typeof location !== 'undefined') {
      params.set('redirect_to', new URL(redirectTo, location.origin).href)
    }
    const q = params.toString()
    const loginUrl = `${baseUrl}/login${q ? `?${q}` : ''}`
    if (typeof location !== 'undefined') {
      location.href = loginUrl
    }
    return loginUrl
  }

  async function logout() {
    try {
      await fetchImpl(`${baseUrl}/logout`, { method: 'POST', credentials: 'include' })
    } finally {
      user = null
    }
  }

  async function register(name, password) {
    const res = await fetchImpl(baseUrl + '/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'register failed' }
    user = data.user
    return { ok: true, user }
  }

  async function loginWithPassword(name, password) {
    const res = await fetchImpl(baseUrl + '/api/login-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'login failed' }
    user = data.user
    return { ok: true, user }
  }

  async function getAchievements() {
    const res = await fetchImpl(baseUrl + '/api/achievements', { credentials: 'include' })
    if (!res.ok) return { ok: false, error: 'achievements fetch failed' }
    const data = await res.json().catch(() => ({}))
    if (!Array.isArray(data.achievements)) return { ok: false, error: 'bad response' }
    return { ok: true, achievements: data.achievements, unlockedCount: data.unlockedCount, total: data.total }
  }

  function isGuest() {
    return user?.provider === 'guest'
  }

  /**
   * 设置自选头像。
   * - 登录用户（github / account）：POST /api/me/avatar 落库，返回最新 user。
   * - 游客：无落库，存 localStorage 并直接更新本地 user，返回 { ok, local: true }。
   * avatarId 为 '0' 或空串表示清除、回到默认头像。
   */
  async function setAvatar(avatarId) {
    const raw = String(avatarId ?? '')
    if (!/^\d+$/.test(raw) || Number(raw) > 26) return { ok: false, error: 'invalid avatar' }

    if (user?.provider === 'guest') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('guestAvatarId', raw)
      } catch { /* 忽略 localStorage 不可用 */ }
      if (user) user.avatarId = raw
      return { ok: true, local: true, user }
    }

    const res = await fetchImpl(baseUrl + '/api/me/avatar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ avatarId: raw }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'set avatar failed' }
    user = data.user
    return { ok: true, user }
  }

  /**
   * 修改展示昵称。
   * - 登录用户（github / account）：POST /api/me/nickname 落库（display_name）。
   * - 游客：无落库，存 localStorage 并直接更新本地 user。
   */
  async function setNickname(nickname) {
    const raw = String(nickname ?? '').trim().slice(0, 24)
    if (!raw) return { ok: false, error: 'invalid nickname' }

    if (user?.provider === 'guest') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('guestNickname', raw)
      } catch { /* 忽略 localStorage 不可用 */ }
      if (user) user.nickname = raw
      return { ok: true, local: true, user }
    }

    const res = await fetchImpl(baseUrl + '/api/me/nickname', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nickname: raw }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'set nickname failed' }
    user = data.user
    return { ok: true, user }
  }
  return { init, getUser, loginWithGithub, register, loginWithPassword, getAchievements, setNickname, setAvatar, logout, isGuest }
}
