/**
 * src/game/engine.js —— 图版层规则引擎（纯逻辑，无 Vue / DOM / 网络依赖）
 *
 * 设计约定（docs/specs/2026-09-26-niigo-party-spec.md）：
 * - 所有函数都接收并修改 state（普通对象），方便将来整体搬到 Durable Object 做服务器权威；
 * - 随机数一律通过参数 rng（() => [0,1)）注入：M0 热座传 Math.random，单测传确定性序列，
 *   联机时由服务端掷骰后走状态帧广播；
 * - 移动骰 1d10（规格 v2.6），战斗判定骰 1d6，两套分开；
 * - 战斗胜利（未 KO）无星币效果；KO 才由加害者抢走败者一半星币（§6.2）。
 * - 回合节奏（2026-09-29 用户拍板）：掷骰前可出 1 张效果牌 → 掷骰移动 → 落地结算 → 结算态 'action'
 *   → 由调用方在动画/通知播完后调 endAction 轮到下一位（UI 按「常态 / 快速」节奏自动调，没有按钮）。
 *   落在商店则停在商店直到关店；踩疾行则回到掷骰态再掷一次。
 */

import {
  TILES, mirrorTile, tileDistance, IS_CROSS, ringOfTile, neighbors, loopPrev, exits,
  LEVEL_COST, WIN_LEVEL, SHOP_PRICE, START_COINS, HAND_LIMIT, MOVE_DIE,
} from './board.js';
import { CHARACTERS } from './characters.js';
import { CARDS, CARD_IDS } from './cards.js';
import { tileDef } from './tiles.js';

const d6 = (rng) => 1 + Math.floor(rng() * 6);
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function log(state, text) {
  state.log.push({ r: state.round, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
function fx(state, type, playerId, extra = {}) {
  state.fx.push({ type, playerId, ...extra });
}
/** 事件窗口：UI 排队弹出（title / text / tone: good|bad|info；art 为插画 key，缺省时显示占位） */
function popup(state, p, data) {
  (state.popups ??= []).push({ playerId: p.id, ...data });
}

// ── 建局 ───────────────────────────────────────────────────

/** seats: [{ charKey, playerName }]，2~4 人 */
export function createGame(seats) {
  const state = {
    phase: 'roll', // roll（等待掷骰）| moving | action | battle | over
    round: 1,
    turnCount: 0,
    current: 0,
    winner: null,
    remaining: 0,
    pending: null, // {type:'branch'|'battleOffer'|'shop'|'chooseRoll', ...}
    battle: null,
    overlays: [], // {tile, kind, ownerId, ...}
    fx: [],
    popups: [], // 事件窗口队列（UI 取走后清空）
    log: [],
    moveTeleported: false, // 本次移动是否已触发传送门（防无限跳）
    players: seats.map((s, i) => {
      const c = CHARACTERS[s.charKey];
      return {
        id: `p${i + 1}`,
        seat: i,
        charKey: s.charKey,
        name: s.playerName || c.name,
        img: c.img,
        color: c.color,
        maxHp: c.hp,
        hp: c.hp,
        atk: c.atk,
        def: c.def,
        coins: START_COINS,
        level: 0,
        tile: [0, 18, 35, 17][i] ?? 0, // 起始格错开：0/18 两个起始点，35/17 排在其行进方向前一位
        loop: 'A',               // 最近所在的环（只作朝向兜底用）
        prev: loopPrev([0, 18, 35, 17][i] ?? 0, 'A'), // 上一格 = 朝向；开局沿外环正向
        choice: null,            // 交点上已选的下一格
        hand: [],
        status: { shield: 0, reflect: 0 },
        fixedRollPending: false, // 遥控骰子：下次掷骰改为自选
        extraRoll: false,        // 疾行：本回合可再掷一次
        immune: false,           // 医院：免疫到下次自己回合开始
        effectPlayed: false,     // 本回合是否已用效果牌
        ko: false,
        koRound: -1,
        missedTurn: false,       // KO 后已跳过一次行动机会
      };
    }),
  };
  log(state, `对局开始：${state.players.map((p) => p.name).join(' / ')}`);
  return state;
}

// ── 小工具 ─────────────────────────────────────────────────

const cur = (state) => state.players[state.current];
const findPlayer = (state, id) => state.players.find((p) => p.id === id);
export const activeTargets = (state, caster) =>
  state.players.filter((p) => p.id !== caster.id && !p.ko && !p.immune);

function drawCards(state, p, k, rng) {
  for (let i = 0; i < k; i++) {
    if (p.hand.length >= HAND_LIMIT) {
      log(state, `${p.name} 手牌已满（${HAND_LIMIT}），抽到的卡被弃置`);
      continue;
    }
    const id = pick(CARD_IDS, rng);
    p.hand.push(id);
    log(state, `${p.name} 抽到「${CARDS[id].name}」`);
  }
}

function damage(state, victim, amount, attacker, source) {
  victim.hp = Math.max(0, victim.hp - amount);
  log(state, `${victim.name} 受到 ${amount} 点伤害（${source}），剩余 HP ${victim.hp}`);
  if (victim.hp <= 0) koPlayer(state, victim, attacker);
}

function koPlayer(state, victim, attacker) {
  if (victim.ko) return;
  victim.ko = true;
  victim.missedTurn = false;
  victim.koRound = state.round;
  if (attacker && attacker.id !== victim.id) {
    const half = Math.floor(victim.coins / 2);
    victim.coins -= half;
    attacker.coins += half;
    log(state, `KO！${attacker.name} 抢走 ${victim.name} 的一半星币（${half}）`);
  } else {
    log(state, `${victim.name} 被 KO！`);
  }
  fx(state, 'ko', victim.id);
  // 若 KO 的是当前行动者，终止其剩余移动
  if (victim.id === cur(state).id) state.remaining = 0;
}

function gainCoins(state, p, n) {
  p.coins += n;
  log(state, `${p.name} 获得 ${n} 星币（现有 ${p.coins}）`);
  fx(state, 'coins', p.id, { amount: n }); // 头顶掉金币
}

function tryLevelUp(state, p) {
  while (p.level < WIN_LEVEL && p.coins >= LEVEL_COST[p.level]) {
    const cost = LEVEL_COST[p.level];
    p.coins -= cost;
    p.level += 1;
    log(state, `${p.name} 升到 Lv${p.level}！（花 ${cost} 星币）`);
    fx(state, 'levelup', p.id);
  }
  if (p.level >= WIN_LEVEL) {
    state.winner = p.id;
    state.phase = 'over';
    log(state, `${p.name} 达到 Lv4，获胜！`);
  }
}

// ── 掷骰与移动 ─────────────────────────────────────────────

/** 掷移动骰并进入移动阶段。遥控骰子生效时必须传 opts.fixed（1~10）。 */
export function rollMove(state, rng, opts = {}) {
  const p = cur(state);
  if (state.phase !== 'roll' && !(state.phase === 'action' && (p.extraRoll || p.fixedRollPending))) return;
  if (state.pending && state.pending.type !== 'chooseRoll') return;
  let steps;
  if (p.fixedRollPending) {
    if (!opts.fixed || opts.fixed < 1 || opts.fixed > 10) return; // 等 UI 选点数
    steps = opts.fixed;
    p.fixedRollPending = false;
    state.pending = null;
    log(state, `${p.name} 使用遥控骰子，指定 ${steps} 步`);
  } else {
    steps = 1 + Math.floor(rng() * MOVE_DIE);
    log(state, `${p.name} 掷出 ${steps} 点`);
  }
  // 供 UI 播放大字骰点（seq 递增，同点数连掷也能触发）
  state.lastRoll = { value: steps, seq: (state.lastRoll?.seq ?? 0) + 1, playerId: p.id, fixed: !!opts.fixed };
  p.extraRoll = false;
  state.remaining = steps;
  state.moveFrom = p.tile;
  state.phase = 'moving';
  state.moveTeleported = false;
  p.choice = null;
}

/**
 * 移动一格。遇交点未选环 / 遇对手可战斗 / 传送门时挂起 pending，等 UI 处理后继续。
 * 返回 'done'（移动结束，已落地结算）| 'pending' | 'moving'
 */
export function moveStep(state, rng = Math.random) {
  const p = cur(state);
  if (state.phase !== 'moving' || state.pending) return 'pending';
  if (state.remaining <= 0) { land(state, rng); return 'done'; }

  // 十字路口：站在交点上要先选方向（直行 / 左转 / 右转，不许掉头）才能迈步
  const from = heading(p);
  if (IS_CROSS(p.tile) && p.choice == null) {
    state.pending = { type: 'branch', tile: p.tile, from, options: exits(p.tile, from) };
    return 'pending';
  }
  const next = p.choice ?? exits(p.tile, from)[0];
  p.choice = null;
  p.prev = p.tile;
  p.tile = next;
  p.loop = ringOfTile(next) ?? p.loop;
  state.remaining -= 1;

  // 到达检查（顺序：叠加物 → 传送门 → 对手）
  const ovIdx = state.overlays.findIndex((o) => o.tile === p.tile);
  const ov = ovIdx >= 0 ? state.overlays[ovIdx] : null;
  if (ov && ov.ownerId === p.id) {
    log(state, `${p.name} 路过自己放的${ov.kind === 'roadblock' ? '路障' : '陷阱'}，不触发`);
  } else if (ov) {
    const o = ov;
    if (ov.kind === 'roadblock') {
      state.remaining = 0;
      log(state, `${p.name} 撞上路障，停止移动`);
    } else if (ov.kind === 'bomb') {
      const owner = findPlayer(state, ov.ownerId);
      damage(state, p, ov.dmg, owner, '爆破陷阱');
      state.overlays.splice(ovIdx, 1);
    } else if (ov.kind === 'phish') {
      const owner = findPlayer(state, ov.ownerId);
      const pay = Math.min(ov.coins, p.coins);
      p.coins -= pay;
      if (owner) owner.coins += pay;
      log(state, `${p.name} 触发钓鱼执法，付给 ${owner?.name ?? '？'} ${pay} 星币`);
      state.overlays.splice(ovIdx, 1);
    }
  }

  // 走进即触发的地块（传送门等），见 tiles.js onEnter
  tileDef(TILES[p.tile].type).onEnter?.({ state, p, rng, api: TILE_API });

  if (p.hp <= 0 && !p.ko) koPlayer(state, p, null); // 兜底

  // 落格有对手 → 询问是否战斗（KO 者 / 医院免疫者不构成威胁）
  const foe = state.players.find(
    (o) => o.id !== p.id && o.tile === p.tile && !o.ko && !o.immune,
  );
  if (foe && !p.ko) {
    state.pending = { type: 'battleOffer', defenderId: foe.id, tile: p.tile };
    log(state, `${p.name} 在 ${p.tile} 号格遭遇 ${foe.name}！`);
    return 'pending';
  }

  if (state.remaining <= 0) {
    land(state, rng);
    return 'done';
  }
  return 'moving';
}

/**
 * 当前朝向：上一格 prev 若确实与所在格相邻就用它；否则（旧存档 / 测试直接改了 tile）
 * 按所在环的正向推一个默认朝向——交点不属于单一环，用最近所在的环。
 */
function heading(p) {
  if (neighbors(p.tile).includes(p.prev)) return p.prev;
  return loopPrev(p.tile, ringOfTile(p.tile) ?? p.loop ?? 'A');
}

/** 十字路口选方向：next 必须是 pending.options 之一 */
export function chooseBranch(state, next) {
  const p = cur(state);
  if (state.pending?.type !== 'branch' || !state.pending.options.includes(next)) return;
  p.choice = next;
  log(state, `${p.name} 在 ${p.tile} 号路口选择前往 ${next} 号格`);
  state.pending = null;
}

/** 回应「可战斗」弹窗 */
export function resolveBattleOffer(state, accept, rng = Math.random) {
  if (state.pending?.type !== 'battleOffer') return;
  const { defenderId } = state.pending;
  const afterLand = state.remaining <= 0;
  state.pending = null;
  if (accept) {
    const side = () => ({ cards: [], spent: 0, locked: false, d6: null, rolled: false });
    state.battle = {
      attackerId: cur(state).id,
      defenderId,
      phase: 'select', // select → atk_d6 → def_choice → def_d6 → (card_roll) → done
      atk: side(),     // cards: [{ id, value }]，value 在 card_roll 才掷出
      def: side(),
      mode: null,      // 'defend' | 'dodge'
      dodged: null,
      outcome: null, afterLand,
    };
    state.phase = 'battle';
    log(state, `战斗开始：${cur(state).name} → ${findPlayer(state, defenderId).name}`);
    autoLock(state, 'atk');
    autoLock(state, 'def');
  } else if (afterLand) {
    land(state, rng);
  }
}

// ── 战斗（规格 §4；2026-09-29 用户拍板的流程）──────────────
//   select     双方同时选战斗牌：互相可见、选定即从手牌扣除（不可撤回、不退回）、各自锁定
//              （攻 9 秒 / 守 10 秒的限时由 UI 负责，超时按已选锁定）
//   atk_d6     攻方掷 D6
//   def_choice 守方看到攻骰后选 防御 / 躲避（UI 限时 10 秒，超时默认防御）
//   def_d6     守方掷 D6
//     躲避：防骰 > 攻骰 或 防骰 = 6 → 成功，done（双方已选的牌照样消耗）
//           失败 → card_roll：只攻方掷战斗牌，守方吃满 ATK + 攻骰 + 攻击牌
//     防御 → card_roll：双方各掷战斗牌，伤害 = max(1, 攻总 − 防总)
//   done
// 头顶的圈（battleTotals）：掷 D6 时出现、显示骰点；掷战斗牌后增长为实际数值
// （基础 ATK/DEF + 骰点 + 牌点）。躲避只比 D6，守方的圈始终是骰点。

const SIDE_OF = { atk: 'attack', def: 'defense' };
const sidePlayer = (state, side) => findPlayer(state, side === 'atk' ? state.battle.attackerId : state.battle.defenderId);
const cardSum = (sd) => sd.cards.reduce((t, c) => t + (c.value ?? 0), 0);

/** 选一张战斗牌（side: 'atk' | 'def'）。选定即扣出手牌，不能撤回；每场每人 3 费上限 */
export function selectBattleCard(state, side, cardId) {
  const b = state.battle;
  if (b?.phase !== 'select' || !b[side] || b[side].locked) return;
  const p = sidePlayer(state, side);
  const card = CARDS[cardId];
  if (!card || card.kind !== 'battle' || card.side !== SIDE_OF[side] || !p.hand.includes(cardId)) return;
  if (b[side].spent + card.cost > 3) return;
  p.hand.splice(p.hand.indexOf(cardId), 1);
  b[side].cards.push({ id: cardId, value: null });
  b[side].spent += card.cost;
  log(state, `${p.name} 选了「${card.name}」`);
  autoLock(state, side);
}

/** 一方还能选的战斗牌（去重）；没有就等于没有可做的决定 */
export function battleOptions(state, side) {
  const b = state.battle;
  if (b?.phase !== 'select' || !b[side] || b[side].locked) return [];
  const p = sidePlayer(state, side);
  return [...new Set(p.hand)].filter((id) => {
    const c = CARDS[id];
    return c.kind === 'battle' && c.side === SIDE_OF[side] && b[side].spent + c.cost <= 3;
  });
}

/** 没有可选的牌 → 自动锁定（不让玩家为「无事可做」点确定） */
function autoLock(state, side) {
  const b = state.battle;
  if (b?.phase === 'select' && !b[side].locked && !battleOptions(state, side).length) lockBattleSide(state, side);
}

/** 锁定一方的选牌；双方都锁定后进入攻方掷 D6 */
export function lockBattleSide(state, side) {
  const b = state.battle;
  if (b?.phase !== 'select' || !b[side] || b[side].locked) return;
  b[side].locked = true;
  if (b.atk.locked && b.def.locked) b.phase = 'atk_d6';
}

export function rollAttackD6(state, rng) {
  const b = state.battle;
  if (b?.phase !== 'atk_d6') return;
  b.atk.d6 = d6(rng);
  log(state, `${sidePlayer(state, 'atk').name} 掷出攻骰 ${b.atk.d6}`);
  b.phase = 'def_choice';
}

/** 守方看到攻骰后选择 防御 / 躲避 */
export function chooseDefense(state, mode) {
  const b = state.battle;
  if (b?.phase !== 'def_choice' || !['defend', 'dodge'].includes(mode)) return;
  b.mode = mode;
  log(state, `${sidePlayer(state, 'def').name} 选择${mode === 'dodge' ? '躲避' : '防御'}`);
  b.phase = 'def_d6';
}

export function rollDefenseD6(state, rng) {
  const b = state.battle;
  if (b?.phase !== 'def_d6') return;
  b.def.d6 = d6(rng);
  log(state, `${sidePlayer(state, 'def').name} 掷出防骰 ${b.def.d6}`);
  if (b.mode === 'dodge') {
    b.dodged = b.def.d6 > b.atk.d6 || b.def.d6 === 6;
    if (b.dodged) { finishBattle(state); return; }
  }
  b.phase = 'card_roll';
  // 没选牌的一方无需掷，直接视为已掷（躲避时守方的牌作废，也不掷）
  if (!b.atk.cards.length) b.atk.rolled = true;
  if (b.mode === 'dodge' || !b.def.cards.length) b.def.rolled = true;
  if (b.atk.rolled && b.def.rolled) finishBattle(state);
}

/** 掷自己选的战斗牌（三档 roll 范围 1~4 / 1~7 / 1~10） */
export function rollBattleCards(state, side, rng) {
  const b = state.battle;
  if (b?.phase !== 'card_roll' || !b[side] || b[side].rolled) return;
  for (const c of b[side].cards) {
    const card = CARDS[c.id];
    c.value = card.min + Math.floor(rng() * (card.max - card.min + 1));
  }
  b[side].rolled = true;
  log(state, `${sidePlayer(state, side).name} 掷战斗牌：${b[side].cards.map((c) => `${CARDS[c.id].name}=${c.value}`).join('、')}`);
  if (b.atk.rolled && b.def.rolled) finishBattle(state);
}

/** 两人头上圈里的数值（UI 与结算共用同一套口径）。未出现时为 null */
export function battleTotals(state) {
  const b = state.battle;
  if (!b) return { red: null, blue: null };
  const A = findPlayer(state, b.attackerId);
  const D = findPlayer(state, b.defenderId);
  const red = b.atk.d6 == null ? null
    : b.atk.rolled && b.phase !== 'def_d6' && !(b.mode === 'dodge' && b.dodged)
      ? { value: A.atk + b.atk.d6 + cardSum(b.atk), parts: [['ATK', A.atk], ['D6', b.atk.d6], ['牌', cardSum(b.atk)]] }
      : { value: b.atk.d6, parts: [['D6', b.atk.d6]] };
  const blue = b.def.d6 == null ? null
    : b.mode === 'defend' && b.def.rolled
      ? { value: D.def + b.def.d6 + cardSum(b.def), parts: [['DEF', D.def], ['D6', b.def.d6], ['牌', cardSum(b.def)]] }
      : { value: b.def.d6, parts: [['D6', b.def.d6]] };
  return { red, blue };
}

function finishBattle(state) {
  const b = state.battle;
  const attacker = findPlayer(state, b.attackerId);
  const defender = findPlayer(state, b.defenderId);
  const { red, blue } = battleTotals(state);
  let dmg;
  if (b.mode === 'dodge') dmg = b.dodged ? 0 : red.value;   // 躲避失败：吃满攻击
  else dmg = Math.max(1, red.value - blue.value);             // 防御：相减，最小 1
  b.outcome = {
    mode: b.mode, dA: b.atk.d6, dD: b.def.d6,
    atkTotal: red.value, defTotal: b.mode === 'dodge' ? null : blue.value, dmg, dodged: !!b.dodged,
  };
  b.phase = 'done';
  log(state, `战斗结算：${b.mode === 'dodge' ? `躲避${b.dodged ? '成功' : '失败'}` : `攻 ${red.value} vs 守 ${blue.value}`} → 伤害 ${dmg}`);
  if (dmg > 0) damage(state, defender, dmg, attacker, '战斗');
  else log(state, `${defender.name} 闪避成功，未受伤`);
}

/** 关闭战斗结算弹窗：回到移动（或落地结算） */
export function closeBattle(state, rng = Math.random) {
  const b = state.battle;
  if (!b || b.phase !== 'done') return;
  state.battle = null;
  const p = cur(state);
  if (state.phase === 'over') return;
  if (p.ko) { state.phase = 'action'; return; }
  if (b.afterLand || state.remaining <= 0) land(state, rng);
  else state.phase = 'moving';
}

// ── 落地结算（规格 §3.2；各地块效果见 tiles.js 注册表）──────────────

function land(state, rng) {
  const p = cur(state);
  state.remaining = 0;
  if (p.ko) { state.phase = 'action'; return; } // 移动中把自己走没了（陷阱）：停在结算态
  if (state.moveFrom != null) {
    log(state, `${p.name} 走到 ${p.tile} 号格（${tileDef(TILES[p.tile].type).name}）`);
    state.moveFrom = null;
  }
  tileDef(TILES[p.tile].type).onLand?.({ state, p, rng, api: TILE_API });
  if (state.phase === 'over') return;
  if (p.ko) { state.phase = 'action'; return; } // 被横祸/试炼走没了：停在结算态
  afterLanding(state);
}

/** 落地结算完：疾行 → 回到掷骰态再掷；否则停在结算态（商店等挂起也在这里等处理） */
function afterLanding(state) {
  const p = cur(state);
  state.phase = p.extraRoll && !state.pending ? 'roll' : 'action';
}

function drawSpecific(state, p, cardId) {
  if (p.hand.length >= HAND_LIMIT) { log(state, `${p.name} 手牌已满，放弃「${CARDS[cardId].name}」`); return; }
  p.hand.push(cardId);
  log(state, `${p.name} 获得「${CARDS[cardId].name}」`);
}

/** 地块钩子可用的引擎能力（tiles.js 不直接 import engine，避免循环依赖） */
const TILE_API = {
  log, fx, popup, damage, gainCoins, drawCards, drawSpecific, tryLevelUp, mirrorTile, pick, d6, CARDS, CARD_IDS,
  canShop: (p, stock) => canShop(p, stock),
};

// ── 行动阶段：效果牌 / 商店 ────────────────────────────────

/** 应用"指定型"效果，处理保护屏障（无效）与以牙还牙（反弹） */
function applyTargeted(state, caster, target, apply) {
  if (target.status.shield > 0) {
    target.status.shield -= 1;
    log(state, `${target.name} 的保护屏障生效，效果被无效化`);
    return;
  }
  if (target.status.reflect > 0) {
    target.status.reflect -= 1;
    log(state, `${target.name} 的以牙还牙生效，效果反弹给 ${caster.name}！`);
    apply(caster, target); // 受害人 = 原施放者，受益人 = 原目标
    return;
  }
  apply(target, caster);
}

/** 出效果牌 / 反制牌（掷骰前）。effect 每回合限 1 张；opts: {targetId?, tileIdx?} */
export function playEffectCard(state, cardId, opts = {}, rng) {
  const p = cur(state);
  if (state.phase !== 'roll' || state.pending) return;
  const card = CARDS[cardId];
  if (!card || !p.hand.includes(cardId)) return;
  if (card.kind === 'effect' && p.effectPlayed) { log(state, '本回合的效果牌已经用过了'); return; }

  // 目标校验先行：不合法不消耗卡牌（远格/无目标/占位冲突都不白费一张卡）
  const needsTarget = ['band', 'brick', 'snatch'].includes(cardId); // 对手指向（band/brick/snatch）
  const isTileTarget = card.target === 'tile'; // phish/bomb/roadblock
  const target = needsTarget ? findPlayer(state, opts.targetId) : null;
  if (needsTarget) {
    if (!target) { log(state, '需要指定一名目标'); return; }
    if (target.immune || target.ko) { log(state, '目标住院/KO，不可指定'); return; }
    if (card.range && tileDistance(p.tile, target.tile) > card.range) {
      log(state, '目标超出射程'); return;
    }
  }
  if (isTileTarget) {
    const tileIdx = opts.tileIdx;
    if (typeof tileIdx !== 'number' || !TILES[tileIdx]) { log(state, '需要选择一个格子'); return; }
    if (tileDistance(p.tile, tileIdx) > card.range) { log(state, '超出射程'); return; }
    if (state.overlays.some((o) => o.tile === tileIdx)) { log(state, '该格已有陷阱/路障'); return; }
  }

  // 校验通过，正式消耗
  p.hand.splice(p.hand.indexOf(cardId), 1);
  if (card.kind === 'effect') p.effectPlayed = true;
  log(state, `${p.name} 打出「${card.name}」`);

  if (card.kind === 'counter') {
    p.status[cardId === 'shield' ? 'shield' : 'reflect'] += 1;
    return;
  }
  switch (cardId) {
    case 'cake':
      p.hp = Math.min(p.maxHp, p.hp + 2);
      log(state, `${p.name} 回复 2 HP（现有 ${p.hp}）`);
      break;
    case 'dice':
      p.fixedRollPending = true;
      state.pending = { type: 'chooseRoll' };
      log(state, `${p.name} 下次移动点数将自选 1~10`);
      break;
    case 'band':
    case 'brick': {
      applyTargeted(state, p, target, (t) => {
        damage(state, t, card.dmg, p, card.name);
      });
      break;
    }
    case 'snatch': {
      applyTargeted(state, p, target, (t, gainer) => {
        const take = Math.min(card.coins, t.coins);
        t.coins -= take;
        gainer.coins += take;
        log(state, `${gainer.name} 抢走 ${t.name} ${take} 星币`);
      });
      break;
    }
    case 'phish':
    case 'bomb':
    case 'roadblock': {
      const tileIdx = opts.tileIdx;
      state.overlays.push({ tile: tileIdx, kind: card.overlay.kind, ownerId: p.id, ...card.overlay, expiresAtTurn: state.turnCount + 24 });
      log(state, `${p.name} 在 ${tileIdx} 号格放置了「${card.name}」`);
      break;
    }
    default:
      break;
  }
}

/** 商店买卡（5 星币/张） */
export function buyCard(state, cardId) {
  const p = cur(state);
  if (state.pending?.type !== 'shop') return;
  if (p.coins < SHOP_PRICE) { log(state, '星币不足'); return; }
  if (p.hand.length >= HAND_LIMIT) { log(state, '手牌已满'); return; }
  const s = state.pending.stock;
  const at = s.indexOf(cardId);
  if (at < 0) return;
  s.splice(at, 1);
  p.coins -= SHOP_PRICE;
  p.hand.push(cardId);
  log(state, `${p.name} 买下「${CARDS[cardId].name}」（剩 ${p.coins} 星币）`);
  // 再也买不了（售罄 / 没钱 / 手牌满）→ 不必让玩家点「离开」
  if (!canShop(p, s)) closeShop(state);
}

/** 还能不能在商店里买：有库存、够钱、手牌没满 */
export function canShop(p, stock) {
  return stock.length > 0 && p.coins >= SHOP_PRICE && p.hand.length < HAND_LIMIT;
}

export function closeShop(state) {
  if (state.pending?.type !== 'shop') return;
  state.pending = null;
  afterLanding(state);
}

/** 结束行动阶段 → 下一位 */
export function endAction(state) {
  if (state.phase !== 'action') return;
  endTurn(state);
}

// ── 回合推进 ───────────────────────────────────────────────

/** 回合上限到点：按 等级 → 星币 → HP 排名结算（规格 §5.4） */
function settleEnd(state) {
  const ranked = [...state.players].sort(
    (a, b) => b.level - a.level || b.coins - a.coins || b.hp - a.hp,
  );
  state.winner = ranked[0].id;
  state.phase = 'over';
  state.pending = null;
  state.battle = null;
  state.remaining = 0;
  ranked.forEach((p, i) => log(state, `第 ${i + 1} 名：${p.name}（Lv${p.level} · ${p.coins} 币 · HP ${p.hp}）`));
  log(state, `25 轮到点，${ranked[0].name} 综合排名第一获胜`);
}

export function endTurn(state, rng = Math.random) {
  if (state.phase === 'over') return;
  // 清理过期叠加物
  state.overlays = state.overlays.filter((o) => !o.expiresAtTurn || o.expiresAtTurn > state.turnCount);

  let next = state.current;
  for (let i = 0; i < state.players.length; i++) {
    next = (next + 1) % state.players.length;
    if (next === 0) {
      state.round += 1;
      if (state.round > 25) { settleEnd(state); return; } // 回合上限：排名结算（§5.4）
    }
    const p = state.players[next];
    if (!p.ko) break;
    if (!p.missedTurn) {
      p.missedTurn = true; // 缺席一次行动机会
      log(state, `${p.name} 被 KO，跳过本轮行动`);
      continue;
    }
    // 复活：原地、回满、彩光一闪
    p.ko = false;
    p.missedTurn = false;
    p.hp = p.maxHp;
    log(state, `${p.name} 复活（HP 回满）`);
    fx(state, 'revive', p.id);
    break;
  }

  state.current = next;
  state.turnCount += 1;
  const p = state.players[next];
  p.immune = false;
  p.effectPlayed = false;
  p.extraRoll = false;
  state.remaining = 0;
  state.pending = null;
  state.moveTeleported = false;
  if ((state.round - 1) % 3 === 0) {
    drawCards(state, p, 1, rng);
  }
  log(state, `── 第 ${state.round} 轮：轮到 ${p.name} ──`);
  state.phase = 'roll';
}
