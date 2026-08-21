<script setup>
import { reactive, ref, onMounted } from 'vue'
import TitleView from './views/TitleView.vue'
import MapView from './views/MapView.vue'
import CombatView from './views/CombatView.vue'
import EventView from './components/EventView.vue'
import ShopView from './components/ShopView.vue'
import CampfireView from './components/CampfireView.vue'
import RewardView from './components/RewardView.vue'
import CardSelectModal from './components/CardSelectModal.vue'
import { newRun, getAvailableNodes, rollCombatEncounter, generateCardReward, generateRelicReward, shopStock, restAtCampfire, upgradeCardInDeck } from './game/run.js'
import { createCombat, startPlayerTurn, playCard, endPlayerTurn, enemyTakeTurn, initIntents, checkCombatEnd } from './core/combat.js'
import { loadRun, saveRun } from './game/run.js'
import { ENEMIES_ACT1, ENEMIES_ACT2, ENEMIES_ACT3 } from './data/enemies.js'

const screen = ref('title')
const run = ref(null)
const combatState = ref(null)
const currentEvent = ref(null)
const currentShopStock = ref(null)
const currentRewards = ref(null)
const showDeckModal = ref(false)

function startNew({character,seed}){
  run.value = newRun({character, seed})
  saveRun(run.value)
  goMap()
}

function continueRun(){
  const r=loadRun()
  if(r){ run.value=r; goMap() }
}

function goMap(){ screen.value='map' }

function availableIds(){
  return getAvailableNodes(run.value).map(n=>n.id)
}

function nodeClicked(nodeId){
  run.value.currentNodeId=nodeId
  run.value.visitedNodes.push(nodeId)
  const n=run.value.map.nodes.get(nodeId)
  if(!n) return
  if(n.type==='monster'||n.type==='elite'||n.type==='boss'){
    startCombat(n.type)
  } else if(n.type==='event'){
    import('./data/events.js').then(m=>{
      currentEvent.value = m.EVENTS[Math.floor(Math.random()*m.EVENTS.length)]
      screen.value='event'
    })
  } else if(n.type==='shop'){
    currentShopStock.value = shopStock(run.value)
    screen.value='shop'
  } else if(n.type==='rest'){
    screen.value='rest'
  } else if(n.type==='treasure'){
    currentRewards.value=[{type:'gold',amount:run.value.rng.int(50,100)}]
    screen.value='reward'
  }
}

function startCombat(nodeType){
  const encounter = rollCombatEncounter(run.value,nodeType)
  const pool=[ENEMIES_ACT1,ENEMIES_ACT2,ENEMIES_ACT3]
  const enemyDefs = encounter.map(e=>pool[run.value.act-1][e.enemyId])
  combatState.value = createCombat({
    player:{ deck: run.value.deck },
    enemies: enemyDefs,
    relics: run.value.relics,
    rng: run.value.rng,
  })
  // 玩家状态挂到战斗上
  combatState.value.playerHp = run.value.hp
  combatState.value.playerMaxHp = run.value.maxHp
  combatState.value.playerBuffs = {}
  startPlayerTurn(combatState.value)
  initIntents(combatState.value)
  screen.value='combat'
}

function onCardPlayed({handIndex,targetIdx}){
  playCard(combatState.value,handIndex,targetIdx)
}

function onEndTurn(){
  endPlayerTurn(combatState.value)
  setTimeout(()=>{
    enemyTakeTurn(combatState.value)
    checkCombatEnd(combatState.value)
    if(combatState.value.over==='win'){
      generateRewards()
    } else if(combatState.value.over==='lose'){
      screen.value='title'
    }
  },600)
}

function generateRewards(){
  const rewards=[]
  rewards.push({type:'gold',amount:run.value.rng.int(15,35)})
  const cards=generateCardReward(run.value,'monster')
  rewards.push({type:'card',candidates:cards.map(c=>c.id)})
  currentRewards.value=rewards
  run.value.hp=combatState.value.playerHp
  saveRun(run.value)
  screen.value='reward'
}

function claimReward(r){
  if(r.type==='gold') run.value.gold+=r.amount
  if(r.type==='relic') run.value.relics.push(r.id)
  if(r.type==='potion') run.value.potions.push(r.id)
  if(r.type==='card'){ /* handled by modal */ }
}

function rewardDone(){
  goMap()
}

onMounted(()=>{
  // noop
})
</script>

<template>
  <TitleView v-if="screen==='title'" @start="startNew" @continue="continueRun" />
  <MapView v-else-if="screen==='map'"
    :map="run.map"
    :current-node-id="run.currentNodeId"
    :available-node-ids="availableIds()"
    :visited-node-ids="run.visitedNodes"
    @node-click="nodeClicked" />
  <CombatView v-else-if="screen==='combat'"
    :combat-state="combatState"
    :player="{...run, block:combatState.playerBlock, energy:combatState.energy, energyMax:combatState.energyMax}"
    @card-played="onCardPlayed"
    @end-turn="onEndTurn" />
  <EventView v-else-if="screen==='event'" :event="currentEvent" @choose="()=>{screen='map'}" />
  <ShopView v-else-if="screen==='shop'" :stock="currentShopStock" @leave="goMap" />
  <CampfireView v-else-if="screen==='rest'" :player-hp="run.hp" :max-hp="run.maxHp" :deck-size="run.deck.length" @rest="()=>{restAtCampfire(run,'rest');goMap()}" @smith="showDeckModal=true" @leave="goMap" />
  <RewardView v-else-if="screen==='reward'" :rewards="currentRewards" @claim="claimReward" @done="rewardDone" />
  <CardSelectModal v-if="showDeckModal" title="选择要升级的牌" :cards="run.deck.filter(c=>!c.upgraded)" @confirm="(ids)=>{upgradeCardInDeck(run,ids[0]);showDeckModal=false;saveRun(run);screen='map'}" @cancel="showDeckModal=false" />
</template>
