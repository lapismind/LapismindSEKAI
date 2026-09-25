# AGENTS.md — blog-editor

本地博客文章编辑器：左编辑 / 右预览 / 一键保存并发布。全貌读 `README.md`。

## 会话启动（必读）

1. 先读 `README.md`（形态、启动、目录分工）。
2. 动代码前翻 `docs/lessons-learned.md`。
3. 遇到错误立即追加到 `docs/lessons-learned.md`，禁止静默忽略。

## 项目地图

- `server/` — Node 服务。`dev.mjs` 是入口（API + Vite 同端口）；`api.mjs` 路由；`posts.mjs` / `frontmatter.mjs` / `assets.mjs` / `publish.mjs` / `paths.mjs` 各管一件事。
- `src/` — 前端。`App.vue` 持有全部状态；`components/` 下 FrontmatterForm / MarkdownEditor / PreviewPane / PublishPanel。
- `src/styles/prose.css` — **镜像**自 `blog/src/styles/global.css` 的 `.prose` 段（博客文章页才是真源）。改博客正文观感时两处一起改。
- `test/` — `node --test`，只测纯逻辑（frontmatter 解析/序列化/校验、文件名清洗）。

## 不要动的地方

- **`blog/` 目录只通过 API 读写**，不要在编辑器代码里 import 博客的源文件。唯一例外是路径常量（`paths.mjs`）。
- **不要在组件里硬编码品牌色 hex**，用 design-kit 的语义类（`bg-surface` / `text-ink` / `border-line`）或 `var(--*)`。
- `public/fonts/` 是 `predev` 同步出来的产物，已 gitignore，不要手动放文件。

## 三条硬约束（改代码前先想一遍）

1. **内容没变不许写盘。** `App.vue` 里用 `pristine` 指纹挡住空保存——否则"点开文章看一眼"就会重写文件。载入文章后要 `await nextTick()` 再放开 `loading`。
2. **frontmatter 必须始终可被博客 schema 接受。** 必填 `title` / `description` / `pubDate`；发布的校验在 `publish.mjs`，不过就不构建。
3. **图片路径是 `../../assets/...`**（文章在 `blog/src/content/blog/`）。预览里要改写成 `/blog-assets/...`，两处都别漏。

## 常用命令

```bash
npm run dev    # http://localhost:5180
npm test       # node --test
```

## 边界

- 发布按钮会**真的部署到生产**（`npx wrangler deploy`）。没确认前不要替用户点。
- 编辑器不做 git 提交。
