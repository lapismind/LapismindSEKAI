# blog — Lapismind 的 SEKAI（blog.qmzhj.top）

真冬主题的个人博客 / 作品集，跑在 Cloudflare 免费栈上：Astro 静态构建，`blog.qmzhj.top` 自定义域名 + Workers ASSETS 资产托管（Worker 只对 `/live2d/*` 做防盗链，见 `src/worker.ts`）。

## 栏目与页面

| 路由 | 说明 |
|---|---|
| `/` | 首页：Hero + 玩家档案 + 箱曲电台入口 + 现在在做 + 精选游戏 + 最新博客 |
| `/projects/` | 游戏作品集（数据在 `src/data/projects.ts`） |
| `/blog/` | 文章列表 + 文章页（目录 / 阅读进度 / 评论区） |
| `/about/` | 关于我 + 技术栈 + 单推角色卡 |
| `/profile/` | 个人资料：身份 / 头像 / 成就展馆（登录后） |
| `/login/` | 进入 SEKAI：GitHub 登录 / 用户名密码注册登录（依赖 auth 服务） |
| `/404` | 404 页 |

## 技术栈

- Astro 7（静态输出）+ Tailwind CSS 4 + Vue 3（`CommentSection` / `UserAvatar` 两个交互岛）
- Cloudflare Workers + ASSETS 托管；字体 / 音乐 / Live2D 素材全部自托管（`public/`）
- 认证 / 评论 / 成就：仓库根 `auth/`（统一认证 Worker），不在本目录内

## 目录结构

```text
src/
├── pages/          # 路由（index / about / profile / projects / blog / 404）
├── layouts/        # BlogPost.astro：文章布局（TOC / 阅读进度 / 评论区挂载）
├── components/     # Header / Footer / BaseHead 全站骨架 + 交互岛（Vue）
├── data/           # 数据源：profile.ts / projects.ts / music-player.json
├── content/blog/   # 文章（.md，frontmatter 由 content.config.ts 校验）
├── styles/         # global.css：设计令牌（--hue-accent 单源 OKLCH 主题）
└── worker.ts       # 仅 /live2d/* 防盗链的轻量入口
docs/               # site-features.md / lessons-learned.md / review-*.md
public/             # 字体 / 音乐 / Live2D / 自定义光标等静态资源
```

## 文档地图（新 agent 必读顺序）

1. `docs/site-features.md` — 站点功能与实现细节：设计系统、音乐播放器、素材获取规范、部署流程
2. `docs/lessons-learned.md` — 本目录踩坑记录（动手前先扫一眼）
3. `docs/review-2026-08-29.md` — 最近一次质量审阅：已知问题清单与修复优先级
4. `AGENTS.md` — agent 运行约定（会话启动先读）

## 认证依赖（重要）

评论区、头像、成就、账号体系都来自仓库根 `auth/`（auth.qmzhj.top）。会话 cookie 域为 `.qmzhj.top`，博客与游戏子域共享；前端身份客户端是 `packages/lobby-kit` 的 `createAuthClient`。改认证相关功能时，接口与测试都在 `auth/`。

> 本地联调提示：lobby-kit 客户端默认指向 `http://localhost:8787`（需要 `auth/` 里 `wrangler dev`）；评论区组件的 `authBaseUrl` 目前硬编码生产域，本地联调评论需自行覆盖。

## 常用命令

```sh
npm run dev          # 本地开发（端口 3000）
npm run build        # 构建到 dist/
npm run preview      # 预览构建产物（后台模式：npm run preview -- --background）
npm run check        # astro check 类型检查（tsconfig.check.json）
npm run lint         # ESLint（astro/vue/js 规则）
npx wrangler deploy  # 部署（Assets 指向 ./dist）
```

## 已知问题速查

详见 `docs/review-2026-08-29.md`：MusicDock SPA 切页后交互失效、`/music/lyrics/*.json` 缺失导致中文歌词字幕 404、评论区分页无 UI、auth 测试桩缺 SUM 查询等。
