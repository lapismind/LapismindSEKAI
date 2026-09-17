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

// --- token 透传 ---
FakeWS.instances = []
const c5 = makeClient()
c5.connect({ roomId: 'T1', nickname: 'n', playerId: 'p9', avatarId: '3', token: 'abc.123sig' })
assert.match(FakeWS.instances[0].url, /token=abc\.123sig/, 'URL 带 token 参数')
assert.match(FakeWS.instances[0].url, /avatarId=3/, 'URL 带 avatarId')

// --- 无 token 时 URL 不包含 token ---
FakeWS.instances = []
const c6 = makeClient()
c6.connect({ roomId: 'T2', nickname: 'n', playerId: 'p10' })
assert.ok(!FakeWS.instances[0].url.includes('token='), '无 token 时不拼接 token 参数')

// --- 断线重连后 session 保留 token ---
FakeWS.instances = []
const c7 = makeClient({ reconnectDelayMs: 1 })
c7.connect({ roomId: 'T3', nickname: 'n', playerId: 'p11', token: 'rt.sig' })
FakeWS.instances[0]._open()
FakeWS.instances[0]._close()
await new Promise((r) => setTimeout(r, 15))
assert.ok(FakeWS.instances.length >= 2)
assert.match(FakeWS.instances[1].url, /token=rt\.sig/, '重连后 URL 仍带 token')

// --- 重试耗尽必须发 offline，不能静默放弃 ---
// 此前 scheduleReconnect 直接 return，客户端永远停在"连接中…"，
// 桌面上却还在显示上一个画面——玩家以为只是别人慢，实际这局已经废了。
{
  FakeWS.instances = []
  const c8 = makeClient({ reconnectDelayMs: 1, maxRetry: 2 })
  const statuses = []
  c8.on('_status', (s) => statuses.push(s))
  c8.connect({ roomId: 'X3', nickname: 'n', playerId: 'p12' })
  FakeWS.instances[0]._open()
  assert.equal(c8.status, 'open', 'onopen 后 status=open')

  // 反复断开，直到重试次数耗尽
  for (let i = 0; i < 8; i++) {
    FakeWS.instances[FakeWS.instances.length - 1]._close()
    await new Promise((r) => setTimeout(r, 18))
  }

  const offline = statuses.filter((s) => s.status === 'offline')
  assert.equal(offline.length >= 1, true, '重试耗尽应发 offline 状态（此前是静默放弃）')
  assert.equal(offline[0].attempt, 2, 'offline 带上已重试次数')
  assert.equal(offline[0].maxRetry, 2, 'offline 带上上限')
  assert.equal(c8.status, 'offline', 'status getter 也反映 offline')
  assert.equal(c8.connected, false, 'offline 时未连接')

  const reconnecting = statuses.filter((s) => s.status === 'reconnecting')
  assert.equal(reconnecting.length >= 1, true, '重连期间要有 reconnecting 状态')
  assert.ok(reconnecting[0].nextDelayMs > 0, 'reconnecting 带上下次重试延迟')

  // --- 手动重连能从 offline 恢复 ---
  const before = FakeWS.instances.length
  assert.equal(c8.retry(), true, 'retry() 在有会话时返回 true')
  await new Promise((r) => setTimeout(r, 15))
  assert.equal(FakeWS.instances.length > before, true, 'retry() 重新发起连接')
  FakeWS.instances[FakeWS.instances.length - 1]._open()
  assert.equal(c8.status, 'open', '手动重连成功后回到 open')
}

// --- 未连接时 send 不能静默丢弃 ---
{
  const c9 = makeClient()
  const dropped = []
  c9.on('_send_failed', (d) => dropped.push(d))
  assert.equal(c9.send('bet', { action: 'call' }), false, '未连接时 send 返回 false')
  assert.equal(dropped.length, 1, '未连接时 send 发 _send_failed 事件')
  assert.equal(dropped[0].type, 'bet', '_send_failed 带上被丢弃的消息类型')
}

// --- disconnect 后状态是 idle，retry 不应复活 ---
{
  FakeWS.instances = []
  const c10 = makeClient()
  c10.connect({ roomId: 'X4', nickname: 'n', playerId: 'p13' })
  FakeWS.instances[0]._open()
  c10.disconnect()
  assert.equal(c10.status, 'idle', 'disconnect 后 status=idle')
  assert.equal(c10.retry(), false, '已断开时 retry() 返回 false（没有会话可恢复）')
}

// --- 手动 retry 后，旧的重试定时器不得再插一手 ---
{
  FakeWS.instances = []
  const c11 = makeClient({ reconnectDelayMs: 200, maxRetry: 3 })
  c11.connect({ roomId: 'X5', nickname: 'n', playerId: 'p14' })
  FakeWS.instances[0]._open()
  FakeWS.instances[0]._close()   // 排入一个 200ms 后的重连
  c11.retry()                    // 立刻手动重连，应当取消上面那个
  await new Promise((r) => setTimeout(r, 30))
  const after = FakeWS.instances.length
  await new Promise((r) => setTimeout(r, 260))
  assert.equal(FakeWS.instances.length, after, '手动重连不应被旧的延迟重连叠加')
}

console.log('ws-client tests passed')
