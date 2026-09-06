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

  wsClient._emit(Msg.RCV_ROOM_STATE, { phase: 'playing', round: 1, players: [] })
  assertNewMatchTransientStateCleared(store)
  assert.equal(store.lastGameOver, null)
  cleanup()
})
