<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import TitleView from './views/TitleView.vue'
import MapView from './views/MapView.vue'
import CombatView from './views/CombatView.vue'
import EventView from './components/EventView.vue'
import ShopView from './components/ShopView.vue'
import CampfireView from './components/CampfireView.vue'
import RewardView from './components/RewardView.vue'
import CardSelectModal from './components/CardSelectModal.vue'
import { newRun, getAvailableNodes, rollCombatEncounter, generateCardReward, generateRelicReward, shopStock, restAtCampfire, upgradeCardInDeck, saveRun } from './game/run.js'
import { generateMap } from './game/map.js'
import { createCombat, startPlayerTurn, playCard, endPlayerTurn, enemyTakeTurn, initIntents, checkCombatEnd } from './core/combat.js'
import { loadRun } from './game/run.js'
import { ENEMIES_ACT1, ENEMIES_ACT2, ENEMIES_ACT3 } from './data/enemies.js'
import { getCard } from './data/cards.js'
import { POTIONS } from './data/potions.js'
import { EVENTS } from './data/events.js'

const screen = ref('title')
const currentNodeType = ref(null)
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
  saveRun(run.value)
  if(n.type==='monster'||n.type==='elite'||n.type==='boss'){
    currentNodeType.value=n.type
    startCombat(n.type)
  } else if(n.type==='event'){
    currentEvent.value = EVENTS[Math.floor(Math.random()*EVENTS.length)]
    screen.value='event'
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
  if(!enemyDefs.every(d=>d)){ goMap(); return }
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
  // initIntents calls initDeck which resets drawPile; re-deal starting hand
  startPlayerTurn(combatState.value)
  screen.value='combat'
}

function onCardPlayed({handIndex,targetIdx}){
  playCard(combatState.value,handIndex,targetIdx)
}

function onEndTurn(){
  if(combatState.value.over) return
  endPlayerTurn(combatState.value)
  setTimeout(()=>{
    if(combatState.value.over) return
    enemyTakeTurn(combatState.value)
    checkCombatEnd(combatState.value)
    if(combatState.value.over==='win'){
      generateRewards()
    } else if(combatState.value.over==='lose'){
      localStorage.removeItem('sts_save')
      setTimeout(()=>{screen.value='title'},1500)
    }
  },600)
}

function onCombatWon(){
  // CombatView emits this when over becomes 'win'; delay for overlay display
  setTimeout(()=>{
    if(combatState.value?.over==='win') generateRewards()
  },1200)
}

function generateRewards(){
  const rewards=[]
  rewards.push({type:'gold',amount:run.value.rng.int(15,35)})
  const cards=generateCardReward(run.value,currentNodeType||'monster')
  rewards.push({type:'card',candidates:cards})
  // Boss/Elite 遗物奖励
  const relicId=generateRelicReward(run.value,currentNodeType||'monster')
  if(relicId&&currentNodeType!=='monster') rewards.push({type:'relic',id:relicId})
  // 小概率药水
  if(run.value.rng.next()<0.4){
    const p=POTIONS[Math.floor(run.value.rng.next()*POTIONS.length)]
    rewards.push({type:'potion',id:p.id,name:p.name})
  }
  // Boss 战：进入下一幕或胜利
  if(currentNodeType==='boss'){
    run.value.act++
    if(run.value.act>3){
      currentRewards.value=rewards
      run.value.hp=combatState.value.playerHp
      saveRun(run.value)
      alert('恭喜！你征服了尖塔！')
      screen.value='title'; return
    }
    run.value.map=generateNewMap()
    run.value.currentNodeId=null;run.value.visitedNodes=[]
  }
  run.value.floor++
  currentRewards.value=rewards
  run.value.hp=combatState.value.playerHp
  saveRun(run.value)
  screen.value='reward'
}

function generateNewMap(){
  return generateMap(run.value.act,()=>run.value.rng.next())
}

function onEventChoose(optIdx){
  const ev=currentEvent.value
  if(!ev)return
  const opt=ev.options[optIdx]
  if(!opt){screen.value='map';return}
  applyEventEffect(opt.effect||{type:'nothing'})
  screen.value='map'
}

function applyEventEffect(ef){
  if(!ef)return
  if(ef.type==='gold')run.value.gold=Math.max(0,run.value.gold+(ef.amount||0))
  if(ef.type==='lose_hp')run.value.hp=Math.max(1,run.value.hp-(ef.amount||0))
  if(ef.type==='heal')run.value.hp=Math.min(run.value.maxHp,run.value.hp+(ef.amount||0))
  if(ef.type==='max_hp'){run.value.maxHp+=ef.amount;if(run.value.maxHp<1)run.value.maxHp=1;run.value.hp=Math.min(run.value.hp,run.value.maxHp)}
  if(ef.type==='curse'){
    const c=getCard(ef.cardId)
    if(c)run.value.deck.push({...structuredClone(c),uid:'c'+Date.now()})
  }
  if(ef.grant){
    const g=ef.grant
    if(g.type==='card'){
      let cardDef=null
      if(g.cardId)cardDef=getCard(g.cardId)
      else if(g.rarity){
        const isIC=run.value.character==='ironclad'
        const pool=[...(isIC?IRONCLAD_CARDS:SILENT_CARDS),...COLORLESS_CARDS].filter(c=>c.rarity===g.rarity&&c.type!=='curse'&&c.type!=='status')
        cardDef=pool[Math.floor(Math.random()*pool.length)]
      }
      if(cardDef)run.value.deck.push({...structuredClone(cardDef),uid:'g'+Date.now()})
    }
    if(g.type==='relic'&&g.rarity){
      const id=generateRelicReward(run.value,g.rarity==='rare'?'boss':'monster')
      if(id)run.value.relics.push(id)
    }
    if(g.type==='heal')run.value.hp=Math.min(run.value.maxHp,run.value.hp+(g.amount||0))
    if(g.type==='remove_card'){} // handled by modal, simplified for now
  }
  if(ef.extra)applyEventEffect(ef.extra)
}

function claimReward(type,payload){
  if(type==='gold'){} // handled in RewardView onMounted auto-claim via emit below
  if(type==='relic') run.value.relics.push(payload)
  if(type==='potion'){ if(run.value.potions.length<3) run.value.potions.push(payload) }
  if(type==='card'){
    const cardDef=getCard(payload)
    if(cardDef){
      run.value.deck.push({...structuredClone(cardDef),uid:'u'+Date.now()+'_'+Math.random().toString(36).slice(2)})
    }
  }
  saveRun(run.value)
}

function onBuy(type,itemId){
  const stock=currentShopStock.value
  if(!stock||!run.value)return
  let price=0,item=null
  if(type==='card'){
    item=stock.cards.find(c=>c.cardId===itemId&&!c.sold)
    if(!item)return;price=item.price;item.sold=true
    const cardDef=getCard(itemId)
    if(cardDef)run.value.deck.push({...structuredClone(cardDef),uid:'s'+Date.now()+'_'+Math.random().toString(36).slice(2)})
  }
  if(type==='relic'){
    item=stock.relicIds?.find(r=>r===itemId)
    if(item===undefined)return
    price=stock.relicPrices?.[itemId]||150
    run.value.relics.push(itemId)
    stock.relicIds=stock.relicIds.filter(r=>r!==itemId)
  }
  if(type==='potion'){
    if(run.value.potions.length>=3)return
    item=stock.potions?.find(p=>p.id===itemId)
    if(!item)return;price=item.price||50
    run.value.potions.push(itemId);item.sold=true
  }
  run.value.gold-=price
  stock.playerGold=run.value.gold
  saveRun(run.value)
}

function onRemoveCard(uid){
  if(!uid)return
  const idx=run.value.deck.findIndex(c=>c.uid===uid)
  if(idx>=0){run.value.deck.splice(idx,1)}
  run.value.gold-=75
  saveRun(run.value)
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
  <CombatView v-if="screen==='combat'"
    :combat-state="combatState"
    :player="{...run, hp:combatState.playerHp??run.hp, maxHp:combatState.playerMaxHp??run.maxHp, block:combatState.playerBlock, energy:combatState.energy, energyMax:combatState.energyMax}"
    @card-played="onCardPlayed"
    @end-turn="onEndTurn"
    @combat-won="onCombatWon" />
  <EventView v-else-if="screen==='event'" :event="currentEvent" @choose="onEventChoose" />
  <ShopView v-else-if="screen==='shop'" :stock="currentShopStock" :deck="run.deck" @buy="onBuy" @remove_card="onRemoveCard" @leave="goMap" />
  <CampfireView v-else-if="screen==='rest'" :player-hp="run.hp" :max-hp="run.maxHp" :deck-size="run.deck.length" :deck="run.deck.filter(c=>!c.upgraded)" @rest="()=>{restAtCampfire(run,'rest');saveRun(run.value||run);goMap()}" @smith="(uid)=>{upgradeCardInDeck(run,uid);saveRun(run);goMap()}" @leave="goMap" />
  <RewardView v-if="screen==='reward'" :rewards="currentRewards" @claim="claimReward" @done="rewardDone" />
  <CardSelectModal v-if="showDeckModal" title="选择要升级的牌" :cards="run.deck.filter(c=>!c.upgraded)" @confirm="(ids)=>{upgradeCardInDeck(run,ids[0]);showDeckModal=false;saveRun(run);screen='map'}" @cancel="showDeckModal=false" />
</template>
