# Lessons Learned

## 2026-08-29 统一登录接入三个游戏（apply_patch 踩坑）

- apply_patch 的路径参数用反斜杠（D:\\xxx\\yyy）会报 "Failed to read file"，一律用正斜杠 D:/xxx/yyy。
- exec 里用模板字符串包 patch 时，patch 内容里的反引号（\`\`\` 代码围栏）与 ${} 会被外层模板插值破坏，少用围栏、把 \` 写成 \\\` 或改用数组 join 拼 patch。
- apply_patch 的上下文行必须以空格开头才是"上下文"；如果该行本身以 - 开头（如 checklist 项），要写成 " - [ ] ..." 而不是 "- [ ] ..."（后者被判为删除行，报 Failed to find expected lines）。
- node --check src/worker/index.js 可快速验证 Worker 入口语法（ESM 需要 package.json type=module）。
- getSharedAuth 是页面级单例（模块内 sharedAuth 变量），在 Node 单测里跨测试块状态会串；测试用独立一次 init 计数断言（本次 auth.test.mjs 的共享实例测试放在最后，且全绿）。
- new Request(request, { url }) 改写 URL 只在 Cloudflare Workers 可用，undici/Node 会静默忽略（RequestInit 没有 url 字段）；改写身份要改用可移植的方式——DO 直接信 token 的身份，或把身份放请求头（new Request(request, { headers })）再读。
- 给 Worker 写单测时：/ws 转发用 stub.fetch 捕获转发请求即可断言；DO 升级路径要 shim Response（undici 不允许 101）和 WebSocketPair。

## 2026-08-29 线上部署统一登录（wrangler secret 实况）

- wrangler secret 值不可读：排查「游戏侧 SESSION_SECRET 是否与 auth 一致」用行为探测——auth 签发一个会话，拿去打游戏域名接口，能过就一致（showhand/abraca 看 /api/identity 返回的 playerId 是否=会话 playerId；turtle 看 /ws 是否 401）。
- 本地 .dev.vars 的值 ≠ 生产值：拿「生产签发的会话 token」用本地密钥验签（verifyIdentityToken），验不过说明本地文件不是生产值，不能直接抄去配置新 Worker。
- 生产状态别只信代码/文档：turtle 生产其实早配了 SESSION_SECRET（门禁已开），旧前端从不建游客会话 → 无会话访客线上直接 401 进不了房；部署新前端（自动游客签到）即修复。上线前先探测线上真实行为。
- 探测 /ws 门禁无副作用技巧：请求不带 Upgrade 头，401=拒（门禁开/值不符），404=放行（转给 DO 后因非升级返回 404，不产生房间状态）。
- 写 .dev.vars 用 [IO.File]::WriteAllLines(path, lines, UTF8Encoding($false))，避免 PowerShell Set-Content 默认编码（ANSI/带 BOM）破坏 wrangler 读取。
## 2026-08-29 Playwright 浏览器复现

- 本机只有 **Python 3.13 的 playwright**（无 node 版），命令一律 `python -m playwright ...`；复现脚本 `docs/agents/playwright-profile-repro.py`，用全新无 cookie 上下文 = 无痕。
- Playwright `response` 对象取 HTTP 方法要用 `r.request.method`，不是 `r.method`（后者 `AttributeError`，且异常发生在事件监听里会刷屏）。
- 页面脚本里 `try/catch` 吞掉的异常不进 Console / `pageerror`；诊断时在 catch 临时加 `console.error('[tag]', e)` 部署后复现，或用 `page.eval_on_selector` 读 `#profile-error.hidden` / `#profile-content.hidden` 判断渲染是否成功。
- wrangler custom domain 改完前端务必强刷（Ctrl+Shift+R）再验证。

## 2026-08-26 成就系统 E2E 测试

- auth `POST /api/matches` 只接受 `p` 开头的 playerId（真实玩家 ID 约定），测试机器人 ID 必须以 `p` 开头，否则被静默过滤且无任何成就，症状是上报 200 但零成就。
- wrangler dev 的 `.dev.vars` 是整体文件：新建或覆盖时必须保留原有条目（本次丢了 abraca 的 IDENTITY_SECRET 导致 /api/identity 500 且无堆栈日志）。
- DO 内 try/catch 吞掉的异常在 wrangler dev 日志里不显示；本地 D1（wrangler d1 execute --local）是排查上报链路最快的证据源。
- apply_patch 写含模板字符串的大文件容易被截断或解析失败，优先用普通字符串拼接。
- auth career 查询曾把本场刚写入的行也计入，判定函数再相加一次导致重复计数、累计成就提前一场触发；修复为查询排除当前 match_id，马拉松测试验证触发场次从第 6 场修正为第 9 场（恰好满 100 次）。
- apply_patch 新增文件的每一行内容必须带 `+` 前缀，漏写会报 invalid hunk header；含中文/模板字符串的长文件建议用行数组 join('\n') 构造补丁。
- SQLite ALTER TABLE RENAME 会把引用表的外键定义一起改指向旧表名，重建用户表后 comments 等引用表也必须重建，否则外键悬空导致 INSERT 500（no such table: xxx_legacy）。
- Cloudflare Workers 的 WebCrypto PBKDF2 迭代次数上限 100000，超过在本地 wrangler dev 正常、生产 deriveBits 直接抛异常；密码哈希参数务必查平台限制。

## 2026-08-27 成就展馆（资料页）

- 测试 fake 工厂的闭包陷阱：在工厂函数外部（测试块里）给返回对象挂的属性（如 fake.achievementsPayload），工厂内部的 fetch 闭包根本看不见，一访问就 ReferenceError；若该错误又被业务代码的 .catch(() => ({})) 吞掉，会伪装成"bad response"之类的业务错误，极难定位。做法：payload 用工厂内的闭包变量 + setter 暴露。
- Node 环境无 location 全局，lobby-kit loginWithGithub 不会拼 redirect_to；auth.test.mjs 里那条断言在本环境必然失败（属于原有测试的过时预期），已改为按 typeof location 分支断言。
- lobby-kit 的 src/auth.js 与 tests/ 目录不在 git 跟踪内（packages/.gitignore 忽略了 lobby-kit/），改动不会出现在 git status；交付/部署请留意该包是工作区直跑，换机器需连同目录一起复制。
