<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLobbyStore } from '../stores/lobbyStore'

const route = useRoute()
const lobby = useLobbyStore()
const roomCode = computed(() => String(route.params.code || '').toUpperCase())
</script>

<template>
  <div class="p-8 text-center">
    <h1 class="text-2xl font-bold text-white">房间 {{ roomCode }}</h1>
    <p class="mt-2 text-slate-400">牌桌开发中…</p>
  </div>
</template>
