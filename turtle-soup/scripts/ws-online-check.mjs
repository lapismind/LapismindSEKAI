/**
 * 线上 AI 判定验证（连生产环境）
 * 用法：node scripts/ws-online-check.mjs
 */

import WebSocket from 'ws'

const BASE = 'wss://turtle-soup.soiciactlybm.workers.dev/ws'
const roomId = 'ON' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(player) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}`,
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
  console.log('连接线上房间', roomId)
  const players = [
    { id: 'on1', nickname: '甲' },
    { id: 'on2', nickname: '乙' },
  ]
  const [s1, s2] = [await connect(players[0]), await connect(players[1])]
  console.log('✓ 双人已连接')
  await wait(500)

  send(s1, 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 5 })
  await wait(400)
  send(s1, 'select_puzzle', { puzzleId: 'the-bar' })
  await wait(400)
  send(s1, 'start_game')
  await wait(600)
  if (lastState(s1).phase !== 'playing') {
    console.log('✗ 开局失败'); process.exit(1)
  }
  console.log('✓ 开局成功')

  console.log('玩家提问 → 线上 AI 判定…')
  send(s2, 'ask_question', { text: '男人进酒吧是为了喝酒吗？' })
  const t0 = Date.now()
  while (Date.now() - t0 < 20000) {
    await wait(500)
    const st = lastState(s2)
    const last = st.messages[st.messages.length - 1]
    if (last?.from === 'moderator' && last.judge) {
      console.log('✓ 线上 AI 判定:', last.judge, '|', (last.reason ?? '').slice(0, 50))
      break
    }
  }
  const st = lastState(s2)
  const last = st.messages[st.messages.length - 1]
  if (last?.from !== 'moderator' || !last.judge) {
    console.log('✗ 线上 AI 判定失败'); process.exit(1)
  }
  console.log('\n✓ 线上 AI 主持链路全部正常')
  s1.close(); s2.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e); process.exit(1)
})
