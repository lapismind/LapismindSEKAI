/**
 * Hibernation 恢复测试：连接后等待 DO 休眠，再操作，验证 attachment 方案。
 * 用法：node scripts/ws-hibernation-test.mjs <roomId>
 */

const roomId = process.argv[2]
if (!roomId) {
  console.error('用法: node scripts/ws-hibernation-test.mjs <roomId>')
  process.exit(1)
}

const BASE = 'ws://127.0.0.1:8787/ws'
const players = [
  { id: 'hb-p1', nickname: '休眠甲' },
  { id: 'hb-p2', nickname: '休眠乙' },
]
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const lastState = (ws) => {
  for (let i = ws.msgs.length - 1; i >= 0; i--) {
    if (ws.msgs[i].type === 'game_state') return ws.msgs[i].data
  }
  return null
}

function connect(player) {
  const ws = new WebSocket(`${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}`)
  ws.msgs = []
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    ws.msgs.push(msg)
    if (msg.type !== 'game_state') {
      console.log(`[${player.nickname}] 收到: ${msg.type}`)
    }
  }
  return ws
}

async function main() {
  const sockets = players.map((p) => connect(p))

  await Promise.all(
    sockets.map(
      (ws, i) =>
        new Promise((resolve, reject) => {
          ws.onopen = () => {
            console.log(`[${players[i].nickname}] 已连接`)
            resolve()
          }
          ws.onerror = reject
        }),
    ),
  )

  console.log('等待 20 秒让 DO 进入 Hibernation...')
  await wait(20000)

  console.log('休眠唤醒后，两人点准备')
  sockets.forEach((ws) => ws.send(JSON.stringify({ type: 'ready', data: {} })))
  await wait(2000)

  const st = lastState(sockets[0])
  if (st?.phase !== 'playing') {
    console.log(`✗ 休眠后开局失败，phase=${st?.phase}`)
    process.exit(1)
  }
  console.log('✓ 休眠后开局成功')

  const cur = st.currentPlayerId
  const aIdx = players.findIndex((p) => p.id === cur)
  const me = lastState(sockets[aIdx]).players.find((p) => p.id === players[aIdx].id)
  if (!me.hand.length) process.exit(1)
  const card = me.hand[0]
  console.log(`[${players[aIdx].nickname}] 休眠后出牌 ${card.suit}-${card.rank}`)
  sockets[aIdx].send(JSON.stringify({ type: 'play_card', data: { cardId: card.id } }))
  await wait(2000)

  const sync = lastState(sockets[1 - aIdx]).topCard?.id === card.id
  console.log(sync ? '✓ 休眠后出牌同步成功' : '✗ 休眠后出牌未同步')
  process.exit(sync ? 0 : 1)
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
