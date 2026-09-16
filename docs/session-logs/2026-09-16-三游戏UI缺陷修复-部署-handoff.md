# 三游戏 UI 缺陷修复 → 部署

> 日期：2026-09-16
> 性质：缺陷修复 + 部署验收（同时实测家机的部署能力）
> 上一段：[`2026-09-16-设计语言统一-部署-handoff.md`](./2026-09-16-设计语言统一-部署-handoff.md)
> Git：`1d4f6b9`
> 部署版本：turtle-soup `86b54f01`、showhand `cf366ef4`、abracadawhat `2ac90038`

## 本轮目标

上一轮收口时 `CURRENT.md` 写了"没有进行中的任务"，但三个游戏被点名的 UI 问题还挂着。
本轮**先做全仓 UI 侦察**（三个游戏 + 共享包 + 全文档待办扫描），再从里面挑出
"确实是 bug、改动可验证、不碰玩法逻辑"的那一批修掉，并用它把家机的部署能力实测一遍。

## 执行摘要

- **修了 abracadawhat 的 3 处真缺陷**（其中 2 处是"文字根本看不见"）：
  - `CastPanel.vue`：施法区标题是白卡上的 `text-white` → 不可见
  - `GameHelp.vue`：规则弹层标题 `📖 游戏规则` 同样是白卡白字 → 不可见
  - `CastFeedback.vue`：`dragon-pop` 关键帧把 `rotate: 0deg` 脱离 `transform` 单独声明，
    **整条 transform 被浏览器丢弃**，动画从 25% 直接跳到 100%
- **清了上一轮迁移漏掉的文件**：`GameChatPanel.vue` 是唯一还停在迁移前色板的组件（14 处），
  已收敛到语义令牌；顺带修掉它把 `● 已连接` 写死在模板里的问题（断线时照样显示已连接）。
- **修掉 `CURRENT.md` 遗留第 2 条**：`AuthBadge` 登录弹层（三个游戏共用）的卡面、表单输入、
  遮罩是裸 hex 且漏了 `.is-dark` 覆盖 → 海龟汤这个深色站会弹出一张**白底表单**。
- **三个游戏已重新部署并验收**：`playwright-verify-deploy.py` → `all_passed: true`。
- **家机部署能力实测通过**（见"部署能力实测"）。

## 关键决策（git 查不到的部分）

- **没有做整轮"重连 UI"**。侦察确认两个游戏断线后都静默冻结、`wsClient.connected` 无人读、
  abracadawhat 的 worker 还会用 HTTP 409/410 拒绝加入而客户端完全忽略——这是最大的共享 UX 空洞。
  但 abracadawhat 自己的 spec 已经把"房间加入失败/移动端施法区重排"划为**独立项目**
  （`docs/superpowers/specs/2026-09-06-abracadawhat-story-progression-design.md:203`）。
  所以本轮只做**最小诚实版**：给 store 加真实 `connected`（订阅 `_open`/`_close`），
  让聊天面板不再撒谎，**不**顺手把整个重连项目开了。
- **异常状态色保留原生色板**。`text-emerald-600` / `text-red-500` / 血条的三档色
  **没有**迁到令牌：design-kit 里根本没有 success/warning/danger 令牌，硬造一套
  等于绕过"唯一真源"。这跟"遗漏"是两回事，已写进回归测试的白名单。
- **CastPanel 的 `bg-white` 顺手换成 `bg-surface-solid`**：只因为那只白卡正是"标题看不见"
  的成因，同一处修完才自洽。**没有**做全仓 `bg-white` → `bg-surface-solid` 的清扫
  （浅色主题下两者都是 `#ffffff`，零视觉影响，但 diff 会摊得很大），留给下一轮。
- **没有做 `bg-brand-600` 白字的全面替换**（见下面的"修正结论"）。

## 修正了一条既有记录（重要）

`CURRENT.md` 原文写「**小字号** `brand-600` 白字低于 AA（4.16:1）」，暗示只有小字号不达标。
**逐值算过之后这不是真的**：

| 组合 | 实测对比度 | AA 要求 | 结论 |
|---|---|---|---|
| 白字 / `brand-600` `#7676B8` | **4.16:1** | 正文字号 4.5:1 | **所有** `bg-brand-600 text-white` 都不达标 |
| 白字 / `brand-700` `#6363a0` | **5.49:1** | 4.5:1 | 达标 |
| 白字 / `--primary`（≈`#605EAB`） | ≈5.5:1 | 4.5:1 | 达标 |

- AA 的"大字号 3:1"豁免要求 ≥24px，或 ≥18.66px 且粗体。那些按钮是 `font-bold` + 默认 16px，
  **不构成大字号**，所以豁免用不上。
- 但 design-kit README:16 明确写着 "600 = 浅色底上白字按钮的**可读性下限**"——
  即设计语言本身把 600 定成了下限。所以这不是"改几个类名"的活，而是**要么改 design-kit 的档位定义，
  要么接受它**。本轮不动它，等一个设计决定（涉及三个游戏约 18 个按钮，视觉上会明显变深）。

## 验证证据

### 单元/构建

| 项 | 结果 |
|---|---|
| abracadawhat `npm test` | **126 passed / 0 fail**（本轮 +5） |
| lobby-kit `npm test` | **8 passed**（本轮 +2，新增 `tests/authbadge-style.test.mjs`） |
| design-kit `npm test` | 30 令牌校验通过 |
| turtle-soup / showhand 测试 | 1 / 8 passed |
| 三游戏构建 | 全部通过（abracadawhat `postbuild` 表情拷贝正常） |
| abracadawhat 产物 CSS | 新令牌类全部生成（`.text-ink` `.bg-overlay` `.bg-field` `.bg-neutral` `placeholder\:text-muted` `hover\:bg-neutral-hover` …），**旧色板类全部消失**（`text-gray-400` `bg-blue-500` `bg-green-500` `border-gray-200` … 均查无） |

### 线上（真实浏览器）

| 项 | 结果 |
|---|---|
| `playwright-verify-deploy.py` | **`all_passed: true`**；两张表情 `200 image/png`（70879 / 82867B）；四站 200、`pageerror` 0；字体生效 |
| 旧调色板残留探针 | 三个游戏均 **✓ 一处都没有** |
| **海龟汤登录弹层（深色站）** | 弹层底 `oklch(0.25 0.028 249)`（= design-kit 深色卡面，**修复前是 `#ffffff`**）；标题对比 **13.02:1**、表单标签 **8.58:1**；输入框底 `oklch(0.19 0.022 249)`、描边 `oklch(0.32 0.02 249)` |
| **梭哈登录弹层（浅色站）** | 弹层底 `rgb(255,255,255)` 保持浅色；标题 15.98:1、标签 8.42:1 |
| **abracadawhat 规则弹层** | 标题 `oklch(0.25 0.028 250)` vs 白卡 **15.98:1**（修复前白字白底 = 不可见）；两个小标题 `rgb(99,99,160)`=`brand-700`，**5.49:1**（修复前 `brand-300` 约 2:1） |
| **abracadawhat 聊天面板** | 旧色板残留 0 处；握手前显示 `○ 连接中…`，WS 连上后显示 `● 已连接`（`text-emerald-600`）——状态真实 |

**未覆盖**：施法区标题与巨龙特效关键帧**没有在真实对局里目视确认**——两者都要 2 名玩家
开局、后者还要恰好打出巨龙。它们由源码回归测试 + 产物 CSS 覆盖，属于"已验签到、未目视"。

## 部署能力实测（家机 → 生产）

上一轮家机卡在"wrangler 未登录"，本轮实测跑通：

```
turtle-soup   86b54f01-4835-43a9-9d69-f91f70cd4bd0   ← soup.qmzhj.top
showhand      cf366ef4-ee7f-4008-abe1-999c94f020c1   ← showhand.qmzhj.top
abracadawhat  2ac90038-e86d-4bf6-86ad-d25647529bef   ← abracadawhat.qmzhj.top
```

三个站逐一 `npm run deploy` 成功，无告警阻塞。`whoami` 那条
`missing Oauth scopes: websearch.run` 无影响（部署需要的 workers/d1/kv/routes 权限都在；
成因是用 npx 的 4.132.0 登录、项目锁 4.123.0，两版期望的 scope 集不同）。

**结论：家机部署能力已恢复并实测可用。**
回滚：Cloudflare 控制台 → Workers → 对应 Worker → 版本历史 → 退回上一个 Version。

## 踩坑记录

1. **Chromium 对非 sRGB 颜色会原样返回计算值**：`getComputedStyle(el).backgroundColor`
   拿到的是 `oklch(0.25 0.028 249)` 而不是 `rgb(...)`，`canvas` 的 `fillStyle` 也不接受 oklch
   （赋值失败会静默保留上一次的值，于是全部读成 `#000000`，看起来像"全都是黑的"）。
   写颜色断言脚本时要么自己实现 oklch→sRGB，要么别默认计算值一定是 rgb。
2. **第一版验证脚本读早了 1 秒**，把"WS 握手未完成"误读成"连接状态坏了"。
   这正是本轮改动的性质——它现在会短暂显示"连接中…"，那是**真话**，不是回归。
3. **`playwright-design-token-probe.py` 必须带 URL 参数**，不带会 `IndexError`。
4. **`npx wrangler login` 在仓库根跑会把 wrangler 装到 npm 缓存**（4.132.0），
   和项目里锁的 4.123.0 不是一个版本；登录本身全局生效，但会带来上面那个 scope 告警。

## 关键文件

| 文件 | 作用 |
|---|---|
| `abracadawhat/src/components/{CastPanel,GameHelp,GameChatPanel,CastFeedback}.vue` | 本轮修复主体 |
| `abracadawhat/src/stores/gameStore.js` | 新增真实 `connected`（订阅 `_open`/`_close`） |
| `packages/lobby-kit/src/vue/AuthBadge.vue` | 登录弹层改 `var(--令牌, 旧值)`（三个游戏共用） |
| `packages/lobby-kit/tests/authbadge-style.test.mjs` | **新增**：守住"弹层必须走令牌、裸 hex 只能在 fallback 里" |
| `abracadawhat/tests/{ui-regressions,game-store}.test.mjs` | 本轮 +5 条回归断言 |

## 当前状态

已收口。三个游戏重新部署、验收全绿、工作区干净（`1d4f6b9`）。

## 下次可做之事（按建议排序）

1. **design-kit 的按钮档位要一个决定**：白字 / `brand-600` 是 4.16:1，
   **所有**字号都不达 AA（README 却把它写成"可读性下限"）。要么把该档位定义改成 700，
   要么接受。涉及三个游戏约 18 个按钮。
2. **重连 / 加入失败 UI**（最大的共享空洞，spec 已认定为独立项目）：
   两个游戏 `_close` 无人订阅，重试 5 次后静默放弃；abracadawhat 的 worker 用
   HTTP 409/410 拒绝加入，客户端完全不看。现在 `connected` 已经有了，UI 层可以直接接。
3. **全仓 `bg-white` → `bg-surface-solid` 清扫**（浅色下零视觉影响，为深色主题铺路）。
4. **梭哈的判型提示**：`core/poker.js` 客户端可用却无人 import，新手看不到自己的牌型——
   "第一次玩看不懂"的最直接来源。
5. **abracadawhat 扣除面积可读性**：8 个无标签 emoji 在约 20px 上辨认（`SpellCard.vue:57`
   在 `size="sm"` 时刻意隐藏名字，`PlayerZone.vue:60` 全部用 `sm`）。
6. 小型清理：showhand `RoomView.vue:324` 的 `v-if="false"`、`GameHelp.vue:9` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮；`--tap-min` / `--dur-*` 令牌在两个游戏里**零引用**。
7. 更早的候选仍在：跨游戏战绩看板、`playwright-two-player-table.py` 补完整局、
   `migrate-hex.mjs` 沉淀成正式工具、博客文章、首页手机端减法。

**不建议**：把游戏物件色（牌背、筹码红、牌桌、海龟汤判定色）迁到令牌；
给 abracadawhat 加观战/重赛投票（spec 明确排除）。
