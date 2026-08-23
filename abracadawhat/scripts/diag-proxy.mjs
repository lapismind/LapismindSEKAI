import WebSocket from 'ws'
const ws = new WebSocket('ws://localhost:5174/ws?roomId=PROXY9&playerId=py&nickname=PY')
ws.on('open', () => console.log('proxy-ws open'))
ws.on('message', (m) => { console.log('msg:', m.toString().slice(0, 80)); process.exit(0) })
ws.on('error', (e) => { console.log('ERR:', e.message); process.exit(1) })
setTimeout(() => { console.log('TIMEOUT no msg'); process.exit(1) }, 5000)
