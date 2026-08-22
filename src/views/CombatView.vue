<script setup>
import { ref, computed, watch } from 'vue'
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
const viewingPile = ref(null) // 'draw'|'discard'|null
const showLog = ref(false)

const hand = computed(()=>props.combatState?.handPile||[])
const enemies = computed(()=>props.combatState?.enemies||[])
const isOver = computed(()=>props.combatState?.over)
const pileCards = computed(()=>{
  if(!viewingPile.value)return[]
  const s=props.combatState
  if(viewingPile.value==='draw')return s?.drawPile||[]
  if(viewingPile.value==='discard')return s?.discardPile||[]
  return s?.exhaustPile||[]
})

watch(()=>props.combatState?.over, (val)=>{
  if(val==='win'){ emit('combat-won') }
  if(val==='lose'){ /* handled by parent */ }
})

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
      <template v-for="(e,i) in enemies" :key="e.instanceId">
        <EnemySprite v-if="e.alive"
        :enemy="e"
        :is-targeting="targetingMode && e.alive"
        @click="enemyClick(i)" />
      </template>
    </div>
    <div class="battle-mid"></div>
    <PlayerHud :player="player" :buffs="combatState?.playerBuffs||{}" />
    <div class="pile-info">
      <button class="pile-btn" @click="viewingPile='draw'">抽 {{ combatState?.drawPile?.length||0 }}</button>
      <button class="pile-btn" @click="viewingPile='discard'">弃 {{ combatState?.discardPile?.length||0 }}</button>
      <button class="pile-btn" @click="viewingPile='exhaust'" v-if="(combatState?.exhaustPile?.length||0)>0">耗 {{ combatState.exhaustPile.length }}</button>
      <button class="pile-btn log-toggle" @click="showLog=!showLog">📜</button>
    </div>
    <div v-if="showLog" class="battle-log">
      <div v-for="(l,i) in (combatState?.log||[]).slice(-15)" :key="i" class="log-line">{{ l }}</div>
    </div>
    <div v-if="isOver" class="combat-over-overlay">
      <div :class="['over-panel',{win:isOver==='win'}]">
        <h3>{{ isOver==='win' ? '战斗胜利！' : '战斗失败……' }}</h3>
        <p v-if="isOver==='lose'">你的旅程到此为止。</p>
      </div>
    </div>
    <!-- Pile Viewer -->
    <div v-if="viewingPile" class="pile-overlay" @click.self="viewingPile=null">
      <div class="pile-panel">
        <h3>{{ viewingPile==='draw'?'抽牌堆':viewingPile==='discard'?'弃牌堆':'消耗堆' }}（{{ pileCards.length }} 张）</h3>
        <div class="pile-grid">
          <GameCard v-for="(c,i) in pileCards" :key="i" :card="c" :scale="0.8" />
          <p v-if="!pileCards.length" class="empty-pile">空</p>
        </div>
        <button class="btn close-pile" @click="viewingPile=null">关闭</button>
      </div>
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
.pile-btn{background:#14121a;border:1px solid #3d3628;color:#a89b84;padding:5px 10px;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit}
.pile-btn:hover{border-color:var(--gold);color:var(--gold2)}
.log-toggle{font-size:14px;padding:4px 8px}
.battle-log{position:absolute;top:130px;right:14px;width:240px;max-height:200px;overflow-y:auto;background:rgba(10,10,13,.92);border:1px solid #302a22;border-radius:6px;padding:8px;z-index:30;font-size:11px;color:#b0a68e;line-height:1.6}
.combat-over-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:50}
.over-panel{text-align:center;padding:40px 60px;background:#1a1622;border:2px solid var(--gold);border-radius:12px}
.over-panel.win h3{color:var(--gold2);font-size:28px;letter-spacing:4px}
.over-panel:not(.win) h3{color:#c0392b;font-size:28px}
.pile-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);z-index:60}
.pile-panel{background:#1a1622;border:2px solid var(--gold);border-radius:10px;padding:20px;max-width:800px;max-height:80vh;overflow:auto;text-align:center}
.pile-panel h3{color:var(--gold2);margin-top:0}
.pile-grid{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:14px 0}
.empty-pile{color:#666;width:100%;text-align:center;padding:30px 0}
</style>
