/**
 * 单人模式测试：AI 模式 1 人开局
 */
import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'S1' + Math.random().toString(36).slice(2, 8).toUpperCase()
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const ws = await new Promise((resolve, reject) => {
  const w = new WebSocket(`${BASE}?roomId=${roomId}&nickname=单人&playerId=solo-1&avatarId=1`)
  w.msgs = []
  w.on('open', () => resolve(w))
  w.on('error', reject)
  w.on('message', (d) => w.msgs.push(JSON.parse(d.toString())))
})
const lastState = () => {
  for (let i = ws.msgs.length - 1; i >= 0; i--) {
    if (ws.msgs[i].type === 'game_state') return ws.msgs[i].data
  }
  return null
}
const send = (type, data = {}) => ws.send(JSON.stringify({ type, data }))

// 设 AI 模式 + 1 人
send('set_host_config', { mode: 'ai', maxPlayers: 1, questionLimit: 5 })
await wait(400)
send('select_puzzle', { puzzleId: 'the-bar' })
await wait(400)

// 1 人开局
send('start_game')
await wait(600)
const st = lastState()
if (st.phase !== 'playing') {
  console.log('✗ 1 人 AI 开局失败, phase=', st.phase)
  process.exit(1)
}
console.log('✓ AI 模式 1 人开局成功')

// 单人提问 → AI 判定
console.log('单人提问，等 AI 判定…')
send('ask_question', { text: '他进酒吧是为了喝酒吗？' })
const t0 = Date.now()
while (Date.now() - t0 < 15000) {
  await wait(500)
  const cur = lastState()
  const last = cur.messages[cur.messages.length - 1]
  if (last?.from === 'moderator' && last.judge) {
    console.log('✓ AI 判定:', last.judge, '|', (last.reason ?? '').slice(0, 40))
    break
  }
}
const last = lastState().messages.slice(-1)[0]
if (last?.from !== 'moderator' || !last.judge) {
  console.log('✗ AI 判定失败'); process.exit(1)
}
console.log('\n✓ 单人模式全部通过')
ws.close()
process.exit(0)
