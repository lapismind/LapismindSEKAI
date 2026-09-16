/**
 * tests/ai-mode-closed.test.mjs —— AI 主持入口关闭（2026-09-16）的回归。
 *
 * 这一组断言守的是一个具体的坑：**只藏前端按钮不改默认值 = 入口没关**。
 * 关掉之前 AI 是三处的默认值（store 的 ref/reset、Worker 的归一化、四个组件的 prop default），
 * 而且 AI 复盘提示是另一条独立烧 token 的支线，必须一起关。
 * 重新开放时把 src/core/features.js 与 src/worker/soupRoom.js 的开关一起改回 true，
 * 并同步更新本文件。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8')

test('AI 开关默认关闭，前后端各有一处真源', async () => {
  const features = await read('../src/core/features.js')
  assert.match(features, /export const AI_MODE_ENABLED = false/)
  const worker = await read('../src/worker/soupRoom.js')
  assert.match(worker, /const AI_MODE_ENABLED = false/)
})

test('服务端强制真人模式：客户端传来 ai 也要归一化', async () => {
  const worker = await read('../src/worker/soupRoom.js')
  assert.match(worker, /AI_MODE_ENABLED && data\?\.mode === 'ai' \? 'ai' : 'human'/)
  // 新建房间的初始状态也不能是 ai
  assert.match(worker, /mode: 'human', \/\/ ai \| human/)
})

test('默认值一律是 human', async () => {
  const store = await read('../src/stores/gameStore.js')
  assert.match(store, /const mode = ref\('human'\)/)
  assert.match(store, /mode\.value = 'human'/)
  for (const file of ['DrawerPanel', 'GameBoard', 'HostConfigPanel', 'MessageList']) {
    const src = await read(`../src/components/${file}.vue`)
    assert.match(src, /mode: \{ type: String, default: 'human' \}/, `${file} 的 mode 默认值不是 human`)
  }
})

test('AI 复盘提示随开关一起关闭，且前端不再发指令', async () => {
  const store = await read('../src/stores/gameStore.js')
  const hint = store.match(/function aiHint\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''
  assert.match(hint, /if \(!AI_MODE_ENABLED\) return/)
  const room = await read('../src/views/RoomView.vue')
  assert.match(room, /:can-ai-hint="AI_MODE_ENABLED && \(game\.amModerator \|\| game\.isHost\)"/)
})

test('房主配置面板的 AI 按钮不可点并标了 beta', async () => {
  const panel = await read('../src/components/HostConfigPanel.vue')
  assert.match(panel, /:disabled="!AI_MODE_ENABLED"/)
  assert.match(panel, /AI 主持<\/span>|>beta</)
  assert.match(panel, /AI 主持暂时关闭/)
})

test('帮助文案不再宣称可以选 AI 主持', async () => {
  const help = await read('../src/components/GameHelp.vue')
  assert.doesNotMatch(help, /选择「AI 主持」或「真人主持」/)
  assert.match(help, /AI 主持（大肥鱼）· beta/)
})

test('大厅与提交谜题的文案不再假设有 AI 主持人', async () => {
  const lobby = await read('../src/views/LobbyView.vue')
  assert.doesNotMatch(lobby, /房主可选 AI 主持或真人主持/)
  const submit = await read('../src/components/PuzzleSubmitModal.vue')
  assert.doesNotMatch(submit, /AI 主持人会用它来判断/)
})
