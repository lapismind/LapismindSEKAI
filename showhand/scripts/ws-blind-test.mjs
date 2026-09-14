/**
 * 闷牌轮联调测试（需先 `npx wrangler dev --port 8788`）
 *
 * 场景：双人五张梭哈 → 甲看牌后加注到 100 → 乙保持闷牌跟注
 *
 * 验证的是这个机制最容易做坏的两点：
 *   1. 同档位下闷牌者只付一半 —— 甲投入 100，乙只投入 50
 *   2. 「差额会补回来」—— 闷牌轮结束后档位按实际最大投入重置，
 *      乙在下一轮跟注时要把省下的 50 补上，两人最终投入相同
 * 第 2 条是关键：它决定闷牌买到的是"用一半价钱先看一张牌"，
 * 而不是"永久打折"。改规则时这个断言会立刻报错。
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SHB' + Math.random().toString(36).slice(2, 8).toUpperCase()
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
const of = (ws, type) => ws.msgs.filter((m) => m.type === type)
const lastOf = (ws, type) => {
  const found = of(ws, type)
  return found.length ? found[found.length - 1].data : null
}
const send = (ws, type, data = {}) => ws.send(JSON.stringify({ type, data }))
const fail = (msg) => {
  console.log('✗', msg)
  process.exit(1)
}

/** 等到出现满足条件的最新消息，超时即失败 */
async function waitFor(ws, type, predicate, label, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = lastOf(ws, type)
    if (data && (!predicate || predicate(data))) return data
    await wait(80)
  }
  fail(`超时等待 ${label}（${type}）`)
}

/** 等到出现满足条件的最新消息，超时返回 null（用于需要自定义报错的场合） */
async function waitForOrNull(ws, type, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = lastOf(ws, type)
    if (data && (!predicate || predicate(data))) return data
    await wait(80)
  }
  return null
}

const a = await connect('pba', '甲看牌')
const b = await connect('pbb', '乙闷牌')
await wait(500)

send(a, 'set_host_config', { mode: 'five', rounds: 1, initialChips: 1000 })
await wait(300)
send(a, 'start_game')

// 开局：闷牌轮，起注档位 = 底注 × 2 = 20
let st = await waitFor(a, 'room_state', (d) => d.stage === 'blind', '闷牌轮开始')
if (st.currentBet !== 20) fail(`闷牌轮起注档位应为 20（底注 10 的 2 倍），实际 ${st.currentBet}`)
const ante = 10
console.log(`✓ 闷牌轮起手：底注 ${ante}，起注档位 ${st.currentBet}，牌桌 ${st.players.length} 人`)

// 乙收到的应是占位符，不是真牌
const bHand = lastOf(b, 'your_hand')
if (!bHand?.cards?.[0]?.concealed) fail('闷牌者的暗牌必须以占位符下发，不能给牌面')

// 行动者以 turn_to 为准：房间状态的首帧广播发生在 beginBettingRound 之前，
// 那时 currentPlayerId 还是 null，真正的轮转信号是 turn_to
const turn = await waitFor(a, 'turn_to', (d) => !!d.playerId, '闷牌轮首次轮转')
const actorId = turn.playerId
const actorWs = actorId === 'pba' ? a : b
const otherWs = actorId === 'pba' ? b : a
const otherId = actorId === 'pba' ? 'pbb' : 'pba'

send(actorWs, 'look')
const looked = await waitFor(actorWs, 'your_hand', (d) => d.cards?.[0]?.concealed === undefined, '看牌后下发真牌')
if (!looked.cards[0].suit) fail('看牌后应下发带花色的真实牌面')
console.log(`✓ ${actorId} 看牌成功，拿到真实牌面`)

// 看牌者加注到 100（全价）
send(actorWs, 'bet', { action: 'raise', amount: 100 })
await wait(600)
st = lastOf(actorWs, 'room_state')
const actorSeat = st.players.find((p) => p.id === actorId)
if (actorSeat.bet !== 100) fail(`${actorId} 加注到 100 后投入应为 100，实际 ${actorSeat.bet}`)
console.log(`✓ ${actorId}（已看牌）加注到 100，投入 ${actorSeat.bet}`)

// 闷牌者跟到同一档位：应只付一半
send(otherWs, 'bet', { action: 'call' })
await wait(800)
st = lastOf(otherWs, 'room_state')
const blindSeat = st.players.find((p) => p.id === otherId)
if (blindSeat.bet !== 50) fail(`${otherId} 闷牌跟到 100 应投入 50（半价），实际 ${blindSeat.bet}`)
console.log(`✓ ${otherId}（闷牌）跟到同一档位，只投入 ${blindSeat.bet}（半价）`)

// 底池只认实际筹码（bet 里已含底注），半价优惠不影响底池口径
const expectedPot = actorSeat.bet + blindSeat.bet
if (st.pot !== expectedPot) fail(`底池应为 ${expectedPot}（实际投入之和），实际 ${st.pot}`)
console.log(`✓ 底池 ${st.pot} 按实际筹码累计（半价优惠不影响底池口径）`)

// 闷牌轮结束：补发剩余牌 + 所有人自动亮牌
st = await waitFor(a, 'room_state', (d) => d.stage === 'flop', '进入 flop')
for (const p of st.players) {
  if (p.blind) fail(`闷牌轮结束后 ${p.id} 不应仍是闷牌状态`)
}
console.log('✓ 闷牌轮结束，所有人自动亮牌，之后的轮次恢复全价')

// 关键：档位按实际最大投入重置，闷牌者要把省下的差额补回来
const flopTurn = await waitForOrNull(a, 'turn_to', (d) => d.currentBet === 100)
if (!flopTurn) {
  const seen = lastOf(a, 'turn_to')
  fail(`flop 轮档位应按实际最大投入重置为 100，实际 ${seen?.currentBet}`)
}
const firstInFlop = flopTurn.playerId
const flopFirst = firstInFlop === 'pba' ? a : b
const flopSecond = firstInFlop === 'pba' ? b : a

send(flopFirst, 'bet', { action: 'call' })
await wait(600)
send(flopSecond, 'bet', { action: 'call' })
await wait(800)

st = lastOf(a, 'room_state')
const finalActor = st.players.find((p) => p.id === actorId)
const finalBlind = st.players.find((p) => p.id === otherId)
if (finalBlind.bet !== finalActor.bet) {
  fail(
    `闷牌省下的差额应被补回：看牌者累计 ${finalActor.bet}，闷牌者累计 ${finalBlind.bet}，` +
      '两者应相等（否则等于永久半价）',
  )
}
console.log(`✓ 差额已补回：两人累计投入均为 ${finalActor.bet}`)
console.log('  → 闷牌买到的是"用一半价钱先看一张牌"，继续跟注则差额补回、最终投入相同')

console.log('\n✓ 闷牌轮全部通过')
a.close()
b.close()
process.exit(0)
