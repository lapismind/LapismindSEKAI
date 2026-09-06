# 出包魔法师故事进程实施计划

> 对应已确认设计：`docs/superpowers/specs/2026-09-06-abracadawhat-story-progression-design.md`
> 实施方法：严格 TDD；每个 Task 先看到预期 RED，再写最小实现到 GREEN，最后仅做保持绿色的整理。
> 范围：Stage A-D。每个 Task 是独立审阅和提交边界，不在同一提交混入下一 Task。

## 全局约束

- 牌局事实唯一来源仍是 `abracadawhat/src/worker/abracaRoom.js` 和 `abracadawhat/src/core/rules.js`；Auth、Store、博客资料页不重新推导服务端没有证明的事实。
- 玩家可见的故事稀有度只能是 `★★★★`、`★★★`、`★★`、`★`。内部排序值 `S`、`A`、`B`、`C` 只能存在于服务端/纯规则数据中，任何游戏 UI、资料页 UI、aria-label、title、错误信息和玩家可见 JSON 展示都不得出现内部字母。
- 成就的 `difficulty` 与故事稀有度分离。成就 UI 使用“难度”，不得把人工难度称为真实稀有度。
- 新版报告使用 `schemaVersion: 2`；只按设计要求暂时兼容 `schemaVersion: 1`。不添加无依据的版本猜测、字段别名或其他通用兼容层。
- v2 报告增加服务端生成的稳定 `reportId`。D1 的 `matches.id` 仍是内部整数主键；`matches.report_id` 保存 `reportId` 并唯一约束。这样重试先定位同一场内部 `match_id`，再满足 `match_id + player_id` 幂等要求。
- 通用 `kills` 包含普通法术和古代巨龙造成的全部击杀；`dragonKills` 是 `kills` 的子集，任何层都不得相加两次。
- `facts`、`stories`、`standings`、昵称快照都来自服务端固定结构。客户端不得提交或渲染任意故事文案。
- 游客可接收当前 `game_over` 故事和新成就广播；最近战报只对 `users.player_id` 中存在的持久账号落库。游客清浏览器后不承诺找回战报。
- Auth 上报失败不得阻止 `game_over`、关闭结算或房主使用现有“再来一局”；只显示“战报暂未保存”。
- 本计划不包含房主迁移、准备/ready 状态、重赛投票、排行榜、赛季、观战、房间加入失败治理、移动端施法区整体重排，也不创建这些功能的接口、字段或占位代码。
- 不修改或回算旧比赛中无法证明的新故事/新成就。旧数据迁移只处理已有成就解锁键和已有累计战绩。

## 统一接口

### Abracadawhat WebSocket

保持现有信封 `{ type, data }`，在 `abracadawhat/src/core/protocol.js` 增加：

```js
Msg.RCV_MATCH_REPORT_STATUS = 'match_report_status'
```

`game_over` 的 v2 `data`：

```js
{
  reportId,
  winnerId,
  standings,
  stories,
  reportStatus: 'saving'
}
```

异步结果：

```js
// achievements_unlocked
{ reportId, achievements: [] }

// match_report_status
{ reportId, saved: true }
// 或
{ reportId, saved: false, message: '战报暂未保存' }
```

Store 只合并与当前 `lastGameOver.reportId` 相同的异步消息，防止上一场迟到的 Auth 响应污染下一场。

### Auth POST `/api/matches`

v1 保持当前 `players` 协议；缺省 `schemaVersion` 按 v1 处理。v2 固定为：

```js
{
  schemaVersion: 2,
  reportId: 'abracadawhat:<uuid>',
  game: 'abracadawhat',
  roomId: 'ABC123',
  startedAt: '2026-09-06T00:00:00.000Z',
  finishedAt: '2026-09-06T00:20:00.000Z',
  rounds: 5,
  standings: [{
    playerId,
    nickname,
    rank,
    score,
    scoreBySource: { roundWinPoints, survivalPoints, secretPoints },
    spellCounts,
    kills,
    dragonKills,
    deaths,
    suicides,
    roundWins,
    roundWinsByReason: { kill, all_spells },
    maxTurnCastCount,
    maxTurnDistinctSpells
  }],
  facts: [],
  stories: []
}
```

成功响应始终至少包含：

```js
{ ok: true, matchId, reportId, savedReports: [], newAchievements: [] }
```

### Auth 查询

- 继续使用 `GET /api/achievements`，兼容原有 `achievements`、`unlockedCount`、`total`，新增顶层 `career`。
- 新增 `GET /api/match-reports?game=abracadawhat&limit=10`，返回 `{ ok: true, persistent, reports }`；`limit` 最大 10。
- `packages/lobby-kit/src/auth.js` 保留 `getAchievements()`，使其透传新增 `career`；新增 `getMatchReports(game = 'abracadawhat', limit = 10)`。

### 纯故事模块

新增 `abracadawhat/src/core/story.js`，公开且只公开：

```js
export const STORY_TIERS = ['S', 'A', 'B', 'C']
export function selectMatchStories(facts, limit = 3) {}
```

`selectMatchStories` 输入固定 key 的事实，输出 `{ key, playerId, tier, data }[]`；确定性排序、同类去重、最多三条，不补低价值占位。玩家可见星级映射由前端固定函数处理，不从服务端接收显示文案。

## 测试纪律

- 每个 Task 的 RED 必须是断言失败，而不是导入错误、语法错误或假 D1 不支持 SQL 的测试脚手架错误。
- RED 失败信息必须对应该 Task 缺失的行为；若测试直接通过，先修测试，使其能证明旧行为不满足设计。
- GREEN 先跑该 Task 的聚焦命令，再跑受影响子项目全量门禁。
- `abracadawhat/npm test` 含构建产物表情测试。遵守已知教训：先 `npm run build`，再 `npm test`，不得与构建并行。
- Auth 测试统一由 `node --test` 执行 `tests/*.test.mjs`；Stage A 首次提交同步修正 `auth/package.json` 的 `test` 脚本，避免只跑 `worker.test.mjs` 而漏掉成就/报告测试。
- Blog 每次至少跑 `npm run check`、`npm run lint`、`npm run build`；新增 Node 单测后由 `npm test` 执行。浏览器验收使用 Python 3.13 Playwright。

---

## Stage A：正确性与关键 UX 修复

### Task A1：锁定 v1 上报清洗并统一击杀口径

**文件**

- 新建：`auth/tests/match-reports.test.mjs`
- 修改：`auth/tests/worker.test.mjs`
- 修改：`auth/package.json`
- 新建：`auth/src/matchReports.js`
- 修改：`auth/src/index.js`
- 修改：`abracadawhat/tests/rules.test.mjs`
- 修改：`abracadawhat/tests/worker-auth.test.mjs`
- 修改：`abracadawhat/src/worker/abracaRoom.js`

**接口与行为**

- 在 `auth/src/matchReports.js` 新增纯函数 `sanitizeMatchReport(body)`；本 Task 先覆盖 v1，并返回 `{ ok: true, version: 1, report }` 或 `{ ok: false, error }`。
- v1 `report.players[]` 必须保留 Worker 已在发送、但当前 Auth 丢弃的字段：`castStreaks`、`turnSpellSets`、`killedHighHpTarget`、`singleCastMultiKillNonDragon`、`firstTurnDragon3`、`comebackFromBehind`、`roundWonNoSecrets`、`hadLowThenFullThenDied`、`castOwlThisMatch`，以及当前已保留字段。
- 清洗器限制玩家数 2-5、`playerId` 64 字符、昵称 64 字符、魔法 id 1-8、非负整数上限；拒绝非 `abracadawhat` 的 v2 形状，不在本 Task 猜测其他游戏字段。
- `abracaRoom.doCast()` 对所有击杀执行 `ms.kills += killsThisCast`；若 `spellId === 1` 再执行 `ms.dragonKills += killsThisCast`，删除当前普通/巨龙互斥统计。

**TDD**

1. RED：在 `auth/tests/match-reports.test.mjs` 写 v1 完整字段清洗测试，证明当前内联 `postMatch` 丢字段；在 `abracadawhat/tests/worker-auth.test.mjs` 通过真实 `AbracaRoom.doCast()` 写“巨龙三杀得到 `kills === 3` 且 `dragonKills === 3`”。
2. 运行：`node --test auth/tests/match-reports.test.mjs`；预期因 `sanitizeMatchReport`/字段保留不存在而 RED。
3. 运行：`node --test abracadawhat/tests/worker-auth.test.mjs`；新增 Worker 统计断言预期因巨龙不进入 `kills` 而 RED。
4. GREEN：提取清洗器并让 `postMatch()` 使用清洗结果；修改击杀累计最小逻辑。
5. 聚焦复跑上述两条命令；预期 GREEN。
6. 全量：在 `auth/` 运行 `npm test`；在 `abracadawhat/` 运行 `npm run build` 后运行 `npm test`；预期全部 GREEN。

**提交边界**

`fix(abracadawhat): preserve match facts and count dragon kills`

### Task A2：停用不可达/坏激励旧成就，并清理跨局新成就残留

**文件**

- 修改：`auth/tests/achievements.test.mjs`
- 修改：`auth/src/achievements.js`
- 修改：`abracadawhat/tests/game-store.test.mjs`
- 修改：`abracadawhat/src/stores/gameStore.js`

**接口与行为**

- 先为定义增加 `status`，本 Task 只把 `egg_social_death`、`dragon_clown` 标为 `legacy`，其余现有定义暂时显式保持 `active`，并确保 `evaluateAchievements()` 不执行 `legacy` 检查。
- 已解锁记录仍由后续资料页迁移展示；本 Task 不删除 D1 行。
- `game.startRound()`、`game.rematch()` 发送新比赛动作前清空 `newAchievements`、旧报告状态和旧 `lastGameOver`；收到第 1 轮 `playing` 状态时再做一次幂等清理。

**TDD**

1. RED：把现有“奶龙大王应触发”测试改为“不再触发”；新增 `maxFailsInRound >= 3` 也不触发“社死现场”的反例。
2. RED：在 Store 测试先发成就广播，再调用 `startRound()`/`rematch()`，断言数组清空；当前实现应失败。
3. 运行：`node --test auth/tests/achievements.test.mjs` 和 `node --test abracadawhat/tests/game-store.test.mjs`；预期对应断言 RED。
4. GREEN：最小加入状态过滤和 Store 重置。
5. 全量运行 `auth/npm test`；`abracadawhat/npm run build` 后 `npm test`；预期 GREEN。

**提交边界**

`fix(achievements): retire impossible and harmful triggers`

### Task A3：修正规则、猫头鹰反馈和手机魔法效果

**文件**

- 修改：`abracadawhat/tests/rules.test.mjs`
- 修改：`abracadawhat/tests/ui-regressions.test.mjs`
- 修改：`abracadawhat/src/core/rules.js`
- 修改：`abracadawhat/src/components/GameHelp.vue`
- 修改：`abracadawhat/src/components/CastFeedback.vue`
- 修改：`abracadawhat/src/components/SpellCard.vue`
- 修改：`abracadawhat/src/components/PublicArea.vue`

**接口与行为**

- `applyCast()` 的成功事件继续使用现有 `secretTaken`；猫头鹰在秘密牌堆为空时必须返回 `secretTaken: null`，`CastFeedback.vue` 只在 `secretTaken != null` 时显示“获得秘密牌”。
- `GameHelp.vue` 把“没有这张牌则失败扣血，回合结束”改为真实规则：失败扣血后留在当前行动，不能继续施法，只能结束行动并补牌。
- `SpellCard.vue` 和 `PublicArea.vue` 不再以 `title` 作为唯一效果入口。增加可聚焦/可点击的效果按钮或展开区，拥有明确 `aria-expanded`、键盘操作和至少 44px 手机触控目标；`title` 可保留为桌面补充但不是唯一信息源。

**TDD**

1. 先增加“秘密牌堆为空时成功猫头鹰的 `secretTaken === null`”规则特征测试；预期现有规则 GREEN，用于锁定服务端事件接口不被 UI 修复改坏。
2. RED：在 `ui-regressions.test.mjs` 断言 `CastFeedback.vue` 只在 `secretTaken != null` 时显示获得提示、帮助文案不再包含“失败…回合结束”，并断言两个魔法展示组件存在非 `title` 的效果内容与 aria 控制。
3. 运行：`node --test abracadawhat/tests/rules.test.mjs abracadawhat/tests/ui-regressions.test.mjs`；预期规则特征测试 GREEN，三个 UI 行为断言 RED。
4. GREEN：只改反馈条件、帮助文案和效果展开交互。
5. 在 `abracadawhat/` 运行 `npm run build`、`npm test`；预期 GREEN。
6. 浏览器回归：扩展项目现有 Python 3.13 Playwright 验证，手机视口点击魔法效果后能读到说明，空秘密牌堆不出现获得提示。

**提交边界**

`fix(abracadawhat): correct rules and mobile spell feedback`

### Task A4：常驻目标分与可关闭后仍可用的重赛入口

**文件**

- 修改：`abracadawhat/tests/ui-regressions.test.mjs`
- 修改：`abracadawhat/tests/game-store.test.mjs`
- 修改：`abracadawhat/src/components/PublicArea.vue`
- 修改：`abracadawhat/src/views/RoomView.vue`
- 修改：`abracadawhat/src/stores/gameStore.js`

**接口与行为**

- `PublicArea.vue` 新增必传/默认值为 8 的 `targetScore` prop，并对每名玩家显示 `还差 Math.max(0, targetScore - score) 分`；“先到 8 分”在比赛中和轮结算中常驻可见。
- 保留现有房主 `game.rematch()`；关闭比赛结算详情只隐藏详情，不清除执行重赛所需的比赛结束状态。
- `RoomView.vue` 在详情关闭后仍显示常驻结算操作条：房主“再来一局”，非房主“等待房主再来一局”，以及返回大厅入口。不得加入投票。
- Store 将“详情是否打开”与 `lastGameOver` 数据分离，例如新增 `gameOverOpen`，`clearGameOver()` 只关闭详情；真正开新场时才清数据。

**TDD**

1. RED：Store 测试接收 `game_over`、调用 `clearGameOver()` 后断言 `lastGameOver` 仍存在且 `gameOverOpen === false`；当前实现应失败。
2. RED：UI 源码回归断言 `target-score`/距离文案和详情外重赛操作条存在。
3. 运行：`node --test abracadawhat/tests/game-store.test.mjs abracadawhat/tests/ui-regressions.test.mjs`；预期 RED。
4. GREEN：拆分显示状态并增加常驻目标/操作条。
5. 在 `abracadawhat/` 运行 `npm run build`、`npm test`；预期 GREEN。
6. Playwright：关闭详情后房主按钮仍可点击并发送现有 `rematch`，非房主看不到可执行按钮。

**提交边界**

`fix(abracadawhat): keep score goal and rematch accessible`

---

## Stage B：服务端事实、故事引擎与结算复盘

### Task B1：落地 schema v2、稳定 reportId 与幂等比赛写入

**文件**

- 新建：`auth/migrations/005_abracadawhat_match_v2.sql`
- 修改：`auth/schema.sql`
- 修改：`auth/tests/match-reports.test.mjs`
- 修改：`auth/tests/worker.test.mjs`
- 修改：`auth/src/matchReports.js`
- 修改：`auth/src/index.js`
- 修改：`abracadawhat/tests/worker-auth.test.mjs`
- 修改：`abracadawhat/src/worker/abracaRoom.js`

**迁移 005**

- `ALTER TABLE matches ADD COLUMN report_id TEXT;`
- `CREATE UNIQUE INDEX idx_matches_report_id ON matches(report_id) WHERE report_id IS NOT NULL;`
- `CREATE UNIQUE INDEX idx_match_players_match_player ON match_players(match_id, player_id);`
- 给 `match_players` 增加：`dragon_kills`、`round_wins`、`round_win_points`、`survival_points`、`secret_points`、`round_wins_by_reason`、`max_turn_cast_count`、`max_turn_distinct_spells`，均用可迁移的非空默认值；同步写入 `schema.sql`。
- 旧行 `report_id` 为 `NULL`，不伪造稳定 id；新字段默认为 0/`'{}'`，旧累计仍可查询。

**接口与行为**

- `hostStart()` 每场生成一次 `reportId = 'abracadawhat:' + crypto.randomUUID()` 并存入 `state.matchStats.reportId`，重连/休眠不变，重赛生成新值。
- `sanitizeMatchReport()` 增加严格 v2 分支，白名单 `standings`、`facts`、`stories`；未知 key、越界数组、无效 tier、非 2-5 人、重复 rank/playerId、`dragonKills > kills` 返回 400。
- `postMatch()` 对 v2 先按 `report_id` 查/插入 `matches`，再按 `(match_id, player_id)` 幂等写玩家行。重复同一 `reportId` 返回同一 `matchId`，不重复累计；v1 继续走现有新建 match 行路径。

**TDD**

1. RED：纯清洗测试覆盖合法 v2、非法 tier/key/range、`dragonKills > kills`。
2. RED：Worker 假 D1 增加两次 POST 同一 `reportId`，断言相同 `matchId` 且每玩家只有一行；当前实现会重复创建。
3. RED：Abracadawhat Worker 测试断言同场 `buildMatchReport()` 输出稳定 `schemaVersion: 2` 和 `reportId`，重赛变化。
4. 运行：`node --test auth/tests/match-reports.test.mjs auth/tests/worker.test.mjs`、`node --test abracadawhat/tests/worker-auth.test.mjs`；预期行为断言 RED。
5. GREEN：执行迁移对应代码、v2 清洗、幂等写入和 reportId 生成。
6. 本地 D1 验证：在 `auth/` 运行 `npx wrangler d1 execute sekai-db --local --file=./migrations/005_abracadawhat_match_v2.sql`；随后查询 `PRAGMA table_info(matches)`、`PRAGMA table_info(match_players)` 和索引，预期字段/唯一索引存在。
7. 全量 Auth/Abracadawhat 测试 GREEN。

**提交边界**

`feat(auth): accept idempotent abracadawhat v2 reports`

### Task B2：记录轮次事实、得分来源和行动统计

**文件**

- 修改：`abracadawhat/tests/rules.test.mjs`
- 新建：`abracadawhat/tests/match-facts.test.mjs`
- 修改：`abracadawhat/src/core/rules.js`
- 修改：`abracadawhat/src/worker/abracaRoom.js`

**接口与行为**

- `finishRound()` 的每个 `summary.standings[]` 保留现有 `gained`，新增：

```js
scoreBySource: { roundWinPoints, survivalPoints, secretPoints }
```

- `summary` 新增 `decisiveSpellId`；结束原因仍固定为 `kill | all_spells | self_destruct`。
- `beginRound()` 保存仅用于当前轮结算的起手快照；`publicState()` 仅在 `round_end` 向对应本人提供 `startingHand`，不进入 Auth 报告。
- `matchStats.players[playerId]` 记录 `roundWins`、`roundWinsByReason`、`maxTurnCastCount`、`maxTurnDistinctSpells`，并正确关联“一次行动连续成功至少四次且清空手牌”。
- `matchStats.facts` 只写固定事实 key：`turn_distinct_spells`、`turn_clear_streak`、`all_spell_types`、`round_win_low_hp`、`low_hp_kill`、`multi_kill_non_dragon`、`dragon_multi_kill`、`comeback_win`、`survivor_secret_stack`、`round_win_routes`、`voluntary_stop`。每条带足够的 round/spell/hp/player/score 数据，不带任意文字。
- “秘密投资人”检查所有轮末幸存者，不只赢家。

**TDD**

1. RED：规则测试分别断言击杀、清空手牌、自爆的三项得分拆分和 `gained` 总和。
2. RED：`match-facts.test.mjs` 通过可控状态调用真实 `AbracaRoom.doCast()`/`doEndTurn()`，覆盖行动计数、起手快照、1 血击杀的受击前血量、非龙双杀、龙三杀、所有幸存者秘密牌、两种轮胜路线。
3. 运行：`node --test abracadawhat/tests/rules.test.mjs abracadawhat/tests/match-facts.test.mjs`；预期新增字段缺失而 RED。
4. GREEN：最小扩展规则 summary 和 DO 累积器；不得把故事选择写进 DO。
5. 在 `abracadawhat/` 运行 `npm run build`、`npm test`；预期 GREEN。

**提交边界**

`feat(abracadawhat): capture authoritative match facts`

### Task B3：实现确定性的故事选择引擎

**文件**

- 新建：`abracadawhat/src/core/story.js`
- 新建：`abracadawhat/tests/story.test.mjs`

**接口与行为**

- 实现统一接口中的 `STORY_TIERS`、`selectMatchStories(facts, limit = 3)`。
- 固定故事 key 至少覆盖设计中的：`comeback_win`、`dragon_multi_kill`、`low_hp_kill`、`turn_clear_streak`、`secret_score`、`round_win_routes`、`all_spell_types`、`voluntary_stop`。
- 内部优先级 S>A>B>C；同 tier 使用固定 key 顺序，再用 `playerId` 和 round 作稳定排序，保证同一输入同一输出。
- 同类去重保留结构化数据更完整/数值更高的一条；无有效高价值事实时允许返回 0-2 条。
- 输出拷贝白名单数据，丢弃多余字段；不得输出 `text`、`name`、`description` 等客户端可控文案。

**TDD**

1. RED：单测覆盖每个故事 key 的成功和反例、S/A/B/C 排序、最多 3 条、同类去重、数据不完整丢弃、输入不变性、重复调用深相等。
2. 运行：`node --test abracadawhat/tests/story.test.mjs`；预期模块不存在/行为缺失。先补最小导出使测试进入真正断言 RED，再继续实现。
3. GREEN：用静态规则表实现选择，不引入 Vue、DOM、WebSocket、D1 或随机数。
4. 运行聚焦测试和 Abracadawhat 全量门禁；预期 GREEN。

**提交边界**

`feat(abracadawhat): select structured match stories`

### Task B4：在 game_over 立即发送故事，并异步合并 Auth 结果

**文件**

- 修改：`abracadawhat/tests/worker-auth.test.mjs`
- 修改：`abracadawhat/tests/game-store.test.mjs`
- 修改：`abracadawhat/src/core/protocol.js`
- 修改：`abracadawhat/src/worker/abracaRoom.js`
- 修改：`abracadawhat/src/stores/gameStore.js`

**接口与行为**

- `startNextRound()` 在存储状态后、调用 Auth 前，用 `selectMatchStories(state.matchStats.facts)` 生成故事并立即广播统一接口中的 `game_over`。
- `reportMatch(payload)` 成功时广播带 `reportId` 的 `achievements_unlocked` 和 `match_report_status { saved: true }`；HTTP 非 2xx、JSON 无效和 fetch 异常都记录 `console.error` 并广播失败状态。
- Store 新增 `matchReportStatus`，只接收与当前 `lastGameOver.reportId` 相同的异步结果；旧场迟到结果被忽略。
- Auth 成功但 `savedReports` 为空仍代表报告主事务成功；`saved: true` 不等于每个玩家都有最近战报。

**TDD**

1. RED：Worker 测试用 pending fetch 证明 `game_over` 在 Auth Promise resolve 前已经广播且带 stories。
2. RED：分别模拟 200、500、网络异常，断言状态消息和错误日志；游戏结束/`waitUntil` 均不被拒绝。
3. RED：Store 先进入 report A，随后接收 report B 的成就/状态，断言不污染 A；当前实现无 reportId 过滤。
4. 运行聚焦测试；预期 RED。
5. GREEN：增加协议常量、带 id 的广播和 Store 过滤。
6. Abracadawhat 全量门禁 GREEN。

**提交边界**

`feat(abracadawhat): deliver stories before auth persistence`

### Task B5：升级回合结算和比赛复盘 UI

**文件**

- 新建：`abracadawhat/src/core/storyPresentation.js`
- 新建：`abracadawhat/tests/story-presentation.test.mjs`
- 修改：`abracadawhat/tests/ui-regressions.test.mjs`
- 修改：`abracadawhat/src/views/RoomView.vue`
- 修改：`abracadawhat/src/components/PlayerZone.vue`

**接口与行为**

- `storyPresentation.js` 导出 `storyStars(tier)` 和 `formatStory(story, context)`；`storyStars` 仅返回四种可见星串，非法 tier 返回 `null`；`formatStory` 仅处理固定 key 并从上下文解析玩家/魔法名称。
- 回合结束按设计顺序展示：赢家、决定性魔法、结束原因；每人三项得分拆分；公开牌；当前玩家 `startingHand` 摘要；当前比分/目标/距离；现有房主下一轮操作。
- 比赛结束展示冠军/排名、每人比分/轮胜/关键统计、最多 3 张故事、最多突出 2 个新成就其余折叠、再来一局主操作、完整统计和返回大厅次操作。
- `matchReportStatus.saved === false` 显示一次“战报暂未保存”，不禁用任何按钮。
- Story DOM 和可访问名称只能出现 `★★★★`/`★★★`/`★★`/`★`，不得插值 `story.tier`。

**TDD**

1. RED：纯展示测试覆盖所有 tier 映射和固定故事中文格式，断言输出不含 `/\b[ＳSＡAＢBＣC]\b/`。
2. RED：UI 回归断言回合结束三种原因、得分拆分、起手摘要、故事区、新成就折叠和失败提示存在。
3. 运行：`node --test abracadawhat/tests/story-presentation.test.mjs abracadawhat/tests/ui-regressions.test.mjs`；预期 RED。
4. GREEN：实现固定 renderer 和结算结构；不接受服务端任意文案。
5. `npm run build`、`npm test` GREEN。
6. Playwright 桌面/手机验收：故事最多 3 张；DOM 全文不出现内部 tier；关闭详情后重赛仍可用。

**提交边界**

`feat(abracadawhat): add round and match recaps`

---

## Stage C：传奇成就、法师档案与旧版迁移

### Task C1：定义 10 个传奇成就和旧版展示状态

**文件**

- 修改：`auth/tests/achievements.test.mjs`
- 修改：`auth/src/achievements.js`
- 修改：`auth/src/index.js`

**接口与行为**

- 活跃 key 固定为：`magic_staircase`、`one_breath`、`eight_facets`、`last_breath`、`weak_over_strong`、`pincer_finish`、`dragon_sweep`、`refuse_ending`、`secret_investor`、`different_paths`。
- 定义字段固定为 `{ key, game, name, desc, difficulty, status }`；`difficulty` 1-4，`status` 为 `active | legacy | hidden`。
- `evaluateAchievements()` 只遍历可触发定义：10 个 `active` 传奇成就，以及未来明确标为 `hidden` 的触发项；本次不擅自把任何一个已命名的 10 个传奇成就改成隐藏。候选替补不加入定义，不预留 checker。
- 所有旧 key 仍保留定义元数据并标为 `legacy`，使已解锁玩家能看到“旧版纪念”；未解锁玩家不收到这些目录项。不得只保留数据库行却丢失名称/描述。
- `GET /api/achievements`：active 全量返回；legacy 仅已解锁返回并带 `legacy: true`；hidden 未解锁时返回 `{ key, status: 'hidden', unlocked: false, name: '？？？', desc: '？？？' }`，已解锁本人返回真实内容。
- 保留 `stars` 响应字段一个发布周期作为现有博客 UI 的过渡别名，值等于 `difficulty`；新 UI 只读 `difficulty`。这是当前已发布消费者所需的具体兼容，后续另开删除任务，不扩展其他别名。

**TDD**

1. RED：断言 active 恰好 10 个且 key 集合完全相等；累计成就、坏激励成就和候选替补均不 active。
2. RED：Auth API 测试覆盖未解锁 legacy 不返回、已解锁 legacy 返回、hidden 锁定不泄露、hidden 解锁后可见。
3. 运行 `node --test auth/tests/achievements.test.mjs auth/tests/worker.test.mjs`；预期 RED。
4. GREEN：重塑定义和 API 投影，不在此 Task 完成所有 checker。
5. Auth 全量测试 GREEN。

**提交边界**

`feat(auth): define legendary achievement catalog`

### Task C2：以事实驱动完成 10 个传奇成就判定

**文件**

- 修改：`auth/tests/achievements.test.mjs`
- 修改：`auth/src/achievements.js`

**接口与行为**

- `evaluateAchievements(report)` 改为以 v2 `facts` 和 `standings` 为主；只在 v1 兼容路径使用清洗后的旧玩家统计。
- 十个条件逐一对应设计，不从昵称、客户端文案或累计 career 猜测单场事实。
- `eight_facets` 读取同场 `spellCounts` 的 1-8；`last_breath`、`weak_over_strong` 等读取对应服务端事实；`different_paths` 读取 `roundWinsByReason.kill >= 1 && all_spells >= 1`。
- 每次返回仍为 `{ playerId, key }[]`；不在纯函数内访问 D1。

**TDD**

1. RED：每个成就至少一条成功和一条边界反例，共至少 20 个独立测试；特别覆盖 2 种而非 3 种魔法、3 次而非 4 次连放、目标受击前 2 血、巨龙仅 2 杀、秘密牌持有者死亡、只有一种轮胜路线。
2. RED：断言 `dragon_clown`、`egg_social_death` 永远不从新报告触发。
3. 运行聚焦测试，预期缺 checker/旧条件 RED。
4. GREEN：最小规则表实现，并保持单条 checker 异常不拖垮整场的现有容错。
5. Auth 全量测试 GREEN。

**提交边界**

`feat(auth): unlock ten fact-based legendary achievements`

### Task C3：迁移可证明的旧解锁并提供法师档案

**文件**

- 新建：`auth/migrations/006_legendary_achievement_aliases.sql`
- 修改：`auth/tests/worker.test.mjs`
- 修改：`auth/src/index.js`
- 修改：`auth/schema.sql`（仅记录迁移注释/最终结构一致性；不重写历史数据）

**迁移 006**

- 使用 `INSERT OR IGNORE INTO achievements (...) SELECT ... FROM achievements WHERE achievement_key = ...` 复制以下可证明的旧解锁：
- `elemental -> magic_staircase`
- `comeback -> weak_over_strong`
- `double_kill -> pincer_finish`
- `dragon_triple_one -> dragon_sweep`
- `not_approved -> refuse_ending`
- `secret_rich -> secret_investor`
- `last_breath` 保持原 key，无复制。
- 不把累计 `spell_collector` 迁到单场 `eight_facets`；不补发 `one_breath`、`different_paths`；旧键行不删除，以保留审计历史，但 API 按新定义/legacy 规则投影。

**法师档案接口**

`GET /api/achievements` 顶层新增：

```js
career: {
  matchesCompleted,
  championships,
  roundWins,
  totalCasts,
  spellCounts,
  kills,
  dragonKills,
  deaths,
  suicides,
  favoriteSpellId,
  spellTypesUsed,
  maxTurnCastCount,
  roundWinsByReason
}
```

- `computeCareer()` 从完整 `match_players` 历史汇总，不从最近十场倒算。
- favorite tie-break 固定取较小 `spellId`，空历史为 `null`。

**TDD**

1. RED：用本地临时 D1 或 migration fixture 执行 006 两次，断言幂等、映射正确、未映射键不补发。
2. RED：Worker 假 D1 造两场含龙击杀/轮胜方式/行动峰值的数据，断言 career 精确汇总且 `kills` 未重复加 `dragonKills`。
3. 运行 Auth 聚焦测试，预期 career 缺失/迁移未执行而 RED。
4. GREEN：实现 SQL 汇总和响应。
5. 本地执行 `005` 后执行 `006` 两次，查询 achievements 无重复。
6. Auth 全量测试 GREEN。

**提交边界**

`feat(auth): migrate legacy unlocks and expose career stats`

### Task C4：资料页展示传奇成就、法师档案和旧版纪念

**文件**

- 新建：`blog/src/lib/abracadawhatProgression.js`
- 新建：`blog/tests/profile-progression.test.mjs`
- 修改：`blog/package.json`
- 修改：`blog/src/pages/profile.astro`
- 修改：`packages/lobby-kit/tests/auth.test.mjs`
- 修改：`packages/lobby-kit/src/auth.js`

**接口与行为**

- `getAchievements()` 透传 `career`，保持现有返回字段。
- `abracadawhatProgression.js` 导出 `buildAchievementSections(achievements)` 和 `buildCareerRows(career)`，只做展示模型，不重新计算成就。
- 资料页分区：传奇成就、法师档案、旧版纪念。active 锁定可见；legacy 只展示 API 已返回的已解锁项；hidden 内容严格使用 API 返回值，不在前端内置秘密名称。
- 成就标签写“难度 ★…”；不出现“稀有度”或故事内部 tier。
- 游客提示修正为：当前局可看故事，但最近战报仅持久账号跨设备保存；不得继续声称所有游客战绩都可可靠找回。

**TDD**

1. RED：lobby-kit 测试断言 career 透传。
2. RED：Blog 纯函数测试覆盖 active/legacy/hidden 分组、法师档案空态、favorite tie 结果展示和无内部 tier 泄漏。
3. 运行：`node --test packages/lobby-kit/tests/auth.test.mjs`；在 `blog/` 运行 `node --test tests/profile-progression.test.mjs`；预期 RED。
4. GREEN：实现客户端透传、展示模型和页面分区。
5. 全量：`packages/lobby-kit/npm test`；`blog/npm test`、`npm run check`、`npm run lint`、`npm run build`；预期 GREEN。
6. Playwright 登录/游客各验证一次隐藏内容和旧版纪念可见性。

**提交边界**

`feat(profile): show legendary achievements and wizard career`

---

## Stage D：最近 10 场战报与资料页

### Task D1：创建最近战报表并实现幂等保存/保留策略

**文件**

- 新建：`auth/migrations/007_player_match_reports.sql`
- 修改：`auth/schema.sql`
- 新建：`auth/tests/match-report-storage.test.mjs`
- 修改：`auth/tests/worker.test.mjs`
- 修改：`auth/src/index.js`

**迁移 007**

```sql
CREATE TABLE IF NOT EXISTS player_match_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL,
  game TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  rounds INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  standings_json TEXT NOT NULL,
  stories_json TEXT NOT NULL,
  unlocked_keys_json TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  UNIQUE(match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_player_match_reports_recent
  ON player_match_reports(player_id, game, finished_at DESC, id DESC);
```

同步最终结构到 `schema.sql`。

**接口与行为**

- `postMatch()` 在成就 `INSERT OR IGNORE` 后按玩家整理当场 `newAchievements`，只为 `users.player_id` 中存在的玩家写报告。
- 每条报告只保存该玩家最多 3 条故事、全场排名昵称快照和当场新解锁 key；不保存聊天、表情、IP、设备、手牌或逐步行动。
- 同一 `(match_id, player_id)` 使用 `INSERT ... ON CONFLICT DO UPDATE` 或等价幂等写法，重试不得新增行或重复解锁。
- 重试时不得用空的本次 `newAchievements` 覆盖首次保存的 `unlocked_keys_json`；已存在报告保留首次解锁 key，POST 重试响应的 `newAchievements` 仍为空。
- 每次写入后按 `finished_at DESC, id DESC` 保留该玩家该游戏前 10 条，删除第 11 条及更旧记录。
- POST 响应 `savedReports` 是实际成功落库的 playerId 数组；游客不在数组中。

**TDD**

1. RED：存储测试覆盖持久账号保存、游客跳过、同场重试一条、11 场只留 10、不同游戏独立保留、JSON 无禁止字段。
2. 运行 `node --test auth/tests/match-report-storage.test.mjs auth/tests/worker.test.mjs`；预期表/保存逻辑缺失而 RED。
3. GREEN：实现最小事务顺序和保留删除。
4. 本地 D1 依次执行 005、006、007；再次执行 007 必须安全（`IF NOT EXISTS`）；检查唯一约束和索引。
5. Auth 全量测试 GREEN。

**提交边界**

`feat(auth): persist ten recent abracadawhat reports`

### Task D2：提供战报查询接口和 lobby-kit 客户端

**文件**

- 修改：`auth/tests/worker.test.mjs`
- 修改：`auth/src/index.js`
- 修改：`packages/lobby-kit/tests/auth.test.mjs`
- 修改：`packages/lobby-kit/src/auth.js`

**接口与行为**

- 路由新增 `GET /api/match-reports`。
- 未登录返回 401；游客会话返回 200 `{ ok: true, persistent: false, reports: [] }`；GitHub/账号返回自己的数据，不接受 `playerId` 查询参数。
- `game` 白名单首版只允许 `abracadawhat`；`limit` 缺省 10、范围 1-10；排序 `finished_at DESC, id DESC`。
- 响应报告字段固定为 `{ matchId, game, rank, score, rounds, playerCount, standings, stories, unlockedKeys, finishedAt }`，JSON 解析失败时跳过损坏行并记录错误，不返回任意数据库列。
- lobby-kit `getMatchReports(game, limit)` 使用 cookie，校验 `reports` 数组，并透传 `persistent`。

**TDD**

1. RED：Auth 测试覆盖匿名/游客/账号、limit、排序、不能越权传 playerId、损坏 JSON 行。
2. RED：lobby-kit 测试覆盖 URL、credentials、成功和坏响应。
3. 运行对应聚焦测试；预期 RED。
4. GREEN：实现路由和客户端方法。
5. Auth 与 lobby-kit 全量测试 GREEN。

**提交边界**

`feat(auth): expose recent match reports`

### Task D3：资料页渲染最近 10 场个人战报

**文件**

- 修改：`blog/src/lib/abracadawhatProgression.js`
- 修改：`blog/tests/profile-progression.test.mjs`
- 修改：`blog/src/pages/profile.astro`
- 修改：`blog/tests/ui_ux_regression_v2.py`

**接口与行为**

- 页面在身份/成就加载后并行调用 `auth.getMatchReports('abracadawhat', 10)`；失败只隐藏战报区或显示局部重试，不让整个资料页进入 error。
- `buildReportCards(reports)` 只使用 Auth 返回数据，按日期展示人数、轮数、名次、比分、全场昵称/排名快照、当前玩家故事和当场新成就。
- Blog 增加固定故事 key renderer；星级映射只能输出 `★★★★`/`★★★`/`★★`/`★`，不显示 tier 字母，不使用服务端任意文案。
- 持久账号无记录显示明确空态；游客显示“游客当前局可看故事，最近战报需登录后保存”，不生成伪报告。
- 前端最多渲染 10 条，即使坏响应超过 10 条也截断。

**TDD**

1. RED：纯函数测试覆盖排序保持、最多 10 条、固定 story renderer、未知 story key 忽略、空态/游客态、内部 tier 不泄漏。
2. RED：Playwright 路由拦截 Auth `/api/me`、`/api/achievements`、`/api/match-reports`，验证账号/游客/局部失败三种状态和手机无横向溢出。
3. 运行 Blog 单测和 Python 3.13 Playwright 聚焦用例；预期 RED。
4. GREEN：实现战报区和局部错误隔离。
5. 在 `blog/` 运行 `npm test`、`npm run check`、`npm run lint`、`npm run build`；预期 GREEN。

**提交边界**

`feat(profile): show recent abracadawhat reports`

### Task D4：全链路回归、迁移、部署与生产验收

**文件**

- 修改：`abracadawhat/scripts/e2e-achievement-test.mjs`
- 修改：`abracadawhat/scripts/e2e-marathon-test.mjs`（移除对已停用累计成就的目标，改为幂等/档案验证；若脚本职责不再成立则冷藏原脚本并新增 v2 文件，不在原名下伪装旧目的）
- 新建：`abracadawhat/scripts/e2e-story-progression-test.mjs`
- 修改：`abracadawhat/docs/deployment-v2.md`
- 修改：`docs/lessons-learned.md`（仅记录实施中真实发生的错误；无错误不写占位）

**本地 RED/GREEN 验收**

1. 先扩展 E2E，使旧服务组合下至少因缺少 `reportId`、stories、profile report 或 10 个新成就之一 RED；不得只检查“收到任意成就”。
2. 本地启动 Auth Wrangler 和 Abracadawhat Wrangler，使用 `.dev.vars` 已有密钥，不覆盖其他条目。
3. E2E 固定验证：`game_over` 先于 Auth 完成；故事 0-3 条；可见星级无 S/A/B/C；同一 v2 payload POST 两次只有一个 match/player report；新成就只解锁一次；游客当前可看故事但 `/api/match-reports` 为空；账号能读最近报告；Auth 500 时仍可重赛且显示失败提示。
4. 修到 E2E GREEN，再运行所有门禁：

```powershell
# auth/
npm test
npx wrangler deploy --dry-run

# packages/lobby-kit/
npm test

# abracadawhat/，构建必须先于测试
npm run build
npm test

# blog/
npm test
npm run check
npm run lint
npm run build
npx wrangler deploy --dry-run
```

**生产迁移顺序**

1. 备份/导出 D1 或确认 Cloudflare D1 可用恢复点；禁止跳过。
2. 对目标数据库只读执行 `auth/operations/preflight/005-match-player-duplicates.sql`。若返回任何 `(match_id, player_id)` 重复行，立即中止并人工审查；禁止静默删除、合并或任选历史行。操作性 SQL 禁止放入 `auth/migrations/`，避免被 Wrangler 当成迁移发现。
3. 当前既有数据库的 001-004 曾用 `wrangler d1 execute` 直接执行，不在 `d1_migrations` 中；直接执行不等于 Wrangler migration tracking。建立并人工核对基线前，禁止对既有库盲目运行 `wrangler d1 migrations apply`。
4. 在 `auth/` 依次执行：

```powershell
npx wrangler d1 execute sekai-db --remote --file=./migrations/005_abracadawhat_match_v2.sql
npx wrangler d1 execute sekai-db --remote --file=./migrations/006_legendary_achievement_aliases.sql
npx wrangler d1 execute sekai-db --remote --file=./migrations/007_player_match_reports.sql
```

5. 远程只读核对表、索引和迁移映射；不对无法证明的旧比赛补故事/成就。
6. 先部署 Auth，使其能同时接 v1/v2；再部署 Abracadawhat 开始发送 v2；最后部署 Blog 消费新增查询。该顺序保证发布窗口内旧游戏仍可上报。
7. Auth：在 `auth/` 运行 `npm run deploy`。
8. Abracadawhat：严格按 `abracadawhat/docs/deployment-v2.md` 在 `abracadawhat/` 运行 `npm run deploy`，不得拆开绕过 `postbuild` 表情复制。
9. Blog：在 `blog/` 运行 `npm run build` 后 `npx wrangler deploy`。

**生产验证**

- 先探测 `https://auth.qmzhj.top/api/me`、`https://abracadawhat.qmzhj.top`、`https://blog.qmzhj.top/profile/` 可达，并保留 Wrangler deployment id。
- 用可控的持久测试账号完成一场 2-3 人比赛，核对：轮结束原因/得分拆分/起手摘要；比赛故事最多 3；UI 只出现四种星串；新成就最多突出 2 且只解锁一次；关闭详情后仍可重赛。
- 在资料页核对同一场报告的日期、人数、轮数、名次、比分、昵称快照、故事和新成就；重复 POST/重试不生成第二条。
- 用游客完成一场，确认当前结算有故事，但资料页最近战报为空。
- 临时模拟/观察一次 Auth 失败路径应在本地或受控环境完成，生产不主动破坏 Auth；确认失败提示不阻止重赛。
- 查询 D1：持久账号该游戏报告 `<= 10`；`dragon_kills <= kills`；同一 `(match_id, player_id)` 唯一；传奇 achievement key 无重复。
- 按既有部署文档再检查两张聊天表情 URL 返回 `200 image/png`，防止部署故事功能时回归资源打包。
- 用 `npx wrangler tail` 观察一场完整链路，无未处理异常、未知 story/fact key 或 D1 constraint 错误。

**回滚边界**

- 若 Auth 部署失败：停止后续部署，旧 Abracadawhat 继续用 v1。
- 若 Abracadawhat 部署失败：回滚该 Worker deployment；Auth 保持双版本兼容，无需回滚迁移。
- 若 Blog 部署失败：回滚 Blog；游戏结算和 Auth 存储不受影响。
- 007 表可暂时闲置但不删除；禁止为回滚删除已保存玩家报告。应用层回滚优先于破坏性数据库回滚。

**提交边界**

`test(abracadawhat): verify story progression end to end`

---

## 最终完成标准

- 17 个 Task 分别完成 RED、GREEN、全量回归和独立提交。
- 10 个 active 传奇成就的成功/反例测试齐全；不可达和坏激励旧成就不再触发。
- v1/v2 Auth 集成测试、v2 幂等、最近 10 条、游客不保存、Auth 失败不阻塞均有自动化证据。
- 回合/比赛结算、手机魔法效果、重赛入口、资料页档案/旧版纪念/最近战报通过桌面和手机 Playwright。
- 代码和生产 DOM 扫描确认内部 `S/A/B/C` 不进入玩家 UI；玩家故事星级只有 `★★★★`、`★★★`、`★★`、`★`。
- 生产可控测试局、D1 核对、日志观察和表情资源回归全部通过后才宣告完成。
