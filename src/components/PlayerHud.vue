<script setup>
import { computed } from 'vue'
import { BUFFS } from '../core/buffs.js'

const props = defineProps({
  player: { type: Object, required: true },
  buffs: { type: Object, default: ()=>({}) },
})
const buffList = computed(()=>{
  return Object.entries(props.buffs||{}).map(([k,v])=>({
    key:k,
    name:BUFFS[k]?.name||k,
    icon:BUFFS[k]?.icon||'?',
    type:BUFFS[k]?.type||'buff',
    stacks:v,
    desc:BUFFS[k]?.desc||'',
  }))
})
</script>

<template>
  <aside class="hud">
    <div class="hud-avatar">🛡️</div>
    <div class="hud-hp">
      <div class="hp-bar"><div class="hp-fill" :style="{width:(player.hp/player.maxHp*100)+'%'}"></div></div>
      <span class="hp-text">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>
    <div class="orb-energy">{{ player.energy ?? 0 }}<small>/{{ player.energyMax ?? 3 }}</small></div>
    <div v-if="(player.block||0)>0" class="block-shield">{{ player.block }}</div>
    <div class="buff-row" v-if="buffList.length">
      <span v-for="b in buffList" :key="b.key"
        :class="['buff-icon',b.type]" :title="b.name+'：'+b.desc">
        {{ b.icon }}{{ b.stacks }}
      </span>
    </div>
    <div class="gold">💰 {{ player.gold ?? 0 }}</div>
    <div class="floor-tag">第 {{ player.floor ?? 0 }} 层</div>
    <div class="relics">
      <span v-for="r in player.relics" :key="r" class="relic-dot" :title="r"></span>
    </div>
  </aside>
</template>

<style scoped>
.hud{
  position:absolute;left:14px;top:70px;width:180px;padding:14px;
  background:linear-gradient(180deg,rgba(10,10,13,.94),rgba(10,10,13,.78));
  border:1px solid #302a22;border-radius:8px;display:flex;flex-direction:column;gap:10px;z-index:20;
}
.hud-avatar{font-size:32px;text-align:center}
.gold,.floor-tag{font-size:12px;color:#a89b84;text-align:center}
.relics{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.relic-dot{width:22px;height:22px;border-radius:50%;background:#5a4c37;border:1px solid #6d5c40;display:inline-grid;place-items:center;font-size:11px}
.buff-row{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.buff-icon{display:inline-flex;align-items:center;gap:2px;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid}
.buff-icon.buff{background:#1a2e1a;border-color:#3f9b5a;color:#7dc97d}
.buff-icon.debuff{background:#2e1a1a;border-color:#c0392b;color:#e06c5a}
</style>
