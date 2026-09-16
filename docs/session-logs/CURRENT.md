# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-16
> 性质：**没有进行中的任务**（海龟汤揭底后投票已收口、已上线、已验收）
> 上一轮 → [`2026-09-16-海龟汤投票-部署-handoff.md`](./2026-09-16-海龟汤投票-部署-handoff.md)

## 当前状态

海龟汤新增「揭底后投票（🍎）」，三个阶段（关 AI 入口 → 服务端 → 面板）全部完成并上线。

| 站 | 线上版本 | 备注 |
|---|---|---|
| soup.qmzhj.top | `85ee3a96` | 本轮：AI 主持入口关闭 + 投票面板 |
| showhand.qmzhj.top | `cf366ef4` | 本轮未动 |
| abracadawhat.qmzhj.top | `2ac90038` | 本轮未动 |
| blog.qmzhj.top | `bc42df85` | 本轮未动 |

验收：`npm test` 30 条全过；本地 4 连接集成 22 项断言、本地浏览器三视角 27 项、
**生产浏览器三视角 30 项**全过（含逐人裁剪、计数隐藏、小红花、结束投票）；
通用线上验收 `all_passed: true`。工作区干净。

## 这件事的要点（接手前先看，细节在 handoff 里）

- **🍎 是"我的名单"不是"一票"**：再点即撤回、满了顶掉最早的。玩家因此"点别人即换人"，
  主持人天然保留最近两个。**改这块前先读 handoff 的"关键决策"**，它是几处规则的共同前提。
- **两处 AI 开关必须一起改**：`src/core/features.js` 与 `src/worker/soupRoom.js` 的
  `AI_MODE_ENABLED`。`tests/ai-mode-closed.test.mjs` 就是守这个的。
- **关 AI 必须连 `handleAIHint` 一起关**（它独立于主持模式、真的会打 AI 请求）。
- **投票计数在结束前是 `null`，前端不要 `?? 0`**——那是"还没公开"，不是"没人投他"。

## 下一步最该做的两件

1. **真上线玩一局，看投票有没有人用。** 这是这个方案唯一的主要死法——揭底之后大家懒得投。
   面板已经落地且**不持久化**，正好拿来试：没人用就停在这里，不往 Phase 4–5 走。
2. **`win.gif` 庆祝页要不要救回来。** 人类模式两条结束路径都直接置 `revealed=true`，
   所以 `phase==='ended' && !revealed` 不会出现——这段是 Phase 1 关 AI 之后的死代码。
   改法是让「主持人确认猜中」时先不揭底、多点一下看 GIF，**但那是一次交互变更**，等用户拍板。

## 遗留清单（未做，按建议排序）

1. **abracadawhat 的 v2 上报在生产未被证实**（跨两轮的老问题）：
   `player_match_reports` 生产 **0 行**，`matches` 8 条全是 v1 写的、最新 2026-09-02。
   **注意**：用户说"玩的时候能看到战报"与这不矛盾——游戏里那套是 DO 现算广播的（不过 D1），
   D1 写入是另一条尽力而为的支线。唯一判别方法：**完整打一局，看结算弹窗有没有「战报暂未保存」**。
   这是历史 🍎（Phase 4–5）的前置。
2. **design-kit 的按钮档位要一个决定。** 白字压在 `brand-600` 上是 **4.16:1**，
   而 AA 对正文（含 16px 粗体按钮）要求 4.5:1——**所有 `bg-brand-600 text-white` 都不达标**，
   不是只有小字号。但 design-kit README 明确把 600 写成"可读性下限"。
   要么改档位定义（改 700 是 5.49:1），要么接受。涉及三个游戏约 18 个按钮，会明显变深。
3. **重连 / 加入失败 UI**（最大的共享空洞）。两个游戏都：`_close` 无人订阅、
   `wsClient.connected` 无人读、重试 5 次后**静默放弃**；abracadawhat 的 worker 还用
   HTTP 409/410 拒绝加入而客户端忽略。表现是"点了没反应的冻结桌面"。
   abracadawhat 的 spec 已把它划为独立项目。（abracadawhat 的 `gameStore.connected` 已经是真的了。）
4. **全仓 `bg-white` → `bg-surface-solid` 清扫**（约 28 处）。浅色主题下两者都是 `#ffffff`，
   **零视觉影响**，为深色主题铺路。
5. **梭哈的牌型提示**：`core/poker.js` / `core/hand.js` 客户端可用却**无人 import**，
   新手直到摊牌都不知道自己是什么牌。
6. **abracadawhat 扣牌区可读性**：8 个无标签 emoji 在约 20px 上辨认
   （`SpellCard.vue:57` 在 `size="sm"` 时刻意隐藏名字，`PlayerZone.vue:60` 全部传 `sm`）。
7. **小型清理**：showhand `RoomView.vue:324` 的 `v-if="false"`、`GameHelp.vue:9` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮、`RoomView.vue:326` 复制的注释。
   **`--tap-min` / `--dur-*` / `--ease-soft` 在 showhand 里零引用**。
8. **文档更正**：`docs/agent/deploy.md` 第四节写"三个游戏 `/api/identity` 返回 500"，
   但**海龟汤没有这个路由**（`index.js` 只注册了 `/ws` 和 `/api/ping`，生产 404）。

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、
把动效/瘦身写成博客文章、首页手机端减法。

## 环境与权限

- **两台机器 wrangler 均已登录**，家机部署能力已实测（多个站 `npm run deploy` 成功）。
- 海龟汤本地起服务：`npx wrangler dev --port 8790`（换端口避免和残留进程撞）。
- `whoami` 的 `missing Oauth scopes: websearch.run` **无影响**（npx 4.132.0 与项目锁的 4.123.0 期望的 scope 集不同）。
- **Playwright 读计算色不要假定是 `rgb()`**：Chromium 对 oklch 会原样返回，而 `canvas.fillStyle` 不接受 oklch。
- **验证脚本的三条纪律**（本轮反复踩到，都是"本地过、生产挂"）：
  1. 不要用固定 `sleep` 等广播 —— 轮询到条件成立；
  2. 不要按显示名定位元素 —— 生产有 auth，游客身份会覆盖昵称，用 `data-testid`；
  3. 不要用 `networkidle` 判成败 —— 见 `playwright-verify-deploy.py` 里的说明。
- 生产的 `/ws` 需要会话（`SESSION_SECRET` 已配置），裸 WS 探针连不上；
  要探生产就在页面上下文里 `new WebSocket(...)`，浏览器会自动带 cookie。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**，否则被 Cloudflare 403。

## 阻塞项

无。
