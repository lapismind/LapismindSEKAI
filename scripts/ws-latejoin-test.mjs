/**
 * 游戏开始后加入 → 自动观战测试
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'GS' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(player) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}&avatarId=1`,
    )
    ws.msgs = []
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('message', (d) => ws.msgs.push(JSON.parse(d.toString())))
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
  const [s1, s2] = [await connect({ id: 'g1', nickname: '甲' }), await connect({ id: 'g2', nickname: '乙' })]
  await wait(300)
  send(s1, 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 10 })
  await wait(300)
  send(s1, 'select_puzzle', { puzzleId: 'the-bar' })
  await wait(300)
  send(s1, 'start_game')
  await wait(500)
  if (lastState(s1).phase !== 'playing') { console.log('✗ 开局失败'); process.exit(1) }
  console.log('✓ 开局成功（2 人）')

  // 游戏开始后第 3 人加入
  const s3 = await connect({ id: 'g3', nickname: '丙' })
  await wait(400)
  const st = lastState(s3)
  console.log(`第 3 人加入后：玩家=${st.players.length} 观战=${st.spectators.length}`)
  const isSpec = st.amI.isSpectator
  if (st.spectators.length !== 1 || !isSpec) {
    console.log('✗ 游戏开始后加入未自动变观战'); process.exit(1)
  }
  console.log('✓ 游戏开始后加入自动观战，amI.isSpectator=' + isSpec)

  // 观战不能提问
  send(s3, 'ask_question', { text: '观战提问' })
  await wait(400)
  const errs = s3.msgs.filter((m) => m.type === 'error')
  if (errs.length === 0) { console.log('✗ 观战提问未被拒'); process.exit(1) }
  console.log('✓ 观战提问被拒绝')

  s1.close(); s2.close(); s3.close()
  await wait(200)
  console.log('\n✓ 游戏开始后观战全部通过')
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e); process.exit(1)
})
