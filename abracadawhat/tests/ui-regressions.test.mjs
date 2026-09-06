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
  assert.match(source, /@click="goToLobby"/)
  assert.doesNotMatch(source, /投票|vote/i)
})
