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
  // 统一身份：GitHub 登录用户用服务端 playerId，游客自动签发（见 IdentityBadge/auth）
  // 统一身份：auth.getUser() 结果；GitHub/账号登录用户用服务端 playerId，游客自动签发（见 AuthBadge/auth）
  const identity = ref(null)
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
    puzzles,
    setNickname,
    setAvatar,
    syncIdentity,
    fetchPuzzles,
  }
})
