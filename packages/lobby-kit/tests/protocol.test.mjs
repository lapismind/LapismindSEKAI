import assert from 'node:assert/strict'
import { makeMessage, isServerMessageValid } from '../src/protocol.js'

// makeMessage
assert.deepEqual(makeMessage('ping'), { type: 'ping', data: {} }, '缺 data 时补空对象')
assert.deepEqual(makeMessage('bet', { action: 'call' }), { type: 'bet', data: { action: 'call' } }, '带 data 原样')
assert.deepEqual(makeMessage('join', null), { type: 'join', data: null }, 'data 为 null 原样')

// isServerMessageValid
assert.equal(isServerMessageValid({ type: 'room_state', data: {} }), true, '合法消息')
assert.equal(isServerMessageValid({ type: 'hello' }), true, '缺 data 合法')
assert.equal(isServerMessageValid(null), false, 'null 不合法')
assert.equal(isServerMessageValid(undefined), false, 'undefined 不合法')
assert.equal(isServerMessageValid('str'), false, '字符串不合法')
assert.equal(isServerMessageValid(42), false, '数字不合法')
assert.equal(isServerMessageValid({}), false, '缺 type 不合法')
assert.equal(isServerMessageValid({ type: 123 }), false, 'type 非字符串不合法')
assert.equal(isServerMessageValid({ type: 'x', data: 'str' }), false, 'data 非对象不合法')
assert.equal(isServerMessageValid([{ type: 'x' }]), false, '数组不合法（信封必须是对象）')

console.log('protocol tests passed')
