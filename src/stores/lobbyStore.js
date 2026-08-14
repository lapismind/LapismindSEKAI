/**
 * stores/lobbyStore.js
 * 大厅状态 —— 通用件（昵称/头像/playerId）来自 @lapismind/lobby-kit，
 * 谜题列表为海龟汤特有逻辑，保留在本侧。
 */

import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'
import { api } from '../network/api'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  const puzzles = ref([])

  async function fetchPuzzles() {
    const data = await api.listPuzzles()
    puzzles.value = data.puzzles ?? []
  }

  return {
    ...state,
    puzzles,
    setNickname: kit.setNickname,
    setAvatar: kit.setAvatar,
    fetchPuzzles,
  }
})
