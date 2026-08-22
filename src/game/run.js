// 跑局主控
import { IRONCLAD_CARDS, SILENT_CARDS, COLORLESS_CARDS } from '../data/cards.js'
import { ENEMIES_ACT1, ENEMIES_ACT2, ENEMIES_ACT3 } from '../data/enemies.js'
import { STARTER_RELICS, COMMON_RELICS, UNCOMMON_RELICS, RARE_RELICS, BOSS_RELICS, SHOP_RELICS } from '../data/relics.js'
import { generateMap } from './map.js'
import { createRng } from '../core/rng.js'

const SAVE_KEY='sts_save'

export function newRun({ character='ironclad', seed=null, ascension=0 }={}){
  const rng = createRng(seed ? hashSeed(seed) : (Date.now()&0xffffffff))
  const isIC=character==='ironclad'
  const deck=[]
  const addCard=(c)=>deck.push({ ...c, uid: `u${deck.length}_${Date.now()}` })
  const basePool = isIC?IRONCLAD_CARDS:SILENT_CARDS
  for(let i=0;i<5;i++) addCard(basePool.find(c=>c.id===(isIC?'strike_r':'strike_g')))
  for(let i=0;i<(isIC?4:5);i++) addCard(basePool.find(c=>c.id===(isIC?'defend_r':'defend_g')))
  if(isIC){ addCard(basePool.find(c=>c.id==='bash_r')) }
  else { addCard(basePool.find(c=>c.id==='neutralize')); addCard(basePool.find(c=>c.id==='survivor')) }
  return {
    character,
    ascension,
    rng,
    hp: isIC?80:70,
    maxHp: isIC?80:70,
    gold: 99,
    floor: 0,
    act: 1,
    rngState: rng.state,
    relics:[isIC?'burning_blood':'ring_of_the_snake'],
    potions:[],
    deck,
    map: generateMap(1, ()=>rng.next()),
    currentNodeId:null,
    visitedNodes:[],
  }
}

function hashSeed(str){
  let h=0
  for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),16777619)>>>0 }
  return h
}

export function getAvailableNodes(run){
  if(!run.currentNodeId){
    return [...run.map.nodes.values()].filter(n=>n.floor===0)
  }
  const cur=run.map.nodes.get(run.currentNodeId)
  return (cur?.children||[]).map(id=>run.map.nodes.get(id))
}

const ACT_ENEMY_POOLS=[ENEMIES_ACT1,ENEMIES_ACT2,ENEMIES_ACT3]

export function rollCombatEncounter(run,nodeType){
  const act=Math.min(run.act-1, ACT_ENEMY_POOLS.length-1)
  const pool=ACT_ENEMY_POOLS[act]
  const allEnemies=Object.keys(pool)
  const bosses=allEnemies.filter(id=>pool[id].boss)
  const normals=allEnemies.filter(id=>!pool[id].boss)
  if(nodeType==='boss') return [{enemyId: run.rng.pick(bosses)}]
  if(nodeType==='elite'){
    const elites=Object.keys(pool).filter(id=>{ const e=pool[id]; return !e.boss && e.hp>=50 })
    return [{enemyId: run.rng.pick(elites.length?elites:normals)}]
  }
  const n = 1 + (run.rng.next()<0.4?1:0)
  const out=[]
  for(let i=0;i<n;i++){
    out.push({enemyId: run.rng.pick(normals.filter(id=>pool[id].hp<50)) || normals[0]})
  }
  return out
}

export function generateCardReward(run,nodeType){
  const isIC=run.character==='ironclad'
  const pool=[...(isIC?IRONCLAD_CARDS:SILENT_CARDS),...COLORLESS_CARDS]
  const candidates=[]
  const eliteBonus = nodeType==='elite'?0.15:(nodeType==='boss'?0.25:0)
  for(let i=0;i<3;i++){
    const roll=run.rng.next()
    let rarity
    if(roll < 0.05+eliteBonus) rarity='rare'
    else if(roll < 0.35+eliteBonus) rarity='uncommon'
    else rarity='common'
    const filtered=pool.filter(c=>c.rarity===rarity && c.type!=='curse' && c.type!=='status')
    const pick=filtered[Math.floor(run.rng.next()*filtered.length)]||pool[0]
    candidates.push(pick)
  }
  return candidates
}

export function generateRelicReward(run,nodeType){
  const owned=new Set(run.relics)
  let pool
  if(nodeType==='boss') pool=BOSS_RELICS
  else if(nodeType==='shop') pool=SHOP_RELICS
  else {
    const r=run.rng.next()
    pool = r<0.6?COMMON_RELICS:(r<0.9?UNCOMMON_RELICS:RARE_RELICS)
  }
  const avail=pool.filter(r=>!owned.has(r.id))
  return avail.length?avail[Math.floor(run.rng.next()*avail.length)].id:null
}

export function shopStock(run){
  const isIC=run.character==='ironclad'
  const cardPool=[...(isIC?IRONCLAD_CARDS:SILENT_CARDS),...COLORLESS_CARDS].filter(c=>c.rarity!=='basic'&&c.type!=='curse')
  const cards=[]
  for(let i=0;i<5;i++){
    const c=cardPool[Math.floor(run.rng.next()*cardPool.length)]
    cards.push({cardId:c.id,price:c.rarity==='rare'?(140+run.rng.int(0,40)):(c.rarity==='uncommon'?(90+run.rng.int(0,30)):(50+run.rng.int(0,20)))})
  }
  const relicIds=[]
  for(let i=0;i<3;i++){
    const id=generateRelicReward(run,'shop')
    if(id&&!relicIds.includes(id)) relicIds.push(id)
  }
  return { cards, relicIds, removeServicePrice:75, playerGold:run.gold }
}

export function restAtCampfire(run,action){
  if(action==='rest'){
    const heal=Math.floor(run.maxHp*0.3)
    run.hp=Math.min(run.maxHp,run.hp+heal)
    return { healed:heal }
  }
  return {}
}

export function upgradeCardInDeck(run,uid){
  const c=run.deck.find(x=>x.uid===uid)
  if(!c) return false
  Object.assign(c,c.upgrade||{})
  c.upgraded=true
  c.name=(c.upgrade?.name)||c.name+'+'
  return true
}

export function saveRun(run){
  try{
    const data={
      character:run.character,ascension:run.ascension,
      hp:run.hp,maxHp:run.maxHp,gold:run.gold,floor:run.floor,act:run.act,
      rngState:run.rng.state,
      relics:[...run.relics],potions:[...run.potions],
      deck:run.deck.map(c=>({id:c.id,name:c.name,type:c.type,rarity:c.rarity,cost:c.cost,target:c.target,desc:c.desc,effects:c.effects?JSON.parse(JSON.stringify(c.effects)):{},upgrade:c.upgrade?JSON.parse(JSON.stringify(c.upgrade)):null,upgraded:!!c.upgraded,exhaust:!!c.exhaust,uid:c.uid})),
      mapNodes:Array.from(run.map.nodes.entries()).map(([k,v])=>[k,{...v}]),
      mapRoots:run.map.roots?[...run.map.roots]:[],
      mapAct:run.map.act||1,
      currentNodeId:run.currentNodeId,
      visitedNodes:Array.isArray(run.visitedNodes)?run.visitedNodes:Array.from(run.visitedNodes),
    }
    localStorage.setItem(SAVE_KEY,JSON.stringify(data))
  }catch(e){}
}
export function loadRun(){
  try{
    const raw=localStorage.getItem(SAVE_KEY)
    if(!raw) return null
    const d=JSON.parse(raw)
    if(!d.deck||!d.mapNodes)return null
    const run={
      character:d.character||'ironclad',
      ascension:d.ascension||0,
      hp:d.hp||80,maxHp:d.maxHp||80,gold:d.gold||99,
      floor:d.floor||0,act:d.act||1,
      rng:createRng(d.rngState||(Date.now()&0xffffffff)),
      relics:d.relics||[],potions:d.potions||[],
      deck:d.deck,
      map:{nodes:new Map(d.mapNodes),roots:d.mapRoots||[],act:d.mapAct||1},
      currentNodeId:d.currentNodeId,
      visitedNodes:d.visitedNodes||[],
    }
    return obj
  }catch(e){return null}
}
