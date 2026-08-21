<script setup>
import { ref, computed, onMounted } from 'vue'
import CardSelectModal from './CardSelectModal.vue'

const props = defineProps({
  rewards: { type: Array, default: () => [] }
})

const emit = defineEmits(['claim', 'done'])

const claimed = ref(props.rewards.map((r) => r?.type === 'gold'))
const cardModalIndex = ref(-1)

const TYPE_META = {
  gold: { icon: '💰', label: '金币' },
  card: { icon: '🃏', label: '卡牌' },
  potion: { icon: '🧪', label: '药水' },
  relic: { icon: '💎', label: '遗物' }
}

const allClaimed = computed(() =>
  claimed.value.length === 0 || claimed.value.every(Boolean)
)

onMounted(() => {
  props.rewards.forEach((r) => {
    if (r?.type === 'gold') emit('claim', 'gold', r.amount ?? 0)
  })
})

function meta(r) {
  return TYPE_META[r?.type] || { icon: '❔', label: r?.type || '奖励' }
}

function rowLabel(r) {
  if (r?.type === 'gold') return '金币 ×' + (r.amount ?? 0)
  if (r?.type === 'card') return '卡牌奖励（' + (r.candidates?.length || 0) + ' 选 1）'
  return meta(r).label
}

function take(index) {
  const r = props.rewards[index]
  if (!r || claimed.value[index]) return
  if (r.type === 'card') {
    cardModalIndex.value = index
    return
  }
  claimed.value[index] = true
  emit('claim', r.type, r.id ?? r.value ?? null)
}

function confirmCard(ids) {
  const i = cardModalIndex.value
  cardModalIndex.value = -1
  if (i < 0 || !ids || !ids.length) return
  claimed.value[i] = true
  emit('claim', 'card', ids[0])
}
</script>

<template>
  <section class="reward-room">
    <h2 class="reward-title">战利品</h2>

    <ul class="reward-list">
      <li
        v-for="(r, i) in rewards"
        :key="i"
        class="reward-row"
        :class="{ done: claimed[i] }"
      >
        <span class="reward-icon">{{ meta(r).icon }}</span>
        <span class="reward-label">{{ rowLabel(r) }}</span>
        <span v-if="claimed[i]" class="got-mark">已领取 ✓</span>
        <button v-else class="claim-btn" @click="take(i)">
          {{ r.type === 'card' ? '选择' : '领取' }}
        </button>
      </li>
    </ul>

    <button class="continue-btn" :disabled="!allClaimed" @click="emit('done')">
      继续
    </button>

    <CardSelectModal
      v-if="cardModalIndex >= 0"
      title="选择一张卡牌"
      :cards="rewards[cardModalIndex]?.candidates || []"
      :max-select="1"
      confirm-text="拿走"
      @confirm="confirmCard"
      @cancel="cardModalIndex = -1"
    />
  </section>
</template>

<style scoped>
.reward-room {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: radial-gradient(ellipse at center, #221a10 0%, #110c07 70%);
  padding: 24px;
}
.reward-title {
  margin: 0;
  color: #f0c75e;
  font-size: 26px;
  letter-spacing: 5px;
}
.reward-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: min(480px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.reward-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid #5a4a30;
  background: linear-gradient(170deg, #2e2418, #1d1610);
}
.reward-row.done {
  opacity: 0.55;
}
.reward-icon {
  font-size: 24px;
}
.reward-label {
  flex: 1;
  color: #e8dcc0;
  font-size: 15px;
}
.got-mark {
  color: #7dc97d;
  font-weight: 700;
  font-size: 14px;
}
.claim-btn {
  padding: 8px 20px;
  border-radius: 8px;
  border: 1px solid #d4af37;
  background: linear-gradient(180deg, #d4af37, #a8842a);
  color: #1c1510;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}
.claim-btn:hover {
  filter: brightness(1.1);
}
.continue-btn {
  padding: 12px 44px;
  border-radius: 9px;
  border: 1px solid #6b5636;
  background: #3a2f22;
  color: #e8dcc0;
  font-size: 16px;
  letter-spacing: 3px;
  cursor: pointer;
}
.continue-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.continue-btn:not(:disabled):hover {
  border-color: #f0c75e;
  color: #f0c75e;
}
</style>
