import WebSocket from 'ws'

const ROOM = 'H' + Math.random().toString(36).slice(2, 6).toUpperCase()
function connect(id) {
  return new Promise((res) => {
    const ws = new WebSocket('ws://127.0.0.1:8787/ws?roomId=' + ROOM + '&playerId=' + id + '&nickname=' + id)
    const s = { ws, id, q: [] }
    ws.on('open', () => res(s))
    ws.on('message', (m) => s.q.push(JSON.parse(m.toString())))
  })
}
const a = await connect('a')
const b = await connect('b')
await new Promise((r) => setTimeout(r, 800))
a.q = []; b.q = []
a.ws.send(JSON.stringify({ type: 'start_round', data: {} }))
await new Promise((r) => setTimeout(r, 1000))
const before = a.q.filter((m) => m.type === 'room_state').at(-1)
console.log('before cast: a.health =', before.data.players.find((p) => p.id === 'a').health)
a.q = []; b.q = []
a.ws.send(JSON.stringify({ type: 'cast', data: { spellId: 1 } }))
await new Promise((r) => setTimeout(r, 1000))
for (const m of b.q) {
  if (m.type === 'cast_result') console.log('cast_result:', m.data.type, 'damage:', m.data.damage)
  if (m.type === 'room_state') {
    const p = m.data.players.find((p) => p.id === 'a')
    console.log('room_state: phase=' + m.data.phase, 'a.health =', p.health)
  }
}
process.exit(0)
