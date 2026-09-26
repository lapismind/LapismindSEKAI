/**
 * src/game/engine.js —— 图版层规则引擎（纯逻辑，无 Vue / DOM / 网络依赖）
 *
 * 设计约定（docs/specs/2026-09-26-niigo-party-spec.md）：
 * - 所有函数都接收并修改 state（普通对象），方便将来整体搬到 Durable Object 做服务器权威；
 * - 随机数一律通过参数 rng（() => [0,1)）注入：M0 热座传 Math.random，单测传确定性序列，
 *   联机时由服务端掷骰后走状态帧广播；
 * - 移动骰 1d10（规格 v2.6），战斗判定骰 1d6，两套分开；
 * - 战斗胜利（未 KO）无星币效果；KO 才由加害者抢走败者一半星币（§6.2）。
 */

import {
  TILES, nextTile, mirrorTile, directedDistance, IS_CROSS,
  LEVEL_COST, WIN_LEVEL, SHOP_PRICE, START_COINS, HAND_LIMIT, MOVE_DIE,
} from './board.js';
import { CHARACTERS } from './characters.js';
import { CARDS, CARD_IDS } from './cards.js';

const d6 = (rng) => 1 + Math.floor(rng() * 6);
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function log(state, text) {
  state.log.push({ r: state.round, text });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}
function fx(state, type, playerId, extra = {}) {
  state.fx.push({ type, playerId, ...extra });
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
        tile: i === 0 ? 0 : 18, // 两个起始点，中心对称
        loop: 'A',
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
  if (state.phase === 'action') p.extraRoll = false;
  state.remaining = steps;
  state.phase = 'moving';
  state.moveTeleported = false;
  p.branchChosenAt = null;
}

/**
 * 移动一格。遇交点未选环 / 遇对手可战斗 / 传送门时挂起 pending，等 UI 处理后继续。
 * 返回 'done'（移动结束，已落地结算）| 'pending' | 'moving'
 */
export function moveStep(state, rng = Math.random) {
  const p = cur(state);
  if (state.phase !== 'moving' || state.pending) return 'pending';
  if (state.remaining <= 0) { land(state, rng); return 'done'; }

  // 站在交点上：先选环才能迈步（已在交点选过 / 步数耗尽则直接走或落地）
  if (IS_CROSS(p.tile) && p.branchChosenAt !== p.tile) {
    state.pending = { type: 'branch', tile: p.tile };
    return 'pending';
  }

  p.tile = nextTile(p.tile, p.loop);
  p.branchChosenAt = null;
  state.remaining -= 1;
  log(state, `${p.name} 移动到 ${p.tile} 号格`);

  // 到达检查（顺序：叠加物 → 传送门 → 对手）
  const ovIdx = state.overlays.findIndex((o) => o.tile === p.tile);
  if (ovIdx >= 0) {
    const ov = state.overlays[ovIdx];
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

  if (TILES[p.tile].type === 'teleport' && !state.moveTeleported) {
    const dest = mirrorTile(p.tile);
    state.moveTeleported = true;
    p.tile = dest;
    log(state, `${p.name} 触发传送门，跃迁到 ${dest} 号格`);
    fx(state, 'teleport', p.id);
  }

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

/** 交点选环 */
export function chooseBranch(state, loop) {
  const p = cur(state);
  if (state.pending?.type !== 'branch') return;
  p.loop = loop;
  p.branchChosenAt = p.tile;
  log(state, `${p.name} 在交点选择走 ${loop === 'A' ? '外环' : '内环'}`);
  state.pending = null;
}

/** 回应「可战斗」弹窗 */
export function resolveBattleOffer(state, accept, rng = Math.random) {
  if (state.pending?.type !== 'battleOffer') return;
  const { defenderId } = state.pending;
  const afterLand = state.remaining <= 0;
  state.pending = null;
  if (accept) {
    state.battle = {
      attackerId: cur(state).id,
      defenderId,
      phase: 'attack_cards', // attack_cards → defense_cards → defend_choice → done
      atkCards: [], defCards: [], atkSpent: 0, defSpent: 0,
      outcome: null, afterLand,
    };
    state.phase = 'battle';
    log(state, `战斗开始：${cur(state).name} → ${findPlayer(state, defenderId).name}`);
  } else if (afterLand) {
    land(state, rng);
  }
}

// ── 战斗（规格 §4：攻防骰 1d6、闪避 = 防骰>攻骰或防骰=6、伤害 ≥1）──

const sideActor = (state) => {
  const b = state.battle;
  return b.phase === 'attack_cards' ? findPlayer(state, b.attackerId)
    : findPlayer(state, b.defenderId);
};

/** 打出战斗牌（三档 1~3 费，roll 范围 1~4 / 1~7 / 1~10；每人每场 3 费上限） */
export function playBattleCard(state, cardId, rng) {
  const b = state.battle;
  if (!b || !['attack_cards', 'defense_cards'].includes(b.phase)) return;
  const actor = sideActor(state);
  const card = CARDS[cardId];
  if (!card || card.kind !== 'battle' || !actor.hand.includes(cardId)) return;
  const spent = b.phase === 'attack_cards' ? b.atkSpent : b.defSpent;
  if (spent + card.cost > 3) return;
  const value = card.min + Math.floor(rng() * (card.max - card.min + 1));
  actor.hand.splice(actor.hand.indexOf(cardId), 1);
  (b.phase === 'attack_cards' ? b.atkCards : b.defCards).push({ id: cardId, value });
  if (b.phase === 'attack_cards') b.atkSpent += card.cost;
  else b.defSpent += card.cost;
  log(state, `${actor.name} 打出「${card.name}」→ ${value} 点`);
}

export function confirmBattleCards(state) {
  const b = state.battle;
  if (b?.phase === 'attack_cards') b.phase = 'defense_cards';
  else if (b?.phase === 'defense_cards') b.phase = 'defend_choice';
}

/** 防守方选择防御或躲避，结算整场战斗 */
export function chooseDefense(state, mode, rng) {
  const b = state.battle;
  if (!b || b.phase !== 'defend_choice') return;
  const attacker = findPlayer(state, b.attackerId);
  const defender = findPlayer(state, b.defenderId);
  const dA = d6(rng);
  const dD = d6(rng);
  const atkTotal = attacker.atk + b.atkCards.reduce((s, c) => s + c.value, 0) + dA;
  let dmg;
  let dodged = false;
  const defTotal = defender.def + b.defCards.reduce((s, c) => s + c.value, 0) + dD;
  if (mode === 'dodge') {
    dodged = dD > dA || dD === 6;
    dmg = dodged ? 0 : atkTotal; // 躲避失败：防御视为 0，承受全部攻击点数
  } else {
    dmg = Math.max(1, atkTotal - defTotal); // 伤害最小 1
  }
  b.outcome = { mode, dA, dD, atkTotal, defTotal: mode === 'dodge' ? null : defTotal, dmg, dodged };
  b.phase = 'done';
  log(state, `战斗结算：攻 ${atkTotal} vs 守 ${mode === 'dodge' ? `闪避(${dodged ? '成功' : '失败'})` : defTotal} → 伤害 ${dmg}`);
  if (dmg > 0) damage(state, defender, dmg, attacker, '战斗');
  else log(state, `${defender.name} 闪避成功，未受伤`);
}

/** 关闭战斗结算弹窗：回到移动（或落地结算） */
export function closeBattle(state, rng = Math.random) {
  const b = state.battle;
  if (!b || b.phase !== 'done') return;
  state.battle = null;
  const p = cur(state);
  if (state.phase === 'over' || p.ko) { endTurn(state); return; }
  if (b.afterLand || state.remaining <= 0) land(state, rng);
  else state.phase = 'moving';
}

// ── 落地结算（规格 §3.2）───────────────────────────────────

function land(state, rng) {
  const p = cur(state);
  state.remaining = 0;
  if (p.ko) { endTurn(state); return; } // 移动中把自己走没了（试炼/陷阱）
  const type = TILES[p.tile].type;
  switch (type) {
    case 'coin': {
      const v = pick([8, 12, 16, 20, 32], rng);
      gainCoins(state, p, v);
      break;
    }
    case 'coinhi': {
      const v = pick([20, 28, 40], rng);
      gainCoins(state, p, v);
      break;
    }
    case 'misfortune':
      log(state, `${p.name} 天降横祸！`);
      damage(state, p, 2, null, '天降横祸');
      break;
    case 'trial': {
      const r = d6(rng);
      if (r >= 5) { log(state, `试炼成功（${r}）！`); gainCoins(state, p, 15); }
      else { log(state, `试炼失败（${r}）…`); damage(state, p, 3, null, '试炼失败'); }
      break;
    }
    case 'hospital':
      p.hp = Math.min(p.maxHp, p.hp + 2);
      p.immune = true;
      log(state, `${p.name} 住院休养：回 2 HP，免疫到下次自己回合`);
      break;
    case 'shop': {
      const free = pick(CARD_IDS, rng);
      drawSpecific(state, p, free);
      state.pending = { type: 'shop', stock: [pick(CARD_IDS, rng), pick(CARD_IDS, rng), pick(CARD_IDS, rng)] };
      log(state, `${p.name} 到商店：免费拿 1 张，可花 5 星币/张补货`);
      break;
    }
    case 'card':
      drawCards(state, p, 2, rng);
      break;
    case 'swift':
      p.extraRoll = true;
      log(state, `${p.name} 踩中疾行，可再掷一次移动骰`);
      break;
    case 'start':
    case 'upgrade':
      log(state, `${p.name} 停在${type === 'start' ? '起始点' : '升级格'}`);
      tryLevelUp(state, p);
      break;
    case 'cross':
    case 'teleport':
    default:
      break;
  }
  if (state.phase === 'over') return;
  if (p.ko) { endTurn(state); return; } // 被横祸/试炼走没了
  state.phase = 'action';
}

function drawSpecific(state, p, cardId) {
  if (p.hand.length >= HAND_LIMIT) { log(state, `${p.name} 手牌已满，放弃「${CARDS[cardId].name}」`); return; }
  p.hand.push(cardId);
  log(state, `${p.name} 获得「${CARDS[cardId].name}」`);
}

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
    apply(caster);
    return;
  }
  apply(target);
}

/** 出效果牌 / 反制牌。effect 每回合限 1 张；opts: {targetId?, tileIdx?} */
export function playEffectCard(state, cardId, opts = {}, rng) {
  const p = cur(state);
  if (state.phase !== 'action' || state.pending) return;
  const card = CARDS[cardId];
  if (!card || !p.hand.includes(cardId)) return;
  if (card.kind === 'effect') {
    if (p.effectPlayed) { log(state, '本回合的效果牌已经用过了'); return; }
    p.effectPlayed = true;
  }
  p.hand.splice(p.hand.indexOf(cardId), 1);
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
      const target = findPlayer(state, opts.targetId);
      if (!target) return;
      applyTargeted(state, p, target, (t) => {
        damage(state, t, card.dmg, p, card.name);
      });
      break;
    }
    case 'snatch': {
      const target = findPlayer(state, opts.targetId);
      if (!target) return;
      applyTargeted(state, p, target, (t) => {
        const take = Math.min(card.coins, t.coins);
        t.coins -= take;
        p.coins += take;
        log(state, `${p.name} 抢走 ${t.name} ${take} 星币`);
      });
      break;
    }
    case 'phish':
    case 'bomb':
    case 'roadblock': {
      const tileIdx = opts.tileIdx;
      if (typeof tileIdx !== 'number' || !TILES[tileIdx]) return;
      if (directedDistance(p.tile, tileIdx) > card.range) { log(state, '超出射程'); return; }
      if (state.overlays.some((o) => o.tile === tileIdx)) { log(state, '该格已有陷阱/路障'); return; }
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
}

export function closeShop(state) {
  if (state.pending?.type !== 'shop') return;
  state.pending = null;
}

/** 结束行动阶段 → 下一位 */
export function endAction(state) {
  if (state.phase !== 'action') return;
  endTurn(state);
}

// ── 回合推进 ───────────────────────────────────────────────

export function endTurn(state, rng = Math.random) {
  if (state.phase === 'over') return;
  // 清理过期叠加物
  state.overlays = state.overlays.filter((o) => !o.expiresAtTurn || o.expiresAtTurn > state.turnCount);

  let next = state.current;
  for (let i = 0; i < state.players.length; i++) {
    next = (next + 1) % state.players.length;
    if (next === 0) state.round += 1;
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
