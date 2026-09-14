/**
 * 七张梭哈联调测试（需先 `npx wrangler dev --port 8788`）
 * 场景：双人七张梭哈 → 闷牌轮（1 张暗牌）→ 逐阶段下注 → 摊牌
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SH7' + Math.random().toString(36).slice(2, 8).toUpperCase()
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

const a = await connect('p7a', '甲七')
const b = await connect('p7b', '乙七')
await wait(500)

send(a, 'set_host_config', { mode: 'seven', rounds: 5, initialChips: 1000 })
await wait(400)
send(a, 'start_game')
await wait(600)

const st = lastOf(a, 'room_state')
if (!st || st.phase !== 'playing') fail('七张开局失败')
if (st.config.mode !== 'seven') fail('模式不是 seven')
console.log('✓ 七张开局成功')

const handA = lastOf(a, 'your_hand')
// 边发边下注：开局只发第一阶段，七张模式为 2 暗 + 1 明
if (!handA || handA.cards.length !== 1) fail(`七张闷牌轮应 1 张暗牌，实际 ${handA?.cards?.length}`)
const dark = handA.cards.filter((c) => c.hidden).length
const light = handA.cards.filter((c) => !c.hidden).length
if (dark !== 1 || light !== 0) fail(`七张闷牌轮应为 1 暗 0 明，实际 ${dark} 暗 ${light} 明`)
console.log('✓ 七张闷牌轮发牌 1 张暗牌正确')

// 逐阶段跟注到摊牌。边发边下注共有 4 轮下注（preflop/flop/turn/river），
// 每个 turn_to 只处理一次，轮到一起跟到结束。
const actedCount = { p7a: 0, p7b: 0 }
const byPid = { p7a: a, p7b: b }
for (let step = 0; step < 80; step++) {
  await wait(150)
  const cur = lastOf(a, 'room_state')
  if (cur?.phase !== 'playing') break
  for (const pid of Object.keys(byPid)) {
    const ws = byPid[pid]
    const turns = ws.msgs.filter((m) => m.type === 'turn_to')
    while (actedCount[pid] < turns.length) {
      const playerId = turns[actedCount[pid]].data.playerId
      actedCount[pid] += 1
      if (byPid[playerId]) send(byPid[playerId], 'bet', { action: 'call' })
    }
  }
}
await wait(1500)
const sd = lastOf(a, 'showdown')
if (!sd) fail('没有摊牌')
console.log('✓ 摊牌:', sd.hands.map((h) => `${h.nickname}:${h.handName || '弃牌'}`).join(' | '))
console.log('✓ 赢家:', sd.winners.map((w) => `${w.playerId}+${w.amount}`).join(', '))

console.log('\n✓ 七张梭哈全部通过')
a.close()
b.close()
process.exit(0)
