# Progress

## Phase 1：关闭 AI 主持入口 —— ✅ 完成（2026-09-16）

**Git**：`3363c9f`
**部署**：`soup.qmzhj.top` = `c9c89d92-6182-4f0e-8622-c2940a7466a2`

### 做了什么

用户决定：AI 主持暂时只留代码、关掉入口（token 成本 + 判定准确率 + 玩家更愿意和真人朋友玩），
以后条件合适再开放。落成一个前后端各一处真源的开关：

| 位置 | 改动 |
|---|---|
| `src/core/features.js` | **新增**，前端唯一真源 `AI_MODE_ENABLED = false` |
| `src/worker/soupRoom.js` | 同名常量；`handleSetHostConfig` 归一化为 `AI_MODE_ENABLED && data?.mode === 'ai' ? 'ai' : 'human'`；新建 state 的 `mode: 'human'` |
| `src/stores/gameStore.js` | `mode = ref('human')`、`resetRoom()` 回 `'human'`；`aiHint()` 加开关兜底 |
| 四个组件 | `GameBoard` / `MessageList` / `DrawerPanel` / `HostConfigPanel` 的 `mode` prop default → `'human'` |
| `HostConfigPanel.vue` | AI 按钮 `:disabled="!AI_MODE_ENABLED"` + `beta` 标记 + 置灰 + 说明一行 |
| `src/views/RoomView.vue` | `:can-ai-hint="AI_MODE_ENABLED && (game.amModerator \|\| game.isHost)"` |
| 文案 | `GameHelp`（AI 章节改"暂时关闭"，「是也不是」的解释挪到通用玩法一节）、`LobbyView`、`PuzzleSubmitModal` |

**一并关闭了 AI 复盘提示**。这是本轮的一个判断：`handleAIHint` 是**真的会往 `AI_BASE_URL` 打请求**的
（共用 `AI_API_KEY`），由主持人/房主在 `playing` 和 `ended` 阶段随时可触发，**独立于主持模式**。
不关它，"关掉 AI 入口"就只关了一半——用户给的理由（成本）对它同样成立。
`src/ai/**` 实现与协议字段 `mode` 全部保留，重新开放只需把两处开关改回 `true`。

顺带修掉 `HostConfigPanel` 里「本局人数（含主持人」缺右括号（既有小缺陷）。

### 验证证据

| 项 | 结果 |
|---|---|
| `npm test` | **8 passed**（新增 `tests/ai-mode-closed.test.mjs` 7 条，防"只改前端不改服务端"） |
| 构建 | 通过 |
| **本地服务端强制** | 冒充房主硬发 `set_host_config{mode:'ai', maxPlayers:1}` → 收到 `human -> human -> human`，最终 `maxPlayers: 2` |
| **线上服务端强制** | 同上探针打到生产：`human/8 → human/8 → human/2`，最后一条 `{mode:'human', maxPlayers:2}` |
| 本地 UI | 房间头部「真人主持」；AI 按钮 `disabled=true`、title 说明、含 beta；人数选项 `2-8`（无 1）；AI复盘按钮 0 个；`pageerror 0` |
| 线上 UI | 同上，全部一致；`pageerror 0` |
| 通用线上验收 | `playwright-verify-deploy.py` → `all_passed: true`（四站 200、字体、两张表情 `200 image/png`） |

### 踩坑

- **验证脚本读太早会给出假阴性**：第一版线上探针在第 2 条 `game_state` 就收工，
  读到的是加入房间的初始广播（`maxPlayers: 8`），差点得出"服务端没强制"的错误结论。
  实际配置生效的广播是第 3 条。等待类断言必须取**最后一条**状态或等一个明确的收敛条件。
- 本地那版探针恰好 3 条都拿到了，所以没暴露这个缺陷——**同一个脚本在生产上才现形**。

## Phase 2：投票协议 + DO 状态 —— ⬜ 未开始

下一步从这里接。形制照 `reviewNotes`（`soupRoom.js` 的 `handleReviewNote`）：
单玩家提交 → push 进 `state` 数组 → 广播；差别只在资格校验和"要不要隐藏中间结果"。

本轮已经确认过的前提（见 `findings.md`）：
- 投票只在 `phase === 'ended'` 接受，一局一次（海龟汤没有"轮"）。
- `viewFor()` 已把 `players` 与 `spectators` 分开下发，资格判定在服务端是干净的。
- 展开看还需要：`state.apples = [{ from, to }]`、主持人两票的约束（不能自投、必须给两个不同的人）、
  以及"关闭投票"的触发点（房主按钮 + 全员离开）。

## Phase 3：面板 UI —— ⬜ 未开始

`ended` 阶段现有的"回答卡"改成面板（上半区汤面+汤底，下半区 🍎 网格 + 观众小红花），
**不阻塞「返回大厅」**。

## Phase 4–5：历史 🍎 —— ⏸️ 用户决定本轮不做

用户拍板"历史 🍎 先不做"，所以先只做房间内投票、不出现任何分数列。
真要做时前置是 Phase 4（先证明 auth 的 v2 上报在生产能落行——见 `findings.md` 第 3、6 节）。
