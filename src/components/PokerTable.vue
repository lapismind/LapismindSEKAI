<script setup>
/**
 * PokerTable.vue —— 牌桌贴图。
 * 使用处理过的透明背景 PNG（木框 + 绿毛毡八角桌），
 * 铺满父容器，通过 slot 在桌面中央放底池等内容。
 */
import tableImg from '../assets/table.png'
</script>

<template>
  <img
    :src="tableImg"
    alt=""
    draggable="false"
    class="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
  />
</template>

