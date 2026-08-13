const roomId = process.argv[2] || 'HX4KQA'
const ws = new WebSocket(
  'wss://card-game.soiciactlybm.workers.dev/ws?roomId=' + roomId +
  '&nickname=test&playerId=diag-1'
)
ws.onopen = () => { console.log('OPEN') }
ws.onclose = (e) => { console.log('CLOSE code=' + e.code + ' reason=' + e.reason) }
ws.onerror = (e) => { console.log('ERROR', e.type, e.message ?? '') }
ws.onmessage = (e) => { console.log('MSG', e.data) }
setTimeout(() => { console.log('timeout'); process.exit(0) }, 10000)
