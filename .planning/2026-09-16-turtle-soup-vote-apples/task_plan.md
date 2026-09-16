# Task Plan: 海龟汤 · 揭底后投票（🍎）

## Goal

海龟汤每局揭底后加一个投票面板：**上半区呈现本局的汤面（+汤底），下半区让玩家把 🍎 送给自己觉得发挥最好的玩家**。
目的是让一起玩的人高兴高兴、看看谁猜得好——**不做战绩框架、不做成就、不做反刷分**。

## 已定的设计（用户拍板，不再讨论）

1. **AI 主持标 beta、关掉入口**，暂时只能玩真人模式。理由：token 是问题、准确率是问题、而且大家更喜欢和真人朋友一块玩。以后 AI 效率/成本提高了再考虑——所以**代码保留，只关入口**。
2. **不做"战绩"这个字眼**，不功利化。就是每局一次投票，用一个面板呈现，玩家可能顺手就点了。
3. **计分物是 🍎**：玩家给心仪的选手发 🍎，**给一个用户记载一个历史 🍎 数**即可。
4. **主持人的 🍎**：按之前谈定的——主持人可以被投，但他自己那两份**不能投给自己，且必须给两个不同的人**。
5. **观众不能发 🍎**，但可以送**小红花**（= 临时点个赞），**小红花不计入历史**。
6. **明确不做**防刷分/防作弊。原话：「有人愿意玩就很开心了，不用防玩家刷分什么的，你让人家刷人家还懒得刷呢」。

## 事实核查（三条，均已实测，会直接改变实现）

### 1. 海龟汤没有"轮"，一局 = 一道汤

`state.phase` 只有 `waiting | playing | ended`，`state.puzzle` 是**单个对象**，`ended` 是终态
（揭底 → 返回大厅）。三条通往 `ended` 的路径：猜中（`soupRoom.js:483`）、`556`、主持人揭底（`575`）。

→ 所以"每轮结束投票"实际是**每局投一次**，且**只有揭底后一个时机**。

### 2. AI 目前是三处的默认值，只藏按钮不够

| 位置 | 现状 |
|---|---|
| `src/stores/gameStore.js:16` / `:51` | `const mode = ref('ai')`，`resetRoom()` 也回 `'ai'` |
| `src/worker/soupRoom.js:218` | `const mode = data?.mode === 'human' ? 'human' : 'ai'` |
| `GameBoard.vue:19` / `MessageList.vue:8` / `DrawerPanel.vue:9` / `HostConfigPanel.vue:3` | prop `default: 'ai'` |

→ **不翻默认值，新建房间仍然走 AI**，等于入口没关。`soupRoom.js:220` 的
`minPlayers = mode === 'ai' ? 1 : MIN_PLAYERS` 也挂在同一个开关上。

其余 AI 触点（要么随模式一起不可达，要么需要改文案）：
`HostConfigPanel.vue:18-31`（模式选择按钮）、`GameBoard.vue:137,179-186`（大肥鱼头像）、
`MessageList.vue:25`（🐟 大肥鱼）、`DrawerPanel.vue:107,173` → `RoomView.vue:101-104`（AI 提示）、
`GameHelp.vue:13,21`、`LobbyView.vue:148`、`PuzzleSubmitModal.vue:118`（文案提到 AI 主持人会判题）、
`src/ai/aiHost.js` + `src/ai/logicProfile.js`（实现，保留不动）。

### 3. 🍎 的"历史数"踩在一条从没在生产跑通的管道上

查生产 D1 实测（`wrangler d1 execute sekai-db --remote`）：

| 事实 | 值 |
|---|---|
| `player_match_reports`（迁移 007 / auth 端 v2 逐玩家表） | 表**存在**，但 **0 行** |
| `matches` | 只有 **8 行**，全部 `game='abracadawhat'`，最新一条 **2026-09-02** |
| `match_players`（v1 老路径） | 17 行 |
| `d1_migrations` 账本 | **只有 001/002** |

→ 003–007 是**手工 `d1 execute` 上的、账本没记**（这正是 D4 那条"迁移基线未建立"）。
两边都能对上：表在，但账本说没应用，所以 **`d1 migrations apply` 不能盲跑**
（`CREATE TABLE IF NOT EXISTS` 安全，裸 `ALTER TABLE ADD COLUMN` 会因重复列失败）。

→ 更关键：**auth 的 v2 逐玩家上报在生产一条都没落过**。abracadawhat 的
故事/成就/战绩那一整套（A1–D3 都已"完成"）在生产上是**未被证实的**，
这正是没做完的 D4 阶段。**🍎 的历史数如果要做，就是骑在这条没验证过的链上。**

→ 另外：海龟汤的 Worker 绑定里**没有 D1、也没有 `MATCH_REPORT_SECRET`**
（本轮部署输出实测：只有 `SoupRoom` / `PuzzleLib` / `ASSETS` / `AI_BASE_URL` / `AI_MODEL`）。

**好消息**：auth 的 `player_match_reports` 表是**按 `game` 字段通用的**（不是出包专用），
列是 `game, rank, score, rounds, player_count, standings_json, stories_json, unlocked_keys_json, finished_at`，
配 `POST /api/matches`（`MATCH_REPORT_SECRET` 校验）+ `GET /api/match-reports`。
所以 🍎 不用另起炉灶，加一列就够——**前提是那条链本身先被证明可用**。

## Phases

- [ ] **Phase 1：关掉 AI 入口（可独立先发，不依赖投票）**
  翻三处默认值到 `human`；`HostConfigPanel` 的 AI 按钮标 beta + 禁用（不删）；
  改 GameHelp / LobbyView / PuzzleSubmitModal 里"可选 AI 主持"的文案；
  `src/ai/**` 与协议 `mode` 字段保留。
  验收：新建房间默认真人主持、可正常开局；AI 路径在 UI 上不可达。

- [ ] **Phase 2：投票的协议 + DO 状态（无 UI）**
  新增消息类型（形制照 `review_note`：`soupRoom.js:583` 是现成的同形先例——
  单玩家提交、push 进 state 数组、`playing`/`ended` 都收）；
  `state.apples = [{ from, to }]`；资格规则（谁能投、主持人两份、不能自投）**一律在服务端判定**；
  只在 `phase === 'ended'` 接受。
  单元测试覆盖：资格、主持人两票约束、非 ended 拒绝、重复提交。

- [ ] **Phase 3：面板 UI（本轮的可见成果）**
  `ended` 阶段现有的"回答卡"改成面板：上半区汤面+汤底，下半区 🍎 网格 + 观众小红花区；
  **不阻塞「返回大厅」**；顺带把揭底的 win.gif → 面板 → 返回大厅 的衔接理顺。
  浏览器验证（Playwright，真人 2 人本地 `wrangler dev`）。

- [ ] **Phase 4（前置）：把 v2 上报在生产跑通** —— 只在要做"历史 🍎"时才需要
  确认/补上 abracadawhat 的 `MATCH_REPORT_SECRET`；用一局真实对局验证
  `player_match_reports` 落行；**别盲跑 `d1 migrations apply`**，
  先补账本基线（把 003–007 标记为已应用），否则重复列会炸。

- [ ] **Phase 5：🍎 入账 + 个人页展示**
  海龟汤加 `MATCH_REPORT_SECRET`；auth 加迁移 008（`apples` 列，或复用 `standings_json`）；
  `sanitizeMatchReport`/`persistV2MatchReport`/`GET /api/match-reports` 各加一处；
  个人页显示历史 🍎 总数。游客累积、注册后保留（与出包现有行为一致）。

## 待定（我给了倾向，等你一句话）

| # | 待定 | 我的倾向 | 为什么 |
|---|---|---|---|
| 1 | **历史 🍎 这一版就做吗？** | **先不做，只做房间内面板** | 见下面"唯一的主要死法"；且它被 Phase 4 挡住 |
| 2 | 小红花什么时候能送 | 只在面板里，和 🍎 同处；**不做实时** | 实时就变成弹幕/点赞流，是另一个项目；"临时点个赞"在面板里已经成立 |
| 3 | 小红花送给谁 | 送给**某个玩家**，不挂到某条提问 | 挂提问要改消息列表的数据结构，价值对不上 |
| 4 | 🍎 能不能投给自己 | **不允许** | 理由不是防刷，是**面板会变得没意思**（四个人各给自己一个）。实现只多一个条件 |
| 5 | 投票能不能改/撤 | **关闭前可以改**（点别人即换） | 这是个"顺手点一下"的东西，点错了不能改会很别扭 |
| 6 | 投票什么时候关、结果什么时候显示 | 房主一个「结束投票」按钮 + 全员离开即关；**关闭后才显示结果**，不实时显示票数 | 实时显示会从众；不设倒计时，免得又多一个计时器要维护 |
| 7 | 上半区只放汤面还是汤面+汤底 | **汤面 + 汤底** | 揭底之后判断"谁猜得好"必须看汤底。现有回答卡已经有这两块 |

## 唯一的主要死法

**揭底之后再让大家投票，很容易变成一件像作业的事**——谜底已经解开了，注意力已经散了。
这不是数据能预先回答的问题，只能试。

所以 Phase 1–3 的取舍很明确：**先只做"房间内投票、不持久化、不出现任何分数列"**，
把面板做得能顺手点、能跳过、绝不挡「返回大厅」。如果真有人投，再上 Phase 4–5。
反过来先建管道后验证需求，是最容易白干的那条路。

## Scope 边界

- 只动 `turtle-soup/`（Phase 1–3）。Phase 4–5 才碰 `auth/`。
- **不动**：`turtle-soup` 的判定色/`fx-pop` 回弹/琥珀汤面卡（既有决定）；
  `card-game`（已归档）、`slay-the-spire`（已搁置）。
- **不做**：跨游戏战绩看板、成就（用户明确反对）；防刷分/防作弊（用户明确不要）。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| — | — | 尚未开始实现 |
