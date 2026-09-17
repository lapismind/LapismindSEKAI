# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-17
> 性质：**没有进行中的任务**（设计语言文章已上线、四站已同步部署并验收）
> 上一轮 → [`2026-09-17-设计语言文章-上线-handoff.md`](./2026-09-17-设计语言文章-上线-handoff.md)

## 当前状态

把"设计语言收口"这件事写成了博客文章并上线，随后把四站统一部署到 `b7496e3`。

| 站 | 线上版本 | 备注 |
|---|---|---|
| soup.qmzhj.top | `86571697` | 随本轮重新部署（投票功能已确认在线） |
| showhand.qmzhj.top | `c1b95265` | 同上 |
| abracadawhat.qmzhj.top | `bf97819c` | 同上 |
| blog.qmzhj.top | `1b70b73a` | 新增文章《同一个颜色抄了四遍之后》 |

验收：五个项目测试全 0 fail（abracadawhat 126 / turtle-soup 30 / showhand 8）；博客四项门禁全过
（build / check 0 errors / lint / test）；线上验收 `all_passed: true`；新文章与梭哈补记均已上线。
工作区干净，已推送。

## 接手前先看

- **`AGENTS.md` 的"会话启动"第一条不是形式**：本轮的教训是漏读 `CURRENT.md`，导致拿着**过期 15 个提交**的
  认知继续工作，差点用过期工作树部署、把另一台机器的 11 个提交（海龟汤投票等）静默回退。
  **第一条命令就该是 `git fetch` + 读本文件。** 详见 `lessons-learned.md` 2026-09-17。
- **部署前后都要对齐 HEAD**：部署产物应等于仓库 HEAD。`git status -sb` 看 `behind` 不为 0 就先 rebase，
  再跑测试、再部署。验收脚本能挡"站点挂了"，挡不住"功能被回退"。
- **design-kit 是设计语言的唯一真源**（`packages/design-kit/README.md`）。项目 `global.css` 只留应用外壳，
  不要在项目里重写令牌；色值也不要写进文档（`docs/LOBBY-KIT-COLORS.md` 已改为只讲"为什么"）。
- **博客文章的封面由脚本生成**（`blog/scripts/gen-token-cover.py`，读令牌真值渲染），
  不要手画封面——那会变成又一份色值副本。

## 下一步最该做的两件（承接上轮，仍未做）

1. **真上线玩一局海龟汤，看投票有没有人用。** 这是投票方案唯一的主要死法——揭底之后大家懒得投。
   面板不持久化，正好拿来试：没人用就停在这里，不往 Phase 4–5 走。
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
首页手机端减法。

## 环境与权限

- **两台机器 wrangler 均已登录**，家机部署能力已实测。
- 海龟汤本地起服务：`npx wrangler dev --port 8790`（换端口避免和残留进程撞）。
- 联机页面验证必须 `npx wrangler dev`（`vite dev` / `vite preview` 都没有 `/ws`、`/api` 代理）。
- **Playwright 读计算色不要假定是 `rgb()`**：Chromium 对 oklch 会原样返回，而 `canvas.fillStyle` 不接受 oklch。
- **验证脚本的三条纪律**（反复踩到，都是"本地过、生产挂"）：
  1. 不要用固定 `sleep` 等广播 —— 轮询到条件成立；
  2. 不要按显示名定位元素 —— 生产有 auth，游客身份会覆盖昵称，用 `data-testid`；
  3. 不要用 `networkidle` 判成败 —— 见 `playwright-verify-deploy.py` 里的说明。
- 生产的 `/ws` 需要会话（`SESSION_SECRET` 已配置），裸 WS 探针连不上；
  要探生产就在页面上下文里 `new WebSocket(...)`，浏览器会自动带 cookie。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**，否则被 Cloudflare 403。
  （本机 Git Bash 的 `curl` 另有 TLS 握手失败问题，直接用 Python urllib 更稳。）

## 阻塞项

无。
