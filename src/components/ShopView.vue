<script setup>
import { ref, computed } from 'vue'
import CardSelectModal from './CardSelectModal.vue'
import { getCard } from '../data/cards.js'

const props = defineProps({
  stock: { type: Object, required: true },
  deck: { type: Array, default: () => [] }
})

const emit = defineEmits(['buy', 'leave', 'remove_card'])

const showRemoveModal = ref(false)
const serviceUsed = ref(false)

const cards = computed(() => props.stock?.cards ?? [])
const relics = computed(() => props.stock?.relics ?? [])
const potions = computed(() => props.stock?.potions ?? [])
const gold = computed(() => props.stock?.playerGold ?? 0)
const removePrice = computed(() => props.stock?.removeService ?? 0)
const canAffordRemove = computed(() => gold.value >= removePrice.value)
const removeAvailable = computed(() => canAffordRemove.value && !serviceUsed.value)

function itemName(item) {
  return item?.name || item?.id || '?'
}

function cardOf(entry) {
  return getCard(entry.cardId) || { id: entry.cardId, name: entry.cardId, cost: '?', desc: '', type: 'skill', rarity: 'common', effects: {} }
}

function buyItem(type, item) {
  if (!item || item.sold) return
  if ((item.price ?? 0) > gold.value) return
  emit('buy', type, item.cardId ?? item.id)
}

function clickRemove() {
  if (!removeAvailable.value) return
  if (props.deck.length > 0) {
    showRemoveModal.value = true
  } else {
    serviceUsed.value = true
    emit('remove_card')
  }
}

function confirmRemove(ids) {
  showRemoveModal.value = false
  if (!ids || !ids.length) return
  serviceUsed.value = true
  emit('remove_card', ids[0])
}
</script>

<template>
  <section class="shop-room">
    <header class="shop-header">
      <h2 class="shop-title">商人</h2>
      <div class="gold-badge">金币 {{ gold }}</div>
    </header>

    <div class="shop-body">
      <div class="shelf cards-shelf">
        <h3 class="shelf-title">卡牌</h3>
        <div class="goods-grid">
          <div v-for="entry in cards" :key="entry.cardId" class="goods-item">
            <button
              class="mini-card"
              :class="['t-' + (cardOf(entry).type || 'skill'), 'r-' + (cardOf(entry).rarity || 'common'), { sold: entry.sold, poor: !entry.sold && entry.price > gold }]"
              :disabled="entry.sold || entry.price > gold"
              @click="buyItem('card', entry)"
            >
              <span class="cost">{{ cardOf(entry).cost }}</span>
              <span class="strip"></span>
              <span class="cname">{{ cardOf(entry).name }}</span>
              <span class="cdesc">{{ cardOf(entry).desc }}</span>
              <span class="check" v-if="entry.sold">✓</span>
            </button>
            <div class="price-tag">{{ entry.price }} G</div>
          </div>
        </div>
      </div>

      <aside class="side-column">
        <div class="shelf">
          <h3 class="shelf-title">遗物</h3>
          <button
            v-for="r in relics"
            :key="r.id ?? r.name"
            class="good-row"
            :class="{ sold: r.sold, poor: !r.sold && r.price > gold }"
            :disabled="r.sold || r.price > gold"
            @click="buyItem('relic', r)"
          >
            <span class="good-name">{{ itemName(r) }} <span class="check-inline" v-if="r.sold">✓</span></span>
            <span class="row-price">{{ r.price }} G</span>
          </button>
          <p v-if="!relics.length" class="empty-row">售罄</p>
        </div>

        <div class="shelf">
          <h3 class="shelf-title">药水</h3>
          <button
            v-for="p in potions"
            :key="p.id ?? p.name"
            class="good-row"
            :class="{ sold: p.sold, poor: !p.sold && p.price > gold }"
            :disabled="p.sold || p.price > gold"
            @click="buyItem('potion', p)"
          >
            <span class="good-name">{{ itemName(p) }} <span class="check-inline" v-if="p.sold">✓</span></span>
            <span class="row-price">{{ p.price }} G</span>
          </button>
          <p v-if="!potions.length" class="empty-row">售罄</p>
        </div>
      </aside>
    </div>

    <footer class="shop-footer">
      <button class="btn service" :disabled="!removeAvailable" @click="clickRemove">
        移除卡牌（{{ removePrice }} G）
      </button>
      <button class="btn leave" @click="emit('leave')">离开</button>
    </footer>

    <CardSelectModal
      v-if="showRemoveModal"
      title="选择要移除的牌"
      :cards="deck"
      :max-select="1"
      confirm-text="移除"
      @confirm="confirmRemove"
      @cancel="showRemoveModal = false"
    />
  </section>
</template>

<style scoped>
.shop-room {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at top, #241c12 0%, #120d08 75%);
  padding: 20px 28px;
}
.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.shop-title {
  margin: 0;
  color: #f0c75e;
  font-size: 26px;
  letter-spacing: 4px;
}
.gold-badge {
  padding: 8px 18px;
  border-radius: 20px;
  border: 1px solid #d4af37;
  background: rgba(212, 175, 55, 0.12);
  color: #f0c75e;
  font-weight: 700;
  font-size: 16px;
}
.shop-body {
  flex: 1;
  display: flex;
  gap: 22px;
  align-items: flex-start;
}
.cards-shelf {
  flex: 1;
}
.side-column {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.shelf {
  background: rgba(43, 33, 24, 0.72);
  border: 1px solid #4a3c28;
  border-radius: 12px;
  padding: 14px 16px;
}
.shelf-title {
  margin: 0 0 12px;
  color: #c9b98f;
  font-size: 15px;
  letter-spacing: 3px;
  border-bottom: 1px solid #4a3c28;
  padding-bottom: 8px;
}
.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.goods-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.mini-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 185px;
  padding: 28px 10px 10px;
  border-radius: 10px;
  border: 2px solid var(--rc, #777);
  background: linear-gradient(175deg, #23201c, #16130f);
  color: #e8dcc0;
  cursor: pointer;
  text-align: center;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.mini-card:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
.mini-card.poor:not(.sold) {
  opacity: 0.55;
}
.mini-card.poor:not(.sold) .price-tag,
.goods-item .price-tag.red {
  color: #e06c5a;
}
.mini-card.sold {
  filter: grayscale(0.95);
  opacity: 0.55;
  cursor: not-allowed;
}
.check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52px;
  color: #7dc97d;
  background: rgba(10, 8, 5, 0.55);
  border-radius: 8px;
}
.cost {
  position: absolute;
  top: -9px;
  left: -9px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #0e0c09;
  border: 2px solid #f0c75e;
  color: #f0c75e;
  font-weight: 700;
  line-height: 24px;
  font-size: 14px;
}
.strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 14px;
  border-radius: 7px 7px 0 0;
  opacity: 0.85;
}
.t-attack > .strip { background: #a63a32; }
.t-skill > .strip { background: #3f7d4e; }
.t-power > .strip { background: #3465a4; }
.t-curse > .strip,
.t-status > .strip { background: #5c4a66; }
.r-basic { --rc: #9aa0a6; }
.r-common { --rc: #b8beb4; }
.r-uncommon { --rc: #4a90d9; }
.r-rare { --rc: #f2c94c; }
.r-special { --rc: #b07fd8; }
.r-curse { --rc: #8e44ad; }
.r-status { --rc: #6d6862; }
.cname {
  font-size: 15px;
  font-weight: 700;
  color: #f5ead0;
}
.cdesc {
  flex: 1;
  font-size: 11px;
  line-height: 1.5;
  color: #cfc3ab;
}
.price-tag {
  text-align: center;
  color: #f0c75e;
  font-weight: 700;
  font-size: 14px;
}
.good-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  border: 1px solid #5a4a30;
  background: #33291d;
  color: #e8dcc0;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.good-row:hover:not(:disabled) {
  background: #463823;
}
.good-row.sold {
  filter: grayscale(0.95);
  opacity: 0.55;
  cursor: not-allowed;
}
.good-row.poor:not(.sold) {
  opacity: 0.55;
}
.good-row.poor:not(.sold) .row-price {
  color: #e06c5a;
}
.good-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.check-inline {
  color: #7dc97d;
  font-weight: 700;
}
.row-price {
  color: #f0c75e;
  font-weight: 700;
  white-space: nowrap;
}
.empty-row {
  color: #8f8070;
  text-align: center;
  margin: 4px 0;
  font-size: 13px;
}
.shop-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 18px;
}
.btn {
  padding: 12px 26px;
  border-radius: 9px;
  border: 1px solid #6b5636;
  background: #3a2f22;
  color: #e8dcc0;
  font-size: 15px;
  cursor: pointer;
}
.btn.service {
  border-color: #b06a4a;
  color: #f0b8a0;
}
.btn.service:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn.leave {
  background: linear-gradient(180deg, #d4af37, #a8842a);
  border-color: #f0c75e;
  color: #1c1510;
  font-weight: 700;
}
</style>
