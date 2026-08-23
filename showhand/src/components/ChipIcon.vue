<script setup>
/**
 * ChipIcon.vue —— SVG 扑克筹码图标。
 * 边缘条纹 + 内圈渐变，支持自定义颜色和尺寸。
 */
const props = defineProps({
  size: { type: Number, default: 18 },
  color: { type: String, default: '#e05a4e' },
})

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, ((n >> 16) & 0xff) + 40)
  const g = Math.min(255, ((n >> 8) & 0xff) + 30)
  const b = Math.min(255, (n & 0xff) + 25)
  return 'rgb(' + r + ',' + g + ',' + b + ')'
}
function darken(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, ((n >> 16) & 0xff) - 50)
  const g = Math.max(0, ((n >> 8) & 0xff) - 45)
  const b = Math.max(0, (n & 0xff) - 40)
  return 'rgb(' + r + ',' + g + ',' + b + ')'
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" class="inline-block shrink-0">
    <defs>
      <radialGradient :id="'chipGrad-' + color.replace('#','')" cx="40%" cy="35%" r="70%">
        <stop offset="0%" :stop-color="lighten(color)" />
        <stop offset="100%" :stop-color="darken(color)" />
      </radialGradient>
    </defs>

    <!-- 外圈条纹 -->
    <g :stroke="darken(color)" stroke-width="3" stroke-linecap="round" opacity="0.85">
      <line x1="12" y1="1.5" x2="12" y2="5" />
      <line x1="22.5" y1="12" x2="19" y2="12" />
      <line x1="12" y1="22.5" x2="12" y2="19" />
      <line x1="1.5" y1="12" x2="5" y2="12" />
      <line x1="4.6" y1="4.6" x2="7.1" y2="7.1" />
      <line x1="19.4" y1="4.6" x2="16.9" y2="7.1" />
      <line x1="4.6" y1="19.4" x2="7.1" y2="16.9" />
      <line x1="19.4" y1="19.4" x2="16.9" y2="16.9" />
    </g>

    <!-- 主体 -->
    <circle cx="12" cy="12" r="10" :fill="'url(#chipGrad-' + color.replace('#','') + ')'" />

    <!-- 内圈白虚线 -->
    <circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" stroke-dasharray="4.5 3.2" />

    <!-- 高光点 -->
    <circle cx="8.5" cy="8" r="2.5" fill="rgba(255,255,255,0.25)" />
  </svg>
</template>

