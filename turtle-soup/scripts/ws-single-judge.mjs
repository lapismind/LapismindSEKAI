import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function askOne(puzzleId, question) {
  const roomId = 'Q' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const ws = await new Promise((res, rej) => {
    const w = new WebSocket(`${BASE}?roomId=${roomId}&nickname=测&playerId=q1&avatarId=1`)
    w.msgs = []
    w.on('open', () => res(w))
    w.on('error', rej)
    w.on('message', (d) => w.msgs.push(JSON.parse(d)))
  })
  const send = (t, d = {}) => ws.send(JSON.stringify({ type: t, data: d }))
  const lastJudge = () => {
    for (let i = ws.msgs.length - 1; i >= 0; i--) {
      const m = ws.msgs[i]
      if (m.type === 'game_state') {
        const judges = m.data.messages.filter((x) => x.judge)
        if (judges.length) return judges[judges.length - 1]
      }
    }
    return null
  }

  send('set_host_config', { mode: 'ai', maxPlayers: 1, questionLimit: 5 })
  await wait(300)
  send('select_puzzle', { puzzleId })
  await wait(300)
  send('start_game')
  await wait(500)

  send('ask_question', { text: question })
  const t0 = Date.now()
  let result = null
  while (Date.now() - t0 < 15000) {
    await wait(500)
    const j = lastJudge()
    if (j) { result = j; break }
  }
  ws.close()
  await wait(300)
  return result ? `${result.judge} | ${result.reason}` : '超时'
}

console.log('the-bar "男人有打嗝的问题吗？":', await askOne('the-bar', '男人有打嗝的问题吗？'))
console.log('the-phone-call "他能看见吗？":', await askOne('the-phone-call', '他能看见吗？'))
console.log('dead-fisherman "他是自杀的吗？":', await askOne('dead-fisherman', '他是自杀的吗？'))
console.log('the-mirror "镜子有鬼吗？":', await askOne('the-mirror', '镜子里有鬼吗？'))
console.log('the-doctor "医生是女性吗？":', await askOne('the-doctor', '医生是女的吗？'))
process.exit(0)
