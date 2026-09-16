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

## Phase 2：投票协议 + DO 状态 —— ✅ 完成（2026-09-16）

**未部署**：本阶段对外零可见（前端还没有引用新字段），与 Phase 3 一起发。

### 落下来的规则

| 规则 | 实现 |
|---|---|
| 一局一次、只在揭底后 | `handleGiveApple` 在 `phase !== 'ended'` 时拒收并回错误「揭底之后才能送 🍎」 |
| 名额：观众 0 / 主持人 2 / 其余玩家 1 | `appleQuota(state, playerId)`；主持人的判定带 `state.mode === 'human'`，与前端 `amModerator` 一致 |
| 不能给自己送 | 服务端拒收，回「不能给自己送 🍎」 |
| 目标必须是玩家 | 观战者不能作为 🍎 的目标（也不是小红花的目标） |
| **🍎 是"我的名单"不是"一票"** | 目标已在名单里 → 再点即撤回；名单没满 → 加入；**满了 → 顶掉最早的**。所以玩家"点别人即换人"，主持人天然保留最近两个，且两份不可能落在同一个人头上 |
| 投的过程中不公开计数 | `viewFor` 的 `appleCounts` 在 `votingClosed` 之前是 **null**，只下发 `myApples` |
| 进度可见但不泄露方向 | `voted` / `voters`（"已有几人送出"），不给"送给了谁" |
| 结束时点 | 房主的 `close_voting`；**外加全员送满时自动关闭**（见下） |
| 小红花：观众专用、不计入历史 | `handleGiveFlower` 只允许观战者发；同一观众对同一玩家只有一朵，再点即收回（天然限流）。**它一直可见**，不跟着 🍎 一起藏——"临时点个赞"没人看得见就不叫点赞 |
| 新一局清空 | `handleStartGame` 重置 `apples` / `flowers` / `votingClosed` |

### 两处我自己加的判断（可驳回）

1. **全员送满就自动收口**（`isVotingComplete`）。计划里只写了"房主按钮 + 全员离开即关"，
   但那样房主 AFK 时面板会永远等不到结果——是个死胡同。加上这条后，
   最后一个人点完就出结果，房主的按钮退化成"提前结束"。
   注意：**掉线的人仍算在 voters 里**（开局后 `webSocketClose` 只标记离线不移除），
   所以有人掉线时不会自动关，需要房主点按钮——这是有意的，避免短暂重连把投票提前关掉。
2. **小红花实时可见，🍎 计数不实时**。两者的性质不同：🍎 是"谁猜得好"的比较，
   互相看得见会从众；小红花只是点赞，它的乐趣就在于看得见。
   这是两条规则，不是一条，理由写在上面的表里。

### 验证证据

| 项 | 结果 |
|---|---|
| `npm test` | **23 passed**（本轮新增 `tests/vote-apples.test.mjs` 15 条） |
| 构建 | 通过 |
| **真实多连接集成**（本地 `wrangler dev`，4 条 WS：房主/玩家2/玩家3/观众） | **全部通过**，22 项断言 |

集成实测覆盖（这些是单元测试绕过的部分——真实消息分发与 `game_state` 广播）：

```
开局 → 抽出主持人 → 揭底 → ended
送 🍎 后：p2 看到自己的 ["pv3"]；p3 看到 []（逐人裁剪生效）；p3 的 appleCounts 仍是 null
再点同一个 → 撤回
观众送 🍎 被拒「观战不能送 🍎，可以送小红花」；给自己送被拒；🍎 不能送给观战者
小红花：观众送出 → 所有人的 flowerCounts 立刻看到 {"pv2":1}，且 appleCounts 仍为 null
主持人 pv3 → ["pv1","pv2"]（两个），quota=2
非房主 close_voting 无效；房主点后 appleCounts 公开 {"pv3":1,"pv1":1,"pv2":1}；此后不能再改
```

### 踩坑

- **替换代码块时把相邻函数的文档注释一起吃掉了**：用 `saveState/broadcastState` 这段
  在文件里重复出现的代码当锚点，`old_string` 里带了下一行注释而 `new_string` 没带，
  结果 `handleAIHint` 的 `/** 复盘：AI 辅助提示 */` 被删。是 `grep -B 3` 复查时发现的。
  **高重复度的锚点必须连带复查前后文**，不能只看 Edit 返回成功。

## Phase 3：面板 UI —— ⬜ 未开始 ← **下一步从这里接**

`ended` 阶段现有的"回答卡"改成面板：上半区汤面 + 汤底，下半区 🍎 网格 + 观众小红花区。
**不阻塞「返回大厅」**。

Phase 2 已经把要用的数据都下发好了，前端直接取：
`game.myApples` / `game.myFlowers` / `game.appleQuota` / `game.appleCounts`（未关闭时为 null）/
`game.flowerCounts` / `game.votingClosed` / `game.votingComplete` / `game.voted` / `game.voters`。

前端还需要补的（Phase 2 未做）：
- `protocol.js` 的三个 `SEND_*` 常量已在，但 `gameStore` 还**没有**对应的 action
  （`giveApple` / `giveFlower` / `closeVoting`），`hydrate()` 也还没有把上面那些字段
  写进 store —— 这两件是 Phase 3 的第一步。


## Phase 3：面板 UI —— ⬜ 未开始

`ended` 阶段现有的"回答卡"改成面板（上半区汤面+汤底，下半区 🍎 网格 + 观众小红花），
**不阻塞「返回大厅」**。

## Phase 4–5：历史 🍎 —— ⏸️ 用户决定本轮不做

用户拍板"历史 🍎 先不做"，所以先只做房间内投票、不出现任何分数列。
真要做时前置是 Phase 4（先证明 auth 的 v2 上报在生产能落行——见 `findings.md` 第 3、6 节）。
