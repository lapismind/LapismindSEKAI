// 杀戮尖塔 · 卡牌数据库（铁甲战士 + 静默猎手 + 无色牌）
const A='attack',S='skill',P='power'

function card(id,name,type,rarity,cost,target,desc,effects,upgrade={}){
  return {id,name,type,rarity,cost,target,desc,effects,upgrade}
}

export const IRONCLAD_CARDS=[
  card('strike_r','打击',A,'basic',1,'enemy','造成 {dmg} 点伤害。',{damage:6},{name:'打击+',damage:9}),
  card('defend_r','防御',S,'basic',1,'none','获得 {blk} 点格挡。',{block:5},{block:8}),
  card('bash_r','痛击',A,'basic',2,'enemy','造成 {dmg} 点伤害，施加 2 层易伤。',{damage:8,vulnerable:2},{damage:10,vulnerable:3}),

  // 普通
  card('anger','愤怒',A,'common',0,'enemy','造成 {dmg} 点伤害，将一张「愤怒」加入弃牌堆。',{damage:6},{damage:8}),
  card('cleave','顺劈斩',A,'common',1,'all_enemies','对所有敌人造成 {dmg} 点伤害。',{damage:8},{damage:11}),
  card('clothesline','晾衣绳',A,'common',2,'enemy','造成 {dmg} 点伤害，施加 2 层虚弱。',{damage:12,weak:2},{damage:14,weak:3}),
  card('headbutt','头槌',A,'common',1,'enemy','造成 {dmg} 点伤害，将弃牌堆一张牌置于抽牌堆顶。',{damage:9},{damage:12}),
  card('flex','屈伸',S,'common',0,'none','获得 {str} 点力量（回合结束失去）。',{temp_strength:2},{temp_strength:4}),
  card('shrug_it_off','耸肩卸力',S,'common',1,'none','获得 {blk} 格挡，抽 1 张牌。',{block:8,draw:1},{block:11}),
  card('sword_boomerang','回旋飞剑',A,'common',1,'all_enemies','随机造成 3 次 {dmg} 点伤害。',{random_hits:{times:3,damage:3}},{times:4}),
  card('thunderclap','雷霆一击',A,'common',1,'all_enemies','对所有敌人造成 {dmg} 伤害并施加 1 易伤。',{damage:4,vulnerable_all:1},{damage:7}),
  card('twin_strike','双持打击',A,'common',1,'enemy','造成两次 {dmg} 点伤害。',{multi_hit:2,multi_damage:5},{multi_damage:7}),
  card('armaments','武装',S,'common',1,'none','获得 {blk} 格挡，升级手牌中一张牌。',{block:5,upgrade_hand:true},{upgrade_all_hand:true}),
  card('body_slam','重压猛击',A,'common',1,'enemy','造成与当前格挡值相等的伤害。',{body_slam:true},{cost:0}),
  card('clash','冲突',A,'common',0,'enemy','手牌全是攻击牌时才能打出。造成 {dmg} 伤害。',{clash:true,damage:14},{damage:18}),
  card('iron_wave','铁浪',A,'common',1,'enemy','获得 {blk} 格挡并造成 {dmg} 伤害。',{block:5,damage:5},{block:7,damage:7}),
  card('pommel_strike','柄击',A,'common',1,'enemy','造成 {dmg} 伤害，抽 1 张牌。',{damage:9,draw:1},{damage:10,draw:2}),
  card('warcry','战嚎',S,'common',0,'none','抽 1 牌，将手牌一张置顶。消耗。',{draw:1,warcry:true,exhaust:true},{draw:2}),
  card('havoc','浩劫',S,'common',1,'none','打出抽牌堆顶的牌，不消耗能量。',{havoc:true},{}),

  // 罕见
  card('battle_trance','战斗专注',S,'uncommon',0,'none','抽 {n} 张牌。本回合不能再抽牌。',{draw:3,no_draw:true},{draw:4}),
  card('bloodletting','放血',S,'uncommon',0,'none','失去 3 点生命，获得 {en} 能量。',{lose_hp:3,gain_energy:2},{gain_energy:3}),
  card('burning_pact','燃烧契约',S,'uncommon',1,'none','消耗手牌一张，抽 {n} 张。',{exhaust_from_hand:1,draw:2},{draw:3}),
  card('carnage','屠杀',A,'uncommon',2,'enemy','消耗。造成 {dmg} 伤害。',{damage:20,exhaust:true},{damage:28}),
  card('dark_embrace','黑暗拥抱',P,'uncommon',2,'none','每当有牌被消耗时抽 1 张。',{power_dark_embrace:true},{cost:1}),
  card('disarm','缴械',S,'uncommon',1,'enemy','敌人失去 {n} 力量。消耗。',{remove_str:2,exhaust:true},{remove_str:3}),
  card('entrench','壕沟',S,'uncommon',2,'none','格挡值翻倍。',{entrench:true},{cost:1}),
  card('ghostly_armor','幽灵护甲',S,'uncommon',1,'none','消耗。获得 {blk} 格挡。',{block:10,exhaust:true},{block:13}),
  card('inflame','燃烧',P,'uncommon',1,'none','获得 {n} 点力量。',{strength:2},{strength:3}),
  card('metallicize','金属化',P,'uncommon',1,'none','每回合结束时获得 {n} 格挡。',{power_metallicize:3},{power_metallicize:4}),
  card('rage','怒火',P,'uncommon',0,'none','本回合每打一张攻击牌获得 {n} 格挡。',{rage:1},{rage:2}),
  card('rampage','暴走',A,'uncommon',1,'enemy','造成 {dmg} 伤害，每次使用后永久 +{inc}。',{rampage:8,ramp_up:5},{ramp_up:8}),
  card('seeing_red','赤红',S,'uncommon',1,'none','消耗。获得 {en} 能量。',{gain_energy:2,exhaust:true},{cost:0}),
  card('sentinel','哨兵',S,'uncommon',1,'none','获得 {blk} 格挡，若被消耗则获得能量。',{sentinel:true,block:5},{sentinel_energy:7}),
  card('shockwave','冲击波',S,'uncommon',2,'all_enemies','所有敌人施加 {wk} 虚弱和脆弱。消耗。',{weak_all:3,frail_all:3,exhaust:true},{cost:1}),
  card('uppercut','上勾拳',A,'uncommon',2,'enemy','造成 {dmg} 伤害，施加 {wk} 虚弱和 {frl} 脆弱。',{damage:13,weak:1,frail:1},{weak:2,frail:2}),
  card('whirlwind','旋风斩',A,'uncommon','X','all_enemies','对所有敌人造成 {dmg} 点伤害 X 次。',{x_cost:true,x_damage:5},{x_damage:8}),
  card('dropkick','飞踢',A,'uncommon',1,'enemy','造成 {dmg} 伤害，若目标易伤则抽1牌获1能量。',{damage:5,dropkick:true},{damage:8}),

  // 稀有
  card('bludgeon','巨力挥舞',A,'rare',3,'enemy','造成 {dmg} 点伤害。',{damage:32},{damage:42}),
  card('barricade','壁垒',P,'rare',3,'none','格挡不再在回合开始时消失。',{barricade:true},{cost:2}),
  card('berserk','狂暴',P,'rare',0,'none','获得 {n} 层狂暴（每回合自动+1力量），获得 2 易伤。',{berserk:2,vulnerable_self:2},{berserk:1}),
  card('brutality','残暴',P,'rare',0,'none','回合开始失去6生命，抽1张牌。',{brutality:6},{no_lose_hp:true}),
  card('corruption','腐化',P,'rare',3,'none','技能费用变0，技能打出后消耗。',{corruption:true},{cost:2}),
  card('demon_form','恶魔之型',P,'rare',3,'none','回合开始获得 {n} 力量。',{demon_form:2},{demon_form:3}),
  card('feed','吞噬',A,'rare',1,'enemy','造成 {dmg} 伤害，若击杀非Boss敌人最大生命+{hp}。',{feed:10,feed_hp:3},{damage:12,feed_hp:4}),
  card('fiend_fire','恶魔之火',A,'rare',2,'all_enemies','消耗手牌全部，每张对所有敌人造成 {dmg} 伤害。',{fiend_fire:7},{damage:10}),
  card('immolate','燎原',A,'rare',2,'all_enemies','对所有敌人造成 {dmg} 伤害，加一张「灼烧」到弃牌堆。',{damage:21,add_burn:true},{damage:28}),
  card('impervious','固若金汤',S,'rare',2,'none','获得 {blk} 格挡。消耗。',{block:30,exhaust:true},{block:40}),
  card('juggernaut','重装上阵',P,'rare',2,'none','每当获得格挡对随机敌人造成 {dmg} 伤害。',{juggernaut:5},{juggernaut:7}),
  card('limit_break','极限突破',P,'rare',1,'none','力量翻倍。消耗。',{limit_break:true,exhaust:true},{not_exhaust:true}),
  card('offering','献祭',S,'rare',0,'none','失去6生命，抽{n}牌获{en}能量。消耗。',{lose_hp:6,draw:3,gain_energy:2,exhaust:true},{draw:5}),
  card('reaper','收割',A,'rare',2,'all_enemies','对所有敌人造成 {dmg} 伤害并回复等量生命。消耗。',{reaper:4,exhaust:true},{damage:5}),
]

// ============ 静默猎手 ============
export const SILENT_CARDS=[
  // 基础
  card('strike_g','打击',A,'basic',1,'enemy','造成 {dmg} 点伤害。',{damage:6},{damage:9}),
  card('defend_g','防御',S,'basic',1,'none','获得 {blk} 点格挡。',{block:5},{block:8}),
  card('survivor','幸存者',S,'basic',1,'none','获得 {blk} 格挡，弃 1 张牌。',{block:8,discard:1},{block:11}),
  card('neutralize','中和',A,'basic',0,'enemy','造成 {dmg} 伤害，施加 {wk} 层虚弱。',{damage:3,weak:1},{damage:4,weak:2}),

  // 普通
  card('acrobatics','杂技',S,'common',1,'none','抽 {n} 张牌，弃 1 张。',{draw:3,discard:1},{draw:4}),
  card('backstab','背刺',A,'common',0,'enemy','造成 {dmg} 伤害。消耗。首回合不可打出。',{damage:11,exhaust:true,innate:false},{damage:13}),
  card('blade_dance','飞刀之舞',S,'common',1,'none','将 {n} 张「碎片刀」加入手牌。',{add_shivs:3},{add_shivs:4}),
  card('cloak_dagger','暗影匕首',S,'common',1,'none','获得 {blk} 格挡，弃 1 张牌；若弃攻击牌加碎片刀。',{block:6,shivs_if_attack:1},{shivs_if_attack:2}),
  card('dash','冲刺',A,'common',1,'enemy','造成 {dmg} 伤害，获得 {blk} 格挡。',{dash:10},{dash:13}),
  card('deflect','偏斜',S,'common',0,'none','获得 {blk} 格挡。',{deflect:true,block:7},{block:11}),
  card('dodge_and_roll','闪避翻滚',S,'common',1,'none','获得 {blk} 格挡，下回合再获得。',{dodge_roll:4},{dodge_roll:6}),
  card('expertise','专长',S,'common',1,'none','将手牌补至 {n} 张。',{expertise:6},{expertise:7}),
  card('finisher','终结者',A,'common',1,'enemy','每张本回合已打出的攻击牌对其造成 {dmg} 伤害。',{finisher:4},{finisher:6}),
  card('flechettes','飞镖',A,'common',1,'enemy','每张手牌中的技能牌对其造成 {dmg} 伤害。',{flechettes:4},{flechettes:6}),
  card('slice','切割',A,'common',0,'enemy','造成 {dmg} 点伤害。',{damage:6},{damage:9}),
  card('quick_slash','快斩',A,'common',1,'enemy','造成 {dmg} 伤害，抽 1 张牌。',{damage:8,draw:1},{damage:12}),
  card('poisoned_stab','淬毒刺击',A,'common',1,'enemy','造成 {dmg} 伤害，施加 {psn} 中毒。',{damage:6,poison:3},{damage:8,poison:4}),
  card('all_out_attack','全面打击',A,'common',1,'enemy','对所有敌人造成 {dmg} 伤害，随机弃 1 张牌。',{aoe_discard:true,damage:10},{damage:14}),
  card('prepared','准备',S,'common',0,'none','抽 1 牌，弃 1 牌。',{prepared:true},{draw:2}),

  // 罕见
  card('accuracy','精准射击',P,'uncommon',1,'none','碎片刀额外造成 {n} 伤害。',{accuracy:3},{accuracy:5}),
  card('caltrops','铁蒺藜',P,'uncommon',1,'none','受到攻击时对攻击者造成 {dmg} 伤害。',{caltrops:3},{caltrops:5}),
  card('distraction','分心术',S,'uncommon',1,'none','将 1 张随机技能加入手牌。',{add_random_skill:1},{cost:0}),
  card('endless_agony','无尽苦痛',A,'uncommon',0,'enemy','消耗。造成 {dmg} 伤害，被抽到时复制一份到手牌。',{endless_agony:4},{damage:7}),
  card('eviscerate','掏心',A,'uncommon',3,'enemy','造成 {dmg} 伤害；本回合每弃一张牌费用-1。',{damage:7,eviscerate:true},{damage:10}),
  card('expertise_plus','专家级',S,'uncommon',0,'none','将手牌补至 {n} 张（不弃）。',{expertise_no_discard:6},{n:7}),
  card('footwork','身法',P,'uncommon',1,'none','获得 {n} 敏捷。',{dexterity:2},{dexterity:3}),
  card('heel_hook','脚钩',A,'uncommon',1,'enemy','造成 {dmg} 伤害，若敌人虚弱则抽1牌获1能量。',{damage:5,heel_hook:true},{damage:8}),
  card('leg_sweep','扫堂腿',A,'uncommon',2,'enemy','施加 {wk} 虚弱，获得 {blk} 格挡。',{weak:2,block:11},{weak:3,block:14}),
  card('predator','掠食者',A,'uncommon',2,'enemy','造成 {dmg} 伤害，下回合多抽 {n} 张。',{damage:15,predator:2},{damage:20}),
  card('reflex','反射',S,'uncommon',0,'none','不可打出。当被抽到时抽 {n} 张牌。',{reflex:2},{n:3}),
  card('ridewind_the_bell','骑风铃',A,'uncommon',1,'enemy','造成 {dmg} 伤害，弃 {n} 张牌。',{damage:9,discard_needed:1},{damage:13}),
  card('setup','布局',S,'uncommon',1,'none','将手牌一张置于抽牌堆顶。',{setup:true},{cost:0}),
  card('tactical_draw','战术撤退',S,'uncommon',1,'none','抽 {n} 张牌，弃 1 张。',{tactical_draw:true},{n:3}),

  // 稀有
  card('adept_tactician','老练战术家',S,'rare',0,'none','保留手牌。消耗。',{retain_hand:true,exhaust:true},{cost:1}),
  card('after_image','残像',P,'rare',1,'none','打出一张牌后获得 {blk} 格挡。',{after_image:1},{after_image:2}),
  card('adrenaline','肾上腺素',S,'rare',0,'none','获得 {en} 能量，抽 2 张牌。消耗。不受消耗效果影响。',{gain_energy:1,exhaust:true},{gain_energy:2}),
  card('bullet_time','子弹时间',S,'rare','X','none','本回合所有手牌费用变 0，不能再抽牌。',{bullet_time:true},{}),
  card('burst','爆发',S,'rare',1,'none','下一张技能牌触发 {n} 次。',{burst:1},{burst:2}),
  card('corpse_explosion','尸爆',P,'rare',2,'none','敌人死亡时对所有敌人造成最大生命一半的伤害。',{corpse_explosion:true},{cost:1}),
  card('die_die_die','去死去死',A,'rare',1,'all_enemies','对所有敌人造成 {dmg} 伤害。',{damage:13},{damage:17}),
  card('double_tap_g','双重敲击',P,'rare',1,'none','下一张攻击牌触发 {n} 次。',{double_tap:1},{double_tap:2}),
  card('envenom','涂毒',P,'rare',1,'none','攻击未被格挡时施加 {psn} 中毒。',{envenom:1},{envenom:2}),
  card('glass_knife','玻璃刀',A,'rare',1,'enemy','造成 {dmg} 伤害两次。每次使用后永久-2。',{glass_knife:8},{damage:10}),
  card('grand_finale','盛大终章',A,'rare',0,'enemy','手牌为 0 时才能打出。对所有敌人造成 {dmg} 伤害。',{grand_finale:50},{damage:60}),
  card('malaise','消沉',S,'rare','X','enemy','施加 X 虚弱和 X 中毒。',{x_cost_malaise:true},{plus_one_effect:true}),
  card('night_terror','夜之恐惧',S,'rare',3,'none','获得 1 能量，抽 3 张牌，弃 3 张牌。',{night_terror:true},{cost:2}),
  card('phantasmal_killer','幻影杀手',S,'rare',1,'none','下回合开始时消耗所有手牌，每张造成等量伤害。',{phantasmal_killer:true},{not_exhaust_hand:true}),
  card('tools_of_the_trade','行头',P,'rare',1,'none','每回合开始抽 1 弃 1。',{tools_of_trade:true},{cost:0}),
]

// ============ 无色 / 诅咒 / 状态牌 ============
export const COLORLESS_CARDS=[
  card('bandage_up','包扎',S,'colorless',0,'none','回复 {hp} HP。消耗。',{heal:4,exhaust:true},{heal:6}),
  card('blind','致盲',S,'colorless',0,'enemy','施加 {wk} 虚弱。',{weak:2},{weak:3}),
  card('dark_shackles','黑暗镣铐',S,'colorless',0,'enemy','敌人本回合失去 {n} 力量。',{temp_str_down:9},{n:15}),
  card('deep_breath','深呼吸',S,'colorless',0,'none','洗牌，抽 {n} 张。',{shuffle_and_draw:1},{draw:2}),
  card('discovery','发现',S,'colorless',1,'none','从三张随机非基础牌中选一张加入手牌。',{discovery:true},{cost:0}),
  card('finesse','灵巧',S,'colorless',0,'none','获得 {blk} 格挡，抽 1 牌。',{block:2,draw:1},{block:4}),
  card('flash_of_steel','寒光一闪',A,'colorless',0,'enemy','造成 {dmg} 伤害，抽 1 牌。',{damage:3,draw:1},{damage:6}),
  card('mind_blast','心灵爆破',A,'colorless',2,'enemy','造成等同于抽牌堆数量的伤害。',{mind_blast:true},{cost:1}),
  card('panacea','万灵药',S,'colorless',0,'none','移除所有负面状态。消耗。',{purge_debuffs:true},{not_exhaust:true}),
  card('swift_strike','迅击',A,'colorless',0,'enemy','造成 {dmg} 伤害。',{damage:7},{damage:10}),
  card('trip','绊倒',S,'colorless',0,'all_enemies','施加 {vul} 易伤。',{vulnerable_all:2},{vulnerable_all:3}),
]

export const CURSE_CARDS=[
  card('regret','悔恨','curse','curse',0,'none','不可打出。回合结束时失去等同于手牌数量的生命。',{unplayable:true,end_turn_hp_loss:true},{}),
  card('injury','受伤','curse','curse',0,'none','不可打出。',{unplayable:true},{}),
  card('pain','痛苦','curse','curse',0,'none','不可打出。手牌中时受到攻击额外失去 1 生命。',{unplayable:true,pain:true},{}),
]

export const STATUS_CARDS=[
  card('burn','灼烧','status','status',0,'none','不可打出。回合结束时受到 {dmg} 点伤害。',{unplayable:true,burn_self:2},{}),
  card('wound','伤口','status','status',0,'none','不可打出。',{unplayable:true},{}),
  card('dazed','眩晕','status','status',0,'none','不可打出。消耗。',{unplayable:true,ethereal_exhaust:true},{}),
  card('shiv','碎片刀','status','status',0,'enemy','造成 {dmg} 点伤害。消耗。',{damage:4,exhaust:true},{damage:6}),
]

export const ALL_CARDS=[...IRONCLAD_CARDS,...SILENT_CARDS,...COLORLESS_CARDS,...CURSE_CARDS,...STATUS_CARDS]
export function getCard(id){return ALL_CARDS.find(c=>c.id===id)}

