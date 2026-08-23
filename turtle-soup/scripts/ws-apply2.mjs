/**
 * 主持人报名机制测试（用 ws 库，避免原生 WebSocket 多连接在 Windows 上的 bug）
 * 场景1：3人，甲乙报名 → 随机选；场景2：仅丙报名 → 直接当选
 * 用法：node scripts/ws-apply2.mjs
 */

import WebSocket from 'ws'

const BASE = 'ws://127.0.0.1:8788/ws'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(roomId, player) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${BASE}?roomId=${roomId}&nickname=${encodeURIComponent(player.nickname)}&playerId=${player.id}`,
    )
    ws.msgs = []
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    ws.on('message', (data) => ws.msgs.push(JSON.parse(data.toString())))
  })
}

function lastState(ws) {
  for (let i = ws.msgs.length - 1; i >= 0; i--) {
    if (ws.msgs[i].type === 'game_state') return ws.msgs[i].data
  }
  return null
}

function send(ws, type, data = {}) {
  ws.send(JSON.stringify({ type, data }))
}

async function roomFlow(players, applicants) {
  const roomId = 'A' + Math.random().toString(36).slice(2, 8).toUpperCase()
  const sockets = {}
  for (const p of players) {
    sockets[p.id] = await connect(roomId, p)
    await wait(150)
  }
  const hostId = players[0].id
  send(sockets[hostId], 'set_host_config', { mode: 'human', maxPlayers: players.length, questionLimit: null })
  await wait(300)
  send(sockets[hostId], 'select_puzzle', { puzzleId: 'the-mirror' })
  await wait(300)
  for (const id of applicants) {
    send(sockets[id], 'apply_moderator', { apply: true })
  }
  await wait(300)
  send(sockets[hostId], 'start_game')
  await wait(500)
  const st = lastState(sockets[players[0].id])
  for (const ws of Object.values(sockets)) ws.close()
  return st
}

async function main() {
  // 场景1：多人报名随机选
  const players1 = [
    { id: 'a1', nickname: '甲' },
    { id: 'a2', nickname: '乙' },
    { id: 'a3', nickname: '丙' },
  ]
  const st1 = await roomFlow(players1, ['a1', 'a2'])
  const mod1 = st1.players.find((p) => p.isModerator)
  console.log('场景1 报名数:', st1.moderatorApplicants.length, '(应为2)')
  console.log('场景1 主持人:', mod1.nickname)
  if (!['甲', '乙'].includes(mod1.nickname)) {
    console.log('✗ 主持人应从报名者中选出')
    process.exit(1)
  }
  console.log('✓ 多人报名从报名者中随机选')
  await wait(300)

  // 场景2：单人报名直接当选
  const players2 = [
    { id: 'b1', nickname: '丁' },
    { id: 'b2', nickname: '戊' },
    { id: 'b3', nickname: '己' },
  ]
  const st2 = await roomFlow(players2, ['b3'])
  const mod2 = st2.players.find((p) => p.isModerator)
  console.log('场景2 报名数:', st2.moderatorApplicants.length, '(应为1)')
  console.log('场景2 主持人:', mod2.nickname, '(应为 己)')
  if (mod2.nickname !== '己') {
    console.log('✗ 单人报名应直接当选')
    process.exit(1)
  }
  console.log('✓ 单人报名直接当选')

  console.log('\n✓ 报名机制全部通过')
  process.exit(0)
}

main().catch((e) => {
  console.error('测试失败:', e)
  process.exit(1)
})
