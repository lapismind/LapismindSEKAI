<script setup>
/**
 * App.vue —— M0：设置页 ↔ 对局页切换（联机里程碑再引入 router / 大厅）
 * dev 下地址加 #editor 进入地图编辑器（build 产物里不含编辑器）
 */
import { defineAsyncComponent, ref } from 'vue';
import { useGameStore } from '@/stores/game.js';
import SetupScreen from '@/components/SetupScreen.vue';
import GameScreen from '@/components/GameScreen.vue';

const store = useGameStore();
const IS_DEV = import.meta.env.DEV;
const MapEditor = IS_DEV ? defineAsyncComponent(() => import('@/components/MapEditor.vue')) : null;
const editor = ref(IS_DEV && location.hash === '#editor');
if (IS_DEV) window.addEventListener('hashchange', () => { editor.value = location.hash === '#editor'; });
</script>

<template>
  <component :is="MapEditor" v-if="editor" />
  <SetupScreen v-else-if="!store.started" />
  <GameScreen v-else />
</template>
