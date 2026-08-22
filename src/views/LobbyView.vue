<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLobbyStore } from '../stores/lobbyStore'
import { generateRoomCode, readRoomCodeFromUrl } from '@lapismind/lobby-kit'
import { ProfileEditor } from '@lapismind/lobby-kit/vue'
import { avatarChoices } from '../game/avatars'

const lobby = useLobbyStore()
const router = useRouter()

const roomCode = ref('')
const invited = ref('') // 受邀进入的房间号（来自链接）
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })

// 检查 URL 是否带房间号（分享链接）：填入房间码 + 显示邀请提示
const roomFromUrl = readRoomCodeFromUrl()
if (roomFromUrl) {
  invited.value = roomFromUrl
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
  lobby.setNickname(profileDraft.value.nickname)
  lobby.setAvatar(profileDraft.value.avatarId)
  router.push({ path: `/room/${code}` })
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-10">
    <header class="text-center drop-shadow-sm">
      <h1 class="text-3xl font-bold text-slate-800">🃏 Showhand 梭哈</h1>
      <p class="mt-2 text-sm text-slate-500">多人联机梭哈，五张 / 七张双玩法</p>
    </header>

    <!-- 邀请提示（来自分享链接） -->
    <div
      v-if="invited"
      class="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-center"
    >
      <div class="text-sm font-semibold text-brand-700">📩 你被邀请进入房间 {{ invited }}</div>
      <p class="mt-1 text-xs text-slate-500">
        设置好昵称和头像，点击下方「加入」即可进入
      </p>
    </div>

    <!-- 昵称 + 头像（共享组件） -->
    <ProfileEditor v-model="profileDraft" :avatar-choices="avatarChoices" />

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
        class="flex-1 rounded-lg border border-brand-300 bg-white px-3 py-2.5 text-center text-sm font-mono uppercase tracking-widest text-slate-800 outline-none focus:border-brand-500"
        placeholder="输入房间码"
        maxlength="6"
        @keyup.enter="joinRoom"
      />
      <button
        type="button"
        class="rounded-lg bg-brand-600 px-5 font-bold text-white transition hover:bg-brand-500"
        @click="joinRoom"
      >
        加入
      </button>
    </div>

    <p class="text-center text-xs text-slate-400">
      房主创建房间后可选择五张或七张梭哈，开局后设定局数与初始筹码
    </p>
  </div>
</template>
