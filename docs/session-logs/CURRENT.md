# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-16
> 性质：**没有进行中的任务**（三游戏 UI 缺陷修复已收口、已上线、已验收）
> 上一轮 → [`2026-09-16-三游戏UI缺陷修复-部署-handoff.md`](./2026-09-16-三游戏UI缺陷修复-部署-handoff.md)

## 当前状态

修复了三个游戏的一批可见 UI 缺陷（含两处"文字根本看不见"、一处白底表单、一处无效关键帧），
重新部署并验收全绿。代码与文档均已提交（`1d4f6b9`）。

| 站 | 线上版本 | 备注 |
|---|---|---|
| soup.qmzhj.top | `86b54f01` | 本轮新部署（登录弹层深色化，之前是白底） |
| showhand.qmzhj.top | `cf366ef4` | 本轮新部署（同上，浅色站观感不变） |
| abracadawhat.qmzhj.top | `2ac90038` | 本轮新部署（4 处组件修复 + 聊天面板迁令牌） |
| blog.qmzhj.top | `bc42df85` | 更早一轮，本轮未动 |
| auth.qmzhj.top | — | 本轮未动 |

验收结论：`playwright-verify-deploy.py` → `all_passed: true`；两张表情 `200 image/png`；
四站 200、无 `pageerror`；字体生效；**三个游戏旧调色板残留 0 处**；
海龟汤登录弹层实测为深色卡面（`oklch(0.25 0.028 249)`）、abracadawhat 规则弹层标题 15.98:1。
工作区干净。

## 如果你只是要恢复部署能力

**先读 [`docs/agent/deploy.md`](../agent/deploy.md)。** 一句话：本地唯一需要的
是 `npx wrangler login`，其余配置都在 Cloudflare 侧。**命令要在某个项目目录里跑**
（仓库根没装 wrangler）。先跑：

```powershell
cd turtle-soup; npx wrangler whoami   # 应打印账号邮箱
```

未登录就 `npx wrangler login`（交互式 OAuth，需要人工点授权）。
**两台机器现在都已登录**（账号 `soiciactlybm@gmail.com`），部署能力已实测可用。

## 上一件事的遗留（未做，按建议排序）

1. **design-kit 的按钮档位要一个决定。** 白字压在 `brand-600` 上是 **4.16:1**，
   而 AA 对正文（以及所有 16px 粗体按钮）要求 4.5:1——所以**不是只有小字号不达标，
   是所有 `bg-brand-600 text-white` 都不达标**（AA 的 3:1 豁免要 ≥24px 或 ≥18.66px 粗体，用不上）。
   但 design-kit README 明确把 600 写成"浅色底上白字按钮的可读性下限"。
   所以要么改档位定义（改 700 后是 5.49:1），要么接受。**涉及三个游戏约 18 个按钮，会明显变深。**
   ⚠️ 之前 `CURRENT.md` 把这条记成"小字号问题"，本轮已修正——记录可以引用，结论要自己验。
2. **重连 / 加入失败 UI**（最大的共享空洞）。两个游戏都：`_close` 无人订阅、
   `wsClient.connected` 无人读、重试 5 次后**静默放弃**；abracadawhat 的 worker 还用
   HTTP 409（房间满/已开局）和 410（已结束）拒绝加入，而客户端完全忽略响应。
   表现是"点了没反应"的冻结桌面。abracadawhat 的 spec 已把它划为**独立项目**。
   本轮已铺好地基：`gameStore.connected` 现在是真的。
3. **全仓 `bg-white` → `bg-surface-solid` 清扫**（约 28 处）。浅色主题下两者都是 `#ffffff`，
   **零视觉影响**，但能让三个游戏为深色主题铺好路。本轮只改了 CastPanel 一处。
4. **梭哈的牌型提示**：`core/poker.js` / `core/hand.js` 客户端可用却**无人 import**
   （只有 worker 用），新手直到摊牌都不知道自己是什么牌——"第一次玩看不懂"的最直接来源。
5. **abracadawhat 扣牌区可读性**：8 个无标签 emoji 在约 20px 上辨认
   （`SpellCard.vue:57` 在 `size="sm"` 时刻意隐藏名字，`PlayerZone.vue:60` 全部传 `sm`）。
6. **小型清理**：showhand `RoomView.vue:324` 的 `v-if="false"`、`GameHelp.vue:9` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮、`RoomView.vue:326` 复制的注释。
7. **`--tap-min` / `--dur-*` / `--ease-soft` 在 showhand 里零引用**——44px 全用 `min-h-[44px]` 硬写。

更早的候选（仍未做）：跨游戏战绩与成就看板、`playwright-two-player-table.py` 补成能跑完整局、
`migrate-hex.mjs` 从 `.planning/` 沉淀成正式工具、把动效/瘦身写成博客文章、首页手机端减法。

## 环境与权限（本轮更新）

- **两台机器 wrangler 均已登录**，家机部署能力本轮**已实测**（三个站逐一 `npm run deploy` 成功）。
- `whoami` 会提示 `missing Oauth scopes: websearch.run`——**无影响**，
  成因是登录用的 npx wrangler 4.132.0 与项目锁的 4.123.0 期望的 scope 集不同。
- **缺 `.dev.vars` 时的 500 是环境缺口，不是回归**：三个游戏 `/api/identity` 返回
  `server not configured`（handler 有显式守卫）；游戏功能正常，走降级路径。
- 联机页面验证必须 `npx wrangler dev`（`vite dev` / `vite preview` 都没有 `/ws`、`/api` 代理）。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**，否则被 Cloudflare 403（见 `deploy.md` 第五节）。
- **Playwright 里读计算色不要假定是 `rgb()`**：Chromium 对 oklch 会原样返回
  `oklch(0.25 0.028 249)`，而 `canvas.fillStyle` **不接受 oklch**（赋值失败会静默保留旧值，
  于是全读成 `#000000`）。要断言颜色就自己实现 oklch→sRGB。
- `playwright-design-token-probe.py` **必须带 URL 参数**，不带会 `IndexError`。

## 阻塞项

无。
