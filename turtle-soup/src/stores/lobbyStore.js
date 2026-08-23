/**
 * stores/lobbyStore.js
 * 大厅状态 —— 通用件（昵称/头像/playerId）来自 @lapismind/lobby-kit，
 * 谜题列表为海龟汤特有逻辑，保留在本侧。
 *
 * 注意：
 * 1. kit.setter 直接修改 kit.state（原始对象），不经过 reactive 代理，不触发响应，
 *    因此 setter 包装成操作响应式 state。
 * 2. `...state` 展开 reactive 对象得到的是值快照（非响应式），必须用 toRefs 保持响应式。
 */

import { defineStore } from 'pinia'
import { reactive, toRefs, ref } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'
import { api } from '../network/api'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  const puzzles = ref([])

  function setNickname(name) {
    state.myNickname = typeof name === 'string' && name.trim() ? name.trim() : '玩家'
  }

  function setAvatar(id) {
    state.myAvatarId = String(id)
  }

  async function fetchPuzzles() {
    const data = await api.listPuzzles()
    puzzles.value = data.puzzles ?? []
  }

  return {
    ...toRefs(state),
    puzzles,
    setNickname,
    setAvatar,
    fetchPuzzles,
  }
})
