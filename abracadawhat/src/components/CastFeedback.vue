<script setup>
/**
 * 施法结果反馈：
 * - 顶部横幅：猜对（效果结算）/ 猜错（扣血）即时提示，几秒后自动消失
 * - 古代巨龙成功时触发全屏特效（特效实现预留接口，当前为占位样式）
 */
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { SPELLS } from '../core/rules'

const game = useGameStore()
const visible = ref(false)
let hideTimer = null

const result = computed(() => game.lastCastResult)
const spell = computed(() => SPELLS.find((s) => s.id === result.value?.spellId))

const isSuccess = computed(() => result.value?.type === 'cast_success')
const isDragon = computed(() => isSuccess.value && result.value?.spellId === 1)

const bannerText = computed(() => {
  if (!result.value) return ''
  const name = spell.value?.name ?? '魔法'
  if (isSuccess.value) {
    const parts = []
    for (const d of result.value.damaged ?? []) parts.push(`玩家 -${d.amount}❤️`)
    for (const h of result.value.healed ?? []) parts.push(`施法者 +${h.amount}❤️`)
    if (result.value.spellId === 4) parts.push('获得秘密牌 🔮')
    return `✨ 猜对了！${name}生效：${parts.join('，') || '无直接目标'}`
  }
  return `💥 猜错了！${name}不在手，扣 ${result.value.damage}❤️`
})

watch(result, (val) => {
  if (!val) return
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { visible.value = false }, 3500)
})
</script>

<template>
  <!-- 古代巨龙全屏特效口子：后续在这里接入正式特效 -->
  <Teleport to="body">
    <div v-if="isDragon" class="dragon-fx" aria-hidden="true">
      <div class="dragon-fx-core">🐉</div>
    </div>
  </Teleport>

  <div
    v-if="result"
    class="pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-all duration-300"
    :class="visible ? 'top-16 opacity-100' : '-top-10 opacity-0'"
  >
    <div
      class="rounded-xl px-5 py-2.5 text-sm font-bold shadow-xl"
      :class="isSuccess ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'"
    >
      {{ bannerText }}
    </div>
  </div>
</template>

<style scoped>
.dragon-fx {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: radial-gradient(circle, rgba(255, 120, 40, 0.35) 0%, rgba(20, 8, 4, 0.75) 75%);
  animation: dragon-bg 1.6s ease-out forwards;
}
.dragon-fx-core {
  font-size: 9rem;
  animation: dragon-pop 1.6s cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
}
@keyframes dragon-bg {
  0% { opacity: 0; }
  18% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes dragon-pop {
  0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
  25% { transform: scale(1.15) rotate(4deg); opacity: 1; }
  55% { transform: scale(1); rotate: 0deg; opacity: 1; }
  100% { transform: scale(1.6); opacity: 0; }
}
</style>
