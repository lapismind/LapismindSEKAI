const BASE = 'http://127.0.0.1:8787'
// 唯一用户名：避免多轮运行撞残留数据；结束后清理
const NAME = 'e2e_' + Date.now().toString(36)
let failures = 0
function check(name, cond, detail = '') {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (cond ? '' : ' :: ' + detail))
  if (!cond) failures++
}
let cookieJar = ''
async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  for (const c of setCookie) {
    if (!c.includes('Max-Age=0')) cookieJar = c.split(';')[0]
  }
  try { return await res.json() } catch { return await res.text() }
}

// 1. 游客登录，拿到游客 playerId
const guest = await req('POST', '/api/guest')
check('guest login', guest?.user?.provider === 'guest' && !!guest?.user?.playerId, JSON.stringify(guest))
const guestPid = guest.user.playerId

// 2. 注册（带游客 cookie → 升级路径）
const reg = await req('POST', '/api/register', { name: NAME, password: 'secret123' })
check('register ok', reg?.ok === true && reg?.user?.provider === 'account', JSON.stringify(reg))
check('playerId preserved on upgrade', reg?.user?.playerId === guestPid, reg?.user?.playerId + ' vs ' + guestPid)

// 3. /api/me 认识账号身份
const me = await req('GET', '/api/me')
check('me returns account', me?.user?.provider === 'account' && me?.user?.nickname === NAME, JSON.stringify(me))
check('me keeps playerId', me?.user?.playerId === guestPid)

// 4. 发评论（账号用户应放行）
const comment = await req('POST', '/api/comments', { page_path: '/e2e-test/', content: 'account e2e test comment' })
check('account can comment', comment?.ok === true, JSON.stringify(comment))

// 5. 重名注册被拒
cookieJar = ''
await req('POST', '/api/guest')
const dup = await req('POST', '/api/register', { name: NAME, password: 'whatever1' })
check('duplicate name rejected', dup?.error === 'name taken', JSON.stringify(dup))

// 6. 密码登录：应复用同一 playerId
const login = await req('POST', '/api/login-password', { name: NAME, password: 'secret123' })
check('password login ok', login?.ok === true && login?.user?.provider === 'account', JSON.stringify(login))
check('login reuses playerId (career continuity)', login?.user?.playerId === guestPid, login?.user?.playerId + ' vs ' + guestPid)

// 7. 错密码被拒
const bad = await req('POST', '/api/login-password', { name: NAME, password: 'wrong!' })
check('wrong password rejected', bad?.error === 'wrong name or password', JSON.stringify(bad))

console.log(failures === 0 ? '\nALL E2E PASSED' : '\n' + failures + ' FAILURES')
process.exit(failures === 0 ? 0 : 1)
