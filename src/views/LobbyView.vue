<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLobbyStore } from '../stores/lobbyStore'
import { generateRoomCode } from '@lapismind/lobby-kit'
import { avatarChoices } from '../game/avatars'

const lobby = useLobbyStore()
const router = useRouter()

const roomCode = ref('')
const invited = ref('') // 受邀进入的房间号（来自链接）

// 检查 URL 是否带房间号（分享链接）：填入房间码 + 显示邀请提示
const params = new URLSearchParams(window.location.search)
const roomFromUrl = params.get('room')
if (roomFromUrl) {
  invited.value = roomFromUrl.toUpperCase()
  roomCode.value = invited.value
}

function createRoom() {
  const code = generateRoomCode()
  enterRoom(code)
}

function joinRoom() {
  const code = roomCode.value.trim().toUpperCase()
  if (!code) return
  enterRoom(code)
}

function enterRoom(code) {
  router.push({ path: `/room/${code}` })
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-10">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-white">🃏 Showhand 梭哈</h1>
      <p class="mt-2 text-sm text-slate-400">多人联机梭哈，五张 / 七张双玩法</p>
    </header>

    <!-- 邀请提示（来自分享链接） -->
    <div
      v-if="invited"
      class="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-center"
    >
      <div class="text-sm font-semibold text-brand-300">📩 你被邀请进入房间 {{ invited }}</div>
      <p class="mt-1 text-xs text-slate-400">
        设置好昵称和头像，点击下方「加入」即可进入
      </p>
    </div>

    <!-- 昵称 -->
    <div>
      <label class="mb-1 block text-xs text-slate-500">昵称</label>
      <input
        v-model="lobby.myNickname"
        class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        maxlength="12"
        placeholder="给自己取个名字"
        @change="lobby.setNickname(lobby.myNickname)"
      />
    </div>

    <!-- 默认头像选择 -->
    <div>
      <label class="mb-1.5 block text-xs text-slate-500">选择头像</label>
      <div class="grid grid-cols-7 gap-2">
        <button
          v-for="a in avatarChoices"
          :key="a.id"
          type="button"
          class="relative aspect-square overflow-hidden rounded-full border-2 transition"
          :class="lobby.myAvatarId === a.id
            ? 'border-brand-400 ring-2 ring-brand-400/40'
            : 'border-slate-700 hover:border-slate-500'"
          @click="lobby.setAvatar(a.id)"
        >
          <img :src="a.url" :alt="`头像${a.id}`" class="h-full w-full object-cover" />
        </button>
      </div>
    </div>

    <!-- 创建房间 -->
    <button
      type="button"
      class="rounded-xl bg-brand-600 py-3 font-bold text-white shadow-lg transition hover:bg-brand-500"
      @click="createRoom"
    >
      创建房间
    </button>

    <!-- 加入房间 -->
    <div class="flex gap-2">
      <input
        v-model="roomCode"
        class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-center text-sm font-mono uppercase tracking-widest text-white outline-none focus:border-brand-500"
        placeholder="输入房间码"
        maxlength="6"
        @keyup.enter="joinRoom"
      />
      <button
        type="button"
        class="rounded-lg bg-slate-700 px-5 font-bold text-white transition hover:bg-slate-600"
        @click="joinRoom"
      >
        加入
      </button>
    </div>

    <p class="text-center text-xs text-slate-600">
      房主创建房间后可选择五张或七张梭哈，开局后设定局数与初始筹码
    </p>
  </div>
</template>
