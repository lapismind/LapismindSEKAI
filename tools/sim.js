// 无头模拟器：自动跑局回归测试
import { newRun, getAvailableNodes, rollCombatEncounter } from '../src/game/run.js'
import { createCombat, startPlayerTurn, playCard, endPlayerTurn, enemyTakeTurn, initIntents, checkCombatEnd } from '../src/core/combat.js'
import { ENEMIES_ACT1 } from '../src/data/enemies.js'

function runOneGame(charName){
  const run = newRun({character:charName})
  let wins=0, losses=0

  // 模拟 10 场战斗
  for(let i=0;i<10;i++){
    const encounter = rollCombatEncounter(run,'monster')
    const enemyDefs = encounter.map(e=>ENEMIES_ACT1[e.enemyId])
    const state = createCombat({ player:{deck:run.deck}, enemies:enemyDefs, relics:run.relics, rng:run.rng })
    state.playerHp=run.hp
    state.playerMaxHp=run.maxHp
    state.playerBuffs={}
    startPlayerTurn(state)
    initIntents(state)

    let turns=0
    while(!state.over && turns<50){
      // 简单 AI：优先打出能打出的攻击牌
      let played=true
      while(played){
        played=false
        for(let hi=state.handPile.length-1;hi>=0;hi--){
          const c=state.handPile[hi]
          if(c.effects?.unplayable) continue
          const cost = typeof c.cost==='number'?c.cost:0
          if(cost>state.energy) continue
          const targetIdx = c.target==='enemy' ? state.enemies.findIndex(e=>e.alive) : null
          const r = playCard(state,hi,targetIdx)
          if(r.ok){ played=true }
        }
      }
      endPlayerTurn(state)
      enemyTakeTurn(state)
      checkCombatEnd(state)
      turns++
      if(turns>=50) break
    }

    if(state.over==='win') wins++
    else if(state.over==='lose') losses++
    else losses++ // 超时算失败

    // 同步血量
    if(state.playerHp>0) run.hp=Math.max(1,state.playerHp)
  }
  return {char:charName,wins,losses}
}

console.log('铁甲战士:', JSON.stringify(runOneGame('ironclad')))
console.log('静默猎手:', JSON.stringify(runOneGame('silent')))

// Boss 战压力测试
function runOneBoss(charName){
  const run=newRun({character:charName})
  const bossId=Object.keys(ENEMIES_ACT1).find(id=>ENEMIES_ACT1[id].boss)
  const state=createCombat({player:{deck:[...run.deck,...run.deck]},enemies:[ENEMIES_ACT1[bossId]],relics:run.relics,rng:run.rng})
  state.playerHp=run.hp;state.playerMaxHp=run.maxHp;state.playerBuffs={}
  startPlayerTurn(state);initIntents(state)
  let turns=0
  while(!state.over&&turns<100){
    let played=true
    while(played){
      played=false
      for(let hi=state.handPile.length-1;hi>=0;hi--){
        const c=state.handPile[hi]
        if(c.effects?.unplayable)continue
        const cost=typeof c.cost==='number'?c.cost:0
        if(cost>state.energy)continue
        const ti=c.target==='enemy'?state.enemies.findIndex(e=>e.alive):null
        if(playCard(state,hi,ti).ok)played=true
      }
    }
    endPlayerTurn(state);enemyTakeTurn(state);checkCombatEnd(state);turns++
  }
  return {boss:ENEMIES_ACT1[bossId].name,result:state.over,turns,hpLeft:Math.max(0,state.playerHp)}
}
console.log('Boss战-铁甲:',JSON.stringify(runOneBoss('ironclad')))
console.log('Boss战-静默:',JSON.stringify(runOneBoss('silent')))
