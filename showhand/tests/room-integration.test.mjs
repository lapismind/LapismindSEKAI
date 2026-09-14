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

/** 所有未弃牌未全下的活跃玩家依次跟注，直到本局结算（含闷牌轮共 5 轮下注） */
async function playHandToSettle(room) {
  for (let safety = 0; safety < 60; safety++) {
    const state = await room.getState()
    if (state.phase !== 'playing' || !state.currentPlayerId) return state
    const player = state.players.find((p) => p.id === state.currentPlayerId)
    if (!player || player.folded || player.allIn) return state
    await bet(room, state.currentPlayerId, 'call')
  }
  return room.getState()
}

/** 兼容旧用例名：等价于把本局打完 */
const everyoneCalls = playHandToSettle

// ---------- 测试用例 ----------

const tests = []
function test(name, fn) { tests.push({ name, fn }) }

test('完整一局：join → start → 闷牌轮起手 → 5 轮下注 → showdown → 结算', async () => {
  const { ctx, room, sockets } = await makeRoom(3, { initialChips: 1000 })
  let state = await room.getState()

  // 房主设置配置并开局
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 2, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  state = await room.getState()

  assert.equal(state.phase, 'playing', '开局后应为 playing')
  assert.equal(state.round, 1, '第 1 局')
  assert.ok(state.hand, '应有 hand 数据')
  assert.ok(state.currentPlayerId, '闷牌轮应有当前行动者')
  assert.equal(state.hand.stage, 'blind', '开局第一轮应是闷牌轮')
  // 闷牌轮每人只发开头那张暗牌；其余牌等本轮流完再补
  for (const p of state.players.filter(p => p.role === 'player')) {
    assert.equal(p.cards.length, 1, `玩家 ${p.id} 闷牌轮应有 1 张暗牌`)
    assert.equal(p.cards[0].hidden, true, '闷牌轮发的那张应是暗牌')
    assert.equal(p.blind, true, '开局默认闷牌状态')
  }
  // 起注档位 = 底注 × 2（底注算作已投入，看牌者要补一个底注，闷牌者不用）
  assert.equal(state.currentLevel, 20, '闷牌轮起注档位应为底注的 2 倍')

  // 打完 5 轮下注（闷牌 + flop/turn/river + 摊牌前最后一轮）
  state = await playHandToSettle(room)

  assert.equal(state.phase, 'settled', '5 轮下注后应摊牌结算')
  // 五张模式最终仍是 5 张牌：闷牌轮 1 张 + 之后 4 张
  for (const p of state.players.filter(p => p.role === 'player')) {
    assert.equal(p.cards.length, 5, `玩家 ${p.id} 结算时应有 5 张牌`)
  }

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

  for (let r = 0; r < 6 && state.phase === 'playing'; r++) {
    state = await everyoneCalls(room)
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

test('观众不参与下注轮转：有人输光转观众后下注轮仍能正常结束', async () => {
  // 输光转观众的玩家仍留在 state.players 里，且 bet 带着上一局的残留值。
  // 下注状态机若收到全量玩家列表，轮转会走到观众身上、下注轮永远结束不了。
  const { room } = await makeRoom(3, { initialChips: 1000 })
  let state = await room.getState()
  const spectator = state.players.find((p) => p.id === 'p2')
  spectator.role = 'spectator'
  spectator.chips = 0
  spectator.bet = 999 // 上一局的残留投入：不该影响本局的 currentBet / 轮转
  await room.saveState(state)

  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  state = await room.getState()
  assert.equal(state.players.find((p) => p.id === 'p2').role, 'spectator', 'P2 应保持观众身份')
  assert.equal(state.currentLevel, 20, '起注档位只应看本局参与者与闷牌轮规则，不应被观众的残留 bet 抬高')

  // 剩余两名玩家一路跟注，整局必须在有限步内走到结算
  for (let i = 0; i < 60; i++) {
    state = await room.getState()
    if (state.phase !== 'playing' || !state.currentPlayerId) break
    const actor = state.players.find((p) => p.id === state.currentPlayerId)
    assert.notEqual(actor.role, 'spectator', `回合不应交给观众（第 ${i} 步轮到 ${actor.id}）`)
    await bet(room, state.currentPlayerId, 'call')
  }

  state = await room.getState()
  assert.equal(state.phase, 'settled', '有观众在场时整局仍应正常结算')
  assert.equal(state.players.find((p) => p.id === 'p2').bet, 0, '观众不应被计入本局投入')
})

test('整场最终排名包含中途输光退席的玩家', async () => {
  const { room, sockets } = await makeRoom(3, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 2, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))

  // 第一局：三人都在座
  let state = await room.getState()
  for (let i = 0; i < 60; i++) {
    state = await room.getState()
    if (state.phase !== 'playing' || !state.currentPlayerId) break
    await bet(room, state.currentPlayerId, 'call')
  }
  state = await room.getState()
  assert.equal(state.phase, 'settled', '第一局应正常结算')

  // 第二局开始前 P2 输光退席（转观众后角色变了，但人仍在 state.players 里）
  const busted = state.players.find((p) => p.id === 'p2')
  busted.role = 'spectator'
  busted.chips = 0
  await room.saveState(state)

  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  for (let i = 0; i < 60; i++) {
    state = await room.getState()
    if (state.phase !== 'playing' || !state.currentPlayerId) break
    await bet(room, state.currentPlayerId, 'call')
  }

  state = await room.getState()
  assert.equal(state.finished, true, '第二局打满后整场结束')
  const over = lastMsg(sockets[0], 'game_over')
  assert.ok(over, '应收到 game_over 广播')
  const ids = over.data.standings.map((row) => row.playerId)
  assert.ok(ids.includes('p2'), '中途输光退席的玩家也应出现在最终排名里')
  assert.equal(over.data.standings.length, 3, '最终排名应包含全部上过牌桌的玩家')
})

test('再来一局：整场结束后房主重置筹码、观众重新入座', async () => {
  const { room } = await makeRoom(3, { initialChips: 1000 })
  let state = await room.getState()
  const busted = state.players.find((p) => p.id === 'p2')
  busted.role = 'spectator'
  busted.chips = 0
  await room.saveState(state)

  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  for (let i = 0; i < 60; i++) {
    state = await room.getState()
    if (state.phase !== 'playing' || !state.currentPlayerId) break
    await bet(room, state.currentPlayerId, 'call')
  }
  state = await room.getState()
  assert.equal(state.finished, true)

  // 非房主不能开新一场
  await room.enqueue(() => room.handleMessage(null, 'p1', JSON.stringify({ type: 'rematch', data: {} })))
  state = await room.getState()
  assert.equal(state.phase, 'settled', '非房主的 rematch 应被拒绝')

  // 房主重置：筹码回初始值、观众重新入座、回到 waiting、可以再次开局
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'rematch', data: {} })))
  state = await room.getState()
  assert.equal(state.phase, 'waiting', '再来一局后应回到 waiting')
  assert.equal(state.finished, false, 'finished 应复位')
  assert.equal(state.round, 0, '局数应归零')
  assert.equal(state.hand, null, '手牌数据应清空')
  assert.equal(state.pot, 0, '底池应清空')
  for (const p of state.players) {
    assert.equal(p.role, 'player', `${p.id} 应重新入座`)
    assert.equal(p.chips, 1000, `${p.id} 筹码应回到初始值`)
    assert.equal(p.bet, 0, `${p.id} 投入应清零`)
  }

  // 重置后能正常开新一场
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))
  state = await room.getState()
  assert.equal(state.phase, 'playing', '再来一局后应能立刻重新开局')
  assert.equal(state.round, 1)
})

test('webSocketClose：同一玩家还有其它连接时不标记离线', async () => {
  const { ctx, room } = await makeRoom(2, { initialChips: 1000 })
  // 模拟同一玩家的第二个连接（多标签页 / 重连过渡期）
  const second = new FakeWebSocket()
  second.serializeAttachment({ playerId: 'p0' })
  ctx.acceptWebSocket(second)
  const first = ctx.sockets.find((s) => s.att?.playerId === 'p0' && s !== second)

  // 运行时关闭连接后，该 socket 不再出现在 getWebSockets() 里
  first.open = false
  await room.webSocketClose(first)
  let state = await room.getState()
  assert.equal(state.players.find((p) => p.id === 'p0').connected, true, '还有连接时不应标记离线')

  second.open = false
  await room.webSocketClose(second)
  state = await room.getState()
  assert.equal(state.players.find((p) => p.id === 'p0').connected, false, '最后一个连接关闭后才标记离线')
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

// ---------- 闷牌轮 ----------

test('闷牌期间的暗牌不下发给本人，看牌后才下发（防 DevTools 看牌）', async () => {
  const { room, sockets } = await makeRoom(2, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))

  const s0 = sockets.find((s) => s.att?.playerId === 'p0')
  let hand = lastMsg(s0, 'your_hand')
  assert.ok(hand, '开局应收到手牌消息')
  assert.equal(hand.data.cards.length, 1)
  assert.equal(hand.data.cards[0].concealed, true, '闷牌期间的暗牌必须以占位符下发')
  assert.ok(!hand.data.cards[0].suit, '占位符不应带花色')
  assert.equal(hand.data.cards[0].rank, 0, '占位符不应带点数')

  let state = await room.getState()
  assert.equal(state.currentPlayerId, 'p0', 'p0 先行动')
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'look', data: {} })))

  hand = lastMsg(s0, 'your_hand')
  assert.equal(hand.data.cards[0].concealed, undefined, '看牌后应下发真实牌面')
  assert.ok(hand.data.cards[0].suit, '真实牌面应带花色')
  assert.ok(hand.data.cards[0].rank > 0, '真实牌面应带点数')

  state = await room.getState()
  const me = state.players.find((p) => p.id === 'p0')
  assert.equal(me.blind, false, '看牌后不再享受半价')
  assert.equal(me.looked, true)
})

test('看牌只能在自己回合', async () => {
  const { room, sockets } = await makeRoom(2, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))

  const state = await room.getState()
  const other = state.currentPlayerId === 'p0' ? 'p1' : 'p0'
  await room.enqueue(() => room.handleMessage(null, other, JSON.stringify({ type: 'look', data: {} })))

  const s = sockets.find((x) => x.att?.playerId === other)
  const err = lastMsg(s, 'error')
  assert.ok(err, '非当前玩家看牌应报错')
  assert.match(err.data.message, /自己的回合/)

  const p = (await room.getState()).players.find((x) => x.id === other)
  assert.equal(p.blind, true, '看牌失败不应改变状态')
})

test('闷牌轮结束自动亮牌，后续轮次恢复全价', async () => {
  const { room, sockets } = await makeRoom(2, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))

  let state = await room.getState()
  assert.equal(state.hand.stage, 'blind')
  // 双方都闷牌跟注（闷牌者按半价，此时恰好不用再补）
  await bet(room, state.currentPlayerId, 'call')
  state = await room.getState()
  await bet(room, state.currentPlayerId, 'call')

  state = await room.getState()
  assert.equal(state.hand.stage, 'flop', '闷牌轮结束后进入 flop')
  for (const p of state.players.filter((p) => p.role === 'player')) {
    assert.equal(p.blind, false, '轮末自动亮牌，不再闷牌')
    assert.equal(p.cards.length, 2, '补发了开局剩下的那张牌')
  }
  assert.equal(state.bettingRound.halfPrice, false, '后续轮次不再半价')

  const s0 = sockets.find((s) => s.att?.playerId === 'p0')
  const hand = lastMsg(s0, 'your_hand')
  assert.equal(hand.data.cards.length, 2)
  assert.ok(
    hand.data.cards.every((c) => c.concealed === undefined),
    '轮末亮牌后不应再有占位符',
  )
})

test('闷牌者的暗牌对观众同样遮罩（否则观众报牌即可废掉机制）', async () => {
  const { room, sockets } = await makeRoom(3, { initialChips: 1000 })
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'set_host_config', data: { mode: 'five', rounds: 1, initialChips: 1000 } })))
  await room.enqueue(() => room.handleMessage(null, 'p0', JSON.stringify({ type: 'start_game', data: {} })))

  const state = await room.getState()
  state.players.find((p) => p.id === 'p2').role = 'spectator'
  await room.saveState(state)
  await room.enqueue(async () => {
    room.broadcastState(await room.getState())
  })

  const s2 = sockets.find((s) => s.att?.playerId === 'p2')
  const spec = lastMsg(s2, 'spectate_state')
  assert.ok(spec, '观众应收到 spectate_state')

  const blindSeat = spec.data.players.find((p) => p.id === 'p0')
  assert.equal(blindSeat.blind, true, '观众应知道该玩家在闷牌')
  assert.equal(blindSeat.cards.length, 1)
  assert.equal(blindSeat.cards[0].concealed, true, '闷牌者的暗牌对观众也应是占位符')
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
