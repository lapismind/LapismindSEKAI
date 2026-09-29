/**
 * src/game/characters.js —— 四角色数值表（规格 §5.1 定稿）
 * mfy 双形态局内为纯外观差异（规格 §5.3）。
 *
 * skills：规格 §5.3 的 A 组（MVP 固定 1 主动 + 1 被动）。目前只有展示信息，
 * 结算尚未实装（规格要求走效果牌同款管线，待技能设计轮）。portrait 为立绘 key，缺省时 UI 用 chibi 占位。
 */

const MFY_SKILLS = {
  active: { name: '优等生的假面', desc: '本回合免疫一次效果牌（被指定即无效）' },
  passive: { name: '（未命名）', desc: '被效果牌指定时 50% 转移给随机其他玩家' },
};

export const CHARACTERS = {
  ena: {
    key: 'ena', name: '東雲絵名', hp: 9, atk: 4, def: 2,
    img: 'ena_f', color: '#f472b6', trait: '均衡偏攻', portrait: null,
    skills: {
      active: { name: '毒舌', desc: '指定一名玩家，随机弃其一张手牌' },
      passive: { name: '毒舌雷达', desc: '始终可见所有玩家的手牌数' },
    },
  },
  mfy_yuki: {
    key: 'mfy_yuki', name: '朝比奈まふゆ（常态）', hp: 10, atk: 2, def: 3,
    img: 'mfy_yuki_f', color: '#c4b5fd', trait: '血厚攻低', portrait: null, skills: MFY_SKILLS,
  },
  mfy_own: {
    key: 'mfy_own', name: '朝比奈まふゆ（暗面）', hp: 10, atk: 2, def: 3,
    img: 'mfy_own_f', color: '#8b7dd8', trait: '血厚攻低', portrait: null, skills: MFY_SKILLS,
  },
  knd: {
    key: 'knd', name: '宵崎奏', hp: 8, atk: 2, def: 3,
    img: 'knd_f', color: '#67e8f9', trait: '血薄攻低', portrait: null,
    skills: {
      active: { name: '为你写歌', desc: '指定一名玩家（可含自己），其下次战斗属性 +2' },
      passive: { name: '足不出户', desc: '主动选择本回合不移动时，抽 1 张牌' },
    },
  },
  mzk: {
    key: 'mzk', name: '暁山瑞希', hp: 9, atk: 3, def: 3,
    img: 'mzk_f', color: '#fda4af', trait: '均衡偏防', portrait: null,
    skills: {
      active: { name: '改装', desc: '把一张手牌变成同类型随机另一张' },
      passive: { name: '藏起来的心事', desc: '自己的手牌数与状态对其他玩家不可见' },
    },
  },
};

export const CHARACTER_KEYS = Object.keys(CHARACTERS);
