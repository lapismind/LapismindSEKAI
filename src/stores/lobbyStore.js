/**
 * stores/lobbyStore.js
 * 大厅状态 —— 房间列表、自己的身份。
 * 房间增删查走 REST（api.js），加入/创建后由 GameView 建立 WebSocket。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../network/api'

export const useLobbyStore = defineStore('lobby', () => {
  const rooms = ref([])
  const loading = ref(false)
  const myPlayerId = ref(`p${Date.now().toString(36)}`)
  const myNickname = ref('玩家')

  function setNickname(name) {
    myNickname.value = name.trim() || '玩家'
  }

  async function fetchRooms() {
    loading.value = true
    try {
      const data = await api.listRooms()
      rooms.value = data.rooms ?? []
    } finally {
      loading.value = false
    }
  }

  /** 创建房间，返回 roomId */
  async function createRoom() {
    const data = await api.createRoom()
    return data.roomId
  }

  return {
    rooms,
    loading,
    myPlayerId,
    myNickname,
    setNickname,
    fetchRooms,
    createRoom,
  }
})
