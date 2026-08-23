<script setup>
defineProps({
  kind: String,
  size: { type:Number, default:48 },
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" class="svg-art">
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8a97a8"/><stop offset="50%" stop-color="#5c6a7d"/><stop offset="100%" stop-color="#3a4454"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f3dda6"/><stop offset="60%" stop-color="#d9b46a"/><stop offset="100%" stop-color="#9a7a35"/>
      </linearGradient>
      <linearGradient id="blood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e05a49"/><stop offset="100%" stop-color="#8b2018"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="40%" stop-color="#fff3cf" stop-opacity=".95"/><stop offset="100%" stop-color="#d9b46a" stop-opacity="0"/></radialGradient>
      <linearGradient id="shadow"><stop offset="0%" stop-color="#000" stop-opacity=".6"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient>
    </defs>

    <!-- 铁甲战士半身像 -->
    <g v-if="kind==='ironclad'">
      <ellipse cx="50" cy="92" rx="32" ry="7" fill="url(#shadow)"/>
      <!-- 肩甲 -->
      <path d="M18,52 Q14,38 26,34 L36,44 Q30,54 24,56 Z" fill="url(#metal)" stroke="#2c3440" stroke-width="1.2"/>
      <path d="M82,52 Q86,38 74,34 L64,44 Q70,54 76,56 Z" fill="url(#metal)" stroke="#2c3440" stroke-width="1.2"/>
      <!-- 头盔 -->
      <path d="M32,44 Q32,22 50,22 Q68,22 68,44 L68,58 Q50,66 32,58 Z" fill="url(#metal)" stroke="#2c3440" stroke-width="1.4"/>
      <path d="M36,42 Q42,36 50,36 Q58,36 64,42 L62,50 Q50,46 38,50 Z" fill="#12181f"/>
      <circle cx="43" cy="43" r="2.5" fill="#ff6b4a"/>
      <circle cx="57" cy="43" r="2.5" fill="#ff6b4a"/>
      <!-- 剑 -->
      <path d="M78,20 L82,16 L86,20 L84,58 L80,58 Z" fill="url(#gold)" stroke="#6b5528" stroke-width="1"/>
    </g>

    <!-- 静默猎手 -->
    <g v-else-if="kind==='silent'">
      <ellipse cx="50" cy="92" rx="28" ry="6" fill="url(#shadow)"/>
      <!-- 斗篷 -->
      <path d="M30,88 Q22,50 34,36 Q50,28 66,36 Q78,50 70,88 Z" fill="#2c3444" stroke="#1a222e" stroke-width="1.2"/>
      <!-- 面罩 -->
      <path d="M36,44 Q50,36 64,44 L62,58 Q50,64 38,58 Z" fill="#1a222e"/>
      <path d="M42,48 L46,48 M54,48 L58,48" stroke="#7ee0c8" stroke-width="1.8" stroke-linecap="round"/>
      <!-- 匕首 -->
      <path d="M72,30 L76,26 L79,29 L77,55 L73,55 Z" fill="url(#metal)"/>
    </g>

    <!-- 敌人形状：虫形 -->
    <g v-else-if="['jaw_worm','red_louse','green_louse','fungi_beast'].includes(kind)">
      <ellipse cx="50" cy="55" rx="30" ry="22" fill="url(#blood)" stroke="#4d1410" stroke-width="1.5"/>
      <ellipse cx="42" cy="48" rx="12" ry="8" fill="#f08a75" opacity=".4"/>
      <circle cx="40" cy="52" r="2.2" fill="#fff"/>
      <circle cx="58" cy="52" r="2.2" fill="#fff"/>
      <path d="M32,65 Q50,72 68,65" stroke="#3a0e0a" stroke-width="2" fill="none"/>
      <ellipse cx="50" cy="84" rx="22" ry="4" fill="url(#shadow)"/>
    </g>

    <!-- 史莱姆形 -->
    <g v-else-if="['acid_slime_s','acid_slime_m','spike_slime_s'].includes(kind)">
      <path d="M22,72 Q20,45 50,42 Q80,45 78,72 Q78,80 50,80 Q22,80 22,72 Z" fill="url(#blood)" opacity=".85"/>
      <ellipse cx="40" cy="55" rx="10" ry="5" fill="#fff" opacity=".25"/>
      <circle cx="42" cy="62" r="3" fill="#1a0806"/><circle cx="58" cy="62" r="3" fill="#1a0806"/>
    </g>

    <!-- Boss 大型敌人 -->
    <g v-else-if="['slime_boss','the_guardian','hexaghost','bronze_automa','champ','time_eater'].includes(kind)">
      <circle cx="50" cy="45" r="30" fill="url(#blood)" stroke="#3a0e0a" stroke-width="2"/>
      <circle cx="50" cy="45" r="30" fill="none" stroke="url(#glow)" stroke-width="3"/>
      <circle cx="40" cy="38" r="4" fill="#ffe9a8"/>
      <circle cx="60" cy="38" r="4" fill="#ffe9a8"/>
      <path d="M35,55 Q50,68 65,55 L63,62 Q50,72 37,62 Z" fill="#3a0e0a"/>
      <ellipse cx="50" cy="88" rx="26" ry="6" fill="url(#shadow)"/>
    </g>

    <!-- 遗物底座 -->
    <g v-else-if="kind==='relic'">
      <circle cx="50" cy="50" r="32" fill="url(#gold)" stroke="#6b5528" stroke-width="2"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke="#fff3cf" stroke-width="1.5"/>
      <text x="50" y="60" text-anchor="middle" font-size="30" font-family="serif">✦</text>
    </g>

    <!-- 能量球 -->
    <g v-else-if="kind==='orb'">
      <circle cx="50" cy="50" r="35" fill="url(#glow)"/>
      <circle cx="50" cy="50" r="26" fill="url(#gold)" stroke="#fff3cf" stroke-width="2"/>
      <text x="50" y="60" text-anchor="middle" font-size="28" font-weight="bold" fill="#000">3</text>
    </g>

    <!-- 默认占位 -->
    <g v-else>
      <circle cx="50" cy="50" r="30" fill="url(#metal)" stroke="#333" stroke-width="2"/>
      <text x="50" y="58" text-anchor="middle" font-size="24">?</text>
    </g>
  </svg>
</template>

<style scoped>
.svg-art{display:block}
</style>
