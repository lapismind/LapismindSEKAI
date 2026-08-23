/**
 * 规则测试：全场跳过 → 桌面重置回到最后出牌者
 * 2 人局流程：A 出牌(尽可能大) → B 跳过 → 应重置回 A 重新起头(topCard=null)
 * 用法：node scripts/ws-rule-k.mjs <roomId>
 */

const roomId = process.argv[2]
if (!roomId) {
  console.error('用法: node scripts/ws-rule-k.mjs <roomId>')
  process.exit(1)
}

const BASE = 'ws://127.0.0.1:8787/ws'
const players = [
  { id: 'k-p1', nickname: 'K甲' },
  { id: 'k-p2', nickname: 'K乙' },
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
    if (msg.type !== 'game_state') console.log(`[${player.nickname}] 收到: ${msg.type}`, msg.data?.message ?? '')
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
  await wait(800)

  // 两人准备开局
  sockets.forEach((ws) => ws.send(JSON.stringify({ type: 'ready', data: {} })))
  await wait(1000)

  let st = lastState(sockets[0])
  if (st.phase !== 'playing') {
    console.log('✗ 未能开局')
    process.exit(1)
  }

  // 先手出最大一张牌
  const firstId = st.currentPlayerId
  const firstIdx = players.findIndex((p) => p.id === firstId)
  const otherIdx = 1 - firstIdx
  const otherId = players[otherIdx].id
  const firstHand = lastState(sockets[firstIdx]).players.find((p) => p.id === firstId).hand
  const card = [...firstHand].sort((a, b) => b.rank - a.rank)[0]
  console.log(`[${firstId}] 先手打出全场最大 ${card.suit}-${card.rank}`)
  sockets[firstIdx].send(JSON.stringify({ type: 'play_card', data: { cardId: card.id } }))
  await wait(800)

  // 另一人跳过（此时没有比它大的牌）
  console.log(`[${otherId}] 跳过`)
  sockets[otherIdx].send(JSON.stringify({ type: 'skip_turn', data: {} }))
  await wait(800)

  st = lastState(sockets[firstIdx])
  const ok = st.topCard === null && st.currentPlayerId === firstId
  console.log(`当前桌面: ${st.topCard ? st.topCard.suit + '-' + st.topCard.rank : '空(已重置)'} | 当前回合: ${st.currentPlayerId}`)
  console.log(ok ? '✓ 修复生效：全场跳过 → 桌面重置，回到出牌者重新起头' : '✗ 重置逻辑未生效')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
