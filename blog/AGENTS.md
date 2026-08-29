# AGENTS.md — blog（qmzhj.top 博客）

## 会话启动（必读）

1. 站点全貌先读 README.md 与 docs/site-features.md（栏目 / 设计系统 / 素材规范 / 部署）。
2. 动代码前翻阅 docs/lessons-learned.md（踩坑记录）与 docs/review-2026-08-29.md（已知问题与修复优先级）。
3. 遇到任何错误，立即追加到 docs/lessons-learned.md，禁止静默忽略。
4. 长任务用 planning-with-files 落地；迭代用 ralph-loop 自检。

## 项目地图

- src/pages — 路由页面：index / about / profile / projects / blog / 404
- src/layouts/BlogPost.astro — 文章布局（目录 / 阅读进度 / 评论区挂载）
- src/components — Header / Footer / BaseHead 全站骨架；CommentSection / UserAvatar 是 Vue 交互岛（认证相关）；Live2dMascot / MusicDock / IntroOverlay 是花活组件
- src/data — profile.ts / projects.ts / music-player.json：页面多为数据驱动，改文案优先改这里
- src/styles/global.css — 设计令牌：`--hue-accent` 单源 OKLCH 亮暗主题
- src/worker.ts — 仅 `/live2d/*` 防盗链，`[assets] directory = ./dist`

## 认证与评论（重要）

- 认证服务在仓库根 auth/（Worker，auth.qmzhj.top）：评论 / 头像 / 成就 / 账号都走它，本目录不持会话逻辑。
- 前端身份客户端在 packages/lobby-kit（createAuthClient），会话在 HttpOnly cookie（域 .qmzhj.top）。
- 本地联调：lobby-kit 客户端默认指向 http://localhost:8787（需 auth/ 起 wrangler dev）；CommentSection 的 authBaseUrl 目前硬编码生产域。
- 动认证接口必须同步 auth/tests（当前 npm test 红，见 review 已知问题）。

## 常用命令

```sh
npm run dev        # 本地开发
npm run build      # 构建到 dist/
npm run preview    # 预览：后台模式 astro preview --background
npx wrangler deploy
```

## 浏览器操作

Python 3.13 + Playwright（全局约定，见仓库根 AGENTS.md）。

## 已知问题速查（详情见 docs/review-2026-08-29.md）

- MusicDock 在 SPA 切页后交互失效 / 播放重置（`__mdBound` 全局守卫绑定旧 DOM）
- /music/lyrics/*.json 缺失 → 中文歌词字幕 404（有日文降级）
- 评论区分页无 UI；评论区不回传 avatar_id（账号自选头像不显示）
- auth 测试桩缺成就 SUM 查询 → npm test 红
