# 博客部署指南

> 博客地址：https://blog.qmzhj.top
> 技术栈：Astro + Tailwind CSS，部署在 Cloudflare Workers（纯静态）

## 日常发布流程

写完/改完文章后，在 `D:\cloudflareGame\blog` 目录执行：

```powershell
npm run build        # Astro 构建到 dist/
npx wrangler deploy  # 上传 dist/ 到 Cloudflare Workers
git add -A; git commit -m "post: 文章标题"; git push  # 归档源码
```

构建成功标志：输出末尾出现 `[build] Complete!` 和页面列表。
部署成功标志：wrangler 输出 `Deployed blog triggers` 和 `blog.qmzhj.top (custom domain)`。

## 写一篇新文章

1. 在 `src/content/blog/` 下新建 `.md` 文件，frontmatter 格式：

```yaml
---
title: '文章标题'
description: '一句话摘要，会显示在列表页和 SEO'
pubDate: 'Aug 22 2026'   # 日期格式：Mon DD YYYY
heroImage: '../../assets/xxx.png'   # 可选，封面图放 src/assets/
---
```

2. 正文用 Markdown，支持代码块、表格、图片。
3. 本地预览：`npm run dev`，浏览器打开 http://localhost:4321
4. 确认没问题后按上面流程发布。

## 配置说明

### wrangler.toml

- `name = "blog"`：Worker 名称
- `routes`：绑定自定义域名 blog.qmzhj.top（Custom Domain 模式，自动创建 DNS + 证书）
- `assets.directory = "./dist"`：静态资源目录
- `not_found_handling = "404-page"`：404 走 Astro 的 404 页面

### 内容集合

`src/content.config.ts` 定义了 blog collection 的 schema（title/description/pubDate/heroImage），新文章 frontmatter 必须符合。

## 常见问题

**Q: 图片太大怎么办？**
A: Astro 构建时自动压缩成 webp（大图能压到 10KB 级别），直接用 PNG/JPG 即可，不需要手动处理。

**Q: 部署后页面没更新？**
A: Cloudflare CDN 缓存。强刷 Ctrl+F5，或等几分钟。也可以在 Cloudflare Dashboard 清缓存。

**Q: wrangler deploy 卡住或超时？**
A: 国内网络波动，重试一次通常就好。持续失败检查代理设置。

**Q: 新增页面没出现在构建输出里？**
A: 检查文件是否放在 `src/pages/` 下，路由基于文件路径自动生成。

## 相关项目

- 博客仓库：`D:\cloudflareGame\blog`
- 海龟汤：https://soup.qmzhj.top（见 `turtle-soup-launch.md`）
- 梭哈：https://showhand.qmzhj.top（见 `showhand-launch.md`）
- 共享文档目录：`D:\cloudflareGame\docs`

