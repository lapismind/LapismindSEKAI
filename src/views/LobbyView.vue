<script setup>
import { onMounted, ref } from 'vue'
import { useLobbyStore } from '../stores/lobbyStore'
import { useGameStore } from '../stores/gameStore'
import { readRoomCodeFromUrl } from '@lapismind/lobby-kit'
import { ProfileEditor } from '@lapismind/lobby-kit/vue'
import PuzzleSubmitModal from '../components/PuzzleSubmitModal.vue'
import FeedbackModal from '../components/FeedbackModal.vue'
import { avatarChoices, avatarUrl } from '../game/avatars'

const lobby = useLobbyStore()
const game = useGameStore()

const roomCode = ref('')
const invited = ref('') // 受邀进入的房间号（来自链接）
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })
const feedbackOpen = ref(false)

onMounted(() => {
  lobby.fetchPuzzles().catch(() => {})
  // 检查 URL 是否带房间号（分享链接）：填入房间码 + 显示邀请提示，不自动进房
  const roomFromUrl = readRoomCodeFromUrl()
  if (roomFromUrl) {
    invited.value = roomFromUrl
    roomCode.value = invited.value
  }
})

function createRoom() {
  const code = generateCode()
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
  // 把房间号写进 URL，方便分享
  const url = new URL(window.location.href)
  url.searchParams.set('room', code)
  window.history.replaceState({}, '', url)
  game.enterRoom(code, lobby.myPlayerId)
  game.connect(code, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-10">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-white">🫕 真冬的海龟汤</h1>
      <p class="mt-2 text-sm text-slate-400">一起推理神秘的汤面，揭开汤底真相</p>
    </header>

    <!-- GitHub 引导 -->
    <a
      href="https://github.com/lapismind/Mafuyu-Turtle-soup"
      target="_blank"
      rel="noopener"
      class="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-300 transition hover:border-brand-500/50 hover:bg-slate-800 hover:text-slate-100"
    >
      <span class="text-lg">⭐</span>
      <span>喜欢这个游戏？欢迎去 GitHub 点个 star 支持</span>
      <span class="text-slate-500">→</span>
    </a>

    <!-- 反馈入口 -->
    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-300 transition hover:border-sky-500/50 hover:bg-slate-800 hover:text-slate-100"
      @click="feedbackOpen = true"
    >
      <span>💬</span>
      <span>意见反馈 · 遇到问题或想提建议？</span>
    </button>

    <!-- 反馈弹窗 -->
    <FeedbackModal v-if="feedbackOpen" @close="feedbackOpen = false" />

    <!-- 昵称 + 头像（共享组件） -->
    <ProfileEditor v-model="profileDraft" :avatar-choices="avatarChoices" />

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

    <!-- 提交谜题 -->
    <PuzzleSubmitModal @submitted="lobby.fetchPuzzles().catch(() => {})" />

    <p class="text-center text-xs text-slate-600">
      房主可选 AI 主持或真人主持，真人模式下房主担任主持人
    </p>
  </div>
</template>
