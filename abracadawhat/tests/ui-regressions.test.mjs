import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('聊天浮动按钮只使用 fixed 定位，避免 relative 覆盖到页面中部', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  const button = source.match(/<!-- 浮动聊天按钮 -->[\s\S]*?<button[\s\S]*?class="([^"]+)"/)
  assert.ok(button, '找不到聊天浮动按钮')
  const classes = button[1].split(/\s+/)
  assert.ok(classes.includes('fixed'))
  assert.ok(classes.includes('right-4'))
  assert.ok(classes.includes('bottom-20'))
  assert.ok(!classes.includes('relative'))
})

test('聊天未读和滚动监听消息版本，不依赖达到上限后不再变化的数组长度', async () => {
  const roomView = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  const chatPanel = await readFile(new URL('../src/components/GameChatPanel.vue', import.meta.url), 'utf8')
  assert.match(roomView, /watch\(\(\) => game\.chatMessageVersion/)
  assert.match(chatPanel, /\(\) => chatMessageVersion\.value/)
})

test('迟到的身份事件不会覆盖游客已经编辑的资料草稿', async () => {
  const lobbyView = await readFile(new URL('../src/views/LobbyView.vue', import.meta.url), 'utf8')
  assert.match(lobbyView, /profileEdited/)
  assert.match(lobbyView, /if \(!profileEdited\.value\)/)
})

test('猫头鹰只有实际取得秘密牌时才显示获得提示', async () => {
  const source = await readFile(new URL('../src/components/CastFeedback.vue', import.meta.url), 'utf8')
  assert.match(source, /result\.value\.secretTaken\s*!=\s*null/)
})

test('帮助说明准确描述猜错后的锁定和补牌流程', async () => {
  const source = await readFile(new URL('../src/components/GameHelp.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /没有这张牌则失败扣血，回合结束/)
  assert.doesNotMatch(source, /必须先成功施法一次/)
  assert.match(source, /至少宣告一次魔法/)
  assert.match(source, /成功后可以继续施法，也可以结束行动并补牌/)
  assert.match(source, /失败会扣血，并阻止本次行动继续施法/)
  assert.match(source, /必须结束行动并补牌/)
})

test('手牌魔法效果通过可访问按钮展开，不只依赖 title', async () => {
  const source = await readFile(new URL('../src/components/SpellCard.vue', import.meta.url), 'utf8')
  assert.match(source, /<button/)
  assert.match(source, /type="button"/)
  assert.match(source, /:aria-expanded="effectOpen"/)
  assert.match(source, /:aria-controls="effectId"/)
  assert.match(source, /:id="effectId"/)
  assert.match(source, /watch\(\(\) => props\.faceDown/)
  assert.match(source, /v-show="!faceDown && effectOpen && spell"/)
  assert.match(source, /v-if="!faceDown && spell"/)
  assert.doesNotMatch(source, /class="fixed /)
  assert.match(source, /min-h-\[44px\]/)
  assert.match(source, /min-w-\[44px\]/)
  assert.match(source, /spell\?\.desc/)
})

test('公共区魔法效果通过独立可访问按钮展开且适合手机触控', async () => {
  const source = await readFile(new URL('../src/components/PublicArea.vue', import.meta.url), 'utf8')
  assert.match(source, /<button/)
  assert.match(source, /type="button"/)
  assert.match(source, /:aria-expanded="openSpellId === spell\.id"/)
  assert.match(source, /:aria-controls="`public-spell-effect-\$\{spell\.id\}`"/)
  assert.match(source, /:id="`public-spell-effect-\$\{spell\.id\}`"/)
  assert.match(source, /min-h-\[44px\]/)
  assert.match(source, /min-w-\[44px\]/)
  assert.match(source, /spell\.desc/)
})

test('公共区常驻显示目标分和每名玩家距离目标的分数', async () => {
  const source = await readFile(new URL('../src/components/PublicArea.vue', import.meta.url), 'utf8')
  assert.match(source, /targetScore/)
  assert.match(source, /data-testid="target-score"/)
  assert.match(source, /targetStandings/)
  assert.match(source, /v-for="row in targetStandings"/)
  assert.match(source, /Math\.max\(0, targetScore - row\.score\)/)
  assert.match(source, /还差/)
})

test('比赛结算详情关闭后仍保留房主重赛和返回大厅操作条且没有投票', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  assert.match(source, /game\.lastGameOver && game\.gameOverOpen/)
  assert.match(source, /data-testid="post-game-actions"/)
  assert.match(source, /@click="game\.rematch\(\)"/)
  assert.match(source, /等待房主再来一局/)
  assert.match(source, /查看结算详情/)
  assert.match(source, /@click="openGameOverDetails"/)
  assert.match(source, /@click="goToLobby"/)
  assert.doesNotMatch(source, /投票|vote/i)
})

test('比赛结算详情具备对话框语义和键盘焦点管理', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-modal="true"/)
  assert.match(source, /aria-labelledby="game-over-title"/)
  assert.match(source, /id="game-over-title"/)
  assert.match(source, /@keydown="onGameOverKeydown"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.key !== 'Tab'/)
  assert.match(source, /gameOverCloseButton/)
  assert.match(source, /gameOverReopenButton/)
})

test('返回大厅和跨房间连接使用显式房间清理且同房重连仍只断开传输', async () => {
  const roomView = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  const store = await readFile(new URL('../src/stores/gameStore.js', import.meta.url), 'utf8')
  assert.match(store, /function leaveRoom\(\)/)
  assert.match(store, /roomId\.value !== roomCode/)
  assert.match(roomView, /game\.disconnect\(\)[\s\S]*game\.connect\(roomCode\.value/)
  const goToLobby = roomView.match(/function goToLobby\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.doesNotMatch(goToLobby, /unsubs\.forEach/)
  assert.doesNotMatch(goToLobby, /game\.leaveRoom\(\)/)
  assert.match(goToLobby, /router\.push\('\/'\)/)
  const unmount = roomView.match(/onUnmounted\(\(\) => \{([\s\S]*?)\n\}\)/)?.[1] ?? ''
  assert.match(unmount, /game\.leaveRoom\(\)/)
  assert.doesNotMatch(unmount, /game\.disconnect\(\)/)
})

test('连接续程使用递增代次阻止离开后或乱序请求打开旧房间', async () => {
  const store = await readFile(new URL('../src/stores/gameStore.js', import.meta.url), 'utf8')
  assert.match(store, /connectGeneration/)
  assert.match(store, /\+\+connectGeneration/)
  assert.match(store, /generation !== connectGeneration/)
})

test('A4 浏览器夹具的大厅路由使用编译 SFC 而不是运行时内联模板', async () => {
  const source = await readFile(new URL('./fixtures/a4-harness.js', import.meta.url), 'utf8')
  assert.match(source, /A4LobbyHarness\.vue/)
  assert.doesNotMatch(source, /component:\s*\{\s*template:/)
})

test('回合结算展示权威赢家、魔法、原因、得分来源和本人起手摘要', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  assert.match(source, /game\.roomState\?\.summary/)
  assert.match(source, /decisiveSpellId/)
  assert.match(source, /击杀结束/)
  assert.match(source, /清空手牌结束/)
  assert.match(source, /施法失败自爆结束/)
  assert.match(source, /轮胜分/)
  assert.match(source, /幸存分/)
  assert.match(source, /秘密牌分/)
  assert.match(source, /你手里原来有/)
  assert.match(source, /startingHand/)
  assert.match(source, /开启下一轮/)
})

test('比赛复盘展示排名统计、最多三条故事、成就折叠和保存失败提示', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  assert.match(source, /formattedStories/)
  assert.match(source, /slice\(0, 3\)/)
  assert.match(source, /轮胜/)
  assert.match(source, /击杀/)
  assert.match(source, /最长连放/)
  assert.match(source, /slice\(0, 2\)/)
  assert.match(source, /其余.*成就/)
  assert.match(source, /<details/)
  assert.match(source, /战报暂未保存/)
  assert.match(source, /matchReportStatus\?\.saved === false/)
  assert.match(source, /查看完整统计/)
})

test('故事展示只调用固定 presentation 且不把内部级别插入模板或可访问属性', async () => {
  const source = await readFile(new URL('../src/views/RoomView.vue', import.meta.url), 'utf8')
  assert.match(source, /formatStory/)
  assert.doesNotMatch(source, /story\.tier/)
  assert.doesNotMatch(source, /:title="[^"]*tier|:aria-label="[^"]*tier/)
})

test('B5 浏览器夹具使用编译 SFC 并提供回合与比赛确定状态', async () => {
  const source = await readFile(new URL('./fixtures/b5-harness.js', import.meta.url), 'utf8')
  assert.match(source, /B5Harness\.vue/)
  assert.doesNotMatch(source, /component:\s*\{\s*template:/)
})
