import assert from 'node:assert/strict'
import { generatePlayerId, isValidPlayerId } from '../src/player-id.js'

// generatePlayerId
for (let i = 0; i < 50; i++) {
  const id = generatePlayerId()
  assert.match(id, /^p[0-9a-z]{12,20}$/, `格式 p+时间戳36进制+随机，实际: ${id}`)
}

// 唯一性：短时间内生成两个不同
const a = generatePlayerId()
const b = generatePlayerId()
assert.notEqual(a, b, '两次生成不同')

// isValidPlayerId
assert.equal(isValidPlayerId('p12345'), true, 'p 开头即认为合法（宽松校验）')
assert.equal(isValidPlayerId('abc'), false, '不以 p 开头')
assert.equal(isValidPlayerId(''), false)
assert.equal(isValidPlayerId(null), false)

console.log('player-id tests passed')
