/**
 * src/game/cards.js —— MVP 卡池 16 张（规格 §5.2）
 *
 * kind: 'battle'（战斗牌，战斗中用，cost 1~3 费，roll 范围随档位）
 *     | 'effect'（效果牌，action 阶段用，每回合限 1 张）
 *     | 'counter'（反制牌，MVP 简化为预置标记：下次被效果牌指定时生效）
 *
 * effect target: 'self' | 'opponent'（任一对手）| 'tile'（射程内的格）
 * 数值出处：docs/specs/2026-09-26-niigo-party-spec.md §4.2/§5.2
 */

export const CARDS = {
  // ── 战斗牌（攻守各 3 档，每场每人 3 费上限）─────────────
  atk1: { id: 'atk1', name: '攻击·1费', kind: 'battle', side: 'attack', cost: 1, min: 1, max: 4 },
  atk2: { id: 'atk2', name: '攻击·2费', kind: 'battle', side: 'attack', cost: 2, min: 1, max: 7 },
  atk3: { id: 'atk3', name: '攻击·3费', kind: 'battle', side: 'attack', cost: 3, min: 1, max: 10 },
  def1: { id: 'def1', name: '防御·1费', kind: 'battle', side: 'defense', cost: 1, min: 1, max: 4 },
  def2: { id: 'def2', name: '防御·2费', kind: 'battle', side: 'defense', cost: 2, min: 1, max: 7 },
  def3: { id: 'def3', name: '防御·3费', kind: 'battle', side: 'defense', cost: 3, min: 1, max: 10 },

  // ── 效果牌（每回合限 1 张）──────────────────────────────
  cake: { id: 'cake', name: '巧克力蛋糕', kind: 'effect', target: 'self',
          desc: '回复 2 HP' },
  dice: { id: 'dice', name: '遥控骰子', kind: 'effect', target: 'self',
          desc: '下次移动点数自选 1~10' },
  band: { id: 'band', name: '皮筋弹弓', kind: 'effect', target: 'opponent',
          range: 10, dmg: 2, desc: '10 格内对手受 2 伤' },
  brick: { id: 'brick', name: '板砖', kind: 'effect', target: 'opponent',
           range: 3, dmg: 5, desc: '3 格内对手受 5 伤' },
  snatch: { id: 'snatch', name: '抢夺', kind: 'effect', target: 'opponent',
            coins: 10, desc: '夺取一名对手 10 星币' },
  phish: { id: 'phish', name: '钓鱼执法', kind: 'effect', target: 'tile', range: 3,
           overlay: { kind: 'phish', coins: 10 }, desc: '3 格内置陷阱：踩上者付你 10 星币' },
  bomb: { id: 'bomb', name: '爆破专家', kind: 'effect', target: 'tile', range: 3,
          overlay: { kind: 'bomb', dmg: 3 }, desc: '3 格内置陷阱：踩上者受 3 伤' },
  roadblock: { id: 'roadblock', name: '路障', kind: 'effect', target: 'tile', range: 3,
               overlay: { kind: 'roadblock' }, desc: '3 格内置路障：踩上停止移动' },

  // ── 反制牌（MVP 简化：打出即预置标记，下次被效果牌指定时生效）──
  shield: { id: 'shield', name: '保护屏障', kind: 'counter',
            desc: '预置：下次被效果牌指定时无效' },
  mirror: { id: 'mirror', name: '以牙还牙', kind: 'counter',
            desc: '预置：下次被效果牌指定时反弹给使用者' },
};

export const CARD_IDS = Object.keys(CARDS);
export const CARD_KINDS = Object.keys(CARDS);
