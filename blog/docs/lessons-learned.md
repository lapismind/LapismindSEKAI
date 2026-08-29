# blog 错误记忆

> 供本项目复用。跨项目通用教训同步到 D:\tianxunruida\docs\通用错误记忆库.md（Q、R 类别）。

## 2026-08-14

### 1. npm 命令没带 workdir，包装错到用户目录
- 现象：`npm install tailwindcss @tailwindcss/vite` 报成功，但 blog 的 package.json / node_modules 里都没有，包被装到了 `C:\Users\lapismind\node_modules`，还在那里误建了 package.json。
- 根因：PowerShell 会话的默认 cwd 是用户目录，npm 命令没指定 workdir 时就在那里安装。
- 修复：删掉 `C:\Users\lapismind\package.json` 和 `node_modules`，在 blog 目录内重装并三步验证（package.json 有、node_modules 有、build 过）。
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