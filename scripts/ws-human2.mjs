/**
 * 真人主持全流程回归（ws 库）
 * 用法：node scripts/ws-human2.mjs
 */

import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'H' + Math.random().toString(36).slice(2, 8).toUpperCase()
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
  const players = [
    { id: 'h1', nickname: '房主' },
    { id: 'h2', nickname: '乙' },
  ]
  const [s1, s2] = [await connect(players[0]), await connect(players[1])]
  await wait(400)

  send(s1, 'set_host_config', { mode: 'human', maxPlayers: 2, questionLimit: 10 })
  await wait(300)
  send(s1, 'select_puzzle', { puzzleId: 'the-bar' })
  await wait(300)
  // 房主报名当主持人
  send(s1, 'apply_moderator', { apply: true })
  await wait(300)
  send(s1, 'start_game')
  await wait(500)

  let st = lastState(s1)
  if (st.phase !== 'playing') {
    console.log('✗ 开局失败'); process.exit(1)
  }
  const mod = st.players.find((p) => p.isModerator)
  console.log('✓ 开局成功，主持人:', mod.nickname, '(房主报名应当选)')
  if (mod.id !== 'h1') {
    console.log('✗ 报名者应优先当选'); process.exit(1)
  }

  // 玩家提问 → 主持人判定
  send(s2, 'ask_question', { text: '这个男人在钓鱼吗？' })
  await wait(500)
  send(s1, 'moderator_judge', { judge: 'no', reason: '不在钓鱼' })
  await wait(500)
  st = lastState(s2)
  const last = st.messages[st.messages.length - 1]
  console.log('✓ 判定:', last.judge, '| 问题数:', st.questionCount + '/' + st.questionLimit)
  if (last.judge !== 'no') {
    console.log('✗ 判定失败'); process.exit(1)
  }

  // 提交答案：主持人确认正确 → 结束
  send(s2, 'guess_answer', { text: '他是被水淹死的' })
  await wait(400)
  send(s1, 'moderator_judge', { judge: 'correct' })
  await wait(500)
  st = lastState(s2)
  console.log('✓ 结束阶段:', st.phase, '| 胜者:', st.winnerId)
  if (st.phase !== 'ended') {
    console.log('✗ 揭底未生效'); process.exit(1)
  }

  console.log('\n✓ 真人主持全流程通过')
  s1.close(); s2.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e); process.exit(1)
})
