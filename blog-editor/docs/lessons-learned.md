# blog-editor 踩坑记录

> 做新功能前先扫一眼。有新错误就往这里加，禁止静默忽略。

## 2026-09-25 首版

### 打开文章就自动保存了一次

**现象**：点开一篇文章，磁盘上的 `.md` 立刻被重写一遍（状态栏显示"已保存"）。

**原因**：`openPost()` 里先 `loading = true`，赋值 `fields/body`，然后在 `finally` 里同步把 `loading = false`。而 Vue 的 watcher 是异步（pre 队列）执行的——等它跑的时候 `loading` 已经变回 false，于是自动保存被触发。

**修法**：赋值后 `await nextTick()` 再放开 `loading`。另外加了 `pristine` 内容指纹做双保险：**指纹没变就绝不写盘**——这样即使逻辑再有疏漏，"看一眼"也不会改文件。

**教训**：用 `flag + watch` 抑制副作用时，flag 的关闭时机必须是"watcher 已经跑完"，不是"赋值已经做完"。同步落 flag 一定会漏。

### 预览里的图片全是 404

**现象**：正文里的 `![](../../assets/posts/x.png)` 在预览区不显示。

**原因**：文章文件在 `blog/src/content/blog/`，图片相对路径是两级向上；而预览页在编辑器自己的源上，相对路径解析成了 `http://localhost:5180/assets/...`。

**修法**：后端把 `blog/src/assets` 挂在 `/blog-assets/*`，渲染后把 `src="../../assets/` 改写成 `src="/blog-assets/`（`src/lib/markdown.js`）。封面缩略图同理，但要注意**不能**把 `../../assets/` 换成 `/blog-assets/assets/`——挂载点是 assets 目录本身，所以是 `../../assets/` → `/blog-assets/`。

### Shiki 的 class 不是 `astro-code`

**现象**：博客的代码块配色 CSS 直接抄过来不生效。

**原因**：博客走 Astro，Shiki 输出的是 `pre.astro-code`；编辑器走 `@shikijs/markdown-it`，输出的是 `pre.shiki`。

**修法**：`src/styles/prose.css` 里把选择器换成 `pre.shiki`，其余（`--shiki-light` / `--shiki-dark` 双主题变量）原样保留。

### `node --test test/` 在 Node 24 上把目录当模块加载

**现象**：`Cannot find module '.../test'`。

**修法**：脚本写成 `node --test`（无参数），由测试运行器自己按 `*.test.*` 发现，且默认排除 `node_modules`。

### 「保存并发布」没有先保存

**现象**：发布读的是磁盘上的文件，但按钮只是打开发布面板——刚敲完字就点，发上去的可能还是 900ms 前那版。

**修法**：按钮改成先 `await save()` 再开面板。顺带把 `save()` 改成返回一个在飞的 Promise——并发的保存请求会等前一次，而不是直接 `return` 丢掉改动。

**教训**："保存并发布"必须是一个动作，不能是"保存"+"发布"两个动作摆在一起靠默认值。凡是"发布/导出/上传"这类以磁盘现状为输入的按钮，点下去的第一件事都应该是落盘。
