<script setup>
import LobbyView from './views/LobbyView.vue'
import GameView from './views/GameView.vue'
import { useGameStore } from './stores/gameStore'

const gameStore = useGameStore()
</script>

<template>
  <GameView v-if="gameStore.inRoom" />
  <LobbyView v-else />
</template>
