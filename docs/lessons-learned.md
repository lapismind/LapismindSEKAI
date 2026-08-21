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

## 未解决

（无）
