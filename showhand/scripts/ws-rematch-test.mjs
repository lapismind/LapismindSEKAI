/**
 * 整场结束 → 再来一局 联调测试（需先 `npx wrangler dev --port 8788`）
 *
 * 场景：双人五张梭哈打满 1 局 → 第三人在结束时加入（变观众）
 *       → 房主 rematch → 筹码复位、观众重新入座、回到 waiting
 *       → 房主再次开局，三人同桌
 *
 * 覆盖：整场结束后房间可被复用（此前只能回大厅重建房间）
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SHRS' + Math.random().toString(36).slice(2, 8).toUpperCase()
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

const a = await connect('pma', '甲')
const b = await connect('pmb', '乙')
await wait(500)

send(a, 'set_host_config', { mode: 'five', rounds: 1, initialChips: 1000 })
await wait(300)
send(a, 'start_game')
await wait(600)

/** 事件驱动地把当前这一局跟注打完 */
async function playHand(clients) {
  const acted = {}
  for (const c of clients) acted[c.pid] = 0
  const byPid = Object.fromEntries(clients.map((c) => [c.pid, c]))
  const ref = clients[0]
  for (let step = 0; step < 80; step++) {
    await wait(150)
    const st = lastOf(ref, 'room_state')
    if (st?.phase !== 'playing') break
    for (const c of clients) {
      const turns = c.msgs.filter((m) => m.type === 'turn_to')
      while (acted[c.pid] < turns.length) {
        const playerId = turns[acted[c.pid]].data.playerId
        acted[c.pid] += 1
        if (byPid[playerId]) send(byPid[playerId], 'bet', { action: 'call' })
      }
    }
  }
  await wait(800)
}

a.pid = 'pma'
b.pid = 'pmb'
await playHand([a, b])

let st = lastOf(a, 'room_state')
if (st?.phase !== 'settled') fail(`第 1 局后 phase=${st?.phase}，应 settled`)
if (st.finished !== true) fail('rounds=1 打满后 finished 应为 true')
console.log('✓ 唯一一局打完，整场结束 finished=true')

const over = lastOf(a, 'game_over')
if (!over || over.standings.length !== 2) fail('最终排名应含 2 人')
console.log('✓ 最终排名:', over.standings.map((r) => `${r.nickname}:${r.chips}`).join(' | '))

// 整场结束后第三人才加入 → 自动变观众
const c = await connect('pmc', '丙')
await wait(700)
st = lastOf(c, 'room_state')
const pc = st?.players.find((p) => p.id === 'pmc')
if (!pc || pc.role !== 'spectator') fail(`整场结束后加入者应为 spectator，实际 ${pc?.role}`)
console.log('✓ 整场结束后加入者进入观众席')

// 非房主不能开新一场
send(b, 'rematch')
await wait(500)
st = lastOf(b, 'room_state')
if (st?.phase !== 'settled') fail('非房主的 rematch 应被拒绝')
console.log('✓ 非房主的再来一局被拒绝')

// 房主 rematch：筹码复位 + 观众重新入座 + 回到 waiting
send(a, 'rematch')
await wait(800)
st = lastOf(a, 'room_state')
if (st?.phase !== 'waiting') fail(`rematch 后应回到 waiting，实际 ${st?.phase}`)
if (st.finished !== false) fail('rematch 后 finished 应复位')
if (st.round !== 0) fail(`rematch 后 round 应归零，实际 ${st.round}`)
for (const p of st.players) {
  if (p.role !== 'player') fail(`${p.nickname} 应重新入座，实际 ${p.role}`)
  if (p.chips !== 1000) fail(`${p.nickname} 筹码应回到 1000，实际 ${p.chips}`)
  if (p.bet !== 0) fail(`${p.nickname} 投入应清零，实际 ${p.bet}`)
}
console.log('✓ 筹码复位、观众重新入座、回到 waiting')

// 重置后能立刻重新开局，三人同桌
send(a, 'start_game')
await wait(700)
st = lastOf(a, 'room_state')
if (st?.phase !== 'playing') fail(`重新开局失败 phase=${st?.phase}`)
if (st.round !== 1) fail(`重新开局 round 应为 1，实际 ${st.round}`)
const seated = st.players.filter((p) => p.role === 'player')
if (seated.length !== 3) fail(`重新开局应有 3 名玩家，实际 ${seated.length}`)
console.log('✓ 重新开局成功，3 人同桌，第 1 局')

console.log('\n✓ 再来一局全部通过')
a.close()
b.close()
c.close()
process.exit(0)
