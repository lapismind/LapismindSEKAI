# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-16
> 性质：**进行中** —— 海龟汤「揭底后投票（🍎）」，Phase 1 已完成并上线，Phase 2 未开始
> 计划目录 → [`.planning/2026-09-16-turtle-soup-vote-apples/`](../../.planning/2026-09-16-turtle-soup-vote-apples/)（`task_plan.md` / `findings.md` / `progress.md`）
> 上一件已收口 → [`2026-09-16-三游戏UI缺陷修复-部署-handoff.md`](./2026-09-16-三游戏UI缺陷修复-部署-handoff.md)

## 这件事是什么

海龟汤每局揭底后加一个投票面板：上半区汤面+汤底，下半区让玩家把 🍎 送给自己觉得发挥最好的玩家。
目的是让一起玩的人高兴高兴，**不做"战绩"框架、不做成就、不做防刷分**。
观众不能发 🍎，但可以送小红花（临时点赞，不计入历史）。

**用户已拍板**：历史 🍎 这一版不做（先只做房间内投票，不出现任何分数列）。
所以本轮范围是 Phase 1–3；Phase 4–5（持久化到个人页）搁置，前置条件见 `findings.md`。

## 当前状态

| 阶段 | 状态 |
|---|---|
| Phase 1 关闭 AI 主持入口（标 beta） | ✅ 完成并上线（`3363c9f` / `c9c89d92`） |
| Phase 2 投票协议 + DO 状态 | ⬜ 未开始 ← **下一步从这里接** |
| Phase 3 面板 UI | ⬜ 未开始 |
| Phase 4–5 历史 🍎 | ⏸️ 用户决定本轮不做 |

线上版本：

| 站 | 线上版本 | 备注 |
|---|---|---|
| soup.qmzhj.top | `c9c89d92` | 本轮新部署：AI 主持入口关闭（含 AI 复盘提示） |
| showhand.qmzhj.top | `cf366ef4` | 本轮未动 |
| abracadawhat.qmzhj.top | `2ac90038` | 本轮未动 |
| blog.qmzhj.top | `bc42df85` | 更早一轮，未动 |

验收：`playwright-verify-deploy.py` → `all_passed: true`；海龟汤 UI 与服务端强制均已实测
（冒充房主硬发 `mode:'ai'` → 服务端返回 `human` + 人数抬到 2）。

## 下一步怎么接（Phase 2）

形制照 `reviewNotes`（`src/worker/soupRoom.js` 的 `handleReviewNote`）：单玩家提交 → push 进 `state` 数组 → 广播。
差别只在资格校验和"要不要隐藏中间结果"。要落的规则见 `task_plan.md` 的"已定的设计"与"待定"两张表。

三个已查实的前提（别重新查）：
1. **海龟汤没有"轮"，一局 = 一道汤**，`phase` 仅 `waiting|playing|ended`，投票只在 `ended` 接受、一局一次。
2. `viewFor()` 已把 `players` 与 `spectators` **分开下发**，资格判定在服务端是干净的。
3. 测试入口：`npm test` 现在有 8 条（`tests/ai-mode-closed.test.mjs` 是本轮新增的示范）。

## 沿用中的约定（本轮新增）

- **AI 开关有两处真源**：`src/core/features.js`（前端）与 `src/worker/soupRoom.js`（服务端）的
  `AI_MODE_ENABLED`。**要开必须两处一起改**，`tests/ai-mode-closed.test.mjs` 就是守这个的。
- 关闭 AI 时**必须连 AI 复盘提示一起关**：`handleAIHint` 会真的往 `AI_BASE_URL` 打请求，
  独立于主持模式，主持人/房主随时可触发。

## 遗留清单（未做，按建议排序）

1. **abracadawhat 的 v2 上报在生产未被证实**（新发现，见 `findings.md` 第 3、6 节）：
   `player_match_reports` 生产 0 行，`matches` 8 条全是 v1 写的、最新 2026-09-02。
   **注意**：用户说"故事/成就/战绩测试通过了、玩的时候能看到战报"——这不矛盾，
   游戏里那套是 DO 现算广播的（不经过 D1）。分辨方法只有一个：**完整打一局，看结算弹窗有没有
   「战报暂未保存」**，再看 `player_match_reports` 是否落行。这与没做完的 D4 阶段是同一件事。
2. **design-kit 的按钮档位要一个决定。** 白字压在 `brand-600` 上是 **4.16:1**，
   而 AA 对正文（含 16px 粗体按钮）要求 4.5:1——**所有 `bg-brand-600 text-white` 都不达标**，
   不是只有小字号。但 design-kit README 明确把 600 写成"可读性下限"。
   要么改档位定义（改 700 是 5.49:1），要么接受。涉及三个游戏约 18 个按钮，会明显变深。
3. **重连 / 加入失败 UI**（最大的共享空洞）。两个游戏都：`_close` 无人订阅、
   `wsClient.connected` 无人读、重试 5 次后**静默放弃**；abracadawhat 的 worker 还用
   HTTP 409（房间满/已开局）和 410（已结束）拒绝加入，客户端完全忽略。
   表现是"点了没反应"的冻结桌面。abracadawhat 的 spec 已把它划为独立项目。
   （abracadawhat 的 `gameStore.connected` 已经是真的了，可以直接接 UI。）
4. **全仓 `bg-white` → `bg-surface-solid` 清扫**（约 28 处）。浅色主题下两者都是 `#ffffff`，
   **零视觉影响**，为深色主题铺路。
5. **梭哈的牌型提示**：`core/poker.js` / `core/hand.js` 客户端可用却**无人 import**，
   新手直到摊牌都不知道自己是什么牌。
6. **abracadawhat 扣牌区可读性**：8 个无标签 emoji 在约 20px 上辨认
   （`SpellCard.vue:57` 在 `size="sm"` 时刻意隐藏名字，`PlayerZone.vue:60` 全部传 `sm`）。
7. **小型清理**：showhand `RoomView.vue:324` 的 `v-if="false"`、`GameHelp.vue:9` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮、`RoomView.vue:326` 复制的注释。
   **`--tap-min` / `--dur-*` / `--ease-soft` 在 showhand 里零引用**（44px 全用 `min-h-[44px]` 硬写）。
8. **文档更正**：`docs/agent/deploy.md` 第四节写"三个游戏 `/api/identity` 返回 500"，
   但**海龟汤没有这个路由**（`index.js` 只注册了 `/ws` 和 `/api/ping`，生产 404）。那条对它不适用。

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、
把动效/瘦身写成博客文章、首页手机端减法。

## 环境与权限

- **两台机器 wrangler 均已登录**，家机部署能力已实测（多个站 `npm run deploy` 成功）。
- `whoami` 的 `missing Oauth scopes: websearch.run` **无影响**（npx 4.132.0 与项目锁的 4.123.0 期望的 scope 集不同）。
- **缺 `.dev.vars` 时的 500 是环境缺口，不是回归**。但注意海龟汤没有 `/api/identity` 路由。
- 联机页面验证必须 `npx wrangler dev`（`vite dev` / `vite preview` 都没有 `/ws`、`/api` 代理）。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**，否则被 Cloudflare 403（见 `deploy.md` 第五节）。
- 海龟汤本地起服务可用：`npx wrangler dev --port 8790`。
- **Playwright 里读计算色不要假定是 `rgb()`**：Chromium 对 oklch 会原样返回
  `oklch(0.25 0.028 249)`，而 `canvas.fillStyle` **不接受 oklch**（赋值失败会静默保留旧值）。
- `playwright-design-token-probe.py` **必须带 URL 参数**。
- 生产的 `/ws` 需要会话（`SESSION_SECRET` 已配置），所以**裸 WS 探针连不上**——
  要探生产就在页面上下文里发 `new WebSocket(...)`，浏览器会自动带 cookie。

## 阻塞项

无。等 Phase 2 开工。
