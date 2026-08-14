import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function runTest(puzzleId, questions) {
  const roomId = 'T' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const ws = await new Promise((res, rej) => {
    const w = new WebSocket(`${BASE}?roomId=${roomId}&nickname=测&playerId=t1&avatarId=1`)
    w.msgs = []
    w.on('open', () => res(w))
    w.on('error', rej)
    w.on('message', (d) => w.msgs.push(JSON.parse(d)))
  })
  const send = (t, d = {}) => ws.send(JSON.stringify({ type: t, data: d }))
  const lastState = () => {
    for (let i = ws.msgs.length - 1; i >= 0; i--) if (ws.msgs[i].type === 'game_state') return ws.msgs[i].data
    return null
  }
  const lastJudge = () => {
    const st = lastState()
    const last = st?.messages?.slice(-1)[0]
    return last
  }

  send('set_host_config', { mode: 'ai', maxPlayers: 1, questionLimit: 20 })
  await wait(300)
  send('select_puzzle', { puzzleId })
  await wait(300)
  send('start_game')
  await wait(500)

  console.log(`\n=== 谜题: ${puzzleId} ===`)
  let judgeCount = 0
  for (const q of questions) {
    send('ask_question', { text: q })
    const t0 = Date.now()
    while (Date.now() - t0 < 12000) {
      await wait(400)
      const st = lastState()
      const count = (st?.messages ?? []).filter((m) => m.judge).length
      if (count > judgeCount) break
    }
    const st = lastState()
    const last = st.messages.filter((m) => m.judge).slice(-1)[0]
    judgeCount = st.messages.filter((m) => m.judge).length
    console.log(`  "${q}" → ${last?.judge ?? '?'} | ${(last?.reason ?? '').slice(0, 40)}`)
  }
  ws.close()
  await wait(200)
}

// 酒吧题：打嗝治疗
await runTest('the-bar', [
  '男人进酒吧是为了喝酒吗？',
  '酒保掏枪是为了抢劫吗？',
  '这把枪是假的吗？',
  '男人有打嗝的问题吗？',
  '酒保是在帮他治打嗝吗？',
])

// 盲人电话题
await runTest('the-phone-call', [
  '丈夫是盲人吗？',
  '他能看见吗？',
  '屋子里的是他真正的妻子吗？',
  '电话是打给他的吗？',
  '他逃命是因为屋里危险吗？',
])

// 钓鱼椅题
await runTest('dead-fisherman', [
  '他是被淹死的吗？',
  '他是被谋杀的吗？',
  '这与河水水位上涨有关吗？',
  '他是自杀的吗？',
  '椅子所在的地方塌方了吗？',
])

process.exit(0)
