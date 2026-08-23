/**
 * 断线重连联调测试（需先 `npx wrangler dev --port 8788`）
 * 场景：2 玩家开局 → A 断线 → A 用相同 playerId 重连 → 身份恢复仍在牌桌
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SHRC' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect(playerId, nickname) {
  const ws = await new Promise((resolve, reject) => {
    const w = new WebSocket(`${BASE}?roomId=${roomId}&nickname=${nickname}&playerId=${playerId}&avatarId=1`)
    w.msgs = []
    w.on('open', () => resolve(w))
    w.on('error', reject)
    w.on('message', (d) => w.msgs.push(JSON.parse(d.toString())))
  })
  return ws
}
const lastOf = (ws, type) => {
  for (let i = ws.msgs.length - 1; i >= 0; i--) {
    if (ws.msgs[i].type === type) return ws.msgs[i].data
  }
  return null
}
const send = (ws, type, data = {}) => ws.send(JSON.stringify({ type, data }))
const fail = (msg) => {
  console.log('✗', msg)
  process.exit(1)
}

const a = await connect('prcA', '甲连')
const b = await connect('prcB', '乙连')
await wait(500)
send(a, 'set_host_config', { mode: 'five', rounds: 10, initialChips: 1000 })
await wait(300)
send(a, 'start_game')
await wait(600)

// A 断线
a.close()
await wait(500)

// A 用相同 playerId 重连
const a2 = await connect('prcA', '甲连')
await wait(800)

// A 重连后应收到房间状态，且仍是玩家（不是新观众）
const st = lastOf(a2, 'room_state')
if (!st || st.phase !== 'playing') fail('重连后未收到房间状态')
const me = st.players.find((p) => p.id === 'prcA')
if (!me || me.role !== 'player') fail(`重连后身份丢失, role=${me?.role}`)
console.log('✓ 重连后身份恢复为玩家')

// A 重连后应能收到自己的手牌
const hand = lastOf(a2, 'your_hand')
if (!hand || hand.cards.length !== 5) fail(`重连后未收到手牌, cards=${hand?.cards?.length}`)
console.log('✓ 重连后收到手牌（5 张）')

console.log('\n✓ 断线重连全部通过')
a2.close()
b.close()
process.exit(0)
