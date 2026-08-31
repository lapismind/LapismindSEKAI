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
## 2026-08-31 出包魔法师 0831 真机反馈排查（本地实证）

- "要看到出的牌必须先点开战绩" = PublicArea.vue 把已出牌展示区（每种魔法已用/总数）放在了 tableOpen 折叠块内（e76767e 引入），应移到"战绩"按钮下方、折叠区外常显。
- "猜药水猜对后会卡 / 点了药水下一个只能点药水 / 直接🐔"根因：药水(id8)成功 → lastCastLevel=8 → canCast(8,·) 只放行药水（规则上合理），但玩家看不到自己手牌，唯一亮着的"魔法药水"按钮在手里没药水时一点 = 判定猜错扣 1❤；复现脚本实测"1 张药水成功后再点 = 猜错扣血"，"2 张药水快速连点 = 第三次点击变成无谓失败"。客户端施法完全无防抖（CastPanel.clickSpell 直接 emit → wsClient.send），连点/延迟判定会多发 cast 造成自伤。
- "猜错后选项仍亮"：当前代码 CastPanel 有 lockedByFailure（:disabled），本地 Playwright 复现 4/4 全灰 + 结束回合可用 + 回合正常移交；线上 index.html 资源名与本地 dist 完全一致（index-Dicpb_ve.js，00:05 构建），属最新代码。玩家若仍看到亮点，先排查浏览器/边缘缓存（Ctrl+Shift+R 强刷，同 08-29 教训），再查身份切换导致 game.myPlayerId 与房间 playerId 不一致（castFailed[me] 取不到）。
- E2E 技巧：自己的手牌别人可见——用第二个浏览器上下文（对手视角）读本方玩家区的手牌 title 即可设计"必中"施法测试；div.rounded-xl.border 索引注意第 0 个是 PublicArea，玩家区从 1 开始。
## 2026-08-31 出包魔法师 0831 反馈修复落地（三处）

- 已出牌展示（每种魔法已用/总数）从 PublicArea 的 tableOpen 折叠块移到顶部常显，玩家不再需要点开"战绩"才能看到出的牌。
- 施法防抖/提交锁：gameStore.cast 增加 castLocked（发出即锁，cast_result 回来或 800ms 超时释放），CastPanel 按钮在锁期间禁用；store 内的同步守卫是真正的防连点护栏（组件的 props 守卫在同一 tick 内读旧值拦不住双发）。效果：单张药水快速连点只成功一次，不再出现第二次"猜错"自伤。
- 结束回合保障：gameStore 增加 declared 标记，宣告一次魔法后（不等服务端回包）结束回合按钮立即可用；turn_to 换人或开新轮、room_state 回合不在我身上时复位。服务端规则本就允许宣告后结束。
- Playwright 验证脚本：临时资源/verify-fixes.py（已出牌常显、单张牌连点不自伤、宣告后结束回合可用、猜错 4/4 变灰+结束回合+移交，pageerrors 为空）；结束回合按钮断言要用 get_by_role("button", name=...)，否则会被我新加的"本回合已猜错，只能点结束回合"提示文案命中两次报 strict mode。

## 2026-08-31 0831 反馈修复代码审阅（Standards/Spec 两轴 + 落地修复）

- 审阅工具链：code-review skill 并行双轴（Standards=规范+坏味道基线 / Spec=需求还原），结论与自读 diff 交叉验证；写文件工具不可用时就改用 multi_agent spawn 并行子代理复现同一审查。
- RoomView.vue 里有 UTF-8 BOM（EF BB BF，PowerShell 写入残留）：本地 Get-Content 读会吞掉 BOM 看不出，必须用 git show HEAD:<file> | Format-Hex 或 ReadAllBytes 验证 blob 原始字节才能在 diff 里发现。
- gameStore.cast 的 800ms 兜底 setTimeout 若不存句柄：cast_result 提前回来解锁后，旧 timer 会在下一次施法锁定期内误开锁——防抖定时器必须句柄化（新 cast/result/错误路径先 clearTimeout 再 set/unset）。
- castLocked/declared 除了 result 路径，还要在 turn_to 移交、room_state 离开 playing、RCV_ERROR（服务端拒绝）时复位；尤其 RCV_ERROR 不复位 declared 会导致"未宣告就点亮结束回合，按了又被服务端拒绝"。
- chatMessages 断开/换房间必须清空，且设上限（splice 截断），否则旧房间消息随 re-hydrate 泄漏进新房间、长会话内存无界增长。
- Vue setup 里从 pinia store 直接解构（const { x } = useStore()）会丢响应性，必须 storeToRefs；chat-kit ChatPanel 曾因此收不到新消息。
- 跨包协议信封一次定死：表情消息字段是 {folder, emojiId}，写过一次 characterId 就会在 URL 拼接处出现 /stamp0530/undefined.png 这类错位；改协议字段的两个消费方必须一起改（Shotgun）。
- 一次性 patch 脚本（_patch-emoji-close.mjs）含机器绝对路径且目标结构已变：要么当天删，要么留着就会被 git 跟踪进"remove temp files"之外，变成劣化源。Scripts 目录只保留可再生成的工具。
- apply_patch 内容若包含正则转义（/ 等），用 String.raw 包补丁串，否则 JS 模板字符串会先吃掉反斜杠导致 Failed to find expected lines。
