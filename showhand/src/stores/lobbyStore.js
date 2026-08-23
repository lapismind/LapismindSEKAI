/**
 * stores/lobbyStore.js —— 基于 @lapismind/lobby-kit 的薄包装。
 * 注意：
 * 1. kit.setter 直接修改 kit.state（原始对象），不经过 reactive 代理，不触发响应，
 *    因此 setter 包装成操作响应式 state。
 * 2. `...state` 展开 reactive 对象得到的是值快照（非响应式），必须用 toRefs 保持响应式。
 */

import { defineStore } from 'pinia'
import { reactive, toRefs } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)

  function setNickname(name) {
    state.myNickname = typeof name === 'string' && name.trim() ? name.trim() : '玩家'
  }

  function setAvatar(id) {
    state.myAvatarId = String(id)
  }

  function joinByCode(raw) {
    return (raw ?? state.roomCode).trim().toUpperCase() || null
  }

  return {
    ...toRefs(state),
    setNickname,
    setAvatar,
    joinByCode,
  }
})
