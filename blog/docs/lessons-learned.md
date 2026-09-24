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

## 2026-09-19（Projects 板块 /works/）

### 29. 新造的类名撞上 `<style is:global>` 的同名类，scoped 隔离救不了
- 现象：`/works/runestaff/` 的「项目简介」区块塌成 39px，竖版主视图脱离文档流、与后续区块重叠。
- 根因：`IntroOverlay.astro` 的 `<style is:global>` 定义了全局 `.intro { position: fixed; inset: 0; ... }`。**该组件只在首页渲染，但 Astro 会把 is:global 样式打进全站共享 CSS，每个页面都生效**。页面里新写的 `.intro` 类名撞车：Astro 的 scoped 属性只让"我的选择器"更准，挡不住"全局同名选择器"也命中同一元素——两边规则合并生效，我没写 `position`，全局的 `position: fixed` 照单全收。
- 修复：页面本地类改名 `.rs-intro`（已全量排查其他新类名，仅此一个撞名）。
- 教训：**新建类名前先 grep 全局样式来源**：`src/styles/global.css`、`packages/design-kit/base.css`、所有 `<style is:global>` 块（`grep -rn "is:global" src/`）。本地类带页面/组件前缀（如 `rs-*`、`work-*`）最稳。

### 30. 验证脚本纪律第 4 条：站点开了 `scroll-behavior: smooth`，Playwright 的 scrollTo 全是动画
- 现象：验收脚本滚动触发 `.reveal`，底部区块始终 `opacity:0`；手动诊断（滚到底、停 1.5s）却能全过——两种滚法结果相反。
- 根因：`global.css` 给 html 设了 `scroll-behavior: smooth`，`window.scrollTo(0, y)` 变成平滑动画：50ms 一次的连续调用**互相打断**，最后一次 `scrollTo(0,0)` 把还没滚到底的动画直接拽回顶部，底部区块从未进过视口，IntersectionObserver 自然没触发。
- 修复：脚本一律 `window.scrollTo({ top: y, behavior: 'instant' })`；reveal 检查用 `wait_for_function` 轮询（`.is-visible` 有过渡动画，滚完立刻单次断言会误报）。顺带：图片懒加载会让 `scrollHeight` 增长，滚动步数要每步重读，且等全部图片 `complete` 后再滚一轮。
- 教训：在"三条纪律"（轮询到条件成立 / data-testid 定位 / 不用 networkidle）之上加第 4 条：**滚动触发型页面的验证脚本必须 instant 滚动**。脚本给出假 FAIL 和假 PASS 一样致命——这次假 FAIL 连着三轮把布局 bug 的发现往后拖。

## 2026-09-20（单推角色卡 · 水槽版式 / 独立预览页）

### 31. `@keyframes` 里的 `opacity` 优先级压过普通声明
- 现象：涟漪只在亮色出现，暗色本该 `opacity: 0` 却照样在闪。
- 根因：`oshi-ripple` 的关键帧里写了 `opacity: 0.7 → 0.35`。**动画在层叠里的优先级高于普通声明**，于是 `:root[data-theme='dark'] .oshi-ripple { opacity: 0 }` 被直接盖掉——选择器再具体也没用。
- 修复：关键帧**只动 `transform`**，`opacity` 留在普通声明里交给主题切换（要渐变就加 `transition`）。
- 教训：想让某个属性"由主题控制"时，**先确认没有动画在写它**。

### 32. 独立预览页必须对齐真源，否则它会"说谎"（漏三处排版基元，尺寸差 24%）
- 背景：给用户看的卡片预览页（`scripts/gen-oshi-preview.py`）内联了令牌与卡片 CSS，但**没内联站点的排版基元**。
- 现象：预览里卡片 500px 高、线上 654px，水线位置跟着错——差点让"看效果"变成看一个失真的东西。逐元素对比才发现，三处都在 `src/styles/global.css`：

  | 漏掉的东西 | 位置 | 后果 |
  |---|---|---|
  | `p { margin: 0 0 1.1em }` | 106 | 卡片矮 154px |
  | `body { font-size: 18px; line-height: 1.85 }` | 56 | 再矮 13%（浏览器默认是 16px/normal） |
  | 标题 `line-height: 1.25` | 80 | `.oshi-head` 高 11px |

- 另外**卡片结构不要手抄**：手抄的模板漏掉了后来加进卡片的 `.oshi-water`，于是"CSS 在、元素不在"，水层静默不渲染。改成从 `about.astro` 抽 `.oshi-card` 子树、只替换 `{oshiCard.xxx}` 表达式。
- 教训：**独立预览页要么内联全部相关真源（含排版基元），要么就别做**。验收不是"看着差不多"，而是**逐元素比高度对到相等**（本轮对到 card 654 / 水线 296 / 每个子块一致）。

### 33. 等距条带做的"水光"会读成百叶窗
- 现象：第一版波光用两条 `repeating-linear-gradient`（100° 与 74°，只差 26°、等距周期）叠加，暗色下看着像**竖条纹/栏杆**，不是水光。
- 原因：干涉要成立得有足够的**角度差与周期差**。只差 26° 的两条等距条纹近乎平行，叠出来还是条纹。
- 改成：角度拉开到 60°（96° 与 36°）、周期改成不等距的多档停靠点、模糊 15–24px，再加一层错开的径向柔光斑打散规律性；三层异速（46s / 71s / 88s）错拍。
- 教训：**"看起来像什么"靠角度/周期/模糊的散度，不靠调透明度**——透明度调低只会得到"很淡的栏杆"。

### 34. 用水浪替换直线：三个坑与一个验证手法
- 需求："在分界线上真的画出水浪"。做法是内联 SVG 画正弦波路径（每段一个 `C`，端点切线同向 → 首尾相接无接缝），
  元素宽 200%、viewBox 里放整数个周期，横移量 `100/(2×段数) %` 就正好是一个周期 → **无缝循环**。
- **坑一：幅度小了只是"一条波浪边"，不是水浪。** 第一版幅度 4px / 2.5px，看着像卡上画了条波浪线。
  加到 6px / 4px 才立住。判断标准是"离远看有没有起伏感"，不是"能不能看出是波"。
- **坑二：浪体的填充色只要比它下面的水更深，水面盒的底边就会切出一条直线。** 盒子一截断，填充色和底下水色的
  差就变成一条水平硬边。修法是给盒子加竖向 `mask-image` 渐隐（`50% → transparent 100%`），让浪化进水里；
  这比给 SVG 加 `linearGradient` 简单，而且不依赖主题色。
- **坑三：波形盒的"均值线"要对齐原来的水线位置。** 盒高 22、`viewBox` 高 20 → 浪的均值线在盒内 11px 处，
  所以盒顶要写成「目标水线 − 11px」，否则整条水面会偏上/偏下几个像素。
- **验证手法（可复用）**：声称"无缝循环"就必须验——**把元素平移正好一个周期，逐像素比两次渲染**。
  注意测试时必须**把其它还在动的图层藏掉**，否则差值来自别人在动（我第一次就栽在这，前层测出最大差 221，
  其实是后层在动）。两层都隔离后：最大差 2–5、超阈值像素 0。
- 顺带：`preserveAspectRatio="none"` + `vector-effect: non-scaling-stroke` 是波浪 SVG 的标配
  ——前者让波形横向任意拉伸、纵向不变形，后者让浪尖高光不被横向缩放拉成一根肥线。

### 35. 预览页的主题改写漏掉 `:not()`，把"亮色专用"规则漏进了暗色面板
- 现象：预览页暗色面板里，水下 k 标签的对比度量出 2.55:1（线上是 5.56:1）——看起来像 CSS bug。
- 根因：预览页把 `:root[data-theme='dark']` 改写成 `[data-theme='dark']`（让两个主题能同页各占一块面板），
  但漏了 `:root:not([data-theme='dark'])` 这种写法 —— `:root` 在预览页里永远没有 `data-theme`，
  于是那条"亮色专用"规则对**两个面板都命中**。
- 修复：改写函数同时处理两种形式（`theme_scope()`）。**修完必须在线上复核一遍**：这次线上量到 5.56:1，确认是预览的假象。
- 教训：**预览页的保真问题会伪装成 CSS bug。** 看到"线上好好的、预览里坏了"，先怀疑预览本身。

### 36. 负 z-index 的装饰层被父层自己的背景盖住，只漏出 4%——而我把这当成"含蓄的美"
- 现象：水族箱造景（SVG）与波光"看不见"；我量到"水层贡献 7.5% 像素、非零"，就判定它在工作、
  还给自己找了个理由（"含蓄、不抢文字"）。用户一句"只有 AI 能通过像素判断出来"戳破。
- 根因：装饰层放在 `.oshi-water { z-index: -1 }`，而它的父元素 `.oshi-below` 只有
  `position: relative` + `z-index: auto`，**不构成层叠上下文**。负 z-index 的子元素于是跑到最近的
  层叠上下文（卡片）里绘制，**位置在 `.oshi-below` 自己的背景之下** —— 那道 alpha 0.96 的水色渐变
  几乎全部盖住了它。
- 修复：给 `.oshi-below` 加 `z-index: 0`，让它自己成为层叠上下文（父层必须显式建立层叠上下文，
  负 z-index 的子层才会落在"父背景之上、父内容之下"）。同一张卡片的 `.oshi-card` 当初也踩过这条。
- 教训有两条，第二条更重要：
  1. **`z-index: -1` 的装饰层，父元素必须自己建立层叠上下文**（`z-index: 0` 或 `isolation: isolate`），
     否则它会被父层背景吃掉。
  2. **验收判据不能设成"有贡献"，那等于没判据。** 这次量到 7.5% 就放行了，而正确的问题是
     "人看不看得见"。给视觉结果设闸时，判据要落在"可感知"上（同尺度下与周围有明显的形/色差），
     不是"数值非零"。

### 37. 顺序反了：我拿现有卡片去**约束**出图，而图才是最高优先级
- 经过：为单推卡做配图时，我先做了一份"构图规格图"——用现有卡片的实测几何
  （卡 752×583、水线 282 = 48.4%、文字墨迹右界 x=570 = 75.8%）去规定图该画成什么样。
  用户："**图是最高级别优先，图出成什么样我们就怎么做。你应该先看看图怎么生成，根据结果划定文字范围 水域特效**"。
- 正解顺序是 **图出 → 量图（水线／安静区／轮廓）→ 排字**，不是 **版式 → 出图规格 → 出图**。
  我那份规格图和它的 `.oshi-figure` 槽位、自绘水浪造景一起作废（已进 `_legacy/`）。
- 教训：**当用户说某样东西是"最高优先级"，它就不能出现在任何约束的左边。** 测量本身没错，
  错的是方向——我量了卡片，但应该量图。
- 附带一条更硬的：量出来的数（x=570、水线 48.4%…）**只对量它的那张图有效**，换图当天全部作废。
  所以它们必须落成脚本（`blog/scripts/measure-oshi-art.py`）而不是写死在 CSS 注释里；
  现在卡片 CSS 里每个百分比都标着出处，并且写明"图一换必须重跑"。

### 38. 「这块能不能压字」要用相对亮度 + 局部标准差量，别用 sRGB 值、更别眼估
- 三条判据，缺一条都会得出反的结论：
  1. **WCAG 相对亮度**（gamma 解码后的），不是 sRGB 均值。同一个空气带，sRGB 均值是 0.35，
     相对亮度是 0.11——差三倍。做对比度判断只能用后者，否则会把"看着中灰"当成"够亮"。
  2. **局部标准差**判平整度。空气带 std 0.03（近乎纯色），水域 std 0.11——前者才能压字。
  3. **`|grad|` 的 p90 判细节密度，不能用平均**。第一版用平均，整张图大片平坦把阈值压到 0.0025，
     于是**所有**候选框都报"不能压字"，等于没量。
- 每个候选框同时算"白字对比度"和"深字对比度"，让数据自己选字色。这次量出：空气带两版图都是
  白字（7.3:1 / 15.8:1）；水里白天是亮水→深字 7.4:1、夜里是暗水→白字 9.9:1——**正好与
  `--ink` 随主题翻转同向**，所以那行签名句一行主题特判都不用写，只写了两条颜色。
- 结论区的形态：**空气带（y 6%–24%、x 4%–62%）是整张图唯一的安静区**，八项资料 + 身份三行全塞进去了；
  水区一块能压字的空地都没有，只够放一句签名。这是量出来的，不是设计出来的。

### 39. 天花板低的容器里排东西，先量元素实际盒高——`<p>` 带着全局下边距
- 现象：`.oshi-facts` 八项的底边落在水线（卡高 25.7%）以下 5px，最后一行的字贴在亮带上。
- 根因：`.oshi-fact` 里的 `<p class="k">` / `<p class="v">` 带着全局 `p` 下边距
  （实测 10.5px / 12.5px），每项被撑到 **33.5px**；归零后是 21px。
- 教训：**处在"可用高度只有卡高 20%"这种容器里时，按 `font-size × line-height` 估高会错一倍。**
  我估八项两行共 34px，实际 71px——因为估的是文字，实际排的是盒子。先量，再决定位置。

### 40. 卡片的字号要用 `cqw` + `clamp()` 两头都夹住
- `container-type: inline-size` + `font-size: clamp(A, Ncqw, B)`：
  纯 `rem` 不跟卡宽走（卡从 760px 缩到 320px 时字相对卡面变得过大）；
  纯 `cqw` 会在小卡上缩到不可读（1.5cqw 在 320px 卡上只有 4.8px）。
- 于是窄屏另有回落：宽屏 680px 以下，空气带只剩卡宽的 20% 装不下八项，
  整块资料移到图下面（`.oshi-body` 从 `absolute` 变 `static`），图上只留身份三行——
  这三行在任何宽度都装得进空气带。**这是量出来的断点，不是拍的**。

### 41. 一张图切亮暗主题，可以不重复下载：`display:none` + `loading="lazy"`
- 两张 `<Image>` 叠在同一位置，`:root[data-theme='dark']` 控制哪张 `display: block`；
  两张都带 `loading="lazy"`。
- 原理：浏览器对 `display:none` 的懒图不产生布局盒、进不了 IntersectionObserver，
  **一个字节都不下**。实测（`add_init_script` 写 `localStorage.theme` 模拟真实首帧）：
  亮色只下 `oshi-day`，暗色只下 `oshi-night`，各 68KB。
- **测法有坑**：如果先 `load` 再用 `setAttribute` 改 `data-theme`，两张都会被下载，
  于是得出"这个优化无效"的错误结论。站点是在首帧前由 `BaseHead.astro` 的内联脚本
  读 `localStorage` 设 `data-theme` 的，所以**验证必须用 `add_init_script` 把首帧状态摆对**。

### 42. 拿站上的"资料"当"表"去做"里"的对照，才发现**表本身是错的**
- 经过：给单推卡做「表と裏」——水面之上放官方资料栏的答案，水面之下放她自己给的答案。
  要做成"同一个标签、两个答案"的对照，就必须先确认水面之上那份真的是官方值。
  一查发现：`profile.ts` 里 `weak: '表达情绪'`，而官方资料栏原文是
  「**苦手なもの・こと：わからない**」（`pjsekai.sega.jp/character/unite05/mafuyu`，两次独立核对；
  萌娘百科信息栏作「不擅长的事情：不知道」，两源一致）。「表达情绪」是对她性格的概括，不是资料栏的值。
- 顺带查实的另一条：官方页里**没有「好きな食べ物」这一项**（「妈妈亲手做的菜」来自游戏内/萌百，不是资料栏）。
- 教训两条：
  1. **角色资料属于"事实型内容"，改之前必须回官方页核一遍。** 这类错误不会报错、不会掉构建，
     会安安静静地挂几年——这次能发现纯属要做对照才去查。
  2. **做"对照"型设计时，先验两边都是真的。** 我把"表"当成已知量直接拿来当基准，
     而它恰恰是没验过的那一边。对照结构会把基准的错误放大成"设计结论"。
- 落点：`profile.ts` 的 `weak` 改成 `'不知道'`，并把出处写进注释；新增 `oshiInner` 也逐条标了来源段落
  （萌百「轶事」「主线」）。**角色卡上的每一个字都要能指回出处**，否则半年后没人敢改。

### 43. 拿 `--font-mono` 排中文 = 静默掉进系统宋体（一张卡两套字体）
- 现象：单推卡上所有中文标签（生日/年龄/趣味/她自己写的）和单位行的日文假名，
  看着像宋体，和楷体的值凑成两套字体；单位行一行里甚至有三种字体。
- **定位手法（可复用）**：用 CDP 的 `CSS.getPlatformFontsForNode` 直接问浏览器
  "这个元素**实际**用了哪个字体、各渲染了几个字"。比看截图猜准得多——它连"一行混了几个字体"
  都能看出来。当时的读数：单位行 = `Cascadia Code×13 + NSimSun×21 + Microsoft YaHei×1`，
  标签 = `NSimSun×2`，值 = `LXGW WenKai Screen×14`。**一行三体，一眼定性。**
- 根因：`--font-mono` 是 `ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'Liberation Mono', monospace`
  —— **一个 CJK 字形都没有**。中文一路落到末尾的通用 `monospace`，而 Windows 的 monospace 就是新宋体。
  design-kit 的 README 本来就写着 mono 只给"筹码数、房间码、倒计时、任何要竖向对齐的数字"，
  **我拿它排中文标签是误用**，而它不会报错、不会掉构建，只是悄悄换成另一种字体。
- **顺带查出一个全站既有问题**：design-kit README 自己说"字体栈逐级兜底，字体没加载出来时
  也不能掉成衬线体"——但 `--font-mono` 结尾那个通用 `monospace` 在 Windows 上对 CJK 就是宋体，
  正好违反它自己这条。所以站内 `.eyebrow`（内容是 `oshi · 单推`、`worlds · 这个站的世界`）
  一直把中文渲染成新宋体。**这属于"已交付"，本轮没动，只报给用户。**
- 查掉一个**疑似**问题：值上的 `font-weight: 600` 是合成粗体（站点 webfont 只有 400 一档）。
  但站内 `h1`/`h2` 一直是 700，假粗是本站在用的做法，所以不是缺陷。**先查再改，别顺手"修好"一个不是错的东西。**

### 44. 「只在夜间显形」这类规则必须挂在 `.has-js` 下
- 做法：`.has-js .oshi-inner { opacity: 0 }` + `:root[data-theme='dark'] .oshi-inner { opacity: 1 }`。
- **为什么不能直接写 `.oshi-inner { opacity: 0 }`**：`data-theme` 是 `BaseHead.astro` 的内联脚本
  在首帧前设的，**没有 JS 时它永远不会被设上** → 暗色那条规则永不命中 → 这份内容对**所有**访客
  永久消失（包括亮色）。挂在 `.has-js` 下，无 JS 时 opacity 保持默认 1，内容还在。
- 站内入场动效早就在用这条规矩（`BaseHead.astro` 注释："入场动效的 opacity:0 只在有 JS 时才生效，
  脚本没跑起来时内容直接是最终态"），这里只是照抄。
- **连带结论**：因为无 JS 时会显白天那张图 + 这套字，所以"昼间深青字"那组颜色**不是死代码**，
  不能因为"白天看不见"就删掉——它是无 JS 分支唯一的配色。
- 验证这类"切主题才显形"的东西，**必须轮询到过渡结束再量**：那两块带 `--dur-slow` 的 opacity 过渡，
  固定 sleep 会在暗色下量到 0.98 这种中间值，看起来像断言坏了（本轮先栽了一次）。

### 45. 量"某个元素的动效"时，画在它上面的固定图层会混进来
- 现象：给单推卡做运动包络图，结果显示**空气带也在动**（0.03% 的像素）——可那里根本没有动画。
  差点去改一个不存在的 bug。
- 根因：`element.screenshot()` 截的是页面在该元素矩形内的**渲染结果**，所以画在它之上的
  `position: fixed` 图层会一起进来。本站 Footer 有一个全站雪花 canvas（`.snow-canvas`）正在跑。
- 定位手法（可复用）：**先用 reduced-motion 做对照**——本站雪花在 reduced-motion 下会关，
  对照跑出"全卡 0.00、逐像素为 0"，就证明没有渲染噪声、动的全部来自动画；再逐个
  `display:none` 藏图层做二分，一路藏到"藏掉整个水层空气带照样动"，才意识到根本不是卡的问题。
- 教训：**测量前先问"我的取景框里还有谁"。** 用 element.screenshot 量动效，先藏固定图层。

### 46. 驱动量要取"共同的结果"，不要枚举"来源"
- 做"滚动引起水面波动"时我第一版用 `window.scrollY` 做驱动。用户一句点破：
  **"拖拽 滚动都是一样的吧 都是这个卡片在用户的视角位置变了"**。
- 对缸里的水来说，滚轮 / 拖滚动条 / 键盘翻页 / 锚点跳转 / 惯性滚动 / 将来某个容器内部滚动
  —— 都只是同一件事：**卡片在用户眼里移动了**。枚举来源必然漏（而且每加一种交互就要改一次），
  只认 `getBoundingClientRect().top` 的逐帧差，什么来源都覆盖。
- 教训：**当一件事有多种触发来源时，去量那个共同的结果，别去枚举来源。**

### 47. 物理动画要按时间积分，不是按帧
- 弹簧第一版写成每帧 `v *= 0.965`，于是与帧率绑定：**120Hz 屏上同一段动画衰减快一倍**，
  效果随显示器变。
- 改成以 60fps 的 16.667ms 为 1 个单位：`dt=(now-last)/16.667`，`v += -k*x*dt`，
  `v *= damping**dt`，`x += v*dt`。
- 顺带一条反直觉的：**冲量那边不必换算** —— 一次滚动 D 像素的总冲量恒为 `D×增益`
  （Σd = D），本来就和帧率无关。只有弹簧的积分需要 dt。

### 48. `mix-blend-mode: screen` 在亮底上等于没画
- 水面波纹第一版用 `screen`（想让它读成"光"而不是"一条白线"）。但**图里水面本身就是亮的**，
  亮底上加白毫无变化 —— 波形几乎不可见，只有暗处看得见。
- 换成普通 alpha，亮底暗底两头都成立。
- 一般化：**screen / lighten 这类"加亮"混合只在暗底上有效**；要两头都成立，用普通 alpha
  或 overlay / soft-light。选混合模式前先量一下背景的亮度。

### 49. 验证"切主题/带过渡才显形"的东西，两个隐蔽陷阱
- **陷阱一：固定 sleep 会量到过渡中间值。** 断言"暗色下 opacity=1"时 sleep 450ms，
  量到 0.98，看起来像断言坏了。改用 `wait_for_function` 轮询到目标值再量。
- **陷阱二：手动设 CSS 变量去测 CSS 映射，会被 rAF 脚本每帧覆盖。** 我把 `--slosh` 设成 0、
  读回来却是 -0.152，反推矩阵才发现是 `scrollIntoView` 触发的冲量还在荡、脚本每帧都在写。
  隔离办法：**用 reduced-motion 让那段脚本整段不跑**，再手动设值 —— 这样测的才是 CSS 映射本身。

### 50. 「给我个 html 看看」这类交付物：**只做装配，别写第二份**
- 自包含预览页（双击就能开、脱网）的六处素材全部从真源抽：
  markup ← 构建产物的真实 DOM；卡片 CSS / 脚本 ← `about.astro` 源码；令牌 ← design-kit；
  字体 ← 站点那 97 个 woff2 子集里命中的 14 个；图片 ← dist 里的 760w（从 srcset 读，不猜文件名）。
- **"装配"比"复刻"多一层价值：它会逼你把真源的每个依赖都点名。** 这次抽的过程当场抓到三个真 bug：
  1. 真源脚本用 `document.querySelector`（单数）—— 一页有两张卡时，第二张永远不会有水面波动。
     这不是预览的问题，是脚本本身该支持多张。
  2. 卡片标记里那个给读屏用的 `.sr-only` 副本，线上靠**全局 CSS** 隐藏；预览只内联了
     tokens + 卡片 CSS，漏了它 → **签名句显示了两遍**，截图里一眼看到。
  3. 脚本里的 TS 语法（泛型、参数标注）构建时会被编译掉，**原样内联到预览就是语法错误、整段不跑**。
- 于是有三处写法为"能被原样内联"让了路，而且**本来就该这么写**：
  `querySelectorAll<HTMLElement>` → `instanceof HTMLElement` 收窄（TS 认、JS 也合法）；
  `(now: number) => {}` → 无参 `tick()` + `performance.now()`。

### 51. 比像素之前先对齐，否则你会追一个不存在的 bug
- 预览页 vs 线上逐像素比，暗色档差 **26.85%** 的像素，差异图全是边缘轮廓。
  我一路怀疑字体子集、怀疑图层、怀疑透明、怀疑图片文件不对 —— 全都不是。
  真因：**卡片在各自布局里纵向差 0.36px**（线上 y=119.828 / 预览 y=120.188），
  元素截图按整数取整后整体错开一行，于是每条边缘的反锯齿都不同。
- 判据：**扫一遍整数位移取最小值**。只留图片时对齐后差 **0.00**（逐像素一致）；
  全部打开时对齐后 3.25（残差来自散光/光柱那几层柔光渐变的亚像素相位）。
- 教训：**"差在边缘"几乎总意味着错位，不是内容不同。** 内容不同会差在块内，不会差在轮廓上。
- 连带一个自摆乌龙：我中途用"从 `class="oshi-shot-night"` 往后搜 `src=`"去验证内联的图对不对，
  结论是"夜图取错了、取成了白天那张"。**其实 `<img>` 里 `src` 排在 `class` 之前**，
  往后搜到的是**下一张图**的 src —— 是我的验证方法错了，不是生成器错了。
  **按字符串搜 HTML 要先确认属性顺序**，或者干脆解析标签。

### 52. 本地预览页要知道自己缺什么：`.has-js`、`.sr-only` 这类"环境约定"
- 站点的两个约定都靠别处提供，预览页没有它们就出错：
  · **`.has-js`** —— "水面之下只在夜里显形"挂在它下面，由 `BaseHead` 的内联脚本打上。
    预览页没有那段脚本，漏了它亮色卡里那两块就不会藏（实测：opacity 一直是 1）。
  · **`.sr-only`** —— 来自全局 CSS / Tailwind，预览没带，签名句显示两遍。
- 教训：**做独立预览时，先列出"线上是谁提供了这个前提"**，把前提一条条补上；
  能从不手抄的就从构建产物里捞（`.sr-only` 的真定义就是从 `dist/_astro/*.css` 里 grep 出来的）。

### 53. 无缝循环的横移，**svg 必须比容器宽出至少一个周期**
- 水线要横向慢慢漂移。做法是 svg 比容器宽、`translate` 正好一个周期（`100%/n`，n = 周期数），
  一个周期后图案接回原样。但**光有"位移 = 一个周期"还不够**：位移到位移末端时，
  svg 的左/右边缘会离开容器边界，容器两端就露出没有线的空档。
- 充要条件：`svg 宽度 − 容器宽度 ≥ 一个周期`，即 **`svg 宽度 ≥ 100% × n/(n−1)`**。
  n=5 → ≥125%；n=4 → ≥133%；n=7 → ≥117%。现在取 130% / 140% / 120%，各留一点余量。
- 验证手法：**把动画冻在 φ=0 / 0.5 / 0.999 三个相位，量 svg 相对容器的左右边界，必须始终包住 `[0, 容器宽]`**。
  这条断言当场抓出 w3 在 φ=0.999 时左边界跑到了 +2.3px（露空）。
  写成 `playwright-oshi-wave-probe.py`，三条一起验。

### 54. 在**会动的参照系**里量几何，会量出假故障
- 上面那条 w3 露空，**第一次量是假警报**。我拿 svg 相对 `.oshi-water` 量边界，
  而 `.oshi-water-inner` 会被 `--slosh` 整体横移 —— `scrollIntoView` 触发的弹簧还没停，
  于是量出来的左右边界都带了一个随机的横向偏移（φ=0 时本该是 0，量到 −8.1）。
- 修法：**改成相对水线元素自身量**（`sr.left - er.left`）。要验的不变量是"svg 盖不盖得住它自己的容器"，
  那就该以那个容器为原点 —— 参照系选对了，同一个故障就不会被别的动画污染。
- 教训：**量一个不变量之前，先问"这个参照系本身会不会动"。** 会动就换成不动的那一层做原点。

### 55. 百分比基准搞错，会让"我量过了"变成一句空话（水线放低 18% 的根因）
- 现象：用户两次说水线太低。我两次都"量过"，两次都说"已压在实测水位 30.3% 上"。
  实际那三条线停在**卡高 47–49%**，也就是水中央，离水位线差了 18%。
- 根因：`.oshi-wave` 是 `position: absolute`，它 `top: 27.5%` 的百分比基准是
  **`.oshi-water-inner`**（水域层，从卡高 25.76% 起、占 74.11%），**不是卡片**。
  换算过来 27.5% 的水域层坐标 = 卡高 46%。
  而我写的探针输出标签是 `中心(相对卡高)`，代码里除的却是 `wr.height`（水域层高）——
  **标签和算式不一致**，我把 30.2%（水域层）读成了"卡高的 30%"。
- 为什么没被发现：我用标尺裁片"复核"过，在 24–40% 的裁片里确实看到一条亮线在 30% 附近 ——
  但那是**图里画的水线**，不是我加的那条。**我把背景当成了自己的产物。**
- 修法与教训：
  1. **探针必须同时输出两个基准**（占卡高 / 占水域层），并写清哪个是哪个；
  2. 加了硬断言：三条的中心必须在实测水位线 ±3% 内，否则直接报错 —— 不再靠"打印出来看一眼"；
  3. 复核动效位置时**把目标染成醒目的颜色**（这次把三条 path 染成品红），
     和背景一次分清。这一条如果第一次就做，根本不会走弯路。

### 56. Astro 的作用域样式**管不到 JS 动态创建的元素**，要用 `:global()`
- 现象：点击冒泡写好了，气泡也确实被创建出来（`document.querySelectorAll('.oshi-pop').length` 是 8），
  但 `getComputedStyle` 量到 `position: static`、`height: 0` —— 气泡根本不成形。
- 根因：Astro 会把 `.astro` 里 `<style>` 的选择器改写成 `.oshi-pop[data-astro-cid-ta2fbyqs]`，
  并给**模板里**的元素打上那个属性。`document.createElement` 出来的元素拿不到它 →
  整条规则不匹配。查法很直接：`grep -o "\.oshi-pop[^}]*}" dist/_astro/*.css`，
  一眼看到选择器里挂着 `[data-astro-cid-…]`。
- 修法：那条规则写 `:global(.oshi-pop) { … }`。**注意自包含预览页**：`:global()` 是构建期语法，
  浏览器不认，所以预览生成器里要把 `:global(...)` 拆掉再内联（照抄构建产物的做法）。
- 教训：**"元素建出来了"不等于"样式生效了"。** 断言要落在 `getComputedStyle` 的关键属性上
  （这次是 `position`），不是节点数量 —— 我第一版只数了个数，8 颗，看着完全正常。

### 57. 同一份样式表里 `@keyframes` **重名不会报错，后定义的直接赢**
- 我给五条水线的呼吸写了个 `@keyframes oshi-breathe`，而水域那道水面高光**早就有**一个同名关键帧。
  结果后定义的那个赢，把水面高光的呼吸整道顶掉 —— 不报错、不报警，只是"有一处效果悄悄变了"。
- 修法：水线的改成 `oshi-wave-breathe`。**给关键帧起名一律带模块前缀**，
  就像 CSS 类名一样 —— 关键帧是全局命名空间，没有作用域。
- 查法：`grep -c "@keyframes <名字>" dist/_astro/*.css`，同一个名字出现两次就是重名。

### 58. 「写脚本的脚本」里，`r"\1"` 会被吃掉一层转义
- 我用一个 Python 脚本去改另一个 Python 脚本，往里写 `re.sub(..., r"\1", css)`。
  写进去的却是 `r"\x01"`（控制字符）—— 反斜杠被吃掉一层，`\1` 变成了八进制转义。
- 后果很隐蔽：替换串成了控制字符，**选择器被整条抹掉**，生成的 CSS 里 `.oshi-pop {` 变成 ` {`，
  规则静默失效。
- 修法：**别写 `r"\1"`，用 `lambda m: m.group(1)`** —— 没有转义就没有歧义。
- 一般化：**多层引号/转义嵌套时，优先用函数式替换、参数化拼接**，
  而不是往字符串里塞反斜杠序列。这一轮我已经在 bash 引号上栽过三次了。

### 59. 跨设备接力时，先确认临时预览目录是否存在

- 本轮按 `CURRENT.md` 去找 `docs/agent/scripts/out/oshi-card/` 截图，`rg` 因目录不存在退出 1；
  随后把并不存在的 `docs/agent/scripts/.gitignore` 也传给 `rg`，再次退出 1。
- `docs/agent/scripts/out/` 在仓库根 `.gitignore` 中，预览截图不会随 Git 跨设备同步。
  接手时先检查路径是否存在；没有就看已提交的原图与页面源码，需要截图时再按脚本生成。
- 搜索多个候选路径前，先确认每个路径存在，避免把路径缺失误读成搜索内容不存在。

### 60. 本机没有全局图片编码命令时，先查项目现成依赖

- 为接入单推卡新图检查 `magick`、`cwebp`、`ffmpeg`，这些命令均不在当前 PATH，批量 `Get-Command` 返回 1。
- `blog/node_modules/sharp` 已安装，可直接用于 PNG → WebP 编码；生成前先查本项目依赖，避免假定全局图像工具可用。

### 61. 旧截图脚本没有 `--help`，且依赖未同步的临时预览页

- 对 `playwright-oshi-preview-check.py` 试运行 `--help` 时，脚本忽略该参数并访问 `docs/agent/scripts/out/oshi-preview/index.html`，因文件不存在报 `ERR_FILE_NOT_FOUND`；已终止该进程。
- 旧脚本是给上轮临时自包含预览页用的。本轮应针对构建产物启动本地服务，另写短脚本截取当前 `/about/` 卡片，避免依赖不会跨设备同步的 `out/` 文件。

### 62. 页面有持续请求时，截图脚本不应把 `networkidle` 当作就绪条件

- 新截图脚本首张卡片已截到，第二次 `page.goto(..., wait_until="networkidle")` 等待 30 秒后超时。
- 改为等待页面 `domcontentloaded`，随后滚动到卡片并显式等待当前主题图片 `complete && naturalWidth > 0`，再截卡片。

### 63. PowerShell 下不要把 `*.css` 直接传给 `rg` 当路径

- `rg -l "oshi-waterline" blog/dist/_astro/*.css` 在本机返回路径语法错误；改用 `rg -l -g '*.css' "oshi-waterline" blog/dist/_astro`。
- 顺着编译产物定位到一处多余的 `}`：它使 `.oshi-waterline` 基础样式整条被丢弃，元素尺寸为 0。已删去多余括号，并在角色名字上显式继承白色以避免全局 `h3` 色覆盖。

### 64. 本地截图循环尽量复用一个页面

- `with_server.py` 连续启动短命静态服务后留有 `http.server` 子进程，再次占用相同端口时浏览器收到 `ERR_EMPTY_RESPONSE`；确认命令行后停止了本轮残留进程。
- 单页静态站里第二次 `goto` 还遇到 30 秒超时。截图脚本改为仅导航一次，后续切换 `data-theme` 和视口宽度，在同一页抓取六种组合；换未占用端口后六张图均生成成功。

### 65. 查设计令牌前先核对包目录结构

- 为研究单推卡字体时把不存在的 `packages/design-kit/src` 传给 `rg`，命令返回 1。
- 本仓库的令牌直接在 `packages/design-kit/tokens.css`，字体文件在 `packages/design-kit/fonts/`；下次先用 `rg --files packages/design-kit` 核对路径。

### 66. 在子目录执行素材复制前先统一路径基准

- 本轮在 `blog/` 作为工作目录运行素材复制，却把源和目标都写成仓库根目录相对路径，导致复制失败，后续 Sharp 也找不到输入文件。
- 素材路径应统一使用解析后的绝对路径，或在同一工作目录下使用正确的相对路径；复制成功后再编码，避免级联报错。

### 67. 在重复结构的页面里补元素时用唯一上下文定位

- 本轮用通用的 `</div></section>` 补 `<noscript>`，补丁命中了页面靠前的玩家资料卡，而非目标单推卡。
- 修改多段相同结构的 Astro 页面时，补丁上下文应包含目标区块独有的类名或下一节标题；写完立即核对目标元素的实际行号和邻接结构。

### 68. 从长页抽出懒加载卡片做样例时要主动加载图

- 本轮样例页通过 iframe 隐藏 `/about/` 的其他区块，让卡片从页面下方跳到首屏；第一次截图卡片只有底色，因为白天图仍在等待懒加载。
- 样例 iframe 加载后把两张卡片图片设为 `loading="eager"`，视觉复核时也应等待当前主题图片 `complete && naturalWidth > 0`，不能只等卡片 DOM 出现。
