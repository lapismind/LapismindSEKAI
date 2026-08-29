# AGENTS.md — LapismindSEKAI 跨 Agent 约定

## 会话启动
- 每次会话先读本文件。
- 长任务用 planning-with-files 落地 plan；迭代用 ralph-loop 自检。
- 错误即时记 docs/lessons-learned.md，禁止静默忽略。

## Playwright 浏览器复现
脚本在 `docs/agents/playwright-profile-repro.py`（用法与原理见其注释），运行：
```
python docs/agents/playwright-profile-repro.py
```
关键坑（避免重踩）：
- Playwright `response` 取方法用 `r.request.method`，不是 `r.method`。
- 页面 `try/catch` 吞掉的异常不进 Console/pageerror；诊断时在 catch 临时加 `console.error`，或用脚本里的 `#profile-error.hidden` / `#profile-content.hidden` 探针判断渲染是否成功。
- wrangler custom domain 改完前端要强刷（Ctrl+Shift+R）。
