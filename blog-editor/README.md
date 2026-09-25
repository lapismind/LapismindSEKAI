# blog-editor — 博客文章编辑器

本地跑的文章编辑器：左边编 frontmatter + Markdown，右边实时预览，一键保存并发布到 `blog.qmzhj.top`。

为什么是本地应用：它要直接写 `blog/src/content/blog/*.md`、往 `blog/src/assets/` 塞图、还要跑 `npx wrangler deploy`——纯网页做不到这三件事。

## 跑起来

```bash
npm install     # 第一次
npm run dev     # → http://localhost:5180
```

一条 `npm run dev` 起一个 Node 服务（同端口上跑 API + Vite）。**不需要**另外开博客的 `npm run dev`，预览是编辑器自己渲染的。

## 界面

- **顶栏**：文章下拉 / 新建 / 插入图片 / 保存 / 保存并发布 / 亮暗切换
- **左栏**：frontmatter 表单（可收起）+ CodeMirror 正文编辑器
- **右栏**：渲染后的预览（用博客正文的那套排版，亮暗跟随）

## 导入图片与标题

- **拖入 / 粘贴图片** → 存到 `blog/src/assets/posts/`，在光标处插入 `![alt](../../assets/posts/xxx.png)`
- **「选图片当封面」** → 存到 `blog/src/assets/covers/`，写进 `heroImage` / `heroImageAlt`
- **粘贴以 `# 标题` 开头的文本** → 标题栏为空时，自动把这一行提到 frontmatter，正文里不重复

## 保存与发布

- 改动后 900ms 自动保存；`Ctrl/Cmd+S` 立即保存
- **内容没变就绝不写盘**（打开文章看一眼不会改文件）
- 「保存并发布」= 保存 → `npm run build` → `npx wrangler deploy`，日志实时滚，结束显示 Version ID
- 发布前会校验 frontmatter（`title` / `description` / `pubDate`）和封面文件是否存在；不过就**不触发构建**

## 目录

| 路径 | 内容 |
|---|---|
| `server/dev.mjs` | 入口：http 服务 + Vite middleware，一个端口 |
| `server/api.mjs` | 路由（文章 CRUD、收图、发布 SSE）+ `/blog-assets/*` 静态托管 |
| `server/posts.mjs` | 文章读写，slug 校验 |
| `server/frontmatter.mjs` | frontmatter 解析/序列化/校验（纯函数，有测试） |
| `server/assets.mjs` | 收图、文件名清洗、重名去重 |
| `server/publish.mjs` | 校验 → build → deploy，逐行回吐日志 |
| `server/paths.mjs` | 路径常量真源 |
| `src/` | 前端（Vue3 + Vite + Tailwind4 + design-kit） |
| `test/` | `node --test`，只测纯逻辑 |

## 自检

```bash
npm test
```

## 约定

- 编辑器**不碰 git**：发布只上线，不 commit。要提交得自己在仓库根 `.\scripts\sync.ps1 ship`。
- `.md` 的 frontmatter 由表单管；文件里未知的 key 会原样保留，不会被吃掉。
