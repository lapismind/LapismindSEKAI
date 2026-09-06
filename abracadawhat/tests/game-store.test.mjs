import './helpers/workerLoader.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

const { useGameStore } = await import('../src/stores/gameStore.js')
const { wsClient } = await import('../src/network/wsClient.js')
const { Msg } = await import('../src/core/protocol.js')

function createStore() {
  setActivePinia(createPinia())
  const store = useGameStore()
  const unsubs = store.hydrate()
  return { store, cleanup: () => unsubs.forEach((unsubscribe) => unsubscribe()) }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function withControlledConnections(run) {
  const originalFetch = globalThis.fetch
  const originalConnect = wsClient.connect
  const connections = []
  const identityRequests = []
  globalThis.fetch = () => {
    const request = deferred()
    identityRequests.push(request)
    return request.promise
  }
  wsClient.connect = options => connections.push(options)
  try {
    await run({ connections, identityRequests })
  } finally {
    globalThis.fetch = originalFetch
    wsClient.connect = originalConnect
  }
}

function seedCompletedMatch(store) {
  wsClient._emit(Msg.RCV_ROUND_END, {
    standings: [{ id: 'a', score: 8, gained: 2 }],
  })
  wsClient._emit(Msg.RCV_GAME_OVER, {
    standings: [{ id: 'a', nickname: 'A', score: 8 }],
  })
  wsClient._emit(Msg.RCV_ACHIEVEMENTS_UNLOCKED, [{ playerId: 'a', key: 'first_cast' }])
  assert.equal(store.newAchievements.length, 1)
  assert.ok(store.roundEndSummary)
  assert.ok(store.lastGameOver)
}

test('关闭比赛结算详情只隐藏详情并保留重赛数据', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)

  assert.equal(store.gameOverOpen, true)
  store.clearGameOver()

  assert.equal(store.gameOverOpen, false)
  assert.ok(store.lastGameOver)
  cleanup()
})

test('离开房间会断开并清空全部房间与结算状态且忽略迟到消息', () => {
  const { store } = createStore()
  seedCompletedMatch(store)
  store.roomState = { phase: 'game_over', players: [{ id: 'a' }] }
  store.lastCastResult = { type: 'cast_success' }
  store.myHandSize = 4
  store.mySecrets = [1, 2]

  store.leaveRoom()
  wsClient._emit(Msg.RCV_GAME_OVER, {
    standings: [{ id: 'late', nickname: '旧房间迟到消息', score: 9 }],
  })

  assert.equal(store.inRoom, false)
  assert.equal(store.roomId, null)
  assert.equal(store.roomState, null)
  assert.equal(store.lastGameOver, null)
  assert.equal(store.gameOverOpen, false)
  assert.deepEqual(store.newAchievements, [])
  assert.equal(store.roundEndSummary, null)
  assert.deepEqual(store.roundScoreDeltas, {})
  assert.equal(store.lastCastResult, null)
  assert.equal(store.myHandSize, 0)
  assert.deepEqual(store.mySecrets, [])
})

test('从房间 A 离开再连接房间 B 不保留旧结算或旧重赛路径', async () => {
  const { store } = createStore()
  store.roomId = 'ROOMA'
  store.inRoom = true
  seedCompletedMatch(store)

  await store.connect('ROOMB', 'B', 'b', '0')

  assert.equal(store.roomId, 'ROOMB')
  assert.equal(store.inRoom, true)
  assert.equal(store.roomState, null)
  assert.equal(store.lastGameOver, null)
  assert.equal(store.gameOverOpen, false)
})

test('同房间断线重连保留比赛结束数据和重赛路径', () => {
  const { store, cleanup } = createStore()
  store.roomId = 'ROOMA'
  store.inRoom = true
  seedCompletedMatch(store)

  store.disconnect()

  assert.equal(store.inRoom, false)
  assert.equal(store.roomId, 'ROOMA')
  assert.ok(store.lastGameOver)
  assert.equal(store.gameOverOpen, true)
  cleanup()
})

test('身份请求未完成时离开房间会使连接续程失效', async () => {
  await withControlledConnections(async ({ connections, identityRequests }) => {
    const { store } = createStore()
    const connecting = store.connect('ROOMA', 'A', 'a', '0')

    store.leaveRoom()
    identityRequests[0].resolve({ ok: false })
    await connecting

    assert.equal(store.roomId, null)
    assert.equal(store.inRoom, false)
    assert.deepEqual(connections, [])
  })
})

test('重叠连接乱序完成时只有最后一次请求可以进入房间并打开连接', async () => {
  await withControlledConnections(async ({ connections, identityRequests }) => {
    const { store } = createStore()
    const connectingA = store.connect('ROOMA', 'A', 'a', '0')
    const connectingB = store.connect('ROOMB', 'B', 'b', '1')

    identityRequests[1].resolve({ ok: false })
    await connectingB
    identityRequests[0].resolve({ ok: false })
    await connectingA

    assert.equal(store.roomId, 'ROOMB')
    assert.equal(store.inRoom, true)
    assert.deepEqual(connections.map(connection => connection.roomId), ['ROOMB'])
  })
})

test('过期身份请求失败不会覆盖最后一次连接状态', async () => {
  await withControlledConnections(async ({ connections, identityRequests }) => {
    const { store } = createStore()
    const connectingA = store.connect('ROOMA', 'A', 'a', '0')
    const connectingB = store.connect('ROOMB', 'B', 'b', '1')

    identityRequests[1].resolve({ ok: false })
    await connectingB
    identityRequests[0].reject(new Error('late identity failure'))
    await connectingA

    assert.equal(store.roomId, 'ROOMB')
    assert.equal(store.inRoom, true)
    assert.deepEqual(connections.map(connection => connection.roomId), ['ROOMB'])
  })
})

test('关闭后可以重新打开比赛结算详情而不改变结算数据', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)
  const retained = store.lastGameOver

  store.clearGameOver()
  store.openGameOver()

  assert.equal(store.gameOverOpen, true)
  assert.equal(store.lastGameOver, retained)
  cleanup()
})

function assertNewMatchTransientStateCleared(store) {
  assert.deepEqual(store.newAchievements, [])
  assert.equal(store.roundEndSummary, null)
  assert.deepEqual(store.roundScoreDeltas, {})
}

function assertTransientStateClearedBeforeSend(store, action) {
  const originalSend = wsClient.send
  let sent = false
  wsClient.send = () => {
    assertNewMatchTransientStateCleared(store)
    assert.ok(store.lastGameOver)
    sent = true
  }
  try {
    action()
    assert.equal(sent, true)
  } finally {
    wsClient.send = originalSend
  }
}

test('结算得分使用服务端 gained，进入下一轮时所有客户端都会清空', () => {
  const { store, cleanup } = createStore()
  wsClient._emit(Msg.RCV_ROOM_STATE, {
    phase: 'round_end',
    players: [{ id: 'a', score: 5 }, { id: 'b', score: 2 }],
    summary: {
      standings: [{ id: 'a', score: 5, gained: 3 }, { id: 'b', score: 2, gained: 1 }],
    },
  })
  assert.deepEqual(store.roundScoreDeltas, { a: 3, b: 1 })

  wsClient._emit(Msg.RCV_ROOM_STATE, {
    phase: 'playing',
    players: [{ id: 'a', score: 5 }, { id: 'b', score: 2 }],
  })
  assert.deepEqual(store.roundScoreDeltas, {})
  cleanup()
})

test('新消息版本在消息上限后仍递增，清空消息不会伪造新消息', () => {
  const { store, cleanup } = createStore()
  for (let index = 0; index < 201; index += 1) {
    wsClient._emit(Msg.RCV_CHAT, {
      playerId: 'a', nickname: 'A', avatarId: '1', text: String(index),
    })
  }
  assert.equal(store.chatMessages.length, 200)
  assert.equal(store.chatMessageVersion, 201)

  store.disconnect()
  assert.equal(store.chatMessages.length, 0)
  assert.equal(store.chatMessageVersion, 201)
  cleanup()
})

test('startRound 发送被丢弃时清空临时结算但保留可重试的比赛结束状态', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)

  store.startRound()

  assertNewMatchTransientStateCleared(store)
  assert.ok(store.lastGameOver)
  cleanup()
})

test('rematch 发送新比赛动作前仅清空临时状态并保留可重试的比赛结束状态', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)

  assertTransientStateClearedBeforeSend(store, () => store.rematch())
  assert.ok(store.lastGameOver)
  cleanup()
})

test('rematch 被服务端拒绝后仍保留可重试的比赛结束状态', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)

  store.rematch()
  wsClient._emit(Msg.RCV_ERROR, { message: '游戏未结束，无法再来一局' })

  assertNewMatchTransientStateCleared(store)
  assert.ok(store.lastGameOver)
  cleanup()
})

test('收到第 1 轮 playing 确认后幂等清空旧比赛结束状态和临时状态', () => {
  const { store, cleanup } = createStore()
  seedCompletedMatch(store)

  wsClient._emit(Msg.RCV_ROOM_STATE, { phase: 'playing', round: 1, players: [] })
  assertNewMatchTransientStateCleared(store)
  assert.equal(store.lastGameOver, null)
  assert.equal(store.gameOverOpen, false)

  wsClient._emit(Msg.RCV_ROOM_STATE, { phase: 'playing', round: 1, players: [] })
  assertNewMatchTransientStateCleared(store)
  assert.equal(store.lastGameOver, null)
  cleanup()
})
