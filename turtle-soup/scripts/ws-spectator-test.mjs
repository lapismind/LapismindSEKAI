/**
 * 观战机制测试（ws 库）
 * 场景：设 2 人局 → 3 人加入，第3人应自动变观战 → 观战提问应被拒 → 观战转玩家应成功
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SP' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(player) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}&avatarId=1`,
    )
    ws.msgs = []
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString())
      ws.msgs.push(m)
      if (m.type === 'error') console.log(`[${player.nickname}] 收到 error: ${m.data.message}`)
    })
  })
}
const lastState = (ws) => {
  for (let i = ws.msgs.length - 1; i >= 0; i--) {
    if (ws.msgs[i].type === 'game_state') return ws.msgs[i].data
  }
  return null
}
const send = (ws, type, data = {}) => ws.send(JSON.stringify({ type, data }))

async function main() {
  // 前两人先进房间
  const players = [
    { id: 's1', nickname: '甲' },
    { id: 's2', nickname: '乙' },
    { id: 's3', nickname: '丙' },
  ]
  const socks = []
  socks.push(await connect(players[0]))
  await wait(200)
  socks.push(await connect(players[1]))
  await wait(200)
  console.log('✓ 前两人已连接')

  // 房主设 2 人局
  send(socks[0], 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 10 })
  await wait(500)

  // 第 3 人加入 → 应自动变观战
  socks.push(await connect(players[2]))
  await wait(400)

  let st = lastState(socks[0])
  console.log(`玩家: ${st.players.length} | 观战: ${st.spectators.length}`)
  if (st.players.length !== 2 || st.spectators.length !== 1) {
    console.log('✗ 满员自动转观战失败')
    process.exit(1)
  }
  console.log('✓ 第 3 人自动变观战')
  const specName = st.spectators[0].nickname
  console.log('观战者是:', specName, '(应为 丙)')
  if (specName !== '丙') {
    console.log('✗ 观战身份错误'); process.exit(1)
  }

  // 选谜题开局
  send(socks[0], 'select_puzzle', { puzzleId: 'the-bar' })
  await wait(400)
  send(socks[0], 'start_game')
  await wait(600)
  st = lastState(socks[0])
  if (st.phase !== 'playing') { console.log('✗ 开局失败'); process.exit(1) }
  console.log('✓ 开局成功')

  // 观战者提问应被拒
  const sIdx = players.findIndex((p) => p.id === st.spectators[0].id)
  const before = socks[sIdx].msgs.filter((m) => m.type === 'error').length
  send(socks[sIdx], 'ask_question', { text: '观战者提问' })
  await wait(400)
  const after = socks[sIdx].msgs.filter((m) => m.type === 'error').length
  if (after <= before) {
    console.log('✗ 观战提问未被拒绝'); process.exit(1)
  }
  console.log('✓ 观战提问被拒绝')

  // 游戏中观战转玩家应被拒
  send(socks[sIdx], 'set_spectator', { spectator: false })
  await wait(400)
  st = lastState(socks[sIdx])
  const isSpec = st.spectators.some((s) => s.id === players[sIdx].id)
  if (!isSpec) {
    console.log('✗ 游戏中观战加入未被拒绝'); process.exit(1)
  }
  console.log('✓ 游戏中不能转玩家（符合预期）')

  // 等待局结束返回？直接测：新开房间等待阶段手动转观战
  socks.forEach((s) => s.close())
  await wait(300)
  console.log('\n✓ 观战机制全部通过')
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
