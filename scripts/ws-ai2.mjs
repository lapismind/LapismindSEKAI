/**
 * AI 主持全流程回归（ws 库，需要 AI key）
 * 用法：node scripts/ws-ai2.mjs
 */

import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'AI' + Math.random().toString(36).slice(2, 8).toUpperCase()
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
    { id: 'ai1', nickname: '甲' },
    { id: 'ai2', nickname: '乙' },
  ]
  const [s1, s2] = [await connect(players[0]), await connect(players[1])]
  await wait(400)

  send(s1, 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 3 })
  await wait(300)
  send(s1, 'select_puzzle', { puzzleId: 'the-bar' })
  await wait(300)
  send(s1, 'start_game')
  await wait(500)

  let st = lastState(s1)
  if (st.phase !== 'playing') {
    console.log('✗ 开局失败'); process.exit(1)
  }
  console.log('✓ 开局成功 mode=ai')

  // AI 提问判定
  console.log('玩家提问，等待 AI 判定…')
  send(s2, 'ask_question', { text: '这个男人进酒吧是为了喝酒吗？' })
  await wait(8000)
  st = lastState(s2)
  const last = st.messages[st.messages.length - 1]
  console.log('AI 判定:', last.judge, '|', (last.reason ?? '').slice(0, 40))
  if (last.from !== 'moderator' || !last.judge) {
    console.log('✗ AI 判定失败'); process.exit(1)
  }

  // 耗尽问题（每问等 AI 判定完成）
  const baseCount = st.questionCount
  while (lastState(s2).questionCount < st.questionLimit) {
    const before = lastState(s2).questionCount
    send(s2, 'ask_question', { text: '再问一个' + before })
    // 等 questionCount 增长或 AI 判定落盘
    const t0 = Date.now()
    while (Date.now() - t0 < 15000) {
      await wait(500)
      const cur = lastState(s2)
      if (cur.questionCount > before) break
    }
  }
  st = lastState(s2)
  console.log('问题计数:', st.questionCount + '/' + st.questionLimit, '| 耗尽:', st.questionsExhausted)
  if (!st.questionsExhausted) {
    console.log('✗ 问题耗尽未生效'); process.exit(1)
  }

  // AI 复盘提示
  console.log('触发 AI 复盘提示…')
  send(s1, 'ai_hint')
  await wait(8000)
  st = lastState(s1)
  const hints = st.reviewNotes.filter((n) => n.kind === 'ai')
  console.log(hints.length ? '✓ AI 复盘: ' + hints[hints.length - 1].text.slice(0, 60) : '✗ 复盘未生成')
  if (!hints.length) process.exit(1)

  console.log('\n✓ AI 主持全流程通过')
  s1.close(); s2.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e); process.exit(1)
})
