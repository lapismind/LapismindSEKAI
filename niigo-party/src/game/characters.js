/**
 * src/game/characters.js —— 四角色数值表（规格 §5.1 定稿）
 * mfy 双形态局内为纯外观差异（规格 §5.3）。
 */

export const CHARACTERS = {
  ena: {
    key: 'ena', name: '東雲絵名', hp: 9, atk: 4, def: 2,
    img: 'ena_f', color: '#f472b6', trait: '均衡偏攻',
  },
  mfy_yuki: {
    key: 'mfy_yuki', name: '朝比奈まふゆ（常态）', hp: 10, atk: 2, def: 3,
    img: 'mfy_yuki_f', color: '#c4b5fd', trait: '血厚攻低',
  },
  mfy_own: {
    key: 'mfy_own', name: '朝比奈まふゆ（暗面）', hp: 10, atk: 2, def: 3,
    img: 'mfy_own_f', color: '#8b7dd8', trait: '血厚攻低',
  },
  knd: {
    key: 'knd', name: '宵崎奏', hp: 8, atk: 2, def: 3,
    img: 'knd_f', color: '#67e8f9', trait: '血薄攻低',
  },
  mzk: {
    key: 'mzk', name: '暁山瑞希', hp: 9, atk: 3, def: 3,
    img: 'mzk_f', color: '#fda4af', trait: '均衡偏防',
  },
};

export const CHARACTER_KEYS = Object.keys(CHARACTERS);
