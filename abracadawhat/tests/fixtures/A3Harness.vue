<script setup>
import { ref } from 'vue'
import SpellCard from '../../src/components/SpellCard.vue'
import PublicArea from '../../src/components/PublicArea.vue'
import CastFeedback from '../../src/components/CastFeedback.vue'
import { useGameStore } from '../../src/stores/gameStore.js'

const firstFaceDown = ref(false)
const game = useGameStore()
game.roomState = { players: [{ id: 'caster', nickname: '测试法师' }] }

function showOwlFeedback(secretTaken) {
  game.lastCastResult = null
  requestAnimationFrame(() => {
    game.lastCastResult = {
      type: 'cast_success',
      playerId: 'caster',
      spellId: 4,
      damaged: [],
      healed: [],
      secretTaken,
    }
  })
}
</script>

<template>
  <main class="min-h-screen bg-[#F7EFF8] p-4 text-[#333333]">
    <section aria-label="SpellCard fixtures" class="space-y-3">
      <button type="button" data-testid="toggle-facedown" @click="firstFaceDown = !firstFaceDown">
        切换暗牌
      </button>
      <div class="flex flex-wrap items-start gap-3">
        <div data-testid="spell-one"><SpellCard :spell-id="4" :face-down="firstFaceDown" size="sm" /></div>
        <div data-testid="spell-two"><SpellCard :spell-id="7" size="sm" /></div>
      </div>
    </section>

    <section aria-label="PublicArea fixture" class="mt-6">
      <PublicArea :cast-counts="{ 1: 1, 4: 2 }" :deck-remaining="9" :secret-pile-remaining="0" />
    </section>

    <section aria-label="Feedback fixture" class="mt-6 flex gap-2">
      <button type="button" data-testid="owl-empty" @click="showOwlFeedback(null)">空牌堆猫头鹰</button>
      <button type="button" data-testid="owl-drawn" @click="showOwlFeedback(3)">抽到秘密牌</button>
    </section>
    <CastFeedback />
  </main>
</template>
