// 遗物数据库

function relic(id,name,rarity,desc,effects={}){
  return {id,name,rarity,desc,effects}
}

export const STARTER_RELICS=[
  relic('burning_blood','燃烧之血','starter','战斗结束后回复 6 点生命。',{heal_after_combat:6}),
  relic('ring_of_the_snake','蛇戒','starter','每场战斗开始时额外抽 2 张牌（首回合）。',{draw_extra_first_turn:2}),
]

export const COMMON_RELICS=[
  relic('anchor','锚','common','每场战斗开始时获得 10 格挡。',{start_block:10}),
  relic('bag_of_marbles','弹珠袋','common','战斗开始时对所有敌人施加 1 易伤。',{start_vulnerable_all:1}),
  relic('blood_vial','血瓶','common','每场战斗开始时回复 2 HP。',{start_heal:2}),
  relic('bronze_scales','铜鳞','common','战斗开始时获得 3 层荆棘。',{start_thorns:3}),
  relic('centennial_puzzle','百年拼图','common','受到攻击未格挡时抽 1 张牌。',{draw_when_hit:1}),
  relic('happy_flower','快乐之花','common','每 3 回合额外获得 1 能量。',{extra_energy_every:3}),
  relic('juzu_bracelet','数珠手链','common','普通战斗房间额外事件减少。',{}),
  relic('lantern','灯笼','common','第一回合额外获得 1 能量。',{first_turn_energy:1}),
  relic('meal_ticket','餐票','common','进入休息处时回复 5 HP。',{rest_heal_bonus:5}),
  relic('nunchaku','双节棍','common','每打满 10 张牌获得 1 能量。',{energy_per_10_cards:1}),
  relic('orichalcum','山铜','common','回合结束时若没有格挡则获得 6 格挡。',{end_block_if_none:6}),
  relic('pocketwatch','怀表','common','未打出攻击牌的回合，下回合多抽 2 张。',{no_attack_draw_bonus:2}),
  relic('preserved_insect','昆虫琥珀','common','精英战敌人生命上限 -25%。',{elite_hp_reduce:.25}),
  relic('regal_pillow','华丽枕头','common','营火休息回复量从 30 提升至 45。',{rest_heal:45}),
  relic('strawberry','草莓','common','最大生命 +7。',{max_hp:7}),
  relic('vajra','金刚杵','common','战斗开始时获得 1 力量。',{start_strength:1}),
]

export const UNCOMMON_RELICS=[
  relic('blue_candle','蓝蜡烛','uncommon','诅咒可被打出，打出后消耗自身。',{}),
  relic('captains_wheel','船长舵轮','uncommon','每场战斗第 3 回合额外抽 2 张并获得 1 能量。',{}),
  relic('darkstone_periapt','黑石护符','uncommon','拾取诅咒时最大生命 +6。',{curse_max_hp:6}),
  relic('dream_catcher','捕梦网','uncommon','营火休息后可选择一张卡加入牌组。',{}),
  relic('frozen_egg','冻结蛋','uncommon','获得的卡自动升级。',{auto_upgrade:true}),
  relic('ink_bottle','墨水瓶','uncommon','每打满 10 张牌抽 1 张。',{draw_per_10_cards:1}),
  relic('kunai','苦无','uncommon','每回合打 3 张攻击牌获得 1 敏捷。',{dex_on_attacks:1}),
  relic('maw_bank','兽口银行','uncommon','每进入新楼层获得 12 金币。',{gold_per_floor:12}),
  relic('meat_on_the_bone','带骨肉','uncommon','战斗结束后若 HP<50% 回复 12 HP。',{post_combat_heal_low:12}),
  relic('mercury_hourglass','水星沙漏','uncommon','回合开始时对所有敌人造成 3 伤害。',{turn_start_damage:3}),
  relic('oddly_smooth_stone','光滑石头','uncommon','战斗开始时获得 1 敏捷。',{start_dex:1}),
  relic('ornamental_fan','装饰扇','uncommon','每回合打 3 张攻击牌获得 4 格挡。',{block_on_attacks:4}),
  relic('pellet_cannon','弹丸炮','uncommon','受到攻击后下次攻击伤害 +10%。',{}),
  relic('pen_nib','笔尖','uncommon','每 10 次攻击，下一次攻击伤害翻倍。',{every_10_double_next:1}),
  relic('shuriken','手里剑','uncommon','每回合打 3 张攻击牌获得 1 力量。',{str_on_attacks:1}),
  relic('smiling_mask','笑脸面具','uncommon','商店卡牌价格减半。',{shop_discount:.5}),
  relic('snake_skull','蛇骷髅','uncommon','施加负面状态时额外抽 1 张。',{}),
  relic('sundial','日晷','uncommon','洗牌 3 次后获得 15 金币。',{}),
  relic('the_boot','靴子','uncommon','每次攻击至少造成 4 点伤害（含多次攻击）。',{min_attack_damage:4}),
  relic('tough_band_aid','创口贴','uncommon','每场战斗回复 3 HP。',{combat_end_heal:3}),
  relic('toxic_egg','毒蛋','uncommon','获得的技能牌自动升级。',{}),
  relic('warpaint','战争涂料','uncommon','获得的技能/能力牌自动升级。',{}),
  relic('white_beast_statue','白兽雕像','uncommon','每场战斗开始时获得 1 瓶药水。',{free_potion_per_combat:1}),
]

export const RARE_RELICS=[
  relic('bird_caged_urn','鸟笼骨灰盒','rare','回合开始时若手牌为空回复 3 HP。',{}),
  relic('calipers','卡钳','rare','失去格挡时最多保留 15 点。',{retain_block:15}),
  relic('dead_branch','枯枝','rare','消耗一张牌时随机将一张牌加入手牌。',{}),
  relic('echo_form_relic','回响形态遗物','rare','每场战斗第一张能力牌触发两次。',{}),
  relic('gambling_chip','赌徒筹码','rare','回合开始时可弃掉任意手牌并重新抽取。',{}),
  relic('ginger','姜','rare','免疫虚弱和脆弱。',{immunity_weak:true,immunity_frail:true}),
  relic('ice_cream','冰淇淋','rare','能量不再在回合结束消失。',{carry_over_energy:true}),
  relic('incense_burner','香炉','rare','每回合结束累积 1 层，6 层时下回合获得 15 格挡。',{}),
  relic('mango','芒果','rare','最大生命 +14。',{max_hp:14}),
  relic('molten_egg','熔岩蛋','rare','获得的攻击牌自动升级。',{}),
  relic('peace_pipe','和平烟斗','rare','营火时可以移除一张卡。',{}),
  relic('philosophers_stone','贤者之石','rare','所有敌人(包括你)获得 1 力量；每回合多 1 能量。',{all_str_plus:1,extra_energy:1}),
  relic('prayer_bead','祈祷念珠','rare','最大生命 +20。',{max_hp:20}),
  relic('runic_dome','符文穹顶','rare','无法看到敌人意图。',{hide_intents:true}),
  relic('sozu','苏祖','rare','不再获得药水；每回合多 1 能量。',{no_potions:true,extra_energy:1}),
  relic('stone_calendar','石历','rare','回合结束时若 HP<=50% 对所有敌人造成 26 伤害。',{}),
  relic('thread_and_needle','针线','rare','每场战斗开始获得 4 层镀层。',{start_plated_armor:4}),
  relic('torii','鸟居','rare','受到 1-5 点未被格挡的伤害时降为 1。',{torii_effect:true}),
  relic('turning_gear','转动的齿轮','rare','每场战斗前 3 回合多抽 1 张。',{early_draw_bonus:1}),
  relic('velvet_choker','天鹅绒项圈','rare','每回合最多打 6 张牌；额外 1 能量。',{max_play_per_turn:6,extra_energy:1}),
]

export const BOSS_RELICS=[
  relic('black_star','黑色星辰','boss','精英敌人和Boss额外掉落一件遗物。',{}),
  relic('calling_bell','召唤铃','boss','获得一件随机遗物、一瓶随机药水和一张诅咒。',{}),
  relic('coffee_dripper','咖啡滴漏器','boss','额外 1 能量；无法在营火休息。',{extra_energy:1,no_rest:true}),
  relic('empty_cage','空笼子','boss','离开宝箱房时额外获得一件遗物。',{}),
  relic('eternal_feather','永恒之羽','boss','地图上每个非Boss楼层回复 5 HP。',{per_floor_heal:5}),
  relic('fusion_hammer','融合锤','boss','额外 1 能量；无法在营火升级卡牌。',{extra_energy:1,no_smith:true}),
  relic('holy_water','圣水','boss','战斗开始时获得 3 瓶随机药水。',{start_potions:3}),
  relic('key_to_the_door','门钥匙','boss','获得大量金币。',{bonus_gold:100}),
  relic('philosopher_stone_alt','哲学家石','boss','额外 1 能量；所有敌人获得 1 力量。',{extra_energy:1,enemy_str:1}),
  relic('ring_of_serpent','巨蟒戒指','boss','每回合开始时额外抽 1 张。',{extra_draw_per_turn:1}),
  relic('runic_pyramid','符文金字塔','boss','回合结束不再弃掉手牌。',{no_discard_hand:true}),
  relic('sozu_alt','苏祖·变体','boss','不再获得药水；每回合多 1 能量。',{no_potions:true,extra_energy:1}),
  relic('tiny_house','小房子','boss','获得金币、最大HP、药水和卡牌奖励。',{small_bonus:true}),
  relic('velvet_choker_boss','天鹅绒项圈B','boss','每回合最多打 6 张牌；额外 1 能量。',{max_play_per_turn:6,extra_energy:1}),
]

export const SHOP_RELICS=[
  relic('membership_card','会员卡','shop','商店物品打五折。',{shop_discount:.5}),
  relic('courier','信使','shop','商店商品补充且价格不涨。',{}),
  relic('lizard_tail','蜥蜴尾巴','shop','第一次死亡时复活并回复 50% 最大生命。',{revive_once:true}),
  relic('orange_pellets','橙色药丸','shop','同回合内打出攻击与技能牌时移除所有负面状态。',{}),
  relic('ssserpent_ring','蛇环','shop','战斗开始时施加 2 层中毒给所有敌人。',{start_poison_all:2}),
  relic('the_abacus','算盘','rare','每次洗牌获得 6 格挡。',{block_on_shuffle:6}),
  relic('medical_kit','医疗包','shop','状态牌可被打出，打出时消耗自身。',{}),
  relic('snecko_eye','蛇眼','boss','开局抽更多牌，但手牌费用随机化。',{random_costs:true,extra_start_draw:1}),
]
