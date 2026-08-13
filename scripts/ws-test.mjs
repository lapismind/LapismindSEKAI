/**
 * 本地联调测试脚本（非生产代码，用完可删）
 * 模拟两个玩家连同一房间：加入→准备→开局→出牌
 *
 * 用法：node scripts/ws-test.mjs <roomId>
 */

const roomId = process.argv[2]
if (!roomId) {
  console.error('用法: node scripts/ws-test.mjs <roomId>')
  process.exit(1)
}

const BASE = 'ws://127.0.0.1:8787/ws'
const players = [
  { id: 'test-p1', nickname: '阿一' },
  { id: 'test-p2', nickname: '阿二' },
]

function connect(player) {
  const ws = new WebSocket(`${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}`)
  ws.messages = []
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    ws.messages.push(msg)
    console.log(`[${player.nickname}] 收到: ${msg.type}`, msg.data?.phase ?? '')
  }
  return ws
}

const sockets = players.map((p) => ({ ...p, ws: null, state: null }))

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function lastState(ws) {
  for (let i = ws.messages.length - 1; i >= 0; i--) {
    if (ws.messages[i].type === 'game_state') return ws.messages[i].data
  }
  return null
}

async function main() {
  console.log(`连入房间 ${roomId}...`)

  const openPromises = sockets.map((s) => {
    s.ws = connect(s)
    return new Promise((resolve, reject) => {
      s.ws.onopen = () => {
        console.log(`[${s.nickname}] 已连接`)
        resolve()
      }
      s.ws.onerror = (e) => reject(e)
    })
  })
  await Promise.all(openPromises)
  await wait(800)

  // 两个玩家都点准备
  sockets.forEach((s) => s.ws.send(JSON.stringify({ type: 'ready', data: {} })))
  console.log('两人都点了准备')
  await wait(800)

  // 看谁先手，让先手出一张 >= 0 的牌（首手随意）
  const p1State = lastState(sockets[0].ws)
  const currentPlayerId = p1State?.currentPlayerId
  console.log(`先手: ${currentPlayerId}`)

  const actor = sockets.find((s) => s.id === currentPlayerId)
  const me = lastState(actor.ws).players.find((p) => p.id === actor.id)
  const firstCard = me.hand[0]
  console.log(`[${actor.nickname}] 出 ${firstCard.suit}-${firstCard.rank}`)
  actor.ws.send(JSON.stringify({ type: 'play_card', data: { cardId: firstCard.id } }))
  await wait(800)

  const p2State = lastState(sockets[1].ws)
  console.log('第二家当前手牌数:', p2State.players.find((p) => p.id === 'test-p2')?.handCount)

  const ok = p2State?.topCard?.id === firstCard.id
  console.log(ok ? '\n✓ 出牌已同步到对方桌面' : '\n✗ 桌面未同步')

  // 验证回合轮转：桌面牌是 club-5(rank5)，下家必须出 >= 5
  await wait(400)
  const current2 = lastState(actor.ws).currentPlayerId
  console.log(`出牌后当前回合者: ${current2}（应为 ${actor.id === 'test-p1' ? 'test-p2' : 'test-p1'}）`)

  // 下家尝试出小牌（应被拒）——先找一张 rank < 5 的牌
  const other = sockets.find((s) => s.id !== actor.id)
  const otherMe = lastState(other.ws).players.find((p) => p.id === other.id)
  const small = otherMe.hand.find((c) => c.rank < 5)
  const sentBefore = other.ws.messages.length
  if (small) {
    console.log(`[${other.nickname}] 尝试非法出牌 ${small.suit}-${small.rank}（< 5）`)
    other.ws.send(JSON.stringify({ type: 'play_card', data: { cardId: small.id } }))
    await wait(600)
    const gotError = other.ws.messages.some((m) => m.type === 'error')
    const topChanged = lastState(other.ws).topCard?.id !== firstCard.id
    console.log(`收到 error: ${gotError} | 桌面未变: ${!topChanged}`)
    if (!gotError || topChanged) {
      console.log('✗ 非法出牌未被正确拦截')
      process.exit(1)
    }
    console.log('✓ 非法出牌被拦截')
  } else {
    console.log('（跳过：下家手里没有 <5 的牌可测）')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
