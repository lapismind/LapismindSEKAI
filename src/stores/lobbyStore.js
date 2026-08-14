/**
 * stores/lobbyStore.js —— 基于 @lapismind/lobby-kit 的薄包装。
 * Pinia setup store 用法：kit 返回普通对象，用 reactive 包装成响应式。
 */

import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)

  return {
    ...state,
    setNickname: kit.setNickname,
    setAvatar: kit.setAvatar,
    joinByCode: kit.joinByCode,
  }
})
