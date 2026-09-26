<script setup>
/**
 * App.vue —— M0：设置页 ↔ 对局页切换（联机里程碑再引入 router / 大厅）
 */
import { useGameStore } from '@/stores/game.js';
import SetupScreen from '@/components/SetupScreen.vue';
import GameScreen from '@/components/GameScreen.vue';

const store = useGameStore();
</script>

<template>
  <SetupScreen v-if="!store.started" />
  <GameScreen v-else />
</template>
