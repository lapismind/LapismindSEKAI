# AGENTS.md — LapismindSEKAI 跨 Agent 工作约定

## 会话启动
- 每次新会话先读本文件。
- 长任务用 planning-with-files 把 plan / findings / progress 落地到磁盘，防上下文丢失。
- 迭代开发全程开 ralph-loop 闭环自检，多次验证再交付。
- 遇到任何错误必须即时追加到 `docs/lessons-learned.md`，禁止静默忽略。

## 仓库边界
- 单 git 仓库（默认 `main` 分支）。`packages/lobby-kit` 现由根仓库**直接跟踪**（曾经因 `packages/.gitignore` 里的 `lobby-kit/` 规则被忽略，已取消）。改动 lobby-kit 后务必提交，否则只打包进部署、不进 git。
- 部署：
  - auth：`cd auth && npx wrangler deploy`
  - blog：`cd blog && npm run build && npx wrangler deploy`
- 未明确要求不要 `git push`；不要提交 `.dev.vars` / `.env`（已被 .gitignore 挡住）。

## Playwright 使用手册（浏览器复现 / 诊断）
本机**只有 Python 3.13 的 playwright**（`C:\Program Files\Python313`），**没有 node 版**。新窗口 / 子 agent 经常误用 `npx playwright`（不存在）或找不到 chromium 二进制，请严格按下面来。

### 安装浏览器二进制（仅首次 / 缺失时）
```
python -m playwright install chromium
```
下载超时（常见，默认 CDN 被墙）换国内镜像：
```
set PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright
python -m playwright install chromium
```

### 运行内置复现脚本
`docs/agents/playwright-profile-repro.py` 用**全新无 cookie 上下文**（等同无痕）访问 `/profile`，抓取 Console、`pageerror`、`>=400` 响应与错误框状态：
```
python docs/agents/playwright-profile-repro.py
```
要验证某个交互（如点「进入 SEKAI」展开账号区块），在脚本里照葫芦画瓢加 `page.click(...)` + `page.eval_on_selector(...)` 即可。

### 常见坑
- **Response 没有 `.method`**：Playwright 的 `response` 对象取 HTTP 方法要用 `r.request.method`，不是 `r.method`（后者会 `AttributeError`，且异常发生在事件监听里会刷屏）。
- **被吞掉的异常**：页面脚本里 `try/catch` 吞掉的异常不会出现在 Console / `pageerror`。诊断时：
  1. 临时在 catch 里加 `console.error('[tag]', e)` 部署后复现；或
  2. 直接用 `page.eval_on_selector` 探针读 `#profile-error.hidden` / `#profile-content.hidden` 判断渲染是否成功（见脚本里的 `[state]`）。
- **custom domain 缓存**：改完前端务必强刷（Ctrl+Shift+R）再验证；wrangler 部署有约数秒 propagate。

## 已知历史坑（速查，避免重踩）
- 头像切换 404：账号分支按 `player_id` → `userId` → 编码 id → `nickname` 多级解析用户，已加兜底（`auth/src/index.js` 的 `resolveAccountId`）。
- profile 游客页曾因「进入 SEKAI」按钮元素被误删 + 悬空 `pf-login` 监听，导致 `render()` 崩溃并伪装成「身份服务暂时不可用」——真实报错是 `Cannot set properties of null (setting 'hidden')`。改前端后务必用上面的脚本确认 `profile-content.hidden=False` 且无 `pageerror`。

## 交流约定
- 改动前先读懂文件既有约定（命名、框架、目录），不要凭空发明接口。
- 报告分数 / 状态变化时，拆分「代码改动」与「衡量标准变化」各贡献多少。
- 不编造源码中没有的接口 / 参数 / 业务规则（必须标注 Mock）。
