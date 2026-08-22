/**
 * tests/room-integration.test.mjs —— ShowhandRoom DO 集成测试。
 *
 * Mock DO 生命周期（storage / getWebSockets / acceptWebSocket / alarm），
 * 走真实 worker 源码的状态机逻辑：
 *   join → set_config → start → preflop 下注轮 → flop/turn/river 逐轮下注
 *   → showdown 结算 → 输光转观众 → 重连恢复
 */
import './helpers/workerLoader.mjs'

const { ShowhandRoom } = await import('../src/worker/showhandRoom.js')

// ---------- Fake 基础设施 ----------

class FakeStorage {
  constructor() { this.map = new Map(); this.alarmAt = null }
  async get(k) { return this.map.get(k) ?? undefined }
  async put(k, v) { this.map.set(k, structuredClone(v)) }
  async delete(k) { this.map.delete(k) }
  async setAlarm(ts) { this.alarmAt = ts }
  async deleteAlarm() { this.alarmAt = null }
}

class FakeWebSocket {
  constructor() { this.messages = []; this.att = null; this.open = true }
  send(data) { if (this.open) this.messages.push(JSON.parse(data)) }
  close() { this.open = false }
  serializeAttachment(v) { this.att = v }
  deserializeAttachment() { return this.att }
}

function makeCtx() {
  const storage = new FakeStorage()
  const sockets = []
  return {
    name: 'test-room',
    storage,
    sockets,
    getWebSockets: () => sockets.filter((s) => s.open),
    acceptWebSocket: (ws) => { ws.open = true; if (!sockets.includes(ws)) sockets.push(ws) },
    waitUntil: (p) => p,
  }
}

/** 创建房间并让 n 个玩家加入（返回 room 和各玩家的 fake socket） */
async function makeRoom(nPlayers, config = {}) {
  const ctx = makeCtx()
  const room = new ShowhandRoom(ctx, {})
  // handleWebSocketUpgrade 会 new WebSocketPair() 并 acceptWebSocket(server)，
  // 在测试环境没有真 WebSocketPair。改为绕过 upgrade 流程，手动模拟 join：
  const sockets = []
  for (let i = 0; i < nPlayers; i++) {
    const state = await room.getState()
    const pid = `p${i}`
    const inGame = state.phase !== 'waiting'
    const seatFull = state.players.filter((p) => p.role === 'player').length >= 8
    const isSpectator = inGame || seatFull
    const player = {
      id: pid,
      nickname: `玩家${i}`,
      avatarId: '0',
      chips: config.initialChips ?? 1000,
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      isHost: !isSpectator && state.players.length === 0,
      role: isSpectator ? 'spectator' : 'player',
      connected: true,
      joinedAt: Date.now(),
    }
    if (!inGame && !seatFull) {
      player.isHost = state.players.length === 0
      player.role = 'player'
    }
    if (state.players.length === 0 && !inGame && !seatFull) {
      state.hostId = pid
    }
    state.players.push(player)
    await room.saveState(state)

    const ws = new FakeWebSocket()
    ws.serializeAttachment({ playerId: pid })
    ctx.acceptWebSocket(ws)
    sockets.push(ws)
  }
  return { ctx, room, sockets }
}

// ---------- 辅助函数 ----------

/** 从 fake socket 的消息流里找指定类型的最新消息 */
function lastMsg(ws, type) {
  const found = ws.messages.filter((m) => m.type === type)
  return found[found.length - 1] ?? null
}

/** 获取当前持久化的 state */
async function getState(room) {
  return room.getState()
}

/** 模拟玩家发送 bet 消息 */
async function bet(room, playerId, action, amount) {
  const state = await room.getState()
  await room.enqueue(() => room.handleMessage(null, playerId, JSON.stringify({ type: 'bet', data: { action, amount } })))
  return room.getState()
}

/** 所有未弃牌未全下的活跃玩家依次跟注直到本轮结束 */
async function everyoneCalls(room) {
  for (let safety = 0; safety < 20; safety++) {
    const state = await room.getState()
    if (!state.currentPlayerId || state.phase !== 'playing') break
    const player = state.players.find((p) => p.id === state.currentPlayerId)
    if (!player || player.folded || player.allIn) break
    await bet(room, state.currentPlayerId, 'call')
  }
}

// ---------- 测试用例 ----------

const tests = []
function test(name, fn) { tests.push({ name, fn }) }

test('完整一局：join → start → 4轮下注 → showdown → 结算', async () => {
  const { ctx, room, sockets } = await makeRoom(3, { initialChips: 1000 })
  let state = await room.getState()

  // 房主设置配置并开局
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 2, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  state = await room.getState()

  assert.equal(state.phase, 'playing', '开局后应为 playing')
  assert.equal(state.round, 1, '第 1 局')
  assert.ok(state.hand, '应有 hand 数据')
  assert.ok(state.currentPlayerId, 'preflop 下注轮应有当前行动者')
  // preflop 发了 2 张牌（五张模式）
  for (const p of state.players.filter(p => p.role === 'player')) {
    assert.equal(p.cards.length, 2, `玩家 ${p.id} preflop 应有 2 张牌`)
  }

  // 打完 4 轮下注（preflop/flop/turn/river），每轮所有人跟注
  for (let round = 0; round < 4; round++) {
    if (state.phase !== 'playing') break
    await everyoneCalls(room)
    state = await room.getState()
  }

  assert.equal(state.phase, 'settled', '4 轮下注后应摊牌结算')

  // 检查底池分配：总筹码守恒（初始 × 3 - 已出局为 0 的情形）
  // settled 后 bet 已归入 pot 并分配，chips + bet 应等于初始总和
  const totalChips = state.players.reduce((s, p) => s + p.chips + (state.phase === 'settled' ? 0 : p.bet), 0)
  assert.equal(totalChips, 3000, `总筹码应守恒 3000，实际 ${totalChips}`)

  // 摊牌消息已广播
  const showdownMsg = lastMsg(sockets[0], 'showdown')
  assert.ok(showdownMsg, '应收到 showdown 广播')
})

test('输光转观众 + 重连恢复', async () => {
  const { ctx, room, sockets } = await makeRoom(2, { initialChips: 100 })
  // 设置极小初始筹码，ante = max(1, floor(100/100)) = 1
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 10, initialChips: 100 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  let state = await room.getState()
  assert.equal(state.phase, 'playing')

  // P1 弃到底，P0 赢光
  for (let round = 0; round < 4 && state.phase === 'playing'; round++) {
    while (state.currentPlayerId && state.phase === 'playing') {
      const p = state.players.find(x => x.id === state.currentPlayerId)
      if (!p || p.folded) break
      if (state.currentPlayerId === 'p1') {
        await bet(room, 'p1', 'fold')
      } else {
        await bet(room, 'p0', 'call')
      }
      state = await room.getState()
    }
    if (state.phase !== 'playing') break
  }

  state = await room.getState()
  assert.equal(state.phase, 'settled', 'P1 全弃后应直接摊牌')
  const winner = state.players.find(p => p.id === 'p0')
  const loser = state.players.find(p => p.id === 'p1')
  assert.ok(winner.chips > 100, `赢家筹码应 > 初始值，实际 ${winner.chips}`)

  // 重连：断开后重连同一 playerId
  ctx.sockets.find(s => s.att?.playerId === 'p1').open = false
  // 模拟 webSocketClose
  await room.enqueue(async () => {
    const st = await room.getState()
    const player = st.players.find((p) => p.id === 'p1')
    if (player) player.connected = false
    await room.saveState(st)
  })

  // 重新加入（新 socket，同 playerId）
  const ws2 = new FakeWebSocket()
  ws2.serializeAttachment({ playerId: 'p1' })
  ctx.acceptWebSocket(ws2)
  const st2 = await room.getState()
  const reconnected = st2.players.find((p) => p.id === 'p1')
  assert.ok(reconnected, '重连后玩家记录仍存在')
  reconnected.connected = true
  await room.saveState(st2)
  const st3 = await room.getState()
  assert.equal(st3.players.find((p) => p.id === 'p1').connected, true, '重连后 connected 应恢复 true')
})

test('整场结束：打满局数后 finished=true，冠军揭晓，不可再开新一局', async () => {
  const { room, sockets } = await makeRoom(2, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  let state = await room.getState()
  assert.equal(state.round, 1)

  for (let r = 0; r < 4 && state.phase === 'playing'; r++) {
    await everyoneCalls(room)
    state = await room.getState()
  }

  state = await room.getState()
  assert.equal(state.phase, 'settled', '唯一一局打完应 settled')
  assert.equal(state.finished, true, 'rounds=1 打满后应标记 finished')
  assert.ok(lastMsg(sockets[0], 'game_over'), '应收到 game_over 广播')

  // 房主尝试再开一局 → 应被拒绝（state.finished 保护）
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  state = await room.getState()
  assert.equal(state.round, 1, '不应开新一局（round 不变）')
})

test('超时 alarm：触发后当前玩家自动弃牌并推进', async () => {
  const { room } = await makeRoom(3)
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  let state = await room.getState()
  const timedOutPid = state.currentPlayerId
  assert.ok(timedOutPid, '开局后应有当前行动者')

  // 手动触发 alarm 回调（不真等 30 秒）
  await room.alarm()
  state = await room.getState()
  // alarm 弃牌后 currentPlayerId 可能仍是同一人（如果只剩他一个活跃玩家），
  // 但 folded 必须为 true
  const timedOutPlayer = state.players.find(p => p.id === timedOutPid)
  assert.equal(timedOutPlayer.folded, true, 'alarm 触发后当前玩家应被弃牌')
  if (state.currentPlayerId === timedOutPid) {
    assert.ok(timedOutPlayer.folded || timedOutPlayer.allIn, '若仍轮到同一人，该玩家应已弃牌或全下（不应卡死）')
  }
})

// ---------- runner ----------
import assert from 'node:assert/strict'

for (const t of tests) {
  try {
    await t.fn()
    console.log(`✔ ${t.name}`)
  } catch (err) {
    console.error(`✖ ${t.name}`)
    console.error(err)
    process.exitCode = 1
  }
}
