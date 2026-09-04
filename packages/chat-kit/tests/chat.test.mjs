import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !specifier.endsWith('.js')) {
        return nextResolve(specifier + '.js', context)
      }
      throw error
    }
  },
})

class FakeWebSocket {
  static instances = []

  constructor() {
    this.readyState = 0
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  receive(type, data) {
    this.onmessage?.({ data: JSON.stringify({ type, data }) })
  }

  close() {
    this.readyState = 3
  }

  send() {}
}

globalThis.WebSocket = FakeWebSocket
const { useChatStore } = await import('../src/chat-store.js')

function createStore() {
  FakeWebSocket.instances = []
  setActivePinia(createPinia())
  return useChatStore()
}

test('切换房间时清空旧消息', () => {
  const store = createStore()
  store.connect('room-a', 'p1', 'A', '1')
  const oldSocket = FakeWebSocket.instances.at(-1)
  oldSocket.receive('chat', {
    playerId: 'p1', nickname: 'A', avatarId: '1', text: 'old',
  })
  assert.equal(store.messages.length, 1)

  store.connect('room-b', 'p1', 'A', '1')
  assert.equal(store.messages.length, 0)

  oldSocket.receive('chat', {
    playerId: 'p1', nickname: 'A', avatarId: '1', text: 'late-old',
  })
  assert.equal(store.messages.length, 0)
})

test('超过最近 50 条后新消息版本仍递增', () => {
  const store = createStore()
  store.connect('room-a', 'p1', 'A', '1')
  const socket = FakeWebSocket.instances.at(-1)
  for (let index = 0; index < 51; index += 1) {
    socket.receive('chat', {
      playerId: 'p1', nickname: 'A', avatarId: '1', text: String(index),
    })
  }

  assert.equal(store.recentMessages.length, 50)
  assert.equal(store.messageVersion, 51)
})
