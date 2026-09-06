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
  assert.match(source, /失败扣血后仍留在当前行动/)
  assert.match(source, /不能继续施法，只能结束行动并补牌/)
})

test('手牌魔法效果通过可访问按钮展开，不只依赖 title', async () => {
  const source = await readFile(new URL('../src/components/SpellCard.vue', import.meta.url), 'utf8')
  assert.match(source, /<button/)
  assert.match(source, /type="button"/)
  assert.match(source, /:aria-expanded="effectOpen"/)
  assert.match(source, /:aria-controls="effectId"/)
  assert.match(source, /:id="effectId"/)
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
