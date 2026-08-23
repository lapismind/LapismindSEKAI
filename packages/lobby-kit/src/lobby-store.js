/**
 * 大厅状态 —— 纯逻辑工厂，返回普通对象 + 方法，不依赖 Pinia。
 *
 * 游戏侧集成（薄包装）：
 *   import { createLobbyStore } from '@lapismind/lobby-kit'
 *   import { defineStore } from 'pinia'
 *   import { reactive, toRefs } from 'vue'
 *
 *   const useLobbyStore = defineStore('lobby', () => {
 *     const kit = createLobbyStore()
 *     const state = reactive(kit.state)
 *     // 两个注意点：
 *     // 1. kit.setter 直接改原始对象，不触发响应，必须包装成操作响应式 state
 *     // 2. 必须用 toRefs(state) 展开（`...state` 是值快照，不响应）
 *     return { ...toRefs(state), setNickname, setAvatar, joinByCode }
 *   })
 *
 * setter 接收普通参数，返回值忽略——Pinia 侧靠 reactive(state) 自动追踪。
 */

import { generatePlayerId } from './player-id.js'

export function createLobbyStore() {
  const state = {
    myPlayerId: generatePlayerId(),
    myNickname: '玩家',
    myAvatarId: '0',
    roomCode: '',
  }

  function setNickname(name) {
    state.myNickname = typeof name === 'string' && name.trim() ? name.trim() : '玩家'
  }

  function setAvatar(id) {
    state.myAvatarId = String(id)
  }

  function joinByCode(raw) {
    const code = (raw ?? state.roomCode).trim().toUpperCase()
    return code || null
  }

  return { state, setNickname, setAvatar, joinByCode }
}
