/**
 * 梭哈完整流程联调测试（需先 `npx wrangler dev --port 8788`）
 *
 * 场景：双人五张梭哈 → 设配置 → 开局 → 逐阶段下注（含一次加注）→ 摊牌 → 结算
 *
 * 除了跑通流程，这里还校验两条容易被静默破坏的不变量：
 *   1. 开局只发第一阶段牌（五张模式 1 暗 1 明），不是一次性发满 5 张；
 *   2. 每次下注后客户端都会收到更新过的 room_state —— 底池/各座位投入必须实时可见，
 *      否则一整轮下注期间这两个数字都是冻结的。
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SH' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect(playerId, nickname) {
  const ws = await new Promise((resolve, reject) => {
    const w = new WebSocket(`${BASE}?roomId=${roomId}&nickname=${nickname}&playerId=${playerId}&avatarId=1`)
    w.msgs = []
    w.pid = playerId
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

const a = await connect('pa', '阿甲')
const b = await connect('pb', '阿乙')
await wait(500)

// 房主设配置：五张梭哈，1 局，初始筹码 1000
send(a, 'set_host_config', { mode: 'five', rounds: 1, initialChips: 1000 })
await wait(400)
send(a, 'start_game')
await wait(600)

let st = lastOf(a, 'room_state')
if (!st || st.phase !== 'playing') fail('开局失败, phase=' + st?.phase)
console.log('✓ 开局成功, mode=', st.config.mode)

// 开局是闷牌轮：只发 1 张暗牌，没有明牌
const handA = lastOf(a, 'your_hand')
const handB = lastOf(b, 'your_hand')
if (!handA || handA.cards.length !== 1) fail(`甲开局应收到 1 张暗牌，实际 ${handA?.cards?.length}`)
if (!handB || handB.cards.length !== 1) fail(`乙开局应收到 1 张暗牌，实际 ${handB?.cards?.length}`)
const darkA = handA.cards.filter((c) => c.hidden).length
const lightA = handA.cards.filter((c) => !c.hidden).length
const concealedA = handA.cards.filter((c) => c.concealed).length
if (darkA !== 1 || lightA !== 0) fail(`闷牌轮应为 1 暗 0 明，实际 ${darkA} 暗 ${lightA} 明`)
if (concealedA !== 1) fail('闷牌期间服务端应以占位符下发，不能把牌面发给本人')
console.log('✓ 闷牌轮发牌 1 张暗牌，且牌面未下发给本人')

// 事件驱动地推进下注：每个 turn_to 只处理一次。
// 第一次行动的人加注到 100，之后所有人跟注。
const actedCount = { pa: 0, pb: 0 }
const byPid = { pa: a, pb: b }
let raised = false

for (let step = 0; step < 60; step++) {
  await wait(150)
  const cur = lastOf(a, 'room_state')
  if (cur?.phase !== 'playing') break

  for (const pid of ['pa', 'pb']) {
    const ws = byPid[pid]
    const turns = of(ws, 'turn_to')
    while (actedCount[pid] < turns.length) {
      const turn = turns[actedCount[pid]].data
      actedCount[pid] += 1
      const snapshot = lastOf(ws, 'room_state')
      const me = snapshot.players.find((p) => p.id === turn.playerId)
      const target = byPid[turn.playerId]
      if (!target) continue
      // 该玩家若不行动，服务端 30 秒后会替他弃牌，这一步必须发出去
      if (!raised && turn.playerId === pid && me.chips > 100) {
        send(target, 'bet', { action: 'raise', amount: 100 })
        raised = true
      } else if (me.chips > 0 && !me.allIn && !me.folded) {
        send(target, 'bet', { action: 'call' })
      }
    }
  }
}

const statesA = of(a, 'room_state')
const betsA = of(a, 'bet_result')
const sd = lastOf(a, 'showdown')
const go = lastOf(a, 'game_over')

if (!sd) fail('没有摊牌消息')
if (!go) fail('没有本局结算消息')

// 不变量 2：每次下注都伴随一次 room_state 重播
if (statesA.length <= betsA.length) {
  fail(`下注期间应重播 room_state：收到 ${betsA.length} 条 bet_result，却只有 ${statesA.length} 条 room_state`)
}
// 不变量 2：下注期间底池必须实时可见（不能一整轮冻结到轮末才跳一次）。
// 这里断言的是"底池在变"，不是一个具体数值 —— 具体金额取决于半价规则，
// 两个玩家都闷牌时加到 100 各付 40，底池最多就是 100。
const potSeq = statesA.map((m) => m.data.pot)
const distinctPots = [...new Set(potSeq)]
// 开局底池 = 各家底注之和，第一个非零值就是它
const antePot = distinctPots.find((v) => v > 0) ?? 0
if (distinctPots.length < 3 || Math.max(...distinctPots) <= antePot) {
  fail(
    '下注期间底池没有实时更新（底池被冻结了）\n' +
      `  观测到的底池序列: ${JSON.stringify(potSeq)}\n` +
      `  下注次数: ${betsA.length}，开局底池: ${antePot}`,
  )
}
console.log(`✓ 下注实时更新：${betsA.length} 次下注 / ${statesA.length} 次 room_state 重播`)
console.log(`  底池变化: ${distinctPots.join(' → ')}`)

console.log('✓ 摊牌:', sd.hands.map((h) => `${h.nickname}:${h.handName || '弃牌'}`).join(' | '))
console.log('✓ 赢家:', sd.winners.map((w) => `${w.playerId}+${w.amount}`).join(', '))
console.log('✓ 本局结算: 第', go.round, '/', go.totalRounds, '局')
if (go.standings.length !== 2) fail(`最终排名应含 2 人，实际 ${go.standings.length}`)

// 摊牌后每人的筹码之和应守恒（初始 1000 × 2）
const total = sd.hands.reduce((sum, h) => sum + h.delta, 0)
if (total !== 0) fail(`本局净变化之和应为 0，实际 ${total}`)
console.log('✓ 筹码守恒：本局净变化合计 0')

console.log('\n✓ 梭哈完整流程全部通过')
a.close()
b.close()
process.exit(0)
