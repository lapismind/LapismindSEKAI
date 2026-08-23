<script setup>
import { ref, computed } from 'vue'
import CardSelectModal from './CardSelectModal.vue'

const props = defineProps({
  playerHp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  deckSize: { type: Number, default: 0 },
  deck: { type: Array, default: () => [] }
})

const emit = defineEmits(['rest', 'smith', 'leave'])

const showSmithModal = ref(false)

const hpPct = computed(() => {
  if (!props.maxHp) return 0
  return Math.max(0, Math.min(100, (props.playerHp / props.maxHp) * 100))
})

function clickRest() {
  emit('rest')
}

function clickSmith() {
  if (props.deck.length > 0) {
    showSmithModal.value = true
  } else {
    emit('smith')
  }
}

function confirmSmith(ids) {
  showSmithModal.value = false
  if (!ids || !ids.length) return
  emit('smith', ids[0])
}
</script>

<template>
  <section class="campfire-room">
    <div class="flame" aria-hidden="true">🔥</div>
    <h2 class="camp-title">营火</h2>

    <div class="status-line">
      <div class="hp-bar">
        <div class="hp-fill" :style="{ width: hpPct + '%' }"></div>
        <span class="hp-text">{{ playerHp }} / {{ maxHp }}</span>
      </div>
      <span class="deck-info">牌组：{{ deckSize }} 张</span>
    </div>

    <div class="actions">
      <button class="choice rest" @click="clickRest">
        <span class="choice-icon">💤</span>
        <span class="choice-name">休息</span>
        <span class="choice-desc">回复 30% 最大生命</span>
      </button>
      <button class="choice smith" @click="clickSmith">
        <span class="choice-icon">⚒️</span>
        <span class="choice-name">锻造</span>
        <span class="choice-desc">升级一张牌</span>
      </button>
    </div>

    <button class="leave-btn" @click="emit('leave')">离开营火</button>

    <CardSelectModal
      v-if="showSmithModal"
      title="选择要升级的牌"
      :cards="deck"
      :max-select="1"
      confirm-text="升级"
      @confirm="confirmSmith"
      @cancel="showSmithModal = false"
    />
  </section>
</template>

<style scoped>
.campfire-room {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  background: radial-gradient(ellipse at center, #2c1d10 0%, #140d07 70%);
  padding: 24px;
}
.flame {
  font-size: 64px;
  filter: drop-shadow(0 0 24px rgba(255, 140, 40, 0.65));
  animation: flicker 1.6s ease-in-out infinite alternate;
}
@keyframes flicker {
  from { transform: scale(1); opacity: 0.92; }
  to { transform: scale(1.08); opacity: 1; }
}
.camp-title {
  margin: 0;
  color: #f0c75e;
  font-size: 28px;
  letter-spacing: 6px;
}
.status-line {
  display: flex;
  align-items: center;
  gap: 18px;
}
.hp-bar {
  position: relative;
  width: 260px;
  height: 24px;
  border-radius: 12px;
  border: 1px solid #6b3030;
  background: #1c1210;
  overflow: hidden;
}
.hp-fill {
  height: 100%;
  background: linear-gradient(180deg, #c0392b, #7e241b);
  transition: width 0.3s ease;
}
.hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffe8dd;
  font-size: 13px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.deck-info {
  color: #b9a888;
  font-size: 14px;
}
.actions {
  display: flex;
  gap: 26px;
}
.choice {
  width: 200px;
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-radius: 14px;
  border: 2px solid #6b5636;
  background: linear-gradient(170deg, #33281c, #201810);
  color: #e8dcc0;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
}
.choice:hover {
  transform: translateY(-4px);
  border-color: #f0c75e;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55), 0 0 14px rgba(240, 199, 94, 0.25);
}
.choice-icon {
  font-size: 34px;
}
.choice-name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 2px;
}
.choice-desc {
  font-size: 13px;
  color: #b9a888;
}
.leave-btn {
  margin-top: 6px;
  padding: 9px 22px;
  border-radius: 8px;
  border: 1px solid #4a3c28;
  background: transparent;
  color: #97876c;
  font-size: 13px;
  cursor: pointer;
}
.leave-btn:hover {
  color: #e8dcc0;
  border-color: #6b5636;
}
</style>
