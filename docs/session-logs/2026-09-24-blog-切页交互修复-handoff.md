# 博客切页交互修复交接

> 日期：2026-09-24
> 性质：生产缺陷修复与部署

## 问题与原因

朋友反馈从「关于」切到其他页面后夜间模式丢失，再返回时水族箱点击不再冒泡；页脚运行时间有时显示 `--`。生产页稳定复现。Astro ClientRouter 换页时会替换 DOM，而原脚本的一次性初始化没有绑定到新节点；主题属性也没有在切页时恢复。

## 修复

- `blog/src/components/BaseHead.astro`：在 `astro:after-swap` 恢复主题与 `has-js`。
- `blog/src/components/Footer.astro`：在 `astro:page-load` 重新绑定当前页脚计时节点，并清除旧定时器。
- `blog/src/pages/about.astro`：在 `astro:page-load` 重绑水族箱交互，切页前清理观察器、动画帧和点击处理。
- `docs/agent/scripts/playwright-about-spa-diagnostic.py`：保存可复跑的生产页浏览器诊断路径。
- `blog/docs/lessons-learned.md`：记录 ClientRouter 生命周期及诊断时机。

## 验证与上线

- 本地 `npm run build` 成功（17 页）；`npm run check` 0 errors、2 个既有 hints；`npm run lint`、`git diff --check` 通过。
- 本地浏览器检查 `/about/` → `/blog/` → `/about/`，以及三轮 `/about/` ↔ `/projects/`：深色主题、计时数字和水族箱气泡均持续，页面无错误。
- 已部署到 `https://blog.qmzhj.top/`，Cloudflare Version ID `d173c1a0-6f92-45d3-a775-2eaeece2a21b`。生产页按 `/about/` → `/blog/` → `/about/` 复跑：主题始终为 `dark`，计时持续显示数字，返回后点击产生 7 个气泡，页面错误为空。
- 上一版 Version ID 为 `0ff9eb40-7e65-4f32-aa05-3086f0daebdb`；需要回退时使用 Cloudflare Workers `blog` 的版本历史。

工作区原有 `.superpowers/sdd/progress.md` 删除未纳入本轮。
