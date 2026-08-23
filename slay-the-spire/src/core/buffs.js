// Buff/Debuff 定义与结算

export const BUFFS = {
  strength:      { name:'力量',   type:'buff',   icon:'💪', desc:'攻击伤害 +N' },
  dexterity:     { name:'敏捷',   type:'buff',   icon:'🌀', desc:'格挡 +N' },
  vulnerable:    { name:'易伤',   type:'debuff', icon:'🎯', desc:'受到攻击伤害 ×1.5' },
  weak:          { name:'虚弱',   type:'debuff', icon:'💤', desc:'造成的攻击伤害 ×0.75' },
  frail:         { name:'脆弱',   type:'debuff', icon:'🦴', desc:'获得的格挡 ×0.75' },
  poison:        { name:'中毒',   type:'debuff', icon:'☠️', desc:'回合开始失去 N 生命，层数-1' },
  thorns:        { name:'荆棘',   type:'buff',   icon:'🌵', desc:'被攻击时反弹 N 点伤害' },
  metallicize:   { name:'金属化', type:'buff',   icon:'⚙️', desc:'回合结束获得 N 格挡' },
  ritual:        { name:'仪式',   type:'buff',   icon:'🔥', desc:'回合结束获得 N 力量' },
  berserk:       { name:'狂暴',   type:'debuff', icon:'😤', desc:'回合开始获得 N 能量，失去1层并加1易伤' },
  regen:         { name:'再生',   type:'buff',   icon:'💚', desc:'回合结束回复 N 生命，层数-1' },
  plated_armor:  { name:'镀层护甲',type:'buff',  icon:'🛡️', desc:'回合结束获得 N 格挡；受到未被格挡的攻击则-1' },
  artifact:      { name:'神器',   type:'buff',   icon:'🏺', desc:'抵消下一次负面状态' },
  intangible:    { name:'无形',   type:'buff',   icon:'👻', desc:'受到的伤害降为1' },
  demon_form:    { name:'恶魔之型',type:'buff',  icon:'😈', desc:'每回合开始获得 N 力量' },
  barricade:     { name:'壁垒',   type:'buff',   icon:'🏰', desc:'格挡不再在回合开始时消失' },
  flying:        { name:'飞行',   type:'buff',   icon:'🕊️', desc:'受到攻击伤害-1（最少1）' },
}

export function applyBuff(target, buffId, stacks=1){
  if(!target.buffs) target.buffs = {}
  // artifact 抵消 debuff
  if(BUFFS[buffId]?.type==='debuff' && (target.buffs.artifact||0) > 0){
    target.buffs.artifact--
    if(target.buffs.artifact<=0) delete target.buffs.artifact
    return false
  }
  target.buffs[buffId] = (target.buffs[buffId]||0) + stacks
  return true
}

export function getBuff(target, buffId){ return target?.buffs?.[buffId] || 0 }
export function hasBuff(target, buffId){ return (target.buffs?.[buffId]||0) > 0 }
export function removeBuff(target, buffId, amount=Infinity){
  if(!target.buffs || !target.buffs[buffId]) return
  target.buffs[buffId] -= amount
  if(target.buffs[buffId]<=0) delete target.buffs[buffId]
}

// 回合开始结算（对 player 或 enemy）
export function tickBuffStart(target){
  const log=[]
  // 中毒：掉血、减一层
  const psn = getBuff(target,'poison')
  if(psn>0){ target.hp -= psn; log.push(`${target.name||'你'} 受到 ${psn} 中毒伤害`); removeBuff(target,'poison',1) }
  // 狂暴：+能量(玩家)/+易伤
  if(target.isPlayer){
    const b = getBuff(target,'berserk')
    if(b>0){ log.push(`狂暴触发`); removeBuff(target,'berserk',1); applyBuff(target,'vulnerable',1) }
  } else {
    removeBuff(target,'berserk')
  }
  return log
}

// 回合结束结算
export function tickBuffEnd(target){
  const log=[]
  // 金属化
  const metal = getBuff(target,'metallicize')
  if(metal>0){ target.block=(target.block||0)+metal; log.push(`${target.name||'你'} 获得 ${metal} 格挡(金属化)`) }
  // 镀层
  const plate = getBuff(target,'plated_armor')
  if(plate>0){ target.block=(target.block||0)+plate; log.push(`镀层 +${plate} 格挡`) }
  // 仪式
  const rit = getBuff(target,'ritual')
  if(rit>0){ applyBuff(target,'strength',rit); log.push(`仪式 +${rit} 力量`) }
  // 再生
  const rg = getBuff(target,'regen')
  if(rg>0){ target.hp=Math.min((target.maxHp||999),target.hp+rg); log.push(`再生 +${rg} HP`); removeBuff(target,'regen',1) }
  return log
}

// 攻击伤害倍率计算
export function damageMultiplier(attacker, defender){
  let m = 1
  if(getBuff(attacker,'weak')>0) m *= 0.75
  if(getBuff(defender,'vulnerable')>0) m *= 1.5
  return Math.floor(m * 100)/100
}

// 格挡倍率
export function blockMultiplier(entity){
  if(getBuff(entity,'frail')>0) return 0.75
  return 1
}

// 回合开始时递减临时 buff（weak/frail/vulnerable）
export function tickDebuffDurations(target){
  for(const k of ['weak','frail','vulnerable']){
    if(hasBuff(target,k)) removeBuff(target,k,1)
  }
}
