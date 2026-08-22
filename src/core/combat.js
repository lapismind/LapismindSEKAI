// 战斗引擎 v2 — 夜间迭代重写
import { applyBuff, getBuff, hasBuff, removeBuff, damageMultiplier } from './buffs.js'

function playerView(s){return{name:'你',isPlayer:true,hp:s.playerHp,maxHp:s.playerMaxHp,buffs:s.playerBuffs||{}}}
function syncPlayer(s,pv){s.playerHp=Math.max(0,pv.hp);s.playerBuffs=pv.buffs}
function slog(s,m){if(s.log.length>80)s.log.shift();s.log.push(m)}

export function createCombat({player,enemies,relics=[],rng}){
  const ei=enemies.map((e,i)=>({...structuredClone(e),instanceId:e.id+'_'+i,hp:e.hp,maxHp:e.hp,block:0,buffs:{},intent:null,alive:true}))
  return{turn:0,energy:3,energyMax:3,playerBlock:0,handPile:[],drawPile:[],discardPile:[],exhaustPile:[],enemies:ei,relics,cardsPlayedThisTurn:0,attacksPlayedThisTurn:0,log:[],over:null,isPlayerTurn:true,_rng:rng||null,_deckSource:(player.deck||[]).map(c=>({...c}))}
}
export function initDeck(s){
  const d=s._deckSource.map(c=>({...c}));const r=s._rng?()=>s._rng.next():Math.random
  for(let i=d.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[d[i],d[j]]=[d[j],d[i]]}
  s.drawPile=d;s.discardPile=[];s.exhaustPile=[]
}
export function drawCards(s,n){
  const r=s._rng?()=>s._rng.next():Math.random
  for(let i=0;i<n;i++){
    if(s.handPile.length>=10)break
    if(s.drawPile.length===0){
      if(s.discardPile.length===0)break
      s.drawPile=s.discardPile;s.discardPile=[]
      for(let j=s.drawPile.length-1;j>0;j--){const k=Math.floor(r()*(j+1));[s.drawPile[j],s.drawPile[k]]=[s.drawPile[k],s.drawPile[j]]}
      slog(s,'洗牌')
    }
    const c=s.drawPile.pop();if(c)s.handPile.push(c)
  }
}
export function dealDamageToEnemy(s,e,amt){
  if(!e||!e.alive)return{dealt:0,blocked:0}
  const pv=playerView(s);let d=Math.max(0,Math.floor(amt*damageMultiplier(pv,e)))
  let b=0;if(e.block>0){b=Math.min(e.block,d);d-=b;e.block-=b}
  if(hasBuff(e,'intangible')&&d>1)d=1
  if(d>0){e.hp-=d;if(e.hp<=0){e.alive=false;slog(s,e.name+' 被击败！')}}
  checkCombatEnd(s);return{dealt:d,blocked:b}
}
export function dealDamageToPlayer(s,src,amt,isAtk=true){
  const pv=playerView(s);if(pv.hp<=0)return{dealt:0,blocked:0}
  let d=amt;if(isAtk)d*=damageMultiplier(src,pv);d=Math.max(0,Math.floor(d))
  let b=0;if(s.playerBlock>0){b=Math.min(s.playerBlock,d);d-=b;s.playerBlock-=b}
  if(hasBuff(pv,'intangible')&&d>1)d=1
  if(d>0)pv.hp-=d
  if(isAtk&&b<amt&&getBuff(pv,'thorns')>0){
    const td=getBuff(pv,'thorns')
    const inst=src.instanceId?s.enemies.find(e=>e.instanceId===src.instanceId):null
    if(inst&&inst.alive){inst.hp-=td;if(inst.hp<=0){inst.alive=false;slog(s,inst.name+' 被荆棘击败！')}}
  }
  syncPlayer(s,pv);checkCombatEnd(s);return{dealt:d,blocked:b}
}
export function gainPlayerBlock(s,base){
  const pv=playerView(s)
  const dex=getBuff(pv,'dexterity');const fm=getBuff(pv,'frail')>0?0.75:1
  const t=Math.max(0,Math.floor((base+Math.max(0,dex))*fm))
  s.playerBlock+=t;return t
}
export function startPlayerTurn(s){
  if(s.over)return
  if(!hasBuff(playerView(s),'barricade'))s.playerBlock=0
  s.turn++;s.energy=s.energyMax;s.cardsPlayedThisTurn=0;s.attacksPlayedThisTurn=0
  const pv=playerView(s);slog(s,'—— 第 '+s.turn+' 回合 ——')
  const psn=getBuff(pv,'poison')
  if(psn>0){pv.hp-=psn;removeBuff(pv,'poison',1);slog(s,'中毒：失去 '+psn+' HP')}
  const brk=getBuff(pv,'berserk')
  if(brk>0){s.energy+=brk;removeBuff(pv,'berserk',1);applyBuff(pv,'vulnerable',1)}
  syncPlayer(s,pv);drawCards(s,5)
}
export function playCard(s,hi,ti=null){
  if(!s.isPlayerTurn||s.over)return{ok:false,reason:'not_your_turn'}
  const card=s.handPile[hi];if(!card)return{ok:false,reason:'no_card'}
  const cost=typeof card.cost==='number'?card.cost:0
  if(cost>s.energy)return{ok:false,reason:'no_energy'}
  if(card.effects?.unplayable)return{ok:false,reason:'unplayable'}
  s.energy-=cost;s.handPile.splice(hi,1);s.cardsPlayedThisTurn++
  if(card.type==='attack')s.attacksPlayedThisTurn++
  const fx=card.effects||{}
  const isAoe=card.target==='all_enemies'||fx.aoe
  const ts=isAoe?s.enemies.filter(e=>e.alive):(ti!=null&&s.enemies[ti]?.alive?[s.enemies[ti]]:[])
  if(fx.damage!=null||fx.multi_damage!=null){
    const ph=fx.multi_damage??fx.damage??0;const nh=fx.multi_hit||1
    for(let h=0;h<nh;h++){for(const t of ts)dealDamageToEnemy(s,t,ph)}
  }
  if(fx.block)gainPlayerBlock(s,fx.block)
  const pv=playerView(s)
  if(fx.strength)applyBuff(pv,'strength',fx.strength)
  if(fx.dexterity)applyBuff(pv,'dexterity',fx.dexterity)
  if(fx.temp_strength)applyBuff(pv,'strength',fx.temp_strength)
  if(fx.metallicize)applyBuff(pv,'metallicize',fx.metallicize)
  if(fx.thorns)applyBuff(pv,'thorns',fx.thorns)
  if(fx.regen)applyBuff(pv,'regen',fx.regen)
  if(fx.plated_armor)applyBuff(pv,'plated_armor',fx.plated_armor)
  if(fx.barricade)applyBuff(pv,'barricade',1)
  if(fx.intangible)applyBuff(pv,'intangible',fx.intangible)
  if(fx.heal){pv.hp=Math.min(pv.maxHp,pv.hp+fx.heal);slog(s,'回复 '+fx.heal+' 点生命')}
  if(fx.gain_energy)s.energy+=fx.gain_energy
  const at=(k,n)=>{for(const t of ts)applyBuff(t,k,n)}
  if(fx.vulnerable)at('vulnerable',fx.vulnerable)
  if(fx.weak)at('weak',fx.weak)
  if(fx.frail)at('frail',fx.frail)
  if(fx.poison)at('poison',fx.poison)
  if(fx.vulnerable_all)for(const e of s.enemies.filter(e=>e.alive))applyBuff(e,'vulnerable',fx.vulnerable_all)
  if(fx.weak_all)for(const e of s.enemies.filter(e=>e.alive))applyBuff(e,'weak',fx.weak_all)
  if(fx.frail_all)for(const e of s.enemies.filter(e=>e.alive))applyBuff(e,'frail',fx.frail_all)
  syncPlayer(s,pv)
  if(fx.draw)drawCards(s,fx.draw)
  if(fx.exhaust||card.exhaust)s.exhaustPile.push(card);else s.discardPile.push(card)
  checkCombatEnd(s);return{ok:true}
}
export function endPlayerTurn(s){
  if(s.over)return
  const pv=playerView(s)
  const m=getBuff(pv,'metallicize');if(m>0)s.playerBlock+=m
  const p=getBuff(pv,'plated_armor');if(p>0)s.playerBlock+=p
  const rg=getBuff(pv,'regen');if(rg>0){pv.hp=Math.min(pv.maxHp,pv.hp+rg);removeBuff(pv,'regen',1)}
  const rt=getBuff(pv,'ritual');if(rt>0)applyBuff(pv,'strength',rt)
  while(s.handPile.length)s.discardPile.push(s.handPile.pop())
  syncPlayer(s,pv);s.isPlayerTurn=false
}
export function enemyTakeTurn(s){
  if(s.over)return[]
  const logs=[]
  for(const e of s.enemies.filter(e=>e.alive)){
    if(!e.intent)continue
    const mv=e.intent;e.block=0
    const src={name:e.name,buffs:e.buffs||{},isPlayer:false,instanceId:e.instanceId,hp:e.hp,maxHp:e.maxHp}
    if(mv.intentType==='attack'||mv.type==='attack'||mv.type==='multi_attack'){
      const nt=mv.times||1
      for(let i=0;i<nt;i++){
        const r=dealDamageToPlayer(s,src,mv.dmg||mv.damage||5,true)
        logs.push(e.name+' 攻击造成 '+r.dealt+' 伤害(格挡'+r.blocked+')')
      }
      const inst=s.enemies.find(x=>x.instanceId===e.instanceId)
      if(inst&&src.hp!==undefined){
        inst.hp=Math.max(0,src.hp)
        if(inst.hp<=0&&inst.alive){inst.alive=false;slog(s,inst.name+' 被荆棘击败！')}
      }
    }
    if(mv.block){e.block=(e.block||0)+mv.block;logs.push(e.name+' 获得 '+mv.block+' 格挡')}
    if(mv.strength)applyBuff(e,'strength',mv.strength)
    if(mv.ritual)applyBuff(e,'ritual',mv.ritual)
    const pv=playerView(s)
    if(mv.weak){applyBuff(pv,'weak',mv.weak);syncPlayer(s,pv)}
    if(mv.vulnerable){applyBuff(pv,'vulnerable',mv.vulnerable);syncPlayer(s,pv)}
    if(mv.frail){applyBuff(pv,'frail',mv.frail);syncPlayer(s,pv)}
    if(mv.poison){applyBuff(pv,'poison',mv.poison);syncPlayer(s,pv)}
    for(const k of['weak','frail','vulnerable']){if(hasBuff(e,k))removeBuff(e,k,1)}
  }
  if(s.playerHp<=0){s.over='lose';slog(s,'你被击败了……');return logs}
  s.isPlayerTurn=true;startPlayerTurn(s)
  for(const e of s.enemies.filter(e=>e.alive)){e.intent=pickIntent(e)}
  checkCombatEnd(s);return logs
}
function pickIntent(en){
  const ids=Object.keys(en.moves||{});if(ids.length===0)return null
  const pid=ids[Math.floor(Math.random()*ids.length)];const m=en.moves[pid]
  return{moveId:pid,name:m.name||'',intentType:m.intent,type:m.intent,
    dmg:m.dmg,times:m.times,block:m.block,strength:m.strength,ritual:m.ritual,
    weak:m.weak,vulnerable:m.vulnerable,frail:m.frail,poison:m.poison}
}
export function initIntents(s){
  initDeck(s)
  for(const e of s.enemies.filter(e=>e.alive)){e.intent=pickIntent(e)}
}
export function checkCombatEnd(s){
  if(s.over)return s.over
  if(s.enemies.every(e=>!e.alive)){s.over='win';slog(s,'战斗胜利！');return'win'}
  if(s.playerHp<=0){s.over='lose';slog(s,'你被击败了……');return'lose'}
  return null
}
