import assert from 'node:assert/strict'
import { createWSClient } from '../src/ws-client.js'
import { makeMessage, isServerMessageValid } from '../src/protocol.js'

// 内存 Fake WebSocket
class FakeWS {
  static instances = []
  constructor(url) {
    this.url = url
    this.sent = []
    this.readyState = 0
    FakeWS.instances.push(this)
  }
  send(data) { this.sent.push(data) }
  close() { this.readyState = 3 }
  _open() { this.readyState = 1; this.onopen?.() }
  _message(raw) { this.onmessage?.({ data: raw }) }
  _close() { this.readyState = 3; this.onclose?.() }
}

function makeClient(opts = {}) {
  return createWSClient({
    wsImpl: FakeWS,
    makeMessage,
    isServerMessageValid,
    ...opts,
  })
}

// --- 连接 ---
const c1 = makeClient()
c1.connect({ roomId: 'ABC123', nickname: '张三', playerId: 'p1' })
assert.equal(FakeWS.instances.length, 1, '创建了一个 WebSocket')
assert.match(FakeWS.instances[0].url, /roomId=ABC123/, 'URL 带 roomId')
assert.match(FakeWS.instances[0].url, /nickname=%E5%BC%A0%E4%B8%89/, 'URL 带 URL 编码昵称')

// --- 连接后 ready ---
assert.equal(c1.connected, false, '连接前 not ready')
FakeWS.instances[0]._open()
assert.equal(c1.connected, true, 'onopen 后 ready')

// --- send 封包 ---
c1.send('chat', { text: 'hi' })
assert.deepEqual(JSON.parse(FakeWS.instances[0].sent[0]), { type: 'chat', data: { text: 'hi' } }, 'send 按信封封包')

// --- 收到消息分发 ---
let got = null
c1.on('room_state', (d) => { got = d })
FakeWS.instances[0]._message(JSON.stringify({ type: 'room_state', data: { seats: 4 } }))
assert.deepEqual(got, { seats: 4 }, '合法消息触发 handler')

// --- 非法消息被丢弃 ---
let badCount = 0
c1.on('bad', () => { badCount++ })
FakeWS.instances[0]._message(JSON.stringify({ type: 'bad', data: 'str' }))
FakeWS.instances[0]._message('not json')
assert.equal(badCount, 0, '非法消息不触发 handler')

// --- 断线重连（指数退避） ---
FakeWS.instances = []
const c2 = makeClient({ reconnectDelayMs: 1 })
c2.connect({ roomId: 'X1', nickname: 'n', playerId: 'p2' })
FakeWS.instances[0]._open()
FakeWS.instances[0]._close()
await new Promise((r) => setTimeout(r, 20))
assert.equal(FakeWS.instances.length >= 2, true, '断线后自动重连')
assert.equal(c2.connected, false, '重连前 not ready')

// --- disconnect 后不再重连 ---
FakeWS.instances = []
const c3 = makeClient()
c3.connect({ roomId: 'X2', nickname: 'n', playerId: 'p3' })
FakeWS.instances[0]._open()
c3.disconnect()
await new Promise((r) => setTimeout(r, 30))
assert.equal(FakeWS.instances.length, 1, 'disconnect 后不重连')
assert.equal(c3.connected, false, 'disconnect 后 not ready')

// --- off 取消订阅 ---
FakeWS.instances = []
const c4 = makeClient()
const unsub = c4.on('evt', () => { throw new Error('不应触发') })
unsub()
c4._emit('evt', {})

console.log('ws-client tests passed')
