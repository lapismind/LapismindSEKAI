/**
 * stores/lobbyStore.js
 * 大厅状态 —— 昵称、房间码、谜题列表。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../network/api'

export const useLobbyStore = defineStore('lobby', () => {
  const myPlayerId = ref(`p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`)
  const myNickname = ref('玩家')
  const myAvatarId = ref('0')
  const roomCode = ref('')
  const puzzles = ref([])

  function setNickname(name) {
    myNickname.value = name.trim() || '玩家'
  }

  function setAvatar(id) {
    myAvatarId.value = String(id)
  }

  async function fetchPuzzles() {
    const data = await api.listPuzzles()
    puzzles.value = data.puzzles ?? []
  }

  function joinByCode() {
    const code = roomCode.value.trim().toUpperCase()
    if (!code) return null
    return code
  }

  return {
    myPlayerId,
    myNickname,
    myAvatarId,
    roomCode,
    puzzles,
    setNickname,
    setAvatar,
    fetchPuzzles,
    joinByCode,
  }
})
