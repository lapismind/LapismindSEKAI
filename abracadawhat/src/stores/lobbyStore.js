import { defineStore } from 'pinia'
import { reactive, ref, toRefs } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  // 统一身份（auth.getUser() 结果，跨游戏共享会话）：null = 未就绪
  const identity = ref(null)
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

  /**
   * 用认证服务身份填充大厅：博客登录的用户（GitHub/账号）进入大厅时自动带上
   * 服务端稳定 playerId 与资料；游客自动登录后拿到的也是服务端签发 playerId，
   * 保证连接 WebSocket 的身份与会话 cookie 一致（Worker 侧以会话为准）。
   */
  function syncIdentity(user) {
    identity.value = user
    if (!user) return
    if (user.playerId) state.myPlayerId = user.playerId
    if (user.provider === 'guest') {
      // 游客昵称/头像存 localStorage，auth.init 已回读进 user；默认 '游客' 不覆盖玩家默认名
      if (user.nickname && user.nickname !== '游客') state.myNickname = user.nickname
      if (user.avatarId) state.myAvatarId = String(user.avatarId)
    } else {
      const name = user.displayName || user.nickname
      if (name) state.myNickname = name
      if (user.avatarId) state.myAvatarId = String(user.avatarId)
    }
  }

  return {
    ...toRefs(state),
    identity,
    setNickname,
    setAvatar,
    joinByCode,
    syncIdentity,
  }
})
