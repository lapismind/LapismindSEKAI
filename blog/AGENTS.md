# AGENTS.md — blog（qmzhj.top 博客）

## 会话启动（必读）

1. 站点全貌先读 README.md 与 docs/site-features.md（栏目 / 设计系统 / 素材规范 / 部署）。
2. 动代码前翻阅 docs/lessons-learned.md（踩坑记录）与 docs/review-2026-08-29.md（已知问题与修复优先级）。
3. **起草或修改文章前读 docs/writing-style.md**（行文特征 / 结构模板 / 禁用清单）。AI 初稿必须按它自检，不要按"通顺"的标准交付。
4. 遇到任何错误，立即追加到 docs/lessons-learned.md，禁止静默忽略。
5. 长任务用 planning-with-files 落地；迭代用 ralph-loop 自检。

## 项目地图

- src/pages — 路由页面：index / about / profile / login / projects（游戏） / works（Projects 板块，游戏之外的作品） / blog / 404
- src/layouts/BlogPost.astro — 文章布局（目录 / 阅读进度 / 评论区挂载）
- src/components — Header / Footer / BaseHead 全站骨架；CommentSection / UserAvatar 是 Vue 交互岛（认证相关）；Live2dMascot / MusicDock / IntroOverlay 是花活组件
- src/data — profile.ts / projects.ts / music-player.json：页面多为数据驱动，改文案优先改这里
- src/styles/global.css — 本站自有令牌（`--cursor-*`、`--lift-hover`、`--corner-*`）与全局样式。
  **设计令牌（品牌色阶 / 表面色 / 圆角 / 阴影 / 字体栈）的真源在 `packages/design-kit`**，
  本站通过 `@import "@lapismind/design-kit/tokens.css"` 引入，不要在 global.css 里重写这些值
  （2026-09-14 收口；`public/fonts/` 也是由 design-kit 同步生成、已 gitignore）
- src/worker.ts — `/live2d/*` 防盗链 + moc3 返回预压缩 `.br` + 设缓存头（详见 docs/site-features.md 第 8 节）
- scripts/precompress-live2d.mjs — 构建后置步骤（`postbuild`），把 moc3 预压成 `.br`

## 不要动的地方（已确认的边界）

### 看板娘（Live2dMascot）的位置
她的位置是用户反复微调定下来的，**不要改**，包括：

- `#l2d-widget` 的 `left / bottom / width / height`：桌面 `left:12px; bottom:0; 300×420`；
  `@media (max-width:720px)` 下 `left:6px; 190×260`；同区块内 `.l2d-ground`、`.l2d-particles` 的尺寸
- `.l2d-card`（「SEKAI · N 天」徽章）的 `left: 50%; bottom: 12px`
- JS `place()` 里的定位算法（scale 取画布高度、x 居中、y 让脚底透明区压出屏幕）

"顺手优化"（防重叠、挪位置、缩放自适应）一律不做。她与右下角其他浮层
（电台按钮 / 回到顶部）在窄屏会视觉相邻，这是**已知且接受**的状态。

顺带：右下角的电台按钮与回到顶部共用角落，定位参数必须走 global.css 的 `--corner-*`
变量（见该处注释），别在组件里各写一份边距——两处分开写必然互相压住。

## 认证与评论（重要）

- 认证服务在仓库根 auth/（Worker，auth.qmzhj.top）：评论 / 头像 / 成就 / 账号都走它，本目录不持会话逻辑。
- 前端身份客户端在 packages/lobby-kit（createAuthClient），会话在 HttpOnly cookie（域 .qmzhj.top）。
- 本地联调：lobby-kit 客户端默认指向 http://localhost:8787（需 auth/ 起 wrangler dev）；CommentSection 的 authBaseUrl 目前硬编码生产域。
- 动认证接口必须同步 auth/tests。

## 常用命令

```sh
npm run dev        # 本地开发
npm run build      # 构建到 dist/
npm run preview    # 预览：后台模式 astro preview --background
npx wrangler deploy
```

## 浏览器操作

Python 3.13 + Playwright（全局约定，见仓库根 AGENTS.md）。

## 已知问题

2026-08-29 审阅（docs/review-2026-08-29.md）与 2026-09-04 UI/UX 审阅
（docs/ui-ux-review-v2-2026-09-04.md）里列出的问题**已全部处理完毕**
（前者见该文第 8 节修复记录；后者的 P0/P1 已实施，Live2D 懒加载/折叠经用户确认不实施）。
不要再按旧清单去"修"已经不存在的 bug——要确认现状就实机复跑，别引用过期文档。

当前门禁：`npm run build` / `npm run check`（0 errors）/ `npm run lint` / `npm test` 均通过。
