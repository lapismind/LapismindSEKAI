<script setup>
/**
 * PokerTable.vue —— 牌桌桌面（纯 SVG 绘制，无贴图）。
 *
 * 为什么不用图片：原先的 table.png 是 880KB 的绿毡+木框写实贴图，
 * 与站点香芋浅紫的画风冲突，而且被 object-fill 从 1024×1024 非等比
 * 拉到 1350×900，八角形肉眼可见变形。SVG 既没有体积问题、不会变形，
 * 颜色也能直接跟 design-kit 的品牌色走。
 *
 * 形状来自 core/tableShape.js —— 与生成博客配图的脚本共用同一份几何，
 * 改形状不会出现"游戏里变了、博客配图还是旧的"。
 *
 * 尺寸由 props 决定（外层按视口宽高比传更方或更扁的尺寸），
 * viewBox 直接用这个尺寸，所以永远等比铺满、不拉伸。
 */
import { computed } from 'vue'
import { octagonPoints, feltInset, RAIL_INSET, TABLE_COLORS } from '../core/tableShape'

const props = defineProps({
  width: { type: Number, default: 1350 },
  height: { type: Number, default: 900 },
})

const outerPoints = computed(() => octagonPoints(props.width, props.height, RAIL_INSET))
const feltPoints = computed(() => octagonPoints(props.width, props.height, feltInset(props.width, props.height)))
const C = TABLE_COLORS
</script>

<template>
  <svg
    class="poker-table pointer-events-none absolute inset-0 h-full w-full select-none"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
  >
    <defs>
      <!-- 台面：淡紫到更淡的紫，比页面底色更"亮"才看得出是一块桌面。
           刻意不做到纯白 —— 纯白台面上白色的席位卡会完全糊在一起。 -->
      <linearGradient id="tableFelt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="C.feltTop" />
        <stop offset="100%" :stop-color="C.feltBottom" />
      </linearGradient>
      <!-- 中心聚光：品牌紫的极淡光晕 -->
      <radialGradient id="tableGlow" cx="50%" cy="44%" r="58%">
        <stop offset="0%" :stop-color="C.glow" />
        <stop offset="100%" :stop-color="C.glowFade" />
      </radialGradient>
    </defs>

    <!-- 台框 -->
    <polygon :points="outerPoints" :fill="C.rail" :stroke="C.railStroke" stroke-width="2" />
    <!-- 台面 -->
    <polygon :points="feltPoints" fill="url(#tableFelt)" :stroke="C.feltStroke" stroke-width="1.5" />
    <!-- 中心光晕 -->
    <polygon :points="feltPoints" fill="url(#tableGlow)" />
  </svg>
</template>

<style scoped>
/* 与 design-kit 的 --shadow-md / --shadow-lg 同色（冷调 oklch(0.3 0.02 250)），
   换成 drop-shadow 是因为 box-shadow 不会贴合八角形轮廓 */
.poker-table {
  filter: drop-shadow(0 2px 6px rgba(61, 61, 104, 0.07))
    drop-shadow(0 16px 40px rgba(61, 61, 104, 0.12));
}

@media (prefers-reduced-motion: reduce) {
  .poker-table {
    filter: drop-shadow(0 2px 6px rgba(61, 61, 104, 0.07));
  }
}
</style>
