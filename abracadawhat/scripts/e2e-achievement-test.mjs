/**
 * scripts/e2e-achievement-test.mjs —— 成就系统端到端测试。
 * 模拟 3 名玩家打完整场（有人达到 8 分触发 game_over），
 * 验证：战绩上报 → auth 判定 → 新成就在房间内广播。
 * 前提：auth dev 在 8788、abraca dev 在 8789。
 */

import WebSocket from 'ws'

const BASE = 'http://127.0.0.1:8789'
const ROOM = 'E2E' + Math.random().toString(36).slice(2, 6).toUpperCase()
const GATHER_MS = 120000

// 盲选施法顺序：先猜最常见（8 药水），失败后逐级降级到龙
const CAST_ORDER = [8, 7, 5, 3, 2, 4, 6, 1]

function makeSocket(playerId, nickname, token) {
  return new Promise((resolve, reject) => {
    let url = 'ws://127.0.0.1:8789/ws?roomId=' + ROOM + '&playerId=' + playerId +
      '&nickname=' + encodeURIComponent(nickname) + '&avatarId=1'
    if (token) url += '&token=' + encodeURIComponent(token)
    const ws = new WebSocket(url)
    const st = { ws, playerId, queue: [], unlocked: [] }
    ws.on('open', () => resolve(st))
    ws.on('error', reject)
   ws.on('message', (raw) => {
     const msg = JSON.parse(raw.toString())
      if (process.env.E2E_VERBOSE) console.log('  [' + st.playerId + ' recv]', msg.type)
     if (msg.type === 'achievements_unlocked') {
        for (const a of msg.data || []) {
          st.unlocked.push(a)
          console.log('[成就广播]', a.playerId, a.name || a.key)
        }
      }
      st.queue.push(msg)
      st.waiters = (st.waiters || []).filter((w) => !w(msg))
    })
  })
}

function waitFor(st, type, timeoutMs = 8000, pred = null) {
  return new Promise((resolve, reject) => {
    const idx = st.queue.findIndex((m) => m.type === type && (!pred || pred(m)))
    if (idx >= 0) return resolve(st.queue.splice(idx, 1)[0])
    const check = (msg) => {
      if (msg.type !== type || (pred && !pred(msg))) return false
      clearTimeout(timer)
      resolve(msg)
      return true
    }
    const timer = setTimeout(() => {
      st.waiters = (st.waiters || []).filter((w) => w !== check)
      reject(new Error(st.playerId + ' 等待 ' + type + ' 超时'))
    }, timeoutMs)
    ;(st.waiters ||= []).push(check)
  })
}

function send(st, type, data = {}) {
  st.ws.send(JSON.stringify({ type, data }))
}

async function takeTurn(st) {
  let lastLevel = null
  let failed = false
  while (!failed) {
    const candidates = CAST_ORDER.filter((id) => lastLevel == null || id >= lastLevel)
    if (candidates.length === 0) break
    const spellId = candidates[0]
    send(st, 'cast', { spellId })
    const res = await Promise.race([
      waitFor(st, 'cast_result'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('cast_result 超时')), 8000))
    ])
    if (res.data.type === 'cast_failed') failed = true
    else {
      lastLevel = spellId
      if (res.data.roundEnded) return // 本轮已结束
    }
  }
  send(st, 'end_turn')
  await Promise.race([waitFor(st, 'turn_to', 8000), waitFor(st, 'round_end', 8000).then(() => null)])
}

async function runPlayer(st, isHost) {
  while (true) {
    const evt = await Promise.race([waitFor(st, 'turn_to', GATHER_MS), waitFor(st, 'round_end', GATHER_MS)])
    if (evt.type === 'round_end') {
      if (isHost) send(st, 'next_round')
      continue
    }
    if (evt.data.playerId !== st.playerId) continue
    await takeTurn(st)
  }
}

async function main() {
  const ids = ['pe2e-bot-a', 'pe2e-bot-b', 'pe2e-bot-c']
  const names = ['成就测试A', '成就测试B', '成就测试C']

  const tokens = []
  for (const id of ids) {
    const res = await fetch(BASE + '/api/identity?playerId=' + id)
    const j = await res.json()
    tokens.push(j.token)
  }
  console.log('身份 token 已签发')

  const players = []
  for (let i = 0; i < 3; i++) players.push(await makeSocket(ids[i], names[i], tokens[i]))
  for (const st of players) await waitFor(st, 'room_state')
  console.log('三个机器人都已连接，房主开局…')

  send(players[0], 'start_round')
  for (const st of players) await waitFor(st, 'room_state', 8000, (m) => m.data.phase === 'playing')
  console.log('第一轮已开始，机器人开始打比赛…')

  const runner = Promise.allSettled([runPlayer(players[0], true), runPlayer(players[1], false), runPlayer(players[2], false)])
  runner.then((rs) => { for (const r of rs) if (r.status === 'rejected') console.error('[机器人循环异常]', r.reason && r.reason.message) })
  while (!players.some((p) => p.queue.some((m) => m.type === 'game_over'))) {
    const done = await Promise.race([runner.then(() => true), new Promise((r) => setTimeout(() => r(false), 1000))])
    if (done) break
  }

  // 等待上报与成就广播落地
  await new Promise((r) => setTimeout(r, 3000))

  const all = players.flatMap((p) => p.unlocked)
  console.log('\n===== 结果 =====')
  console.log('收到成就广播总数:', all.length)
  for (const a of all) console.log(' -', a.playerId, '|', a.name || a.key)
  if (all.length === 0) {
    console.error('未收到任何成就广播 —— 上报或判定可能失败，请查 worker 日志')
    process.exit(1)
  }
  console.log('\n🎉 E2E 成就链路验证通过！')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
