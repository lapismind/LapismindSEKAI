/**
 * 梭哈完整流程联调测试（需先 `npx wrangler dev --port 8788`）
 * 场景：双人五张梭哈 → 设配置 → 开局 → 双方跟注 → 摊牌 → 结算
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SH' + Math.random().toString(36).slice(2, 8).toUpperCase()
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

const a = await connect('pa', '阿甲')
const b = await connect('pb', '阿乙')
await wait(500)

// 房主设配置：五张梭哈，10 局，初始筹码 1000
send(a, 'set_host_config', { mode: 'five', rounds: 10, initialChips: 1000 })
await wait(400)

// 开局
send(a, 'start_game')
await wait(600)

let st = lastOf(a, 'room_state')
if (!st || st.phase !== 'playing') fail('开局失败, phase=' + st?.phase)
console.log('✓ 开局成功, mode=', st.config.mode)

// 双方应收到自己的手牌（5 张）
const handA = lastOf(a, 'your_hand')
const handB = lastOf(b, 'your_hand')
if (!handA || handA.cards.length !== 5) fail('甲手牌不是 5 张')
if (!handB || handB.cards.length !== 5) fail('乙手牌不是 5 张')
console.log('✓ 双方各收到 5 张手牌')
const darkA = handA.cards.filter((c) => c.hidden).length
const lightA = handA.cards.filter((c) => !c.hidden).length
if (darkA !== 1 || lightA !== 4) fail(`五张梭哈应为 1 暗 4 明，实际 ${darkA} 暗 ${lightA} 明`)
console.log('✓ 五张梭哈 1 暗 4 明正确')

// 轮到第一个玩家下注
await wait(400)
const turn = lastOf(a, 'turn_to') || lastOf(b, 'turn_to')
if (!turn) fail('没有 turn_to 消息')
console.log('✓ 开始下注, 轮到', turn.playerId, ', 当前注额', turn.currentBet)

// 双方跟注（处理所有 turn_to，自动跟）
for (let i = 0; i < 6; i++) {
  await wait(300)
  const ta = lastOf(a, 'turn_to')
  const tb = lastOf(b, 'turn_to')
  if (ta && !lastOf(a, 'bet_result')) {
    send(a, 'bet', { action: 'call' })
    console.log('  - 甲跟注')
  }
  if (tb && !lastOf(b, 'bet_result')) {
    send(b, 'bet', { action: 'call' })
    console.log('  - 乙跟注')
  }
}

// 等待摊牌 + 结算
await wait(1500)
const sd = lastOf(a, 'showdown')
const go = lastOf(a, 'game_over')
if (!sd) fail('没有摊牌消息')
if (!go) fail('没有本局结算消息')
console.log('✓ 摊牌:', sd.hands.map((h) => `${h.nickname}:${h.handName || '弃牌'}`).join(' | '))
console.log('✓ 赢家:', sd.winners.map((w) => `${w.playerId}+${w.amount}`).join(', '))
console.log('✓ 本局结算: 第', go.round, '/', go.totalRounds, '局')

console.log('\n✓ 梭哈完整流程全部通过')
a.close()
b.close()
process.exit(0)
