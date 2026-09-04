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
