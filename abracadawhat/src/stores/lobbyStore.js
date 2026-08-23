import { defineStore } from 'pinia'
import { reactive, toRefs } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  // myAvatarId 保持 kit 默认值 '0'，界面显示专门的默认头像 0.png

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
