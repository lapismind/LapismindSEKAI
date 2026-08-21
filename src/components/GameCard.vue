<script setup>
import { computed } from 'vue'

const props = defineProps({
  card: { type: Object, required: true },
  playable: { type: Boolean, default: true },
  selected: { type: Boolean, default: false },
  scale: { type: Number, default: 1 },
})

const typeClass = computed(()=>`card type-${props.card.type||'skill'}`)
const style = computed(()=>({ transform: `scale(${props.scale})` }))

const descText = computed(()=>{
  const fx=props.card.effects||{}
  return (props.card.desc||'')
    .replace(/{dmg}/g, fx.damage ?? '')
    .replace(/{blk}/g, fx.block ?? '')
    .replace(/{n}/g, fx.draw ?? fx.strength ?? fx.dexterity ?? fx.accuracy ?? '')
    .replace(/{wk}/g, fx.weak ?? '')
    .replace(/{frl}/g, fx.frail ?? '')
    .replace(/{en}/g, fx.gain_energy ?? '')
    .replace(/{hp}/g, fx.heal ?? '')
    .replace(/{vul}/g, fx.vulnerable_all ?? '')
})
</script>

<template>
  <div :class="[typeClass,{selected,disabled:!playable}]" :style="style">
    <div class="cost">{{ typeof card.cost==='number'?card.cost:'X' }}</div>
    <div class="name">{{ card.name }}<span v-if="card.upgraded" class="up-badge">+</span></div>
    <div class="type-bar"></div>
    <div class="desc">{{ descText }}</div>
  </div>
</template>

<style scoped>
.up-badge{color:#4caf50;margin-left:3px;font-size:15px}
</style>
