<script setup>
import { useGameStore } from './stores/gameStore'
import LobbyView from './views/LobbyView.vue'
import RoomView from './views/RoomView.vue'
import GameHelp from './components/GameHelp.vue'

const game = useGameStore()
</script>

<template>
  <RoomView v-if="game.inRoom" />
  <LobbyView v-else />
  <!-- 游戏说明：任何环节都可打开 -->
  <GameHelp />
</template>
