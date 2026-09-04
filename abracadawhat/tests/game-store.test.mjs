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
