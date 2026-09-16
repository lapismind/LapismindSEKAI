# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-16
> 性质：**没有进行中的任务**（上一件事已收口、已上线、已验收）
> 上一轮 → [`2026-09-16-设计语言统一-部署-handoff.md`](./2026-09-16-设计语言统一-部署-handoff.md)

## 当前状态

设计语言统一（design-kit → lobby-kit → 三个游戏）**全部完成并上线**，代码与文档均已推送。

| 站 | 线上版本 | 备注 |
|---|---|---|
| soup.qmzhj.top | `29042d02` | 本轮新部署（202 处 slate 迁移 + 深色语义令牌） |
| showhand.qmzhj.top | `5c516ccb` | 本轮新部署（182 处 hex 迁移） |
| abracadawhat.qmzhj.top | `09212849` | 本轮新部署（同上 + 表情资源已验） |
| blog.qmzhj.top | `bc42df85` | 更早一轮（动效 + Live2D 瘦身），本轮未动 |

验收结论：四站 200、无 `pageerror`、字体生效、两张表情 `200 image/png`、
**三个游戏旧调色板残留 0 处**。工作区干净。

## 如果你只是要恢复部署能力

**先读 [`docs/agent/deploy.md`](../agent/deploy.md)。** 一句话：本地唯一需要的
是 `npx wrangler login`，其余配置都在 Cloudflare 侧。先跑：

```powershell
npx wrangler whoami   # 应打印账号邮箱
```

未登录就 `npx wrangler login`（交互式 OAuth，需要人工点授权）。

## 上一件事的遗留（未做，按建议排序）

1. **小字号 `brand-600` 白字低于 AA**（4.16:1；大字号适用 3:1 已达标）。既有问题。
   修法：小字号那几处（如 `copyInvite` 的 `text-xs`）改用 `--primary`。
2. **`AuthBadge.vue` 的表单输入仍是硬编码 `#ffffff` / `#333333`**，未走令牌——
   深色主题下注册/登录表单会是白底，可读但不统一。
3. **暗色主题"分离度"用人眼回看**：中性按钮/描边 vs 卡片的分离度数值下降
   （1.72→1.22 / 1.72→1.32）。WCAG 无标准，截图看框线仍清楚，但你上线后扫一眼确认能否接受。
4. **`playwright-two-player-table.py` 补成能跑完整局**（结算/秀牌），目前只到开局第一轮。
5. **`migrate-hex.mjs` 从 `.planning/` 沉淀成 `docs/agent/scripts/` 下的正式工具。**

更早的候选（上一轮列过、仍未做）：把动效/瘦身写成博客文章、跨游戏战绩与成就看板、
游戏动效"只统一一半"（统一时长缓动但保留出牌/判定的回弹）、首页手机端减法。

## 环境与权限（本轮更新）

- **工作机 wrangler 已登录**；家机当时未登录 → 那边需要先 `npx wrangler login`。
- **缺 `.dev.vars` 时的 500 是环境缺口，不是回归**：三个游戏 `/api/identity` 返回
  `server not configured`（handler 有显式守卫）；游戏功能正常，走降级路径。
- 联机页面验证必须 `npx wrangler dev`（`vite dev` / `vite preview` 都没有 `/ws`、`/api` 代理）。
- `local` 环境的 CORS / `net::ERR_FAILED`（`localhost:8787` 未起 auth）属预期现象。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**，否则被 Cloudflare 403（见 `deploy.md` 第五节）。

## 阻塞项

无。
