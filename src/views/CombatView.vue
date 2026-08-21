<script setup>
import { ref, computed } from 'vue'
import GameCard from '../components/GameCard.vue'
import EnemySprite from '../components/EnemySprite.vue'
import PlayerHud from '../components/PlayerHud.vue'

const props = defineProps({
  combatState: Object,
  player: Object,
})
const emit = defineEmits(['end-turn','card-played'])

const selectedCardIdx = ref(null)
const targetingMode = ref(false)

const hand = computed(()=>props.combatState?.handPile||[])
const enemies = computed(()=>props.combatState?.enemies||[])
const isOver = computed(()=>props.combatState?.over)

function cardClick(idx, card){
  if(!props.combatState?.isPlayerTurn || isOver.value) return
  const needsTarget = (card.target==='enemy')
  if(needsTarget){
    selectedCardIdx.value = idx
    targetingMode.value = true
  } else {
    emit('card-played', { handIndex: idx, targetIdx: null })
    selectedCardIdx.value = null
  }
}

function enemyClick(idx){
  if(!targetingMode.value) return
  emit('card-played', { handIndex: selectedCardIdx.value, targetIdx: idx })
  targetingMode.value=false
  selectedCardIdx.value=null
}
</script>

<template>
  <section class="screen combat-screen">
    <div class="enemies-row">
      <EnemySprite v-for="(e,i) in enemies" :key="e.instanceId"
        :enemy="e"
        :is-targeting="targetingMode && e.alive"
        @click="enemyClick(i)" />
    </div>
    <div class="battle-mid"></div>
    <PlayerHud :player="player" />
    <div class="pile-info">
      <span>抽 {{ combatState?.drawPile?.length||0 }}</span>
      <span>弃 {{ combatState?.discardPile?.length||0 }}</span>
    </div>
    <div class="hand-row">
      <GameCard v-for="(c,i) in hand" :key="i"
        :card="c"
        :playable="(typeof c.cost==='number'?c.cost:0) <= (combatState?.energy||0)"
        :selected="selectedCardIdx===i"
        @click="cardClick(i,c)" />
    </div>
    <button class="btn end-turn" @click="emit('end-turn')">结束回合</button>
  </section>
</template>

<style scoped>
.combat-screen{background:
  radial-gradient(ellipse at 50% 20%,#1a2438,transparent 55%),
  linear-gradient(180deg,#0d0b10,#181220);
}
.enemies-row{display:flex;gap:30px;justify-content:center;padding-top:80px;min-height:200px}
.battle-mid{flex:1}
.hand-row{position:absolute;bottom:-40px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:15}
.pile-info{position:absolute;top:70px;right:14px;display:flex;flex-direction:column;gap:5px;font-size:12px;color:#a89b84}
.end-turn{position:absolute;bottom:190px;right:22px;font-size:17px;padding:13px 26px}
</style>
