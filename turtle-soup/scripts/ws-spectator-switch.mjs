/**
 * 观战手动切换测试（等待阶段）
 * 场景：2人局 → 房主手动转观战（应顺位）→ 再转回玩家
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'SM' + Math.random().toString(36).slice(2, 8).toUpperCase()
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
  const [s1, s2] = [await connect({ id: 'm1', nickname: '甲' }), await connect({ id: 'm2', nickname: '乙' })]
  await wait(300)
  send(s1, 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 5 })
  await wait(400)

  // 房主手动转观战 → 房主应顺位给乙
  send(s1, 'set_spectator', { spectator: true })
  await wait(500)
  let st = lastState(s2)
  console.log(`甲转观战后：玩家=${st.players.length} 观战=${st.spectators.length} | 新房主=${st.hostId} (应为 m2)`)
  if (st.spectators.length !== 1 || st.hostId !== 'm2') {
    console.log('✗ 房主转观战后顺位失败'); process.exit(1)
  }
  console.log('✓ 房主转观战 + 房主顺位成功')

  // 观战转回玩家（等待阶段，有空位）
  send(s1, 'set_spectator', { spectator: false })
  await wait(500)
  st = lastState(s2)
  console.log(`甲转回玩家：玩家=${st.players.length} 观战=${st.spectators.length}`)
  if (st.players.length !== 2 || st.spectators.length !== 0) {
    console.log('✗ 观战转回玩家失败'); process.exit(1)
  }
  console.log('✓ 观战转回玩家成功')

  s1.close(); s2.close()
  await wait(200)
  console.log('\n✓ 手动切换全部通过')
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e); process.exit(1)
})
