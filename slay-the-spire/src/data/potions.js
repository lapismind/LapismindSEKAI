// 杀戮尖塔 · 药水数据库

function potion(id,name,rarity,desc,effects,target='any'){
  return {id,name,rarity,desc,effects,target}
}

export const POTIONS=[
  // 普通（65%）
  potion('fire_potion','火焰药水','common','对单个敌人造成 {dmg} 点伤害。',{damage:20},'enemy'),
  potion('block_potion','格挡药水','common','获得 {blk} 点格挡。',{block:12},'self'),
  potion('energy_potion','能量药水','common','获得 {en} 点能量。',{energy:2},'self'),
  potion('dexterity_potion','敏捷药水','common','本战斗中获得 {dex} 点敏捷。',{dexterity:2},'self'),
  potion('strength_potion','力量药水','common','本战斗中获得 {str} 点力量。',{strength:2},'self'),
  potion('healing_potion','治疗药水','common','回复 {hp} 点生命。',{heal:20},'self'),
  potion('draw_potion','抽牌药水','common','抽 {n} 张牌。',{draw:3},'self'),
  potion('weak_potion','虚弱药水','common','对所有敌人施加 {wk} 层虚弱。',{weak_all:3},'aoe'),
  potion('vulnerable_potion','易伤药水','common','对所有敌人施加 {vul} 层易伤。',{vulnerable_all:2},'aoe'),

  // 罕见（25%）
  potion('poison_potion','淬毒药水','uncommon','对单个敌人施加 {psn} 层中毒。',{poison:6},'enemy'),
  potion('fear_potion','恐惧药水','uncommon','弃掉 {n} 张手牌并抽等量的牌。',{discard_and_draw:5},'self'),
  potion('explosive_potion','爆炸药水','uncommon','对所有敌人造成 {dmg} 点伤害。',{damage:10,damage_all:true},'aoe'),
  potion('distilled_chaos','蒸馏混沌','uncommon','随机打出 {n} 张手牌（不消耗能量）。',{chaos_play:3},'self'),
  potion('liquid_memories','液态回忆','uncommon','从弃牌堆中选择 {n} 张牌置于手牌。',{retrieve_from_discard:3},'self'),
  potion('gambler_brew','赌徒酿造','uncommon','弃掉任意数量的手牌，抽相同数量的牌。',{gambler:true},'self'),
  potion('entropy_brew','熵酿造','uncommon','获得所有药水效果各一层。',{entropy:true},'self'),
  potion('smoke_bomb','烟雾弹','rare','立即逃离战斗（Boss 战无效）。',{escape_combat:true},'self'),
  potion('snake_oil','蛇油','uncommon','移除自身所有负面状态。',{purge_debuffs:true},'self'),
  potion('ancient_potion','远古药水','uncommon','最大生命永久增加 {hp} 点。',{max_hp:50},'self'),

  // 稀有（10%）
  potion('blood_potion','血瓶','rare','回复 {hp} 点生命，并在本场战斗中额外获得 {hp2} 最大生命。',{heal:20,max_hp_combat:20},'self'),
]

// 按稀有度权重抽取：common 65% / uncommon 25% / rare 10%
const RARITY_WEIGHTS={common:65,uncommon:25,rare:10}

export function getPotion(id){
  return POTIONS.find(p=>p.id===id)
}

export function rollRandomPotion(rng=Math.random){
  const totalWeight=Object.values(RARITY_WEIGHTS).reduce((a,b)=>a+b,0)
  let roll=rng()*totalWeight
  for(const [rar,w] of Object.entries(RARITY_WEIGHTS)){
    roll-=w
    if(roll<0){
      const pool=POTIONS.filter(p=>p.rarity===rar)
      if(pool.length===0) continue
      return pool[Math.floor(rng()*pool.length)]
    }
  }
  const pool=POTIONS.filter(p=>p.rarity==='common')
  return pool[Math.floor(rng()*pool.length)]
}
