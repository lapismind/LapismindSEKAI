<script setup>
import { onMounted, ref } from 'vue'
import { useLobbyStore } from '../stores/lobbyStore'
import { useGameStore } from '../stores/gameStore'
import PuzzleSubmitModal from '../components/PuzzleSubmitModal.vue'
import { avatarChoices, avatarUrl } from '../game/avatars'

const lobby = useLobbyStore()
const game = useGameStore()

const roomCode = ref('')

onMounted(() => {
  lobby.fetchPuzzles().catch(() => {})
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

    <!-- 提交谜题 -->
    <PuzzleSubmitModal @submitted="lobby.fetchPuzzles().catch(() => {})" />

    <p class="text-center text-xs text-slate-600">
      房主可选 AI 主持或真人主持，真人模式下房主担任主持人
    </p>
  </div>
</template>
