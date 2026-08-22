<script setup>
/**
 * PokerTable.vue —— SVG 俯视椭圆牌桌。
 * 毛毡质感 + 木纹边框 + 内圈下注线，纯矢量，任意缩放不糊。
 * 通过 slot 在桌面中央放底池等内容。
 */
const props = defineProps({
  width: { type: Number, default: 620 },
  height: { type: Number, default: 400 },
})
</script>

<template>
  <svg
    :viewBox="'0 0 ' + width + ' ' + height"
    :width="width"
    :height="height"
    class="pointer-events-none absolute inset-0 select-none"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <!-- 毛毡径向渐变：中心稍亮、边缘暗 -->
      <radialGradient id="feltGrad" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#3d8b63" />
        <stop offset="55%" stop-color="#35795a" />
        <stop offset="100%" stop-color="#2a6049" />
      </radialGradient>
      <!-- 木纹边框线性渐变 -->
      <linearGradient id="woodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7a4a28" />
        <stop offset="30%" stop-color="#8f5c33" />
        <stop offset="60%" stop-color="#6d3f22" />
        <stop offset="100%" stop-color="#5c341c" />
      </linearGradient>
      <!-- 桌面高光 -->
      <linearGradient id="sheenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.10)" />
        <stop offset="45%" stop-color="rgba(255,255,255,0.02)" />
        <stop offset="100%" stop-color="rgba(0,0,0,0.08)" />
      </linearGradient>
    </defs>

    <!-- 外圈阴影 -->
    <ellipse :cx="width/2" :cy="height/2+6" :rx="width/2-4" :ry="height/2-4" fill="rgba(0,0,0,0.18)" />

    <!-- 木质边框 -->
    <ellipse :cx="width/2" :cy="height/2" :rx="width/2-6" :ry="height/2-6"
      fill="url(#woodGrad)" stroke="#4a2815" stroke-width="1.5" />

    <!-- 木框内缘暗线 -->
    <ellipse :cx="width/2" :cy="height/2" :rx="width/2-24" :ry="height/2-22"
      fill="none" stroke="#3e2010" stroke-width="1" opacity="0.6" />

    <!-- 绿色毛毡 -->
    <ellipse :cx="width/2" :cy="height/2" :rx="width/2-26" :ry="height/2-24"
      fill="url(#feltGrad)" />

    <!-- 内圈下注线（虚线） -->
    <ellipse :cx="width/2" :cy="height/2" :rx="width/2-80" :ry="height/2-70"
      fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" stroke-dasharray="8 5" />

    <!-- 高光层 -->
    <ellipse :cx="width/2" :cy="height/2" :rx="width/2-6" :ry="height/2-6"
      fill="url(#sheenGrad)" pointer-events="none" />
  </svg>
</template>

