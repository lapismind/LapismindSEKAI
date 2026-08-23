<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  cards: { type: Array, default: () => [] },
  maxSelect: { type: Number, default: 1 },
  confirmText: { type: String, default: '确认' }
})

const emit = defineEmits(['confirm', 'cancel'])

const selected = ref([])

const TYPE_LABEL = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
  curse: '诅咒',
  status: '状态'
}

const canConfirm = computed(() => selected.value.length > 0)

function toggle(id) {
  const i = selected.value.indexOf(id)
  if (i >= 0) {
    selected.value.splice(i, 1)
    return
  }
  if (selected.value.length >= props.maxSelect) {
    if (props.maxSelect === 1) selected.value = [id]
    return
  }
  selected.value.push(id)
}

function typeLabel(card) {
  return TYPE_LABEL[card.type] || card.type || ''
}

function fmtDesc(card) {
  const e = card.effects || {}
  return String(card.desc || '')
    .replace('{dmg}', e.damage ?? e.multi_damage ?? '?')
    .replace('{blk}', e.block ?? '?')
    .replace('{wk}', e.weak ?? '?')
    .replace('{psn}', e.poison ?? '?')
    .replace('{vul}', e.vulnerable_all ?? '?')
    .replace('{n}', e.draw ?? e.strength ?? e.dexterity ?? e.accuracy ?? e.add_shivs ?? '?')
    .replace('{en}', e.gain_energy ?? '?')
    .replace('{hp}', e.heal ?? '?')
    .replace('{str}', e.temp_strength ?? '?')
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-panel">
      <h3 class="modal-title">
        {{ title }}
        <span class="sel-count">已选 {{ selected.length }}/{{ maxSelect }}</span>
      </h3>

      <div v-if="cards.length" class="card-grid">
        <button
          v-for="c in cards"
          :key="c.id"
          class="mini-card"
          :class="['t-' + (c.type || 'skill'), 'r-' + (c.rarity || 'common'), { picked: selected.includes(c.id) }]"
          @click="toggle(c.id)"
        >
          <span class="cost">{{ c.cost }}</span>
          <span class="strip"></span>
          <span class="cname">{{ c.name }}</span>
          <span class="cdesc">{{ fmtDesc(c) }}</span>
          <span class="ctype">{{ typeLabel(c) }} · {{ c.rarity }}</span>
        </button>
      </div>
      <p v-else class="empty-tip">没有可选的牌</p>

      <div class="modal-actions">
        <button class="btn ghost" @click="emit('cancel')">取消</button>
        <button class="btn primary" :disabled="!canConfirm" @click="emit('confirm', [...selected])">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(8, 6, 4, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.modal-panel {
  background: linear-gradient(160deg, #2b2118, #1c1510);
  border: 2px solid #6b5636;
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
  padding: 20px 24px;
  max-width: 960px;
  width: min(960px, 92vw);
  max-height: 88vh;
  overflow: auto;
}
.modal-title {
  margin: 0 0 16px;
  color: #f0c75e;
  font-size: 20px;
  letter-spacing: 2px;
}
.sel-count {
  margin-left: 10px;
  font-size: 13px;
  color: #b9a888;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.empty-tip {
  color: #8f8070;
  text-align: center;
  padding: 32px 0;
}
.mini-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 190px;
  padding: 30px 10px 10px;
  border-radius: 10px;
  border: 2px solid var(--rc, #777);
  background: linear-gradient(175deg, #23201c, #16130f);
  color: #e8dcc0;
  cursor: pointer;
  text-align: center;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.mini-card:hover {
  transform: translateY(-3px);
}
.mini-card.picked {
  box-shadow: 0 0 0 3px #f0c75e, 0 0 18px rgba(240, 199, 94, 0.55);
  transform: translateY(-4px);
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
  height: 16px;
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
  font-size: 12px;
  line-height: 1.5;
  color: #cfc3ab;
}
.ctype {
  font-size: 11px;
  color: #97876c;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 18px;
}
.btn {
  padding: 9px 22px;
  border-radius: 8px;
  border: 1px solid #6b5636;
  background: #3a2f22;
  color: #e8dcc0;
  font-size: 14px;
  cursor: pointer;
}
.btn.primary {
  background: linear-gradient(180deg, #d4af37, #a8842a);
  border-color: #f0c75e;
  color: #1c1510;
  font-weight: 700;
}
.btn.primary:disabled {
  filter: grayscale(0.8);
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
}
</style>
