import assert from 'node:assert/strict'
import { generateRoomCode, isValidRoomCode } from '../src/room-code.js'

// generateRoomCode
for (let i = 0; i < 100; i++) {
  const code = generateRoomCode()
  assert.equal(code.length, 6, '长度 6')
  assert.match(code, /^[A-Z2-9]{6}$/, '只含排除易混淆字符的大写字母和数字（无 0/O/1/I）')
}

// isValidRoomCode
assert.equal(isValidRoomCode('ABC234'), true)
assert.equal(isValidRoomCode('abc234'), true, '小写字母大写化后应通过')
assert.equal(isValidRoomCode('ABC23'), false, '长度不足')
assert.equal(isValidRoomCode('ABC23Z4'), false, '长度过长')
assert.equal(isValidRoomCode('AB O23'), false, '含空格')
assert.equal(isValidRoomCode(''), false, '空串')
assert.equal(isValidRoomCode(null), false, 'null')
assert.equal(isValidRoomCode(undefined), false, 'undefined')

console.log('room-code tests passed')
