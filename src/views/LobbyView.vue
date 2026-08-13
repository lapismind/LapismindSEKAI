<script setup>
import { onMounted } from 'vue'
import { useLobbyStore } from '../stores/lobbyStore'
import { useGameStore } from '../stores/gameStore'
import { api } from '../network/api'

const lobby = useLobbyStore()
const game = useGameStore()

onMounted(() => {
  lobby.fetchRooms()
})

async function onCreateRoom() {
  const roomId = await lobby.createRoom()
  enterRoom(roomId)
}

async function onJoinRoom(roomId) {
  enterRoom(roomId)
}

function enterRoom(roomId) {
  game.enterRoom(roomId, lobby.myPlayerId)
  game.connect(roomId, lobby.myNickname, lobby.myPlayerId)
}
</script>

<template>
  <div class="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-8">
    <header class="text-center">
      <h1 class="text-2xl font-bold text-white">卡牌对战</h1>
      <p class="mt-1 text-sm text-slate-400">回合制联机 · 最多 8 人</p>
    </header>

    <!-- 昵称 -->
    <div class="flex gap-2">
      <input
        v-model="lobby.myNickname"
        class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
        placeholder="输入昵称"
        maxlength="12"
        @change="lobby.setNickname(lobby.myNickname)"
      />
      <button
        type="button"
        class="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-400"
        @click="onCreateRoom"
      >
        创建房间
      </button>
    </div>

    <!-- 房间列表 -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300">房间列表</h2>
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-slate-300"
          @click="lobby.fetchRooms()"
        >
          刷新
        </button>
      </div>

      <div
        v-for="room in lobby.rooms"
        :key="room.id"
        class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3"
      >
        <div>
          <div class="text-sm font-semibold text-slate-200">房间 {{ room.id }}</div>
          <div class="text-xs text-slate-500">{{ room.playerCount ?? 0 }}/8 人</div>
        </div>
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
          @click="onJoinRoom(room.id)"
        >
          加入
        </button>
      </div>

      <div v-if="lobby.rooms.length === 0" class="py-8 text-center text-sm text-slate-600">
        暂无房间，创建一个吧
      </div>
    </section>
  </div>
</template>
