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
const invited = ref('')
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })

const roomFromUrl = readRoomCodeFromUrl()
if (roomFromUrl) {
  invited.value = roomFromUrl
  roomCode.value = invited.value
}

function createRoom() {
  enterRoom(generateRoomCode())
}

function joinRoom() {
  const code = roomCode.value.trim().toUpperCase()
  if (code) enterRoom(code)
}

function enterRoom(code) {
  lobby.setNickname(profileDraft.value.nickname)
  lobby.setAvatar(profileDraft.value.avatarId)
  router.push({ path: `/room/${code}` })
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-10">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-[#333333]">🧙 出包魔法师</h1>
      <p class="mt-2 text-sm text-[#8A8299]">2–5 人联机猜牌魔法对决</p>
    </header>

    <div
      v-if="invited"
      class="rounded-xl border border-[#B3B3DD] bg-brand-100 px-4 py-3 text-center"
    >
      <div class="text-sm font-semibold text-brand-600">📩 你被邀请进入房间 {{ invited }}</div>
      <p class="mt-1 text-xs text-[#8A8299]">
        设置好昵称和头像，点击下方「加入」即可进入
      </p>
    </div>

    <ProfileEditor v-model="profileDraft" :avatar-choices="avatarChoices" />

    <button
      type="button"
      class="rounded-xl bg-brand-600 py-3 font-bold text-white shadow-lg transition hover:bg-brand-500"
      @click="createRoom"
    >
      创建房间
    </button>

    <div class="flex gap-2">
      <input
        v-model="roomCode"
        class="flex-1 rounded-lg border border-[#D8D0E4] bg-white px-3 py-2.5 text-center text-sm font-mono uppercase tracking-widest text-[#333333] outline-none focus:border-brand-500"
        placeholder="输入房间码"
        maxlength="6"
        @keyup.enter="joinRoom"
      />
      <button
        type="button"
        class="rounded-lg border border-[#CFCFE9] bg-white px-5 font-bold text-brand-600 transition hover:border-brand-300 hover:text-brand-500"
        @click="joinRoom"
      >
        加入
      </button>
    </div>

    <p class="text-center text-xs text-[#A29BB5]">
      每人 5 张暗手牌——你看不到自己的，但看得到别人的。喊出魔法名试试运气吧！
    </p>
  </div>
</template>
