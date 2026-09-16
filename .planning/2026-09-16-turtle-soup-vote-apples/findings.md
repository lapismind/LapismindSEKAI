# Findings：海龟汤投票（🍎）的前置核查

> 目的：在动手前把"会改变实现"的事实查实。每条都是实测，不是引用文档。

## 1. 游戏结构：一局 = 一道汤，没有"轮"

```
src/worker/soupRoom.js:720-736  初始 state
  players: [], phase: 'waiting',   // waiting | playing | ended
  mode: 'ai',                      // ai | human
  maxPlayers: 8, questionLimit: null, questionsExhausted: false,
  moderatorApplicants: [], puzzle: null, puzzleId: null, questionCount: 0,
  messages: [], pendingGuess: null, reviewNotes: [],
  winnerId: null, revealed: false
```

- `puzzle` 是**单个对象**（不是数组），一局只解一道汤。
- 三条通往 `ended` 的路径：`soupRoom.js:483`（猜中）、`:556`、`:575`（主持人揭底）。
- `viewFor()`（`:762-813`）把 `players` 与 `spectators` **分开下发**
  （`players.filter(p => !p.isSpectator)` / `players.filter(p => p.isSpectator)`），
  所以"谁有投票资格"在服务端是干净的。

**结论**：投票是**每局一次**，唯一时机是 `ended`。

## 2. AI 的入口与默认值

```
src/stores/gameStore.js:16    const mode = ref('ai')
src/stores/gameStore.js:51    mode.value = 'ai'          // resetRoom
src/worker/soupRoom.js:218    const mode = data?.mode === 'human' ? 'human' : 'ai'
src/worker/soupRoom.js:220    const minPlayers = mode === 'ai' ? 1 : MIN_PLAYERS   // MIN_PLAYERS = 2
src/worker/soupRoom.js:352    if (state.mode === 'ai' && playerCount < 1) ...
src/components/HostConfigPanel.vue:18-31   模式选择按钮（AI 主持 / 真人主持）
src/components/GameBoard.vue:19            prop default: 'ai'
src/components/MessageList.vue:8           prop default: 'ai'
src/components/DrawerPanel.vue:9           prop default: 'ai'
src/components/GameBoard.vue:137,179-186   大肥鱼头像
src/components/MessageList.vue:25          '🐟 大肥鱼'
src/components/DrawerPanel.vue:107,173 → src/views/RoomView.vue:101-104   AI 提示
src/worker/soupRoom.js:641-646             fetch(`${AI_BASE_URL}/chat/completions`)
src/ai/aiHost.js、src/ai/logicProfile.js   AI 实现（保留）
```

**结论**：只藏按钮不改默认值 = 入口没关，新房间仍走 AI。另：
`mode === 'ai'` 时 `minPlayers = 1`，即**一个人也能开一局**——这也是"AI 模式不宜计入任何累计数字"的原因。

## 3. 生产 D1 实况（决定性）

```bash
cd auth
npx wrangler d1 migrations list sekai-db --remote
# → 待应用：003_login_attempts / 004_display_name / 005_abracadawhat_match_v2
#             006_legendary_achievement_aliases / 007_player_match_reports

npx wrangler d1 execute sekai-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
# → _cf_KV, achievements, comments, d1_migrations, login_attempts,
#   match_players, matches, player_match_reports, sqlite_sequence, users

npx wrangler d1 execute sekai-db --remote --command "SELECT * FROM d1_migrations"
# → 只有 001_password_accounts.sql(2026-08-28), 002_avatar_id.sql(2026-08-28)

pragma_table_info('player_match_reports')
# → id, match_id, player_id, game, rank, score, rounds, player_count,
#   standings_json, stories_json, unlocked_keys_json, finished_at      ← 与 007 完全一致
pragma_table_info('matches')
# → id, game, room_id, rounds, finished_at, report_id, report_hash,
#   report_status, expected_players                                    ← 含 005 的 v2 字段

SELECT COUNT(*) ... →
  player_match_reports = 0        ← ★ v2 逐玩家上报从未落过一行
  matches              = 8        （全部 game='abracadawhat'，report_status='complete'，最新 2026-09-02）
  match_players        = 17       （v1 老路径，确实工作过）
  users = 9, achievements = 22
```

**读出来的三件事**：

1. **表在、账本不在。** 003–007 是手工 `d1 execute` 上的，`d1_migrations` 没记。
   两边不矛盾（表结构对得上 007/005），但意味着 **`d1 migrations apply` 不能盲跑**：
   `CREATE TABLE IF NOT EXISTS` 安全，裸 `ALTER TABLE ... ADD COLUMN` 会因重复列失败。
   要跑就先补账本基线（把 003–007 标记为已应用）。这正是 D4 那条"迁移基线未建立"。
2. **v2 上报在生产一条都没落过。** `player_match_reports` 为 0 行，`matches` 最新一条是 2026-09-02——
   而出包的故事/成就/战绩那套（A1–D3 都标"完成"）走的就是 v2。所以那套在生产上**未被证实**。
3. **海龟汤没有上报能力。** 本轮部署输出实测，其 Worker 绑定只有
   `SoupRoom`(DO) / `PuzzleLib`(DO) / `ASSETS` / `AI_BASE_URL` / `AI_MODEL`——
   **没有 D1，也没有 `MATCH_REPORT_SECRET`**。

## 4. 现成的同形先例：`reviewNotes`

```js
// src/worker/soupRoom.js:583
async function handleReviewNote(playerId, data) {
  const state = await this.getState()
  if (state.phase !== 'playing' && state.phase !== 'ended') return
  const text = String(data?.text ?? '').trim()
  if (!text || text.length > 500) return
  state.reviewNotes = state.reviewNotes ?? []
  state.reviewNotes.push({ from: playerId, text, ... })
  ...
}
```

这就是投票要的形状：**单玩家提交 → push 进 state 数组 → 广播**。DO 那一侧的工作量因此很小。
差别只在"校验规则"和"要不要在广播前隐藏中间结果"。

## 5. auth 侧的目标管道（如果要做历史 🍎）

```
POST /api/matches          （MATCH_REPORT_SECRET 校验 → sanitizeMatchReport → persistV2MatchReport）
GET  /api/match-reports    （个人页读自己的最近战报）
表：player_match_reports(id, match_id, player_id, game, rank, score, rounds,
                        player_count, standings_json, stories_json, unlocked_keys_json, finished_at)
    UNIQUE(match_id, player_id)   ← 幂等钩子已经在了
    INDEX(player_id, game, finished_at DESC, id DESC)
```

**`game TEXT NOT NULL` 说明这张表是通用的**，不是出包专用。所以海龟汤的 🍎 不需要另起一套，
加一列（或把 🍎 放进 `standings_json`）即可。**前提是这条链本身先被证明可用**（见第 3 节第 2 点）。

迁移命名接力：现有 001–007，下一个是 `008_*.sql`。
注意 `auth/migrations/README.md` 记录了 001–004 是直接 `d1 execute` 的、没有基线。

## 6. 补充核查：出包那 8 条到底是谁写的

```bash
npx wrangler d1 execute sekai-db --remote \
  --command "SELECT id, report_id, report_status, expected_players, rounds, finished_at FROM matches ORDER BY id"
# → 8 条全部 report_id = null、expected_players = 0（v2 的两列没被填），
#   时间全部落在 2026-09-01 / 09-02
```

`report_id` / `expected_players` 是迁移 005 加的 v2 列，全部为 null 说明
**这 8 条是 v1 老路径写的，v2 一条都没写过**。加上 `player_match_reports` 为 0 行，
结论收敛为两条可能，**目前无法区分**：

- (a) 自 2026-09-02 之后**没有任何人完整打过一局**出包（站点是个人项目，完全可能）；
- (b) v2 上报自上线起就在**静默失败**。

```bash
cd abracadawhat && npx wrangler secret list
# → IDENTITY_SECRET / MATCH_REPORT_SECRET / SESSION_SECRET   ← secret 是齐的
```

**secret 齐、表也在**，所以"缺配置"这条假设被排除——剩下 (a)/(b) 只能靠
**真的打一局 2 人局、看 `player_match_reports` 是否落行**来判定。这就是 D4 里
"full-chain E2E + prod acceptance"那一步，无法用看代码替代。

## 7. 顺带核到、与本方案无关但记录备查

```bash
cd turtle-soup && npx wrangler secret list
# → AI_API_KEY / SESSION_SECRET     ← 有真实的 AI key；没有 MATCH_REPORT_SECRET（符合预期）
```

- `src/worker/index.js:23` 的 `/ws` 身份校验用的是 **`SESSION_SECRET`**（不是 `IDENTITY_SECRET`，
  后者只服务 `:34` 的 legacy token 路径）。`SESSION_SECRET` 在生产**已配置**，
  所以"生产没开身份校验"这个担心不成立——查过了，不成立。
- `turtle-soup` **没有 `/api/identity` 路由**（`index.js` 只注册了 `/ws` 和 `/api/ping`），
  生产实测该路径返回 `404 not found`。`docs/agent/deploy.md` 第四节写的
  "三个游戏 `/api/identity` 返回 500" 并不适用于海龟汤——那份文档这一条需要更正（待办）。
