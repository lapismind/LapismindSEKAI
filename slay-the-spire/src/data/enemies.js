// 敌人数据库：普通 / 精英 / Boss

function enemy(id,name,hp,icon,moves,boss=false){
  return {id,name,hp,icon,moves,boss}
}

// moves: { id: { name, intent:'attack'|'defend'|'buff'|'debuff'|'unknown', dmg?, times?, block?, effects? } }
export const ENEMIES_ACT1={
  jaw_worm:enemy('jaw_worm','颚虫',42,'🪱',{
    chomp:{name:'撕咬',intent:'attack',dmg:11},
    thrash:{name:'猛击',intent:'attack_defend',dmg:7,block:5},
    bellow:{name:'咆哮',intent:'buff',strength:3,block:6},
  }),
  cultist:enemy('cultist','信徒',48,'🕯️',{
    incantation:{name:'咏唱',intent:'buff',ritual:3},
    strike:{name:'攻击',intent:'attack',dmg:6},
  }),
  red_louse:enemy('red_louse','红虱',10,'🐛',{
    bite:{name:'啃咬',intent:'attack',dmg:5},
    grow:{name:'成长',intent:'buff',strength:3},
  }),
  green_louse:enemy('green_louse','绿虱',11,'🐛',{
    bite:{name:'啃咬',intent:'attack',dmg:5},
    spit_web:{name:'吐丝',intent:'debuff',weak:2},
  }),
  fungi_beast:enemy('fungi_beast','真菌兽',22,'🍄',{
    bite:{name:'啃咬',intent:'attack',dmg:6},
    grow:{name:'生长',intent:'buff',strength:2},
  }),
  acid_slime_s:enemy('acid_slime_s','酸液怪(小)',13,'🟢',{
    corrosive_spit:{name:'腐蚀唾液',intent:'attack_debuff',dmg:3,weak:1},
  }),
  acid_slime_m:enemy('acid_slime_m','酸液怪(中)',28,'🟢',{
    corrosive_spit:{name:'腐蚀唾液',intent:'attack_debuff',dmg:7,weak:1},
    lick:{name:'舔舐',intent:'debuff',weak:1},
    tackle:{name:'冲撞',intent:'attack',dmg:10},
  }),
  spike_slime_s:enemy('spike_slime_s','尖刺怪(小)',10,'🔺',{
    attack:{name:'攻击',intent:'attack',dmg:5},
  }),
  slime_boss:enemy('slime_boss','史莱姆之王',140,'👑',{
    goop_spray:{name:'粘液喷洒',intent:'debuff',add_status:'slimed'},
    prepare:{name:'准备',intent:'buff',block:5},
    slam:{name:'猛击',intent:'attack',dmg:16},
  },true),
  the_guardian:enemy('the_guardian','守卫者',119,'🛡️',{
    charging_up:{name:'充能',intent:'defend',block:9},
    fierce_bash:{name:'凶猛重击',intent:'attack',dmg:32},
    vent_steam:{name:'排气',intent:'debuff',weak:2,vulnerable:2},
    whirlwind:{name:'旋风',intent:'multi_attack',dmg:5,times:4},
    sharpen:{name:'磨刀',intent:'buff',strength:3},
    twin_slam:{name:'双锤',intent:'multi_attack',dmg:8,times:2},
  },true),
  hexaghost:enemy('hexaghost','六火幽鬼',64,'🔥',{
    divider:{name:'分割',intent:'multi_attack',dmg:6,times:3},
    sear:{name:'灼烧',intent:'attack_debuff',dmg:6,add_status:'burn'},
    ghostly_armor:{name:'幽灵护甲',intent:'defend',block:12},
    siphon_soul:{name:'吸魂',intent:'buff',strength:3},
    inferno:{name:'地狱火',intent:'multi_attack',dmg:2,times:6},
  },true),
}

export const ENEMIES_ACT2={
  byrd:enemy('byrd','鸟怪',25,'🐦',{
    peck:{name:'啄击',intent:'attack',dmg:1},
    fly:{name:'飞行',intent:'buff',flying:true},
    swoop:{name:'俯冲',intent:'attack',dmg:12},
    headbutt:{name:'头槌',intent:'attack',dmg:5},
  }),
  chosen:enemy('chosen','被选中者',95,'🧙',{
    poke:{name:'戳击',intent:'multi_attack',dmg:5,times:2},
    zap:{name:'电击',intent:'attack_debuff',dmg:18},
    hex:{name:'诅咒',intent:'debuff',curse:'regret'},
    drain:{name:'吸取',intent:'attack_drain',dmg:18},
  }),
  centurion:enemy('centurion','百夫长',68,'⚔️',{
    slash:{name:'劈砍',intent:'attack',dmg:14},
    defend:{name:'防御',intent:'defend',block:15,allies:true},
    fortify:{name:'强化',intent:'buff',strength:3},
  }),
  bronze_automaton:enemy('bronze_automa','青铜自动机',300,'⚙️',{
    spawn_orbs:{name:'召唤法球',intent:'summon'},
    beam:{name:'光束',intent:'attack',dmg:42},
    boost_artifact:{name:'神器',intent:'buff',artifact:3},
    stun:{name:'眩晕',intent:'stunned'},
  },true),
  champ:enemy('champ','冠军',176,'🏆',{
    heavy_slash:{name:'重斩',intent:'attack',dmg:16},
    face_slap:{name:'掌掴',intent:'attack_debuff',dmg:12,weak:2},
    execute:{name:'处决',intent:'attack_execute',dmg:20},
    gloat:{name:'得意',intent:'buff',strength:3},
    enraged:{name:'暴怒',intent:'enrage',enrage:2},
  },true),
}

export const ENEMIES_ACT3={
  darkling:enemy('darkling','暗影兽',50,'🌑',{
    nip:{name:'咬',intent:'multi_attack',dmg:9,times:2},
    harden:{name:'硬化',intent:'defend',block:12},
    chomp:{name:'撕咬',intent:'attack',dmg:8},
  }),
  orb_walker:enemy('orb_walker','法球行者',72,'🔮',{
    laser:{name:'激光',intent:'attack',dmg:11},
    claw:{name:'爪击',intent:'attack',dmg:7},
    life_drain:{name:'吸血',intent:'drain',dmg:6,heal:6},
  }),
  spiker:enemy('spiker','尖刺者',26,'🌵',{
    cut:{name:'切割',intent:'multi_attack',dmg:2,times:3},
    thorns:{name:'荆棘',intent:'buff',thorns:3},
  }),
  giant_head:enemy('giant_head','巨大头颅',300,'🗿',{
    glance:{name:'瞥视',intent:'multi_attack',dmg:1,times:3},
    count_up:{name:'倒数',intent:'buff'},
    it_is_time:{name:'时机已到',intent:'attack',dmg:26},
  },true),
  nemesis:enemy('nemesis','复仇女神',155,'⚡',{
    scythe_attack:{name:'镰刀连击',intent:'multi_attack',dmg:6,times:3},
    debuff_steam:{name:'蒸汽',intent:'debuff',frail:2},
  },true),
  time_eater:enemy('time_eater','时间吞噬者',456,'⏳',{
    half_dead:{name:'半血',intent:'special'},
    reverberate:{name:'回响',intent:'multi_attack',dmg:7,times:3},
    head_slam:{name:'头槌',intent:'attack_debuff',dmg:26,weak:1},
    rush_of_time:{name:'时间洪流',intent:'attack',dmg:32},
    time_warp:{name:'时间扭曲',intent:'special'},
  },true),
}

export const ALL_ENEMY_SETS=[ENEMIES_ACT1,ENEMIES_ACT2,ENEMIES_ACT3]
