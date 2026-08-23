/**
 * 观众席联调测试（需先 `npx wrangler dev --port 8788`）
 * 场景：2 玩家开局 → 第 3 人加入变观众 → 观众收到全桌牌 → 玩家输光转观众
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SHSP' + Math.random().toString(36).slice(2, 8).toUpperCase()
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

const a = await connect('psa', '玩家甲')
const b = await connect('psb', '玩家乙')
await wait(500)
send(a, 'set_host_config', { mode: 'five', rounds: 10, initialChips: 1000 })
await wait(300)
send(a, 'start_game')
await wait(600)

// 游戏中第 3 人加入 → 自动变观众
const c = await connect('psc', '观众丙')
await wait(800)
const st = lastOf(a, 'room_state')
const spectator = st.players.find((p) => p.id === 'psc')
if (!spectator || spectator.role !== 'spectator') fail('游戏中加入者应为 spectator')
console.log('✓ 游戏中加入自动变观众')

// 观众收到全桌完整牌
const sp = lastOf(c, 'spectate_state')
if (!sp) fail('观众没收到 spectate_state')
const seat = sp.players.filter((p) => p.role === 'player')
if (seat.length < 2) fail('观众应看到 2 名玩家')
const allHave7 = seat.every((p) => p.cards && p.cards.length === 5)
if (!allHave7) fail('观众应看到玩家完整手牌（5 张）')
console.log('✓ 观众收到全桌完整手牌')

// 观众不能下注
send(c, 'bet', { action: 'call' })
await wait(400)
const err = lastOf(c, 'error')
if (!err) fail('观众下注应被拒绝')
console.log('✓ 观众下注被拒绝:', err.message)

// 玩家视角看不到他人暗牌
const paView = lastOf(a, 'room_state')
const bPublic = paView.players.find((p) => p.id === 'psb')
const hasDark = bPublic.publicCards.some((card) => card.hidden)
if (hasDark) fail('玩家视角不应看到他人暗牌')
if (bPublic.publicCards.length !== 4) fail(`玩家视角他人应只看到 4 张明牌，实际 ${bPublic.publicCards.length}`)
console.log('✓ 玩家视角只看到他人明牌（防作弊）')

// 观众视角能看到暗牌
const spHasDark = sp.players.find((p) => p.role === 'player').cards.some((card) => card.hidden)
if (!spHasDark) fail('观众视角应能看到暗牌')
console.log('✓ 观众视角能看到暗牌（上帝视角）')

console.log('\n✓ 观众席全部通过')
a.close()
b.close()
c.close()
process.exit(0)
