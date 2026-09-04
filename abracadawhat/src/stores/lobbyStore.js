import { defineStore } from 'pinia'
import { reactive, ref, toRefs } from 'vue'
import { createLobbyStore } from '@lapismind/lobby-kit'

function readGuestProfile() {
  try {
    const savedNickname = localStorage.getItem('guestNickname')
    const savedAvatarId = localStorage.getItem('guestAvatarId')
    const nickname = savedNickname?.trim().slice(0, 24)
    const avatarValid = savedAvatarId != null && /^(0|[1-9]|1\d|2[0-6])$/.test(savedAvatarId)
    return {
      nickname: nickname || '玩家',
      nicknameSaved: savedNickname != null && Boolean(nickname),
      avatarId: avatarValid ? savedAvatarId : '0',
      avatarSaved: avatarValid,
    }
  } catch {
    return { nickname: '玩家', nicknameSaved: false, avatarId: '0', avatarSaved: false }
  }
}

export const useLobbyStore = defineStore('lobby', () => {
  const kit = createLobbyStore()
  const state = reactive(kit.state)
  // 统一身份（auth.getUser() 结果，跨游戏共享会话）：null = 未就绪
  const identity = ref(undefined)
  let pendingGuestProfile = null
  // myAvatarId 保持 kit 默认值 '0'，界面显示专门的默认头像 0.png

  function setNickname(name) {
    state.myNickname = typeof name === 'string' && name.trim() ? name.trim() : '玩家'
    if (identity.value?.provider === 'guest') {
      try { localStorage.setItem('guestNickname', state.myNickname) } catch { /* localStorage unavailable */ }
    } else if (identity.value === undefined) {
      pendingGuestProfile = { ...(pendingGuestProfile ?? {}), nickname: state.myNickname }
    }
  }

  function setAvatar(id) {
    state.myAvatarId = String(id)
    if (identity.value?.provider === 'guest') {
      try { localStorage.setItem('guestAvatarId', state.myAvatarId) } catch { /* localStorage unavailable */ }
    } else if (identity.value === undefined) {
      pendingGuestProfile = { ...(pendingGuestProfile ?? {}), avatarId: state.myAvatarId }
    }
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
    if (!user) {
      const guest = readGuestProfile()
      state.myNickname = guest.nickname
      state.myAvatarId = guest.avatarId
      return
    }
    if (user.playerId) state.myPlayerId = user.playerId
    if (user.provider === 'guest') {
      // 共享认证对象可能仍是首次 init 的旧快照，游客资料始终以当前本地存储为准。
      const guest = readGuestProfile()
      state.myNickname = pendingGuestProfile?.nickname
        ?? (guest.nicknameSaved ? guest.nickname : (user.nickname && user.nickname !== '游客' ? user.nickname : '玩家'))
      state.myAvatarId = pendingGuestProfile?.avatarId
        ?? (guest.avatarSaved ? guest.avatarId : String(user.avatarId || '0'))
      try {
        localStorage.setItem('guestNickname', state.myNickname)
        localStorage.setItem('guestAvatarId', state.myAvatarId)
      } catch { /* localStorage unavailable */ }
      pendingGuestProfile = null
    } else {
      pendingGuestProfile = null
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
