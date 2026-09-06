# Lessons Learned

## 2026-09-04 空补丁调用

- `apply_patch` 不能传空对象或缺少 `patchText`；即使只是准备进入下一步，也不要预调用编辑工具。调用前先形成实际 diff，再提交完整补丁。
- 补丁上下文中的相邻行顺序也必须与当前文件完全一致；长会话中不要凭记忆拼上下文，先读取目标片段再改。
- 同一文件有多个修改片段时，补丁块按源码出现顺序排列；跨多文件大补丁任一上下文失败会整体取消，优先拆成可独立验证的小批次。

## 2026-09-04 UI 审阅截图能力边界

- 浏览器能成功保存截图，不代表当前模型能读取图像内容；遇到图片输入不受支持时，不能声称完成了视觉看图审阅。保留截图供人工复核，并用 DOM 几何、计算样式、交互状态、焦点顺序和资源数据支撑可验证结论。

## 2026-09-04 PowerShell 内联浏览器探测

- `python -c` 内再嵌套 JavaScript 箭头函数和多层引号容易被 PowerShell 提前解析，报 `ParserError`。已有 Playwright 脚本时直接增加测试 case，避免把复杂探测压成一行。

## 2026-09-04 npm audit 镜像限制

- `registry.npmmirror.com` 当前对 npm audit 的 `/-/npm/v1/security/advisories/bulk` 返回 404 `NOT_IMPLEMENTED`；这只是审计服务不可用，不能解读为零漏洞。发布前用 `npm audit --registry https://registry.npmjs.org` 获取有效结果。
- 官方 registry 审计若长时间无输出并被工具超时终止，同样不能宣称审计通过；记录未完成状态。若本轮没有依赖变化，可继续其他验证，但交付时明确该缺口。

## 2026-09-06 Playwright 触控热区断言与 CSS 过渡

- `bounding_box()` 返回变换后的视觉几何。元素父级若正从 `scale(0.97)` 过渡到 `scale(1)`，源码中的 44px 会暂时测成约 42.7px，形成假失败。触控盒回归应先等待面板可见且 `transform: none`，再断言稳定状态尺寸；不要为了动画中间帧盲目放大源码尺寸。
- 多文件补丁中任一文件上下文不匹配会导致整体不应用。移动端目录块只有 `display` 和 `padding-top`，不能按记忆补出不存在的 `margin`/`border` 上下文；先读准确片段，再拆分补丁。
- Astro 组件脚本动态创建的 TOC `<a>` 不会带组件的 `data-astro-cid`，普通 scoped `.toc-nav a` 即使写进 CSS 也不会命中；动态子元素必须用 `.toc-nav :global(a)`。排查时要看浏览器计算样式或构建后的选择器，不能只看源码里“已经写了规则”。
- 生产页有 Live2D、音乐等持续资源活动时，Playwright `page.goto(..., wait_until='networkidle')` 会偶发 30 秒超时，即使页面 HTTP 200 且 DOM 已可用。UI 回归改用 `domcontentloaded`，再等待被测元素或状态；不要把“网络完全静默”当 UI 可测的前提。
- `locator.wait_for()` 同样受 Playwright strict mode 约束，就绪选择器可能命中多个元素时要明确 `.first` 或使用唯一选择器。动态折叠区不能只在点击后立刻测量，应先等待 `open` 状态和目标链接可见。
- Astro 的目录脚本监听 `astro:page-load`，生产资源延迟下可能晚于 `DOMContentLoaded`；目录链接由同一初始化函数生成，可把首个 `.toc-nav a` 已挂载作为“开关监听已接近就绪”的信号，再点击并等待 `.open`。
- Windows 当前终端环境不一定有可直接调用的 `rg`，即使项目搜索工具底层使用 ripgrep。提交前敏感信息扫描若命令报 `rg is not recognized`，要改用专用 Grep 工具检查目标文件，不能把失败命令当成零匹配。
- 批量路由回归的断言不能只附 `path` 或留空；焦点类偶发失败至少要带“路径 + 阶段”（初始焦点/激活后焦点），否则生产重跑只能看到空 `AssertionError`，无法判断失败边界。

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

## 2026-09-04 9.1/9.2 提交代码审阅

- `packages/chat-kit/package.json` 的 `npm test` 指向不存在的 `tests/chat.test.mjs`，当前无法验证 ChatPanel 的滚动、跨房间消息隔离和消息上限行为；审阅共享包改动时必须先确认测试入口文件真实存在，不能把脚本存在等同于有测试门禁。
- Node 直接导入 `abracadawhat/src/stores/gameStore.js` 会因源码使用无扩展名 ESM 导入而报 `ERR_MODULE_NOT_FOUND`；Store 测试也要先加载现有 `tests/helpers/workerLoader.mjs` 解析钩子。
- ESM 静态 import 会在模块执行前完成依赖链接，因此把 resolver hook 写在静态 import 上一行仍然来不及；先静态导入 hook，再用顶层 `await import()` 动态加载被测源码。
- `packages/chat-kit/package.json` 虽声明 `pinia`，但子包当前安装树里只有 Vue，新增 Store 测试会报 `Cannot find package 'pinia'`；运行子包测试前必须在该子包执行依赖安装并核对 lockfile。
- 独立代码复审子代理可能因 `stream disconnected before completion` 无结果退出；不能把“已调用代理”等同于“已完成复审”，需重开新会话并由主代理继续检查 diff。
- Tailwind 同一元素同时写 `relative fixed` 会生成互斥的 `position` 声明，最终位置取决于 CSS 生成顺序；浮动按钮本身使用 `fixed` 已能作为绝对定位子元素的包含块，不要再叠加 `relative`。定位修复需用 Playwright 同时断言桌面和手机视口的实际坐标。

## 2026-09-04 游客重新进入资料重置

- `lobbyStore.setNickname/setAvatar` 只改 Pinia 内存时，游客退出或刷新后认证客户端虽然会回读 `guestNickname/guestAvatarId`，但这两个键从未由大厅编辑器写入，最终只能恢复默认值；游客资料 setter 必须同步写 localStorage。
- Vue setup 中用 `ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })` 创建的是一次性初始快照；异步身份到达并更新 Store 后，还需在 `identity-change` 中同步表单草稿，否则输入框仍显示挂载时的默认资料。
- `ProfileEditor` 的“昵称”文字目前不是带 `for` 的真实 label，Playwright `get_by_label('昵称')` 会超时；现状下浏览器回归用 placeholder 定位。若后续做可访问性修复，应补 `for/id` 后再改回语义选择器。
- 游客资料 Playwright 用 Vite dev 跑到 WebSocket 代理失败后，服务进程可能提前退出，刷新时报 `net::ERR_CONNECTION_REFUSED`；已构建页面的纯前端持久化回归改用 `vite preview`，避免后端代理状态干扰测试结论。
- 改源码后直接跑 `vite preview` 会继续使用旧 `dist`，可能出现 localStorage 已是新值但页面仍按旧逻辑渲染的假失败；preview 回归前必须重新 `npm run build`。
- PowerShell 不能把 `$env:NAME='value'` 赋值语句直接放在原生命令的 `&&` 右侧，会报 `Unexpected token`；需要拆成两次工具调用，或放进 PowerShell 脚本块。
- 本地游客资料 E2E 的 `page.reload()` 会受房间 WebSocket/页面资源状态影响而等待超时；验证持久化更稳的方式是在同一 browser context 中关闭页面再新开首页，localStorage 保留且更贴近“退出后重新进入”。路由拦截要挂在 context 上，确保新页面继续生效。
- 本轮 `vite preview` 在 with_server 探活成功后仍出现 `ERR_EMPTY_RESPONSE`/进程提前退出，继续重试无法证明业务正确；本地由单元测试和构建兜底，最终同一 Playwright 路径改在部署后的稳定生产域验收，失败则回滚。
