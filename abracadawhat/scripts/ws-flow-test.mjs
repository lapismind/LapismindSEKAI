/**
 * scripts/ws-flow-test.mjs —— 本地端到端冒烟测试。
 * 模拟两名玩家：连接 → 加入 → 开局 → 施法失败换人。
 * 前提：wrangler dev 已在 8787 端口运行。
 */

import WebSocket from 'ws'

const ROOM = 'T' + Math.random().toString(36).slice(2, 6).toUpperCase()

function connect(playerId, nickname) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:8787/ws?roomId=${ROOM}&playerId=${playerId}&nickname=${encodeURIComponent(nickname)}&avatarId=1`
    )
    const state = { ws, playerId, queue: [] }
    ws.on('open', () => resolve(state))
    ws.on('error', reject)
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      state.queue.push(msg)
      console.log('  [' + state.playerId + ' ←]', msg.type)
      state.waiters = (state.waiters || []).filter((w) => !w(msg))
    })
  })
}

/** 等待 type 匹配的消息；不匹配的消息保留在队列里，不会误吞 */
function waitFor(state, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const idx = state.queue.findIndex((m) => m.type === type)
    if (idx >= 0) {
      resolve(state.queue.splice(idx, 1)[0])
      return
    }
    const check = (msg) => {
      if (msg.type !== type) return false
      clearTimeout(timer)
      resolve(msg)
      return true
    }
    const timer = setTimeout(() => {
      state.waiters = state.waiters.filter((w) => w !== check)
      reject(new Error(`${state.playerId} 等待 ${type} 超时`))
    }, timeoutMs)
    ;(state.waiters ||= []).push(check)
  })
}

function send(state, type, data = {}) {
  state.ws.send(JSON.stringify({ type, data }))
}

const a = await connect('player-a', 'Alice')
console.log('✓ Alice 已连接')
const b = await connect('player-b', 'Bob')
console.log('✓ Bob 已连接')

await waitFor(a, 'room_state')
console.log('✓ Alice 收到房间状态')
await waitFor(b, 'room_state')
console.log('✓ Bob 收到房间状态并连接成功')

// Alice 开局（先清掉等待阶段的旧消息）
a.queue = []
b.queue = []
send(a, 'start_round')

const aState = await waitFor(a, 'room_state', 5000)
if (aState.data.phase !== 'playing') throw new Error('Alice 未收到 playing: ' + JSON.stringify(aState))
console.log('✓ 开局成功，当前回合:', aState.data.currentPlayerId)

await waitFor(b, 'room_state', 5000).then(m => {
  if (m.data.phase !== 'playing') throw new Error('Bob 未收到 playing')
})
console.log('✓ Bob 同步到 playing')

const aHand = await waitFor(a, 'your_hand')
if (aHand.data?.handSize !== 5) {
  throw new Error('Alice 手牌数量不对: ' + JSON.stringify(aHand))
}
console.log('✓ Alice 收到 5 张暗手牌（数量，无牌面）')

// Alice 宣告一种魔法——她自己也看不到手牌，结果由服务端判定。
send(a, 'cast', { spellId: 8 })
const result = await waitFor(a, 'cast_result', 5000)
if (result.data?.type === 'cast_success') {
  console.log('✓ 宣告成功，效果已结算:', JSON.stringify(result.data).slice(0, 100))
} else {
  if (result.data?.type !== 'cast_failed') throw new Error('预期施法结果但得到: ' + JSON.stringify(result.data))
  console.log('✓ 宣告失败，扣血:', result.data.damage, '❤️，回合结束')
}

// 确认 Bob 同步到施法结果与最新状态
await waitFor(b, 'room_state', 5000)
console.log('✓ Bob 同步到最新状态')

console.log('\n🎉 冒烟测试全部通过！')
a.ws.close()
b.ws.close()
process.exit(0)
