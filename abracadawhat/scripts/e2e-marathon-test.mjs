/**
 * scripts/e2e-marathon-test.mjs —— 长线累计成就验证。
 * 同一批机器人连打多场，验证跨场累计（career）是否生效：
 * 目标成就是「百法齐鸣」（累计 100 次施法），
 * 如果它在第 2 场之后才触发，说明跨场累计链路正确。
 * 前提：auth dev 在 8788、abraca dev 在 8789。
 */
import WebSocket from 'ws'

const BASE = 'http://127.0.0.1:8789'
const ROOM = 'MAR' + Math.random().toString(36).slice(2, 6).toUpperCase()
const CAST_ORDER = [8, 7, 5, 3, 2, 4, 6, 1]
const TARGET_KEY = 'hundred_casts'
const MAX_MATCHES = 10

function makeSocket(playerId, nickname, token) {
  return new Promise((resolve, reject) => {
    const url = 'ws://127.0.0.1:8789/ws?roomId=' + ROOM + '&playerId=' + playerId +
      '&nickname=' + encodeURIComponent(nickname) + '&avatarId=1&token=' + encodeURIComponent(token)
    const ws = new WebSocket(url)
    const st = { ws, playerId, queue: [], unlocked: [] }
    ws.on('open', () => resolve(st))
    ws.on('error', reject)
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'achievements_unlocked') {
        for (const a of msg.data || []) {
          st.unlocked.push(a)
          console.log('  [成就]', a.playerId, '|', a.name || a.key)
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
      reject(new Error(st.playerId + ' wait timeout: ' + type))
    }, timeoutMs)
    ;(st.waiters ||= []).push(check)
  })
}

function drain(st, type) {
  const idx = st.queue.findIndex((m) => m.type === type)
  return idx >= 0 ? st.queue.splice(idx, 1)[0] : null
}

function send(st, type, data = {}) {
  st.ws.send(JSON.stringify({ type, data }))
}

async function act(st) {
  let lastLevel = null
  let failed = false
  while (!failed) {
    const candidates = CAST_ORDER.filter((id) => lastLevel == null || id >= lastLevel)
    if (candidates.length === 0) break
    const spellId = candidates[0]
    send(st, 'cast', { spellId })
    const res = await waitFor(st, 'cast_result')
    if (res.data.type === 'cast_failed') failed = true
    else {
      lastLevel = spellId
      if (res.data.roundEnded) return 'round_end'
    }
  }
  send(st, 'end_turn')
  return null
}

/** 打到本场结束（game_over），返回本场的 standings */
async function playMatch(players, hostIdx) {
  while (true) {
    // 任一玩家的队列里找关键事件
    const go = players.map((p) => drain(p, 'game_over')).find(Boolean)
    if (go) return
    const re = players.map((p) => drain(p, 'round_end')).find(Boolean)
    if (re) {
      send(players[hostIdx], 'next_round')
      await new Promise((r) => setTimeout(r, 300))
      continue
    }
    // 找当前该行动的玩家
    let acted = false
    for (const p of players) {
      const tt = drain(p, 'turn_to')
      if (tt && tt.data.playerId === p.playerId) {
        await act(p)
        acted = true
        break
      }
    }
    if (!acted) {
      // 没有可处理事件时等一小会儿让消息进来
      await Promise.race(players.map((p) => waitFor(p, 'turn_to', 3000).catch(() => null), ))
      await new Promise((r) => setTimeout(r, 200))
    }
  }
}

async function main() {
  const ids = ['pe2e-bot-a', 'pe2e-bot-b', 'pe2e-bot-c']
  const names = ['累计测试A', '累计测试B', '累计测试C']
  const tokens = []
  for (const id of ids) {
    tokens.push((await (await fetch(BASE + '/api/identity?playerId=' + id)).json()).token)
  }
  const players = []
  for (let i = 0; i < 3; i++) players.push(await makeSocket(ids[i], names[i], tokens[i]))
  for (const st of players) await waitFor(st, 'room_state')
  console.log('机器人已连接，房间 ' + ROOM + '，目标成就: ' + TARGET_KEY)

  let targetMatch = null
  for (let m = 1; m <= MAX_MATCHES; m++) {
    console.log('\n===== 第 ' + m + ' 场开始 =====')
    send(players[0], 'start_round')
    for (const st of players) await waitFor(st, 'room_state', 8000, (x) => x.data.phase === 'playing')
    const t0 = Date.now()
    await playMatch(players, 0)
    console.log('第 ' + m + ' 场结束，用时 ' + Math.round((Date.now() - t0) / 1000) + 's')
    // 给上报留时间
    await new Promise((r) => setTimeout(r, 2500))
    const hit = players.some((p) => p.unlocked.some((a) => a.key === TARGET_KEY))
    if (hit) {
      targetMatch = m
      console.log('\n>>> 目标成就「百法齐鸣」在第 ' + m + ' 场触发！<<<')
      break
    }
  }

  const unique = new Map()
  for (const p of players) for (const a of p.unlocked) unique.set(a.playerId + '|' + a.key, a)
  console.log('\n===== 全部解锁成就（去重后 ' + unique.size + ' 个）=====')
  for (const [k, a] of unique) console.log(' -', k, '|', a.name || a.key)
  if (targetMatch === null) {
    console.error('\n打了 ' + MAX_MATCHES + ' 场仍未触发 ' + TARGET_KEY + ' —— 需要人工排查')
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
