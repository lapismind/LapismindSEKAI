/**
 * src/game/tiles.js —— 地块类型注册表（规格 §3.2）
 *
 * 每种地块一个条目，展示信息与规则钩子放在一起，新增地块只需在这里加一条：
 *   name / label / icon / color / desc   UI 与地图编辑器用
 *   onLand(ctx)    停在该格时的落地结算
 *   onEnter(ctx)   每走进该格一步就触发（含最终落地那一步，先于落地结算），如传送门
 *   locked         编辑器里不可放置、不可替换（交点由拓扑决定，不是可选地块）
 *   placeable      出现在编辑器调色板里
 *
 * ctx = { state, p, rng, api }；api 由 engine 注入（log / damage / gainCoins / drawCards …），
 * 所以本文件保持纯数据 + 纯函数，不依赖 Vue / DOM，服务器端可直接复用。
 */

const restAndLevel = (label) => ({ state, p, api }) => {
  if (p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    api.log(state, `${p.name} 休息回 2 HP（现有 ${p.hp}）`);
  }
  api.log(state, `${p.name} 停在${label}`);
  api.tryLevelUp(state, p);
};

export const TILE_TYPES = {
  start: {
    name: '起始点', label: '起', icon: '🏁', color: '#3b82f6', placeable: true,
    desc: '回 2 HP；星币达标自动升 1 级',
    onLand: restAndLevel('起始点'),
  },
  upgrade: {
    name: '升级格', label: '级', icon: '⭐', color: '#a855f7', placeable: true,
    desc: '回 2 HP；星币达标自动升 1 级',
    onLand: restAndLevel('升级格'),
  },
  coin: {
    name: '天降横财', label: '财', icon: '🪙', color: '#d69e05', placeable: true,
    desc: '随机获得 8/12/16/20/32 星币',
    onLand: ({ state, p, rng, api }) => api.gainCoins(state, p, api.pick([8, 12, 16, 20, 32], rng)),
  },
  coinhi: {
    name: '横财·高收益', label: '财', icon: '💰', color: '#fff3a0', placeable: true,
    desc: '随机获得 20/28/40 星币',
    onLand: ({ state, p, rng, api }) => api.gainCoins(state, p, api.pick([20, 28, 40], rng)),
  },
  card: {
    name: '卡牌奖励', label: '卡', icon: '🃏', color: '#22c55e', placeable: true,
    desc: '抽 2 张卡',
    onLand: ({ state, p, rng, api }) => api.drawCards(state, p, 2, rng),
  },
  misfortune: {
    name: '天降横祸', label: '祸', icon: '⚡', color: '#ef4444', placeable: true,
    desc: '受 2 点伤害',
    onLand: ({ state, p, api }) => {
      api.log(state, `${p.name} 天降横祸！`);
      api.damage(state, p, 2, null, '天降横祸');
    },
  },
  trial: {
    name: '试炼格', label: '试', icon: '🎲', color: '#fb7185', placeable: true,
    desc: '掷 1d6：≥5 得 15 星币，≤4 受 3 伤',
    onLand: ({ state, p, rng, api }) => {
      const r = api.d6(rng);
      if (r >= 5) { api.log(state, `试炼成功（${r}）！`); api.gainCoins(state, p, 15); }
      else { api.log(state, `试炼失败（${r}）…`); api.damage(state, p, 3, null, '试炼失败'); }
    },
  },
  hospital: {
    name: '医院', label: '院', icon: '✚', color: '#f9a8d4', placeable: true,
    desc: '回 2 HP，免疫伤害与指定到下次自己回合',
    onLand: ({ state, p, api }) => {
      p.hp = Math.min(p.maxHp, p.hp + 2);
      p.immune = true;
      api.log(state, `${p.name} 住院休养：回 2 HP，免疫到下次自己回合`);
    },
  },
  shop: {
    name: '商店', label: '店', icon: '🛍', color: '#f97316', placeable: true,
    desc: '免费拿 1 张，可花 5 星币/张买库存 3 张',
    onLand: ({ state, p, rng, api }) => {
      api.drawSpecific(state, p, api.pick(api.CARD_IDS, rng));
      state.pending = {
        type: 'shop',
        stock: [api.pick(api.CARD_IDS, rng), api.pick(api.CARD_IDS, rng), api.pick(api.CARD_IDS, rng)],
      };
      api.log(state, `${p.name} 到商店：免费拿 1 张，可花 5 星币/张补货`);
    },
  },
  swift: {
    name: '疾行', label: '疾', icon: '⏩', color: '#06b6d4', placeable: true,
    desc: '落地后可再掷一次移动骰',
    onLand: ({ state, p, api }) => {
      p.extraRoll = true;
      api.log(state, `${p.name} 踩中疾行，可再掷一次移动骰`);
    },
  },
  teleport: {
    name: '传送门', label: '传', icon: '🌀', color: '#a78bfa', placeable: true,
    desc: '走进即跃迁到中心对称格，继续走完剩余步数（每次移动限一次）',
    onEnter: ({ state, p, api }) => {
      if (state.moveTeleported) return;
      const dest = api.mirrorTile(p.tile);
      state.moveTeleported = true;
      p.tile = dest;
      api.log(state, `${p.name} 触发传送门，跃迁到 ${dest} 号格`);
      api.fx(state, 'teleport', p.id);
    },
  },
  blank: {
    name: '空格', label: '空', icon: '·', color: '#cbd5e1', placeable: true,
    desc: '无效果（留白，等事件设计补全）',
  },
  cross: {
    name: '交点', label: '交', icon: '✦', color: '#fde047', locked: true,
    desc: '两环交汇，经过时选择走外环或内环（由拓扑固定，不可编辑）',
  },
};

export const TILE_TYPE_KEYS = Object.keys(TILE_TYPES);
export const PLACEABLE_TYPES = TILE_TYPE_KEYS.filter((k) => TILE_TYPES[k].placeable);
export const tileDef = (type) => TILE_TYPES[type] ?? TILE_TYPES.blank;
