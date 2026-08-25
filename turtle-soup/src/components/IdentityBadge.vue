<script setup>
/**
 * 身份徽章 —— 显示当前登录身份（GitHub 昵称头像 / 游客）。
 * 页面加载时经 auth.init() 自动获得游客身份；GitHub 登录跳转认证服务。
 */
import { onMounted, ref } from 'vue'
import { createAuthClient } from '@lapismind/lobby-kit'
import { useLobbyStore } from '../stores/lobbyStore'

const props = defineProps({
  authBaseUrl: { type: String, default: '' }, // 留空用默认（生产 auth.qmzhj.top）
})

const user = ref(null)
let auth = null
const lobby = useLobbyStore()

onMounted(async () => {
  const opts = {}
  if (props.authBaseUrl) opts.baseUrl = props.authBaseUrl
  auth = createAuthClient(opts)
  await auth.init()
  user.value = auth.getUser()
  // 身份写入全局 store：进入房间时以服务端 playerId 为准（与 Worker 会话验签一致）
  if (user.value) lobby.identity = user.value
})

function login() {
  auth?.loginWithGithub(location.pathname + location.search)
}
</script>

<template>
  <div class="flex items-center justify-center gap-2 text-sm">
    <template v-if="user?.provider === 'github'">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        alt=""
        class="h-7 w-7 rounded-full border border-slate-600"
      />
      <span class="text-slate-200">{{ user.nickname }}</span>
    </template>
    <template v-else-if="user?.provider === 'guest'">
      <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs">👤</span>
      <span class="text-slate-400">游客</span>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-purple-500/60 hover:text-white"
        @click="login"
      >
        GitHub 登录
      </button>
    </template>
    <span v-else class="text-xs text-slate-500">身份获取中…</span>
  </div>
</template>
