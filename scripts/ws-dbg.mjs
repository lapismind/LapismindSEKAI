import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const roomId = 'DBG' + Math.random().toString(36).slice(2, 6).toUpperCase()

function connect(player) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE}?roomId=${roomId}&nickname=${player.nickname}&playerId=${player.id}`)
    ws.msgs = []
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString())
      ws.msgs.push(m)
      if (m.type !== 'game_state') console.log(`[${player.nickname}] 收到: ${m.type}`)
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const host = await connect({ id: 'dbg-h', nickname: '房主' })
await wait(400)
send(host, 'set_host_config', { mode: 'ai', maxPlayers: 2, questionLimit: 5 })
await wait(500)
const st = lastState(host)
console.log('mode:', st.mode)
console.log('amI:', JSON.stringify(st.amI))
console.log('players:', JSON.stringify(st.players.map((p) => ({ id: p.id, isHost: p.isHost, isModerator: p.isModerator }))))
console.log('canAIHint 应等于:', st.amI.isHost || (st.amI.isModerator && st.mode === 'human'))
process.exit(0)
