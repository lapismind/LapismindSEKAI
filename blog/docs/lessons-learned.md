# blog 错误记忆

> 供本项目复用。跨项目通用教训同步到外部通用错误记忆库（Agent 配置目录下的 `docs/通用错误记忆库.md`，不在本仓库内）（Q、R 类别）。

## 2026-08-14

### 1. npm 命令没带 workdir，包装错到用户目录
- 现象：`npm install tailwindcss @tailwindcss/vite` 报成功，但 blog 的 package.json / node_modules 里都没有，包被装到了 `%USERPROFILE%\node_modules`，还在那里误建了 package.json。
- 根因：PowerShell 会话的默认 cwd 是用户目录，npm 命令没指定 workdir 时就在那里安装。
- 修复：删掉 `%USERPROFILE%\package.json` 和 `node_modules`，在 blog 目录内重装并三步验证（package.json 有、node_modules 有、build 过）。
- 教训：npm install 必须带 workdir，装完验证落盘位置，别信"up to date"。

### 2. `npx astro add tailwind` 只打印 diff 没实际装
- 现象：输出 "success" 和预期 diff，但 astro.config.mjs / package.json 实际没变。
- 教训：astro add 后必须验证文件真的被改，没改就手动 `npm install -D tailwindcss @tailwindcss/vite` + 手动加 vite 插件。

### 3. npm 11 allow-scripts 拦截 postinstall
- 现象：esbuild、workerd 的 postinstall 脚本被 npm 拦下（"not yet covered by allowScripts"）。
- 修复：`npm approve-scripts <pkg>` 后 `npm rebuild <pkg>`。
- 教训：装含原生二进制的包后，构建/本地运行前先确认 allowScripts 已放行。

### 4. assets-only Worker 不能配 binding
- 现象：`wrangler deploy --dry-run` 报 `Cannot use assets with a binding in an assets-only Worker`。
- 根因：纯静态站点（无 main/Worker 脚本）的 `[assets]` 不能带 `binding = "ASSETS"`。
- 修复：纯静态直接省略 binding 字段，`[assets]` 只留 directory + not_found_handling。
- 教训：先 dry-run 验证再正式部署。

## 2026-08-22

### 5. 找 pjsk.moe 的素材先走资产浏览器，别猜 URL / 抓包
- 现象：为拿歌曲音频与曲绘，走了"抓页面请求 + 猜命名规律 + 批量探测 URL"的弯路（如 `vs_/se_` 前缀、`0062_01` 裸路径都是探测出来的）。
- 正解：pjsk.moe 自带"资产浏览器" Asset Viewer——`/asset-viewer/?server=jp` 等，按目录浏览 + 文件名搜索，直接给出真实资源路径。
- 元数据与歌词接口：`metadata.exmeaning.com/cn/master/*.json`、`translation.exmeaning.com/files/translation/lyrics/music_<id>.json`。
- 教训：先查官方/站方提供的浏览入口，再考虑逆向；拿到路径后再下载并自托管，示例见 `docs/site-features.md` 第 5 节。

### 6. Astro 模块脚本内不能用 frontmatter 数据，需经 JSON script 标签传递
- 现象：播放器初始化静默失败（DOM 渲染正常、JS 不生效），因为 `<script>`（打包模块）拿不到 frontmatter 里的 songs。
- 修复：`<script type="application/json" set:html={JSON.stringify(songs)}>` 注入 DOM，脚本内 `JSON.parse` 读取。
- 教训：Astro 组件脚本与 frontmatter 的数据传递必须显式做；动态创建的元素也收不到 scoped 样式——涉及动态 DOM 的组件样式用 `is:global`。

## 2026-08-22（入场动画专场）

### 7. 入口动画"把卡面摆到指定位置"——裁切窗方案有数学极限，画布锚定才是正解
- 现象：想让人脸精确落在斜切分屏的指定位置（脸小 + 位置偏），连续多轮"调背景偏移/裁切窗"都不收敛。
- 根因：卡面是竖构图、脸在画面中段；要让"脸落到分屏边缘"需要巨大的平移余量，而裁切窗口宽度受原图限制——脸大与位置偏两者互斥，背景 position 可平移范围又只有 ±(A/R-1) 屏宽。
- 正解：**画布锚定法**——按目标脸高把整张卡等比缩放，脸心精确锚定在目标坐标，贴到同比例暗色画布上，溢出由暗底接管；`background-position` 直接归零。位置由锚点数字决定，改一个数即可微调。
- 复用要点：锚点来源用**用户红圈标注 → 红色像素质心**（纯几何、零误差），不要用视觉模型读动漫脸部坐标（读数相互矛盾，本次 ox/deepseek/YuNet/肤色 四套各说各话）。

## 未解决

（无；已知问题清单见 docs/review-2026-08-29.md）

## 2026-08-29（质量审阅发现的实锤问题，待修）

来源：docs/review-2026-08-29.md，Playwright 实测复现。

### 8. MusicDock 在 SPA 切页后整体失效 + 播放被重置（一条根因） —— 已修复（bind 守卫改为元素 dataset；init 只首跑一次；audio.src 需解析成绝对 URL 再比较）
- 现象：首页→其他页→回首页后，播放器所有按钮点击无效（面板打不开）。
- 根因：bind() 用 window.__mdBound 做全局守卫，第二次及以后切页直接 return，监听器仍挂在已被移除的旧 DOM 元素上（src/components/MusicDock.astro:222）。
- 连带：每次 astro:page-load 都会 init() → setTrack(默认曲) + 重设 audio.src，切页即停歌回默认曲（"切页不断歌"名不副实）；播放中标题仍显示"（未播放）"（init 里强制加后缀，播放不更新）。
- 修法方向：bind 按元素实例守卫（如元素 dataset 标记），不要用全局布尔；init 只在模块初始化时跑一次，page-load 只重绑。

### 9. 中文歌词字幕实际不可用 —— 已修复（2026-08-29 下载 6 首歌翻译 JSON 到 public/music/lyrics/，全站自托管）
- /music/lyrics/music_*.json 目录只有 README，六首歌全部 404；前端有日文 LRC 降级所以不崩。
- 要么补数据文件，要么从 site-features.md 撤掉"中文对译"宣传。

### 10. 评论区头像与分页半成品 —— 已修复（auth 回传 avatar_id；CommentSection 支持本地头像与「加载更多」分页，样式并入 CSS 变量）
- listComments 不回传 avatar_id，账号用户自选头像不显示（auth/src/index.js:520）。
- 后端分页参数齐全但前端无翻页 UI，评论 >20 条无法查看。

### 11. auth 测试桩没跟上成就 v2 —— 已修复（fake DB 补 SUM/json_each 桩，npm test 四套全绿）
- npm test 红：fake DB 不支持 computeCareer 的 SUM 查询 → /api/achievements 500（auth/tests/worker.test.mjs:48）。
- 修法：测试桩补 SELECT SUM(...) FROM match_players / json_each 两条查询的形状。

### 12. 资料页 GitHub 主页链接用数字 githubId 拼 URL —— 已修复（改用 nickname 登录名）
- src/pages/profile.astro:456 生成 https://github.com/<数字>（死链）；应改用登录名（user.nickname）。

### 13. 新增：密码登录限频 + 测试门禁（2026-08-29）
- 密码登录失败计数：login_attempts 表（迁移 003），同一用户名 10 分钟最多 10 次失败，成功即清空。
- astro check 门禁：npm run check（tsconfig.check.json 排除 MusicDock/Live2dMascot 两个存量脚本组件），当前 0 errors。
- auth/.gitignore：忽略 .dev.vars / e2e-cookies.txt / 日志，运行产物不再入库。
- ESLint 门禁：eslint.config.js（flat）覆盖 .astro/.vue/.js，.ts 交给 astro check。排版类规则（vue/max-attributes-per-line 等）显式关闭，避免与手写风格冲突。
### 15. 登录入口收敛到独立 /login 页（2026-08-29 交互调整）
- 账号区块（GitHub 登录 / 注册 / 密码登录）从 /profile 移出，独立成 src/pages/login.astro；/profile 只保留身份/头像/成就。
- 所有「进入 SEKAI」入口（头像菜单、资料页游客按钮、评论区注册链接）统一路由到 /login，不再用 #account-forms 锚点。
- /login 已登录（GitHub/账号）访问会自动跳 /profile；注册/登录成功也回 /profile。
- 坑：eslint astro 检查会把「已登录自动跳转」的 .then 参数判为 implicit any，记得标注 (user: any)。
### 16. UI 文案规范：基础功能不做明文标识（2026-08-29）
- 反面案例：hy3 模型写头像切换时，入口按钮写「切头像」，弹窗卡片里又写「点击头像立即切换」——同一件事标注两遍，把用户当傻子。
- 规范：基础功能用直觉交互本身当提示——点头像弹选择器、点昵称直接进编辑，最多一个无文字图标（带 aria-label）；不加「点击这里」「点击头像即可」类重复文案。
- 错误提示、状态反馈这类信息性文案不在此列，该写还得写。
### 17. 修改昵称：展示名与登录名解耦（2026-08-29）
- users 表新增 display_name（迁移 004），/api/me/nickname 只改 display_name；nickname 仍是登录名（账号用户名 / GitHub login），改昵称不影响登录。
- 游客昵称存 localStorage（guestNickname），与头像同模式，不落库。
- 评论列表展示名 = display_name || nickname（listComments 已合并返回）。
- UI：/profile 点击昵称或铅笔图标（仅 aria-label）进入内联编辑，Enter/失焦保存、Esc 取消，不加提示文案（见 16 条规范）。

## 2026-09-15（动效落地 + 令牌源收敛）

### 18. 博客把整份 design-kit 令牌抄在 global.css，值"恰好相同"所以无人察觉
- 现象：`src/styles/global.css` 里有 60 个令牌的完整副本，与 `packages/design-kit/tokens.css` 逐值一致，但博客从未 `@import` 它。
- 危害：平时完全无感（值一样），直到有人改主色/阴影——改了 design-kit，博客纹丝不动，而且没人知道该同步；design-kit README 明文禁止这种写法。
- 修法：改为 `@import '@lapismind/design-kit/tokens.css'` + `base.css`，博客 global.css 只留 `--cursor-*` 和 `--accent*` 两个本站专有令牌。
- 顺带补齐：base.css 的 `.glass` 缺 `-webkit-backdrop-filter`（Safari 需要），补上后博客才能删掉自己那份。
- 验证方式见第 19 条（这是本次最有价值的一条）。

### 19. "换了令牌源"这类重构，用计算样式全量快照验收，别用整页截图
- 做法：Playwright 遍历每页所有元素，按 DOM 路径取样 40 个计算属性（颜色/字体/圆角/阴影/过渡/动画/尺寸…），导出 JSON，改前改后 `diff`。11 页 × 4000+ 元素，两轮基线跑出**零差异**，改后只列出预期内的 72 处。
- 为什么不用截图：整页像素比对会被**页脚每秒跳动的"本站已运行 N 秒"**污染（0.0x% 差异白白排查半天），而且同一次改动在两次截图之间还有 ~9px 的页脚抖动。截图适合看观感，不适合当"无回归"的判据。
- 副作用小抄：`#site-runtime` 是本站唯一的时间型不确定源，做任何像素级比对前先 mask 掉（或 mask 整个 `footer`）；Live2dMascot 是 WebGL，也要遮。

### 20. `.reveal` 原本没有无 JS 兜底——脚本一挂，整页内容永久不可见
- 现象：`.reveal { opacity: 0 }` 靠 JS 加 `.is-visible` 才可见；JS 报错/被拦截/换页漏绑时，内容不会报错，只是**看不见**，是静默失败里最难发现的一种。
- 修法：`<html>` 在 `<head>` 内联脚本里先打 `has-js`，CSS 只写 `html:not(.has-js) .reveal { opacity: 1 }`。没脚本 = 直接是最终态。
- 同类必须一起处理：`.reveal-stagger > *`、`img.img-fade`、`.section-title h2::after`，以及 `prefers-reduced-motion` 下同样要给最终态（否则"减少动效"退化成"滚到才有内容"）。

### 21. 给图片加淡入别用 transition——会被卡片图的 transform 过渡覆盖
- 现象：卡片图本来就有 `transition: transform .5s`（悬停放大）。再给 `img` 加 `transition: opacity`，两条 `transition` 声明互相覆盖，后写的赢，结果是"淡入没了"或"悬停放大变瞬跳"，且取决于 CSS 源码顺序，很隐蔽。
- 正解：淡入用 `animation`（只碰 opacity），`.is-loaded` 时挂 `animation: img-fade-in .7s forwards`。animation 优先级高于普通声明，和 transition 井水不犯河水。
- 注意：首屏最大的那张图（/blog/ 的头条图）不挂，等淡入会推后首屏观感；只给列表卡片图用。

### 22. 提动效方案前先读代码——"错峰显现"博客早就有了
- 现象：我准备好一套 `.reveal-stagger` + JS 编号的新机制，结果发现首页/列表页早已用 `style="--reveal-delay:${i * 90}ms"` 做了逐项错峰（90/80/70ms 三套数字各写各的）。
- 结论：错峰不用新做，只需把三处硬编码换成共享令牌 `--reveal-delay: calc(var(--stagger) * ${i})`，节奏收敛成一个数。
- 教训：**先读现状再提方案**。否则会同时犯两个错——重复造轮子，以及在报告里把"已有功能"说成"新增功能"。

## 2026-09-15（Live2D 首屏瘦身：无损 WebP + moc3 预压缩 + 缓存头）

背景：看板娘首屏实测 3465KB（纹理 2074 + moc3 1158 + JS 230）。要求"不压画质"，所以只做真无损的改动。

### 23. `.moc3` 完全没被压缩，因为它的 Content-Type 是空的
- 现象：`/live2d/mafuyu/model.moc3` 生产实测 1158KB 原样传，`content-encoding` 为空；同目录的 `.js` 都被压成了 zstd。
- 根因：**CF 的自动压缩按 Content-Type 判断**，`.moc3` 没有对应 MIME（实测响应里 content-type 确实缺失），CF 直接跳过。
- 本地实测压缩比：gzip 411KB(35%)、**brotli q11 306KB(26%)**。零画质损失。
- 修法：构建期预压缩成 `.br`，Worker 直接返回（见第 24/25 条的坑）。

### 24. Worker 返回已压缩的 body，必须显式 `encodeBody: 'manual'`——否则二次压缩
- 现象：浏览器 fetch `/live2d/mafuyu/model.moc3` 拿到 313374 字节，sha256 **正好等于 `.br` 文件本身** → 说明运行时把已压缩的 body 又压了一遍，客户端解一次拿到的是压缩包，模型直接加载失败。
- 根因：Worker 里 `new Response(body, {...})` 默认把 body 当作**未压缩数据**，会按 `Content-Encoding` 再编码一次。
- 修法：`encodeBody: 'manual'`（声明"body 已经编码好了"）。
- 两个连带坑：
  - `encodeBody: 'auto'` **会抛错**（`TypeError: encodeBody: unexpected value: auto`）。"不手动编码"的做法是**不设这个属性**，而不是设成 auto。
  - **fetch 响应的 headers 是只读的**，`res.headers.set(...)` 会 `TypeError: Can't modify immutable headers`（表现为 500）。想改头只能 `new Headers(res.headers)` 后重造 Response。
- 因此"只加一个缓存头"的正确写法是：拷头 + 按原响应是否带 `Content-Encoding` 决定要不要 `manual`：
  ```ts
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', LIVE2D_CACHE);
  const init: ResponseInit & { encodeBody?: 'manual' } = { status: res.status, headers };
  if (res.headers.has('Content-Encoding')) init.encodeBody = 'manual';
  return new Response(res.body, init);
  ```
- 验收方法：**别只看字节数**（二次压缩后大小几乎不变，看不出来）。用浏览器 `fetch` + `crypto.subtle.digest('SHA-256', buf)` 跟原始文件比 sha256——解出来必须逐位相同。

### 25. `wrangler dev` 会把进来的 `Accept-Encoding` 改写成 "br, gzip"，本地测不出协商分支
- 现象：curl 明确带 `Accept-Encoding: identity`，Worker 里 `request.headers.get('Accept-Encoding')` 读到的仍是 `"br, gzip"`；用日志确认了三次都是同一个值。
- 后果：基于 Accept-Encoding 的 br 协商**在本地无法验证负面路径**，写了也是自欺欺人。
- 结论：不做协商，永远返回 `.br`（现代浏览器全支持 br；不支持的由 CF 边缘自动解压）。

### 26. Workers 静态资产不会自动处理 `.br` 兄弟文件
- 查证：CF 有一个未关闭的 feature request（workers-sdk #11089）就是这件事，官方没有 `brotli_static` 之类的行为。所以要自己预压缩 + 自己在 Worker 里吐。
- 附带：`not_found_handling = "404-page"` 时，取不存在的文件会拿到**404 状态 + HTML**。判断"预压缩产物是否存在"必须严格判 `status === 200` 并排除 `text/html`，否则会把 404 页面当成压缩产物返回给客户端。

### 27. `_headers` 对 `run_worker_first` 的路径不生效
- CF 文档明确：`_headers` 定义的头**不会**应用到 Worker 代码生成的响应。
- 本项目 `run_worker_first = ["/live2d/*"]`，所以 `/live2d/*` 的缓存头必须在 `src/worker.ts` 里设；`/fonts /music /_astro /cursors` 走静态资产，才受 `public/_headers` 管。
- 顺带：全站默认是 `Cache-Control: public, max-age=0, must-revalidate`（含 `_astro/` 里带哈希的文件）。有 ETag 所以重复访问是 304、不重下，但每个资源每次都要往返校验一次。已按 `_headers` 给哈希资产设 `immutable`、其余 7 天，`/live2d/*` 在 Worker 里设 1 天（这些文件名不含哈希，不敢给 immutable）。

### 28. 纹理 PNG → WebP 无损：为什么用 `exact=True` 而不是默认
- 实测（2048×2048 RGBA 图集）：

  | 编码 | mafuyu | 与 PNG 的关系 |
  |---|---|---|
  | 原 PNG | 2074 KB | — |
  | WebP lossless 默认 | 757 KB | 可见像素逐位相同，**但 alpha=0 区域的 RGB 被清零** |
  | WebP lossless `exact=True` | 1217 KB | **任何像素都逐位相同** |

- 默认模式省得多（多 460KB），且经查差异**全部落在 alpha=0 的不可见像素**（可见像素 0 处不同、alpha 通道完全一致）。
- 但没选它：Live2D 的混合模式写在二进制 moc3 里，无法确认是否存在 multiply 这类"alpha=0 时 RGB 仍参与合成"的模式。`exact=True` 逐位相同，不需要这个前提——多花 460KB 买一个不用赌的保证，符合"不压画质"的字面要求。
- 改法：转文件 + 改 `model.model3.json` 里 `FileReferences.Texture` 的文件名（一处），运行时按 JSON 取图，浏览器解 WebP 无感。本地实测模型渲染正常。
- 验收：转完立刻用 numpy 逐位比对原 PNG 与解码后的 WebP；上线后再用浏览器截图确认模型不是空白。

