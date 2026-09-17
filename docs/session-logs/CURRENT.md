# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-17
> 性质：**没有进行中的任务**（掉线可见 + 三处体验修补 + 手机端徽章改位，均已上线并验收）

## 当前状态

本轮给三个游戏补了"掉线要说出来"，并修了三处具体缺陷（博客手机导航、梭哈手机顶栏、梭哈牌型提示）。

| 站 | 线上版本 | 本轮改了什么 |
|---|---|---|
| showhand.qmzhj.top | `a6665bb1` | 掉线提示 / 牌型提示 / 手机顶栏 2 行 + 竖版桌面 |
| abracadawhat.qmzhj.top | `1a31be76` | 掉线提示 / 手机顶栏徽章移入「我」弹层 |
| soup.qmzhj.top | `96371658` | 掉线提示 / 手机顶栏徽章移入「我」弹层 |
| blog.qmzhj.top | `acbe5f9c` | 手机端导航不再竖排/上溢出 |

验收：六个项目门禁全过（design-kit 33 令牌 / lobby-kit 14 / showhand 8 / abracadawhat 126 /
turtle-soup 30 / 博客 build+check 0 errors+lint+test）；线上验收 `all_passed: true`；
**产物级探针**确认新功能真的都在线上（掉线提示 / 重连按钮 / 重连细条 / 牌型提示 / 闷牌降级 / `--danger` 令牌）。
已推送（`7596a27`），工作区干净。

## 这轮的关键决策与坑（接手前先看）

- **「放弃重连」必须是明确状态。** 此前 ws-client 重试耗尽后直接 `return`，客户端再无动作、界面留着最后一个画面，
  玩家以为只是别人慢，实际这局对他已经废了；showhand / turtle-soup 连 `_close` 都没订阅。
  现在有状态机 + `_status` 事件 + `retry()`，配套共享组件 `ConnectionBanner`（重连中=顶部细条，已断开=居中卡片挡界面）。
  **改动前先读 `packages/README.md` 的「连接状态与事件」一节。**
- **`send()` 未连接时不再静默丢消息**：返回 false 并发 `_send_failed`，调用方应告知玩家。
- **本地量手机端布局不可信**：本地 `/api/identity` 返回 500（未配 `IDENTITY_SECRET`）→ auth 不可达 →
  `AuthBadge` 渲染为零宽。我就是因此把"顶栏降到 2 行"报早了（本地 85px，线上其实 100–138px）。
  **要量手机顶栏就量线上**。
- **abracadawhat / turtle-soup 原本房间页没有资料弹层**，只有顶栏那个徽章。手机上把徽章移出顶栏就必须补一个
  入口，所以本轮给它们各加了「⚙️ 我」+ 我的资料弹层（`ProfileEditor` + `AuthBadge`），入口是 `sm:hidden`。
- **lobby-kit 的 `npm test` 已由显式串联改为 glob**：此前新增用例文件不会自动纳入，"写了但从不执行"（本轮踩到）。

## 下一步最该做的（承接上轮，仍未做）

1. **真上线玩一局海龟汤，看投票有没有人用**（揭底后投票唯一的主要死法就是没人投）。
2. **`win.gif` 庆祝页要不要救回来** —— 人类模式两条结束路径都直接置 `revealed=true`，那段是死代码；
   改法是让「主持人确认猜中」先不揭底、多点一下看 GIF，**但那是一次交互变更**，等用户拍板。

## 遗留清单（未做，按建议排序）

1. **abracadawhat 的 v2 上报在生产仍未被证实。** 本轮查清了：**不是 bug** —— `factsVersion: 2` 于 2026-09-07
   才落地，最后一场比赛是 2026-09-02，v2 这条路从未跑过。生产 `MATCH_REPORT_SECRET` 已配置，8 行全是 v1。
   v2 载荷与持久化两端各有 17 / 7 项测试覆盖且全绿；**未验证的只有 HTTP 那一跳**（与 v1 同路径）。
   → **下次有人打完一局后，查 `player_match_reports` 有没有行就能定案。**
2. **design-kit 的按钮档位要一个决定**：白字压在 `brand-600` 上是 4.16:1，AA 对正文要求 4.5:1——**所有
   `bg-brand-600 text-white` 都不达标**，而 README 把 600 写成"可读性下限"。改 700 是 5.49:1，涉及三个游戏约 18 个按钮。
3. **重连 / 加入失败 UI 只做了一半**：现在"掉线"有提示了，但 **worker 用 HTTP 409/410 拒绝加入**
   （房间满 / 对局中 / 整场结束）时客户端仍然忽略，表现还是"点了没反应"。
4. **全仓 `bg-white` → `bg-surface-solid` 清扫**（约 28 处）。浅色主题下零视觉影响，为深色主题铺路。
5. **abracadawhat 扣牌区可读性**：8 个无标签 emoji 在约 20px 上辨认（`SpellCard.vue:57` 在 `size="sm"` 时刻意隐藏名字）。
6. **小型清理**：showhand `RoomView.vue` 的 `v-if="false"`、`GameHelp.vue` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮。**`--tap-min` / `--dur-*` / `--ease-soft` 在 showhand 里仍零引用。**
7. **文档更正**：`docs/agent/deploy.md` 第四节写"三个游戏 `/api/identity` 返回 500"，
   但**海龟汤没有这个路由**（生产 404）。
8. **showhand 手机端还有约 140px 空白**（顶栏与牌桌之间）：竖版桌面已把桌面放大 48%，这段空隙还能再给桌面。

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、首页手机端减法。

## 环境与权限

- 两台机器 wrangler 均已登录；本地只需 `npx wrangler login`，配置都在 Cloudflare 侧（见 `docs/agent/deploy.md`）。
- **联机页面验证必须 `npx wrangler dev`**（`vite dev` / `vite preview` 都没有 `/ws`、`/api` 代理）。
- 海龟汤本地端口用 8790；多开时注意 **workerd 子进程不随父进程退出**，会残留占端口
  （`taskkill /F /T` 杀 node 包装进程杀不掉它，要按 PID 杀 workerd）。同一端口出现多个监听时，
  请求会随机落到其一，表现为莫名超时。
- **别用"按命令行匹配"的方式批量杀进程**：命令里出现的端口号会把你自己的 shell 也匹配进去。
- **Playwright 读计算色不要假定是 `rgb()`**：Chromium 对 oklch 原样返回，`canvas.fillStyle` 不接受 oklch。
- **验证脚本三条纪律**：不要固定 `sleep` 等广播（轮询到条件成立）；不要按显示名定位元素
  （生产有 auth，游客身份会覆盖昵称，用 `data-testid`）；不要用 `networkidle` 判成败。
- 生产 `/ws` 需要会话，裸 WS 探针连不上；要探就在页面上下文里 `new WebSocket(...)`。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**（否则被 Cloudflare 403）。
  本机 Git Bash 的 `curl` 另有 TLS 握手失败问题，直接用 Python urllib 更稳。
- **Python 里写 Windows 路径要注意转义**：`"...\docs\agent..."` 里的 `\a` 是响铃符，
  要么用正斜杠，要么用 raw string。

## 阻塞项

无。
