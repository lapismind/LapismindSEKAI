/**
 * 局间循环联调测试（需先 `npx wrangler dev --port 8788`）
 * 场景：双人开局 → 摊牌结算(phase=settled) → 房主 start_game → 进入第 2 局(playing)
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SHRD' + Math.random().toString(36).slice(2, 8).toUpperCase()
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

const a = await connect('prdA', '甲局')
const b = await connect('prdB', '乙局')
await wait(500)
send(a, 'set_host_config', { mode: 'five', rounds: 3, initialChips: 1000 })
await wait(300)
send(a, 'start_game')
await wait(600)

// 双方跟注到摊牌：处理所有 turn_to，轮到谁谁就跟
const turnCount = () =>
  Math.max(a.msgs.filter((m) => m.type === 'turn_to').length, b.msgs.filter((m) => m.type === 'turn_to').length)
const betCount = (ws) => ws.msgs.filter((m) => m.type === 'bet_result').length

for (let i = 0; i < 12 && !a.msgs.some((m) => m.type === 'showdown'); i++) {
  await wait(300)
  const ta = [...a.msgs].reverse().find((m) => m.type === 'turn_to')
  const tb = [...b.msgs].reverse().find((m) => m.type === 'turn_to')
  if (ta && ta.data.playerId === 'prdA' && betCount(a) < i + 1) send(a, 'bet', { action: 'call' })
  if (tb && tb.data.playerId === 'prdB' && betCount(b) < i + 1) send(b, 'bet', { action: 'call' })
}
await wait(1000)

// 第 1 局结束
let st = lastOf(a, 'room_state')
if (st?.phase !== 'settled') fail(`第 1 局后 phase=${st?.phase}，应 settled`)
console.log('✓ 第 1 局结束 phase=settled, round=', st.round)

// 房主开下一局
send(a, 'start_game')
await wait(800)
st = lastOf(a, 'room_state')
if (st?.phase !== 'playing') fail(`房主开下一局失败 phase=${st?.phase}`)
if (st?.round !== 2) fail(`round 应=2，实际=${st?.round}`)
console.log('✓ 房主开下一局成功，进入第 2 局 round=2')

// 新局重新发牌
const hand = lastOf(a, 'your_hand')
if (!hand || hand.cards.length !== 5) fail(`第 2 局未重新发牌, cards=${hand?.cards?.length}`)
console.log('✓ 第 2 局重新发牌（5 张）')

console.log('\n✓ 局间循环全部通过')
a.close()
b.close()
process.exit(0)
