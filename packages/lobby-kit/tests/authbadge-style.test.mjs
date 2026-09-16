import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

/**
 * AuthBadge 是三个游戏共用的登录入口，且 lobby-kit 不依赖 design-kit——
 * 所以它的颜色必须写成 var(--令牌, 旧值) 的形式：引了 design-kit 的项目
 * （海龟汤常驻深色）跟着令牌走，没引的项目沿用 fallback。
 *
 * 历史 bug：弹层与表单输入只写了裸 hex，又漏掉了 .is-dark 覆盖，
 * 于是海龟汤（深色站）在注册/登录时弹出一张白底表单。
 */
const source = await readFile(new URL('../src/vue/AuthBadge.vue', import.meta.url), 'utf8')

// 弹层到分隔线的这一段就是"登录/注册弹层"的全部样式
const modalCss = source.slice(source.indexOf('.lk-mask {'), source.indexOf('.lk-msg {'))

test('登录弹层与表单使用令牌并保留 fallback', () => {
  assert.ok(modalCss.length > 0, '找不到弹层样式段')
  assert.match(modalCss, /background: var\(--card-solid, #ffffff\)/)
  assert.match(modalCss, /background: var\(--field-bg, #ffffff\)/)
  assert.match(modalCss, /color: var\(--ink, #333333\)/)
  assert.match(modalCss, /color: var\(--ink-soft, #555555\)/)
  assert.match(modalCss, /border: 1px solid var\(--line, #d8d0e4\)/)
  assert.match(modalCss, /border-color: var\(--primary, #6b6bd0\)/)
  assert.match(modalCss, /background: var\(--overlay, rgba\(20, 20, 30, 0\.45\)\)/)
})

test('弹层样式段里没有漏网的裸色值', () => {
  // 裸 hex 只允许出现在 var() 的 fallback 位置
  const bareHex = modalCss.match(/(?:background|color|border-color|border):\s*#[0-9a-fA-F]{3,8}\s*;/g) ?? []
  assert.deepEqual(bareHex, [], `发现未走令牌的裸色值: ${bareHex.join(', ')}`)
  // 旧遮罩色只能出现在 var(--overlay, ...) 的 fallback 里
  assert.equal(modalCss.split('rgba(20, 20, 30, 0.45)').length - 1, 1)
})
