<script setup>
import { useGameStore } from './stores/gameStore'
import LobbyView from './views/LobbyView.vue'
import RoomView from './views/RoomView.vue'

const game = useGameStore()
</script>

<template>
  <RoomView v-if="game.inRoom" />
  <LobbyView v-else />
</template>
