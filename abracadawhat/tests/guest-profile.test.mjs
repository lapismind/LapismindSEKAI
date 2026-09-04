import './helpers/workerLoader.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createAuthClient } from '@lapismind/lobby-kit'

const { useLobbyStore } = await import('../src/stores/lobbyStore.js')

test('游客退出房间再进大厅时用本地资料覆盖共享认证的旧快照', async () => {
  const saved = new Map()
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
  }

  setActivePinia(createPinia())
  const fetchImpl = async (url) => {
    if (url.endsWith('/api/me')) return { ok: false }
    if (url.endsWith('/api/guest')) {
      return {
        ok: true,
        json: async () => ({
          user: { provider: 'guest', nickname: '游客', avatarId: '0', playerId: 'p-guest' },
        }),
      }
    }
    throw new Error(`unexpected request: ${url}`)
  }
  const firstAuth = createAuthClient({ baseUrl: 'https://auth.test', fetchImpl })
  const firstUser = await firstAuth.init()
  const firstLobby = useLobbyStore()
  firstLobby.syncIdentity(firstUser)
  firstLobby.setNickname('重返魔法师')
  firstLobby.setAvatar('12')

  setActivePinia(createPinia())
  const returningLobby = useLobbyStore()
  returningLobby.syncIdentity(firstAuth.getUser())

  assert.equal(returningLobby.myNickname, '重返魔法师')
  assert.equal(returningLobby.myAvatarId, '12')
  delete globalThis.localStorage
})

test('退出账号后恢复游客资料，不把账号资料写进游客存储', () => {
  const saved = new Map([
    ['guestNickname', '原游客'],
    ['guestAvatarId', '7'],
  ])
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
  }

  setActivePinia(createPinia())
  const lobby = useLobbyStore()
  lobby.syncIdentity({
    provider: 'account', playerId: 'p-account', displayName: '账号昵称', avatarId: '18',
  })
  lobby.syncIdentity(null)
  lobby.setNickname(lobby.myNickname)
  lobby.setAvatar(lobby.myAvatarId)

  assert.equal(lobby.myNickname, '原游客')
  assert.equal(lobby.myAvatarId, '7')
  assert.equal(saved.get('guestNickname'), '原游客')
  assert.equal(saved.get('guestAvatarId'), '7')
  delete globalThis.localStorage
})

test('认证迟到时保留已编辑资料，并在确认游客后补写本地存储', () => {
  const saved = new Map()
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
  }

  setActivePinia(createPinia())
  const lobby = useLobbyStore()
  lobby.setNickname('先进入房间')
  lobby.setAvatar('9')
  lobby.syncIdentity({
    provider: 'guest', playerId: 'p-late', nickname: '游客', avatarId: '0',
  })

  assert.equal(lobby.myNickname, '先进入房间')
  assert.equal(lobby.myAvatarId, '9')
  assert.equal(saved.get('guestNickname'), '先进入房间')
  assert.equal(saved.get('guestAvatarId'), '9')
  delete globalThis.localStorage
})

test('游客主动恢复默认昵称和头像时，本地默认值优先于认证旧快照', () => {
  const saved = new Map([
    ['guestNickname', '玩家'],
    ['guestAvatarId', '0'],
  ])
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, String(value)),
  }

  setActivePinia(createPinia())
  const lobby = useLobbyStore()
  lobby.syncIdentity({
    provider: 'guest', playerId: 'p-stale', nickname: '旧昵称', avatarId: '18',
  })

  assert.equal(lobby.myNickname, '玩家')
  assert.equal(lobby.myAvatarId, '0')
  delete globalThis.localStorage
})
