import assert from 'node:assert/strict'
import { createLobbyStore } from '../src/lobby-store.js'

// 纯逻辑层：createLobbyStore() 返回 { state, setNickname, setAvatar, ... }
// state 是普通对象（非响应式代理），Pinia 侧做薄包装
const store = createLobbyStore()

// 初始状态
assert.equal(typeof store.state.myPlayerId, 'string', 'myPlayerId 已生成')
assert.match(store.state.myPlayerId, /^p[0-9a-z]+$/, 'playerId 格式正确')
assert.equal(store.state.myNickname, '玩家', '默认昵称')
assert.equal(store.state.myAvatarId, '0', '默认头像')

// setNickname
store.setNickname('  张三  ')
assert.equal(store.state.myNickname, '张三', 'trim 后保存')
store.setNickname('   ')
assert.equal(store.state.myNickname, '玩家', '空白回退默认')
store.setNickname('')
assert.equal(store.state.myNickname, '玩家', '空串回退默认')

// setAvatar
store.setAvatar(3)
assert.equal(store.state.myAvatarId, '3', '数字转字符串')
store.setAvatar('7')
assert.equal(store.state.myAvatarId, '7', '字符串原样')

// joinByCode 规范化
assert.equal(store.joinByCode('abc123'), 'ABC123', '大写化')
assert.equal(store.joinByCode('  ab  '), 'AB', 'trim 后大写')
assert.equal(store.joinByCode(''), null, '空串返回 null')

// 每次 create 独立实例
const storeB = createLobbyStore()
assert.notEqual(storeB.state.myPlayerId, store.state.myPlayerId, '不同实例不同 playerId')
storeB.setNickname('李四')
assert.equal(store.state.myNickname, '玩家', '互不影响')

console.log('lobby-store tests passed')
