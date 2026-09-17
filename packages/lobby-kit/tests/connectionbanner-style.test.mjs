import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * ConnectionBanner 是三个游戏共用的"掉线要说出来"的界面。
 * 与 AuthBadge 同理：lobby-kit 不依赖 design-kit，颜色必须写成
 * var(--令牌, 旧值)——引了 design-kit 的项目跟着令牌走（含深色主题），
 * 没引的项目用 fallback。
 *
 * 更要紧的是它存在的理由：ws-client 曾经在重试耗尽后**静默放弃**，
 * 界面上还留着最后一个画面。这个组件必须两档都能渲染出来，
 * 而且 offline 档必须带一个可点的重连按钮 —— 光提示不给出路等于没修。
 */
const source = await readFile(new URL('../src/vue/ConnectionBanner.vue', import.meta.url), 'utf8')

test('两档状态都有渲染分支', () => {
  assert.match(source, /status === 'reconnecting'/, '缺少重连中分支')
  assert.match(source, /status === 'offline'/, '缺少已断开分支')
})

test('offline 档给出可点的重连入口，不是只报错', () => {
  assert.match(source, /emit\('retry'\)/, '重连按钮必须发出 retry 事件')
  assert.match(source, /min-height: var\(--tap-min, 44px\)/, '重连按钮要满足触摸目标下限')
})

test('无障碍语义：重连中用 status，断开用 alert', () => {
  assert.match(source, /role="status"/)
  assert.match(source, /role="alert"/)
})

test('颜色走令牌并保留 fallback，没有裸色值', () => {
  assert.match(source, /var\(--danger, #?[0-9a-fA-F]{3,8}\)/)
  assert.match(source, /var\(--danger-soft, /)
  assert.match(source, /var\(--card-solid, /)
  assert.match(source, /var\(--ink, /)
  // 裸 hex 只允许出现在 var() 的 fallback 位置。
  // 例外：纯白是主题中立的常量 —— 白字压在品牌填充上，亮暗两套都是白，
  // 没有可切换的值，所以它不该是令牌。AuthBadge 的主按钮也是这么写的。
  const isWhite = (decl) => /:\s*#(?:fff|ffffff)\s*;$/.test(decl)
  const bare = (source.match(/(?:background|color|border|border-color|outline):\s*#[0-9a-fA-F]{3,8}\s*;/g) ?? [])
    .filter((decl) => !isWhite(decl))
  assert.deepEqual(bare, [], `发现未走令牌的裸色值: ${bare.join(', ')}`)
})

test('动效尊重 prefers-reduced-motion', () => {
  assert.match(source, /prefers-reduced-motion/)
})

console.log('connection-banner style tests passed')
