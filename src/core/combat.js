// 战斗引擎
import { applyBuff, getBuff, tickBuffStart, tickBuffEnd, damageMultiplier, blockMultiplier, removeBuff, hasBuff, BUFFS } from './buffs.js'

export function createCombat({ player, enemies, relics=[], rng }){
  // 敌人实例化
  const enemyInstances = enemies.map((e,i)=>({
    ...e,
    instanceId: `${e.id}_${i}`,
    hp: e.hp,
    maxHp: e.hp,
    block: 0,
    buffs: {},
    intent: null,
    alive: true,
  }))
  const state = {
    turn: 0,
    energy: 3,
    energyMax: 3,
    playerBlock: 0,
    handPile: [],
    drawPile: rng ? rng.shuffle(player.deck.map(c=>({...c}))) : player.deck.map(c=>({...c})),
    discardPile: [],
    exhaustPile: [],
    enemies: enemyInstances,
    relics,
    cardsPlayedThisTurn: 0,
    attacksPlayedThisTurn: 0,
    log: [],
    over: null,
    isPlayerTurn: true,
  }
  return state
}

// 抽 N 张牌
export function drawCards(state, n){
  for(let i=0;i<n;i++){
    if(state.handPile.length>=10) break
    if(state.drawPile.length===0){
      if(state.discardPile.length===0) break
      state.drawPile = state.discardPile
      state.discardPile = []
      state.log.push('洗牌')
    }
    const card = state.drawPile.pop()
    state.handPile.push(card)
  }
}

// 完整伤害管线
export function dealDamage(state, source, target, amount, isAttack=true){
  if(!target || target.hp<=0) return { dealt: 0, blocked: 0 }
  let dmg = amount
  if(isAttack){
    const strBonus = getBuff(source,'strength')
    if(strBonus>0 && source.isPlayer!==false) dmg += strBonus
    else if(strBonus>0) dmg += strBonus
    dmg *= damageMultiplier(source, target)
  }
  dmg = Math.max(0, Math.floor(dmg))
  let blocked = 0
  const tBlock = target.isPlayer ? state.playerBlock : (target.block||0)
  if(tBlock>0){
    blocked = Math.min(tBlock, dmg)
    dmg -= blocked
    if(target.isPlayer){ state.playerBlock -= blocked }
    else { target.block -= blocked; if(target.block<0) target.block=0 }
  }
  // 无形：伤害降为1
  if(hasBuff(target,'intangible') && dmg>1) dmg=1
  if(dmg>0){
    target.hp -= dmg
    if(!target.isPlayer && target.hp<=0){
      target.alive=false
      state.log.push(`${target.name} 被击败！`)
    }
  }
  return { dealt: dmg, blocked }
}

// 玩家获得格挡（考虑敏捷/脆弱）
export function gainBlock(state, entity, base){
  let b = base
  if(entity?.isPlayer){
    const dex = getBuff({buffs:{}},'dexterity') // placeholder
  }
  const mult = blockMultiplier(entity||{})
  b = Math.floor(b*mult)
  if(entity?.isPlayer || !entity){ state.playerBlock += b }
  else { entity.block=(entity.block||0)+b }
  return b
}

// 回合开始
export function startPlayerTurn(state){
  state.turn++
  state.energy = state.energyMax
  state.cardsPlayedThisTurn = 0
  state.attacksPlayedThisTurn = 0
  state.log.push(`—— 第 ${state.turn} 回合 ——`)
  // 玩家回合开始 buff 结算
  const playerEntity = { name:'你', isPlayer:true, hp:state.playerHp, maxHp:state.playerMaxHp, buffs:state.playerBuffs||{} }
  tickBuffStart(playerEntity)
  state.playerBuffs = playerEntity.buffs
  drawCards(state, 5)
}

// 出牌
export function playCard(state, handIndex, targetIdx=null){
  if(!state.isPlayerTurn || state.over) return { ok:false, reason:'not_your_turn' }
  const card = state.handPile[handIndex]
  if(!card) return { ok:false, reason:'no_card' }
  const cost = typeof card.cost==='number' ? card.cost : 0
  if(cost > state.energy) return { ok:false, reason:'no_energy' }
  if(card.effects?.unplayable) return { ok:false, reason:'unplayable' }
  state.energy -= cost
  state.handPile.splice(handIndex,1)
  state.cardsPlayedThisTurn++
  const fx = card.effects||{}
  const target = targetIdx!=null ? state.enemies[targetIdx] : null
  // 伤害
  // AOE 处理：all_enemies 目标或 aoe 效果
  const isAoe = card.target==='all_enemies' || fx.aoe
  const targets = isAoe ? state.enemies.filter(e=>e.alive) : (target && target.alive ? [target] : [])
  if(fx.damage != null && !fx.multi_damage){
    const playerSrc = { name:'你', buffs:state.playerBuffs||{}, isPlayer:true }
    const hits = fx.multi_hit||1
    for(let i=0;i<hits;i++){
      for(const t of targets) dealDamage(state, playerSrc, t, fx.damage)
    }
  }
  if(fx.multi_damage != null){
    const playerSrc = { name:'你', buffs:state.playerBuffs||{}, isPlayer:true }
    for(const d of Array(fx.multi_hit).fill(fx.multi_damage)){
      for(const t of targets) dealDamage(state,playerSrc,t,d)
    }
  }
  // 格挡
  if(fx.block){
    const dex = getBuff({buffs:state.playerBuffs||{}},'dexterity')
    const total = fx.block + Math.max(0,dex)
    state.playerBlock += total
  }
  // Buffs to self
  if(fx.strength) applyBuff(getSelf(state),'strength',fx.strength)
  if(fx.dexterity) applyBuff(getSelf(state),'dexterity',fx.dexterity)
  if(fx.temp_strength) applyBuff(getSelf(state),'strength',fx.temp_strength)
  // Debuffs to enemy
  const applyToTargets=(k,n)=>{ for(const t of targets) applyBuff(t,k,n) }
  if(fx.vulnerable) applyToTargets('vulnerable',fx.vulnerable)
  if(fx.weak) applyToTargets('weak',fx.weak)
  if(fx.frail) applyToTargets('frail',fx.frail)
  if(fx.poison) applyToTargets('poison',fx.poison)
  // All enemies debuff
  if(fx.vulnerable_all) for(const e of state.enemies.filter(e=>e.alive)) applyBuff(e,'vulnerable',fx.vulnerable_all)
  if(fx.weak_all) for(const e of state.enemies.filter(e=>e.alive)) applyBuff(e,'weak',fx.weak_all)
  if(fx.frail_all) for(const e of state.enemies.filter(e=>e.alive)) applyBuff(e,'frail',fx.frail_all)
  // Draw
  if(fx.draw) drawCards(state,fx.draw)
  // Exhaust / discard routing
  if(fx.exhaust || card.exhaust){ state.exhaustPile.push(card) }
  else { state.discardPile.push(card) }
  checkCombatEnd(state)
  return { ok:true }
}

function getSelf(state){
  if(!state._self) state._self = { name:'你', isPlayer:true, buffs:{}, hp:99, maxHp:99 }
  state._self.buffs = state.playerBuffs||{}
  return state._self
}

// 弃手牌
export function discardHand(state){
  while(state.handPile.length){
    state.discardPile.push(state.handPile.pop())
  }
}

// 结束玩家回合
export function endPlayerTurn(state){
  if(state.over) return
  discardHand(state)
  const pe={name:'你',isPlayer:true,hp:state.playerHp,maxHp:state.playerMaxHp,buffs:state.playerBuffs||{}}
  tickBuffEnd(pe)
  state.playerBuffs=pe.buffs
  // 敌人回合结束 buff 也结算
  for(const e of state.enemies.filter(e=>e.alive)){ tickBuffEnd(e); tickDebuffDurationsE(e) }
  tickDebuffDurations(pe)
  state.playerBuffs=pe.buffs
  state.isPlayerTurn=false
}

function tickDebuffDurationsE(t){
  for(const k of ['weak','frail','vulnerable']){
    if(hasBuff(t,k)) removeBuff(t,k,1)
  }
}
function tickDebuffDurations(t){
  for(const k of ['weak','frail','vulnerable']){
    if(hasBuff(t,k)) removeBuff(t,k,1)
  }
}

// 敌人执行行动
export function enemyTakeTurn(state){
  const logs=[]
  for(const e of state.enemies.filter(e=>e.alive)){
    if(!e.intent) continue
    const mv=e.intent
    e.block=0
    const src = { name:e.name, buffs:e.buffs||{}, isPlayer:false }
    const tgt = { name:'你', isPlayer:true, buffs:state.playerBuffs||{}, hp:state.playerHp, maxHp:state.playerMaxHp }
    if(mv.intentType==='attack'||mv.type==='attack'){
      const times = mv.times||1
      for(let i=0;i<times;i++){
        const r=dealDamage(state,src,tgt,mv.dmg||mv.damage||5,true)
        logs.push(`${e.name} 攻击造成 ${r.dealt} 伤害(格挡${r.blocked})`)
      }
      state.playerHp=tgt.hp
      state.playerBuffs=tgt.buffs
    }
    if(mv.block){ e.block=(e.block||0)+mv.block; logs.push(`${e.name} 获得 ${mv.block} 格挡`) }
    if(mv.strength) applyBuff(e,'strength',mv.strength)
    if(mv.ritual) applyBuff(e,'ritual',mv.ritual)
    if(mv.weak) { applyBuff(tgt,'weak',mv.weak); state.playerBuffs=tgt.buffs }
    if(mv.vulnerable){ applyBuff(tgt,'vulnerable',mv.vulnerable); state.playerBuffs=tgt.buffs }
    if(mv.frail){ applyBuff(tgt,'frail',mv.frail); state.playerBuffs=tgt.buffs }
    if(mv.poison) { applyBuff(tgt,'poison',mv.poison); state.playerBuffs=tgt.buffs }
    tickDebuffDurationsE(e)
  }
  // 检查玩家死亡
  if(state.playerHp<=0){ state.over='lose'; return logs }
  // 新回合开始
  state.isPlayerTurn=true
  startPlayerTurn(state)
  // 为存活敌人选择新意图
  for(const e of state.enemies.filter(e=>e.alive)){
    e.intent = pickEnemyIntent(e)
  }
  checkCombatEnd(state)
  return logs
}

// 简单的敌人意图选择（循环 moves 的 keys）
function pickEnemyIntent(enemy){
  const moveIds=Object.keys(enemy.moves||{})
  if(moveIds.length===0) return null
  const pickId=moveIds[Math.floor(Math.random()*moveIds.length)]
  const m=enemy.moves[pickId]
  return { moveId:pickId, ...m, type:m.intent }
}

export function initIntents(state){
  for(const e of state.enemies.filter(e=>e.alive)){
    e.intent = pickEnemyIntent(e)
  }
}

export function checkCombatEnd(state){
  if(state.over) return state.over
  if(state.enemies.every(e=>!e.alive)){ state.over='win'; return 'win' }
  if(state.playerHp<=0){ state.over='lose'; return 'lose' }
  return null
}
