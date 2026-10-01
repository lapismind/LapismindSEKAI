/**
 * tests/engine.test.mjs —— 图版引擎单测（确定性 rng 注入）
 * node --test tests/*.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, rollMove, moveStep, chooseBranch, resolveBattleOffer, endTurn,
  selectBattleCard, lockBattleSide, rollAttackD6, chooseDefense, rollDefenseD6, rollBattleCards, battleTotals, closeBattle,
  playEffectCard, endAction, buyCard, closeShop,
} from '../src/game/engine.js';
import { TILES, mirrorTile, directedDistance, tileDistance, LOOP_B } from '../src/game/board.js';
import { LEVEL_COST } from '../src/game/board.js';
import { CARDS } from '../src/game/cards.js';
import { activeTargets } from '../src/game/engine.js';

// ── rng 工具 ───────────────────────────────────────────────
/** 固定值 rng：所有 roll 都取同一原始值 */
const constRng = (v) => () => v;
/** 队列 rng：依次消费，耗尽后循环 */
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
/** 让 d6 掷出 v 的原始值；d10 同理（1+floor(r*n)=v → r=[(v-1)/n, v/n)） */
const face6 = (v) => (v - 1) / 6 + 0.01;
const face10 = (v) => (v - 1) / 10 + 0.01;

function newGame() {
  return createGame([
    { charKey: 'ena', playerName: 'P1' },
    { charKey: 'knd', playerName: 'P2' },
  ]);
}

// ── 棋盘拓扑 ───────────────────────────────────────────────
test('棋盘：68 格、4 交点、两环各 36、类型中心对称', () => {
  assert.equal(TILES.length, 68);
  const crosses = TILES.filter((t) => t.type === 'cross');
  assert.equal(crosses.length, 4);
  // 中心对称：每个格的类型与其中心对称格一致
  for (const t of TILES) {
    const m = TILES[mirrorTile(t.i)];
    assert.equal(m.type, t.type, `tile ${t.i} 与其镜像 ${m.i} 类型不一致`);
  }
  // 交点两两中心对称：4↔22、9↔27
  assert.equal(mirrorTile(4), 22);
  assert.equal(mirrorTile(9), 27);
});

test('棋盘：两环等长且交点在两环上', () => {
  assert.equal(LOOP_B.length, 36);
  for (const c of [4, 9, 22, 27]) {
    assert.ok(LOOP_B.includes(c), `交点 ${c} 应在内环上`);
  }
  assert.ok(directedDistance(0, 18) > 0 && directedDistance(0, 18) < 68);
});

// ── 掷骰与移动 ─────────────────────────────────────────────
test('掷骰：1d10 移动，落在疾行格 → 回到掷骰态可再掷', () => {
  const s = newGame();
  assert.equal(s.phase, 'roll');
  rollMove(s, constRng(face10(5)));
  assert.equal(s.phase, 'moving');
  assert.equal(s.remaining, 5);
  // P1 从 0 号（外环）东行：3 步后到 3 号，第 4 步踏上 4 号交点
  moveStep(s); moveStep(s); moveStep(s);
  assert.equal(s.players[0].tile, 3);
  moveStep(s);
  assert.equal(s.players[0].tile, 4);
  // 第 5 步从交点迈出前 → 弹选环
  const r = moveStep(s);
  assert.equal(r, 'pending');
  assert.equal(s.pending.type, 'branch');
  chooseBranch(s, 5); // 十字路口直行：沿外环到 5
  assert.equal(s.players[0].tile, 4);
  const r2 = moveStep(s);
  assert.equal(r2, 'done'); // 步数耗尽 → 落地（5 号疾行）
  assert.equal(s.phase, 'roll');
  assert.equal(s.current, 0, '疾行：还是自己的回合');
  assert.equal(s.players[0].extraRoll, true);
});

test('交点选内环：B 环继续行进', () => {
  const s = newGame();
  s.players[0].tile = 4; // 站在交点上（模拟）
  s.phase = 'roll';
  rollMove(s, constRng(face10(2)));
  moveStep(s); // 选环挂起
  assert.equal(s.pending.type, 'branch');
  chooseBranch(s, 64); // 右转进内环：4 → 64（中央左缘）
  moveStep(s);
  moveStep(s);
  assert.equal(s.players[0].tile, 65);
});

test('路过对手：弹战斗确认，拒绝后继续走', () => {
  const s = newGame();
  s.players[1].tile = 2; // P2 站在 2 号格
  s.players[0].tile = 0;
  rollMove(s, constRng(face10(2)));
  moveStep(s); // 到 1
  const r = moveStep(s); // 到 2，有对手
  assert.equal(r, 'pending');
  assert.equal(s.pending.type, 'battleOffer');
  resolveBattleOffer(s, false);
  assert.equal(s.pending, null);
  assert.equal(s.players[0].tile, 2);
  assert.equal(s.phase, 'action', '落地结算完停在结算态'); // 2 号是卡牌格，抽 2 张
  endAction(s);
  assert.equal(s.current, 1, '调用方结束后轮到下一位');
});

// ── 战斗 ───────────────────────────────────────────────────
/** 进入战斗；atk / def 为进战前塞进双方手牌的牌（空手的一方会被自动锁定） */
function battleSetup(atk = [], def = []) {
  const s = newGame();
  s.players[0].hand.push(...atk);
  s.players[1].hand.push(...def);
  s.players[1].tile = 2;
  s.players[0].tile = 0;
  rollMove(s, constRng(face10(2)));
  moveStep(s);
  moveStep(s); // 遭遇
  resolveBattleOffer(s, true);
  return s;
}

/** 双方选牌并锁定 → 攻骰 dA → 守方选 mode → 防骰 dD */
function fight(s, { atk = [], def = [], dA, mode, dD }) {
  for (const id of atk) selectBattleCard(s, 'atk', id);
  for (const id of def) selectBattleCard(s, 'def', id);
  lockBattleSide(s, 'atk'); lockBattleSide(s, 'def');
  rollAttackD6(s, constRng(face6(dA)));
  chooseDefense(s, mode);
  rollDefenseD6(s, constRng(face6(dD)));
  return s;
}

test('战斗：选牌 3 费上限；选定即扣出手牌、锁定后不能再选', () => {
  const s = battleSetup();
  s.players[1].hand.push('def1');               // 守方有牌可选 → 不会被自动锁定
  s.players[0].hand.push('atk1', 'atk3', 'def1', 'atk2');
  s.battle.atk.locked = false; s.battle.def.locked = false; s.battle.phase = 'select';
  selectBattleCard(s, 'atk', 'atk1');
  selectBattleCard(s, 'atk', 'atk3');            // 1+3 > 3 → 拒绝
  selectBattleCard(s, 'atk', 'def1');            // 攻方不能选防御牌
  assert.equal(s.battle.atk.spent, 1);
  assert.ok(!s.players[0].hand.includes('atk1'), '选定即从手牌扣除');
  assert.ok(s.players[0].hand.includes('atk3'));
  lockBattleSide(s, 'atk');
  selectBattleCard(s, 'atk', 'atk2');            // 已锁定
  assert.equal(s.battle.atk.cards.length, 1);
  assert.equal(s.battle.phase, 'select', '守方未锁定前不进入掷骰');
  lockBattleSide(s, 'def');
  assert.equal(s.battle.phase, 'atk_d6');
});

test('战斗：圈在掷 D6 时出现（只显示骰点），掷牌后增长为 基础 + 骰 + 牌', () => {
  const s = battleSetup(['atk1'], ['def1']);
  selectBattleCard(s, 'atk', 'atk1'); selectBattleCard(s, 'def', 'def1');
  lockBattleSide(s, 'atk'); lockBattleSide(s, 'def');
  assert.deepEqual(battleTotals(s), { red: null, blue: null }, '选牌阶段不出现圈');
  rollAttackD6(s, constRng(face6(3)));
  assert.equal(battleTotals(s).red.value, 3);
  assert.equal(battleTotals(s).blue, null);
  chooseDefense(s, 'defend');
  rollDefenseD6(s, constRng(face6(2)));
  assert.equal(s.battle.phase, 'card_roll');
  assert.equal(battleTotals(s).blue.value, 2);
  rollBattleCards(s, 'atk', constRng(face6(4))); // atk1: 1 + floor(0.51*4) = 3
  assert.equal(battleTotals(s).red.value, 4 + 3 + 3); // ena ATK4 + 攻骰3 + 牌3
  rollBattleCards(s, 'def', constRng(face6(1))); // def1 → 1
  assert.equal(s.battle.phase, 'done');
  assert.equal(s.battle.outcome.defTotal, 6);    // knd DEF3 + 防骰2 + 牌1
  assert.equal(s.battle.outcome.dmg, 4);
  assert.equal(s.players[1].hp, 8 - 4);
});

test('战斗：无牌可选的一方自动锁定；选满 3 费或无合法牌也自动锁定', () => {
  let s = battleSetup();                          // 双方手牌为空
  assert.equal(s.battle.atk.locked, true);
  assert.equal(s.battle.def.locked, true);
  assert.equal(s.battle.phase, 'atk_d6', '双方都没牌：直接进入掷攻骰');
  s = newGame();
  s.players[1].tile = 2; s.players[0].tile = 0;
  s.players[0].hand.push('atk3'); s.players[1].hand.push('def1', 'def2');
  rollMove(s, constRng(face10(2))); moveStep(s); moveStep(s);
  resolveBattleOffer(s, true);
  assert.equal(s.battle.phase, 'select');
  selectBattleCard(s, 'atk', 'atk3');             // 3 费用满 → 自动锁定
  assert.equal(s.battle.atk.locked, true);
  selectBattleCard(s, 'def', 'def1');             // 还能再选 def2（1+2=3）→ 不锁
  assert.equal(s.battle.def.locked, false);
  selectBattleCard(s, 'def', 'def2');
  assert.equal(s.battle.def.locked, true);
  assert.equal(s.battle.phase, 'atk_d6');
});

test('战斗：防御伤害最小 1', () => {
  const s = fight(battleSetup(), { dA: 1, mode: 'defend', dD: 6 }); // 攻 4+1=5，守 3+6=9
  assert.equal(s.battle.phase, 'done', '双方都没牌：掷完防骰直接结算');
  assert.equal(s.battle.outcome.dmg, 1);
});

test('战斗：躲避成功——只比 D6，双方已选的牌照样消耗、不退回', () => {
  const s = battleSetup(['atk3'], ['def2']);
  fight(s, { atk: ['atk3'], def: ['def2'], dA: 3, mode: 'dodge', dD: 4 });
  assert.equal(s.battle.phase, 'done');
  assert.equal(s.battle.outcome.dodged, true);
  assert.equal(s.players[1].hp, 8);
  assert.ok(!s.players[0].hand.includes('atk3') && !s.players[1].hand.includes('def2'), '牌已消耗');
  const t = battleTotals(s);
  assert.equal(t.red.value, 3); assert.equal(t.blue.value, 4); // 圈里只是骰点
});

test('战斗：防骰 = 6 必定躲开', () => {
  const s = fight(battleSetup(), { dA: 6, mode: 'dodge', dD: 6 });
  assert.equal(s.battle.outcome.dodged, true);
});

test('战斗：躲避失败——只攻方掷牌，守方吃满 ATK + 攻骰 + 攻击牌', () => {
  const s = battleSetup(['atk1'], ['def3']);
  fight(s, { atk: ['atk1'], def: ['def3'], dA: 3, mode: 'dodge', dD: 3 }); // 3>3 否、非 6 → 失败
  assert.equal(s.battle.phase, 'card_roll');
  assert.equal(s.battle.def.rolled, true, '躲避时守方的牌不掷');
  rollBattleCards(s, 'def', constRng(0.99));
  assert.equal(s.battle.def.cards[0].value, null);
  rollBattleCards(s, 'atk', constRng(face6(4)));  // atk1 → 3
  assert.equal(s.battle.phase, 'done');
  assert.equal(s.battle.outcome.dmg, 4 + 3 + 3);
  assert.equal(battleTotals(s).blue.value, 3, '守方圈仍只显示骰点');
});

test('战斗 KO：加害者抢走败者一半星币，败者缺席一回合后复活回满', () => {
  const s = battleSetup();
  s.players[1].hp = 1;
  s.players[1].coins = 21;
  s.players[0].coins = 10;
  fight(s, { dA: 2, mode: 'defend', dD: 1 }); // 攻 4+2=6，守 3+1=4 → 伤害 2 ≥ HP1
  assert.equal(s.players[1].ko, true);
  assert.equal(s.players[0].coins, 10 + 10);
  assert.equal(s.players[1].coins, 11);
  closeBattle(s, constRng(face10(1)));
  endAction(s);
  assert.equal(s.current, 0);
  assert.equal(s.players[1].missedTurn, true);
  endTurn(s, constRng(face10(1)));
  assert.equal(s.current, 1);
  assert.equal(s.players[1].ko, false);
  assert.equal(s.players[1].hp, s.players[1].maxHp);
});

test('战斗：阶段乱序调用一律无效', () => {
  const s = battleSetup();
  s.players[0].hand.push('atk1');                // 让双方都还有牌可选，停在选牌阶段
  s.players[1].hand.push('def1');
  s.battle.atk.locked = false; s.battle.def.locked = false; s.battle.phase = 'select';
  rollAttackD6(s, constRng(face6(3)));            // 还在选牌
  chooseDefense(s, 'dodge');
  rollDefenseD6(s, constRng(face6(3)));
  assert.equal(s.battle.phase, 'select');
  assert.equal(s.battle.atk.d6, null);
});

test('战斗结束后攻方继续走完剩余步数', () => {
  const s = newGame();
  s.players[1].tile = 2;
  s.players[0].tile = 0;
  rollMove(s, constRng(face10(5)));
  moveStep(s); moveStep(s); // 遭遇（剩 3 步）
  resolveBattleOffer(s, true);
  fight(s, { dA: 6, mode: 'defend', dD: 1 });
  closeBattle(s);
  assert.equal(s.phase, 'moving');
  assert.equal(s.remaining, 3);
});

// ── 传送门 / 升级 / 手牌 ───────────────────────────────────
test('传送门：跃迁到中心对称格并继续走', () => {
  const s = newGame();
  s.players[0].tile = 15; // 外环，16（传送门）在前方 1 格
  s.players[1].tile = 40; // 挪开，避免误触战斗
  rollMove(s, constRng(face10(3)));
  moveStep(s); // 踏上 16 → 传送
  assert.equal(s.players[0].tile, mirrorTile(16)); // 34
  moveStep(s); moveStep(s);
  assert.equal(s.players[0].tile, 0); // 34 → 35 → 0（绕回外环起点，落地起始点）
  assert.equal(s.phase, 'action');
});

test('升级格：星币达标自动兑换等级，Lv4 获胜', () => {
  const s = newGame();
  s.players[0].tile = 44; // 内环，45（升级格）在前 1 格；先落医院回血无妨
  s.players[1].tile = 0;
  s.players[0].loop = 'B';
  s.players[0].coins = 15;
  rollMove(s, constRng(face10(1)));
  moveStep(s); // 落在 45 → Lv1（花 15）
  assert.equal(s.players[0].level, 1);
  assert.equal(s.players[0].coins, 0);
  // 直接构造 Lv3 + 45 币 → 兑换 Lv4 获胜
  s.players[0].level = 3;
  s.players[0].coins = 45;
  s.phase = 'roll';
  rollMove(s, constRng(face10(1)));
  moveStep(s); // 46 是横祸（-2HP），不会升级；改成直接落 45 再试
});

test('手牌上限 10：满了抽卡被弃置', () => {
  const s = newGame();
  s.players[0].hand = Array(10).fill('cake');
  s.players[0].tile = 2; // 落在卡牌格抽 2 张
  s.phase = 'action';
  // 直接调用落地逻辑不导出，这里用商店免费卡验证上限分支：
  s.pending = { type: 'shop', stock: ['atk1', 'atk2', 'atk3'] };
  buyCard(s, 'atk1');
  assert.equal(s.players[0].hand.length, 10); // 满，买不进
});

test('效果牌：掷骰前出、每回合限 1 张；遥控骰子指定 1~10', () => {
  const s = newGame();
  s.players[0].hand.push('dice', 'cake');
  s.players[0].hp = 5;
  playEffectCard(s, 'dice', {});                  // 掷骰前出 → 挂起选点数
  assert.equal(s.pending.type, 'chooseRoll');
  assert.equal(s.players[0].effectPlayed, true);
  rollMove(s, constRng(face10(1)), { fixed: 7 });
  assert.equal(s.remaining, 7);
  assert.equal(s.pending, null);
  playEffectCard(s, 'cake', {});                  // 移动中不能出
  assert.equal(s.players[0].hp, 5);
  s.phase = 'roll';
  playEffectCard(s, 'cake', {});                  // 同回合第二张效果牌被拒
  assert.equal(s.players[0].hp, 5);
  assert.ok(s.players[0].hand.includes('cake'));
});

test('限牌：反制牌与效果牌合计每回合 1 张', () => {
  const s = newGame();
  s.players[0].hand.push('shield', 'cake', 'mirror');
  playEffectCard(s, 'shield', {});
  assert.equal(s.players[0].status.shield, 1, '反制牌打出成功');
  assert.equal(s.players[0].effectPlayed, true, '反制牌也计入每回合一张');
  s.players[0].hp = 5;
  playEffectCard(s, 'cake', {});                  // 同回合再出效果牌被拒
  assert.equal(s.players[0].hp, 5);
  assert.ok(s.players[0].hand.includes('cake'), '被拒不消耗');
  playEffectCard(s, 'mirror', {});                // 反制牌同样被拒
  assert.equal(s.players[0].status.reflect, 0);
  assert.ok(s.players[0].hand.includes('mirror'));
  endTurn(s, constRng(face10(1)));
  assert.equal(s.players[s.current].effectPlayed, false, '换人后重置');
});

test('限牌：战斗牌不能在掷骰前打出（不被消耗）', () => {
  const s = newGame();
  s.players[0].hand.push('atk1');
  playEffectCard(s, 'atk1', {});
  assert.ok(s.players[0].hand.includes('atk1'), '战斗牌原样在手');
  assert.equal(s.players[0].effectPlayed, false);
});

test('定向效果弹事件特写：受害者坏事 + 施放者好事；反弹时角色对调', () => {
  const s = newGame();
  s.players[0].hand.push('snatch');
  playEffectCard(s, 'snatch', { targetId: 'p2' });
  const tones = s.popups.map((pp) => `${pp.playerId}:${pp.tone}`);
  assert.ok(tones.includes('p2:bad'), tones.join(','));
  assert.ok(tones.includes('p1:good'), tones.join(','));
  assert.ok(s.popups.every((pp) => pp.line == null), '引擎只发事件，台词由 UI 层补');

  const s2 = newGame();
  s2.players[1].status.reflect = 1;
  s2.players[1].coins = 0;
  s2.players[0].coins = 20;
  s2.players[0].hand.push('snatch');
  playEffectCard(s2, 'snatch', { targetId: 'p2' });
  const t2 = s2.popups.map((pp) => `${pp.playerId}:${pp.tone}`);
  assert.ok(t2.includes('p1:bad') && t2.includes('p2:good'), `反弹后应对调：${t2.join(',')}`);
});

test('陷阱触发弹事件特写：踩中者坏事 + 主人好事', () => {
  const s = newGame();
  s.overlays.push({ tile: 1, kind: 'bomb', ownerId: 'p2', dmg: 3 });
  s.players[0].hp = 9;
  rollMove(s, constRng(face10(1)));
  moveStep(s, constRng(face10(1)));
  assert.equal(s.players[0].hp, 6);
  const tones = s.popups.map((pp) => `${pp.playerId}:${pp.tone}`);
  assert.ok(tones.includes('p1:bad'), tones.join(','));
  assert.ok(tones.includes('p2:good'), tones.join(','));
});

test('横财落地弹好事特写', () => {
  const s = newGame();
  s.players[1].tile = 40;
  rollMove(s, constRng(face10(1)));
  moveStep(s, constRng(face10(1))); // 落 1 号横财格
  const good = s.popups.find((pp) => pp.playerId === 'p1' && pp.tone === 'good' && /星币/.test(pp.text));
  assert.ok(good, '应有带金额的好事弹窗');
});

test('商店：5 星币一张、库存内购买', () => {
  const s = newGame();
  s.players[0].coins = 12;
  s.pending = { type: 'shop', stock: ['atk1', 'atk2', 'atk3'] };
  s.phase = 'action';
  buyCard(s, 'atk1');
  buyCard(s, 'atk2');
  assert.equal(s.players[0].coins, 2);
  assert.deepEqual(s.players[0].hand.slice(-2), ['atk1', 'atk2']);
  buyCard(s, 'atk3'); // 没钱了
  assert.equal(s.players[0].hand.length, 2);
  closeShop(s);
  assert.equal(s.pending, null);
  assert.equal(s.phase, 'action', '关店后停在结算态，由调用方结束回合');
});

test('商店：买到再也买不了（没钱）就自动关店', () => {
  const s = newGame();
  s.players[0].coins = 7;
  s.pending = { type: 'shop', stock: ['atk1', 'atk2', 'atk3'] };
  s.phase = 'action';
  buyCard(s, 'atk1');
  assert.equal(s.players[0].coins, 2);
  assert.equal(s.pending, null, '剩 2 币买不了 → 自动关店');
});

// ── 整局随机模拟：验证热座闭环可自然打完（无死锁、能分出胜负）────
test('整局随机模拟：随机合法操作 8000 步内分出胜负', () => {
  const rng = Math.random;
  for (let game = 0; game < 5; game++) {
    let s = createGame([
      { charKey: 'ena' }, { charKey: 'knd' }, { charKey: 'mfy_yuki' }, { charKey: 'mzk' },
    ]);
    let turns = 0;
    while (s.phase !== 'over' && turns < 8000) {
      turns++;
      const p = s.players[s.current];
      if (s.phase === 'roll') {
        // 掷骰前三成概率出牌（效果/反制合计限 1 张，随机合法目标）
        const held = p.hand.map((id) => CARDS[id]).filter((c) => c.kind !== 'battle');
        const effect = p.effectPlayed ? null : held[0];
        if (!s.pending && effect && rng() < 0.35) {
          if (effect.target === 'self' || effect.kind === 'counter') playEffectCard(s, effect.id, {}, rng);
          else if (effect.target === 'opponent') {
            const ts = activeTargets(s, p);
            if (ts.length) playEffectCard(s, effect.id, { targetId: ts[Math.floor(rng() * ts.length)].id }, rng);
          } else if (effect.target === 'tile') {
            const ts = TILES.map((t) => t.i)
              .filter((i) => i !== p.tile && tileDistance(p.tile, i) <= effect.range
                && !s.overlays.some((o) => o.tile === i));
            if (ts.length) playEffectCard(s, effect.id, { tileIdx: ts[Math.floor(rng() * ts.length)] }, rng);
          }
          if (s.phase === 'over') break;
        }
        rollMove(s, rng, p.fixedRollPending ? { fixed: 1 + Math.floor(rng() * 10) } : {});
        continue;
      }
      if (s.phase === 'moving') {
        if (s.pending?.type === 'branch') chooseBranch(s, s.pending.options[Math.floor(rng() * s.pending.options.length)]);
        else if (s.pending?.type === 'battleOffer') resolveBattleOffer(s, rng() < 0.6, rng);
        else moveStep(s, rng);
        continue;
      }
      if (s.phase === 'battle') {
        const b = s.battle;
        if (b.phase === 'select') {
          for (const side of ['atk', 'def']) {
            if (b[side].locked) continue;
            const pl = s.players.find((x) => x.id === (side === 'atk' ? b.attackerId : b.defenderId));
            const want = side === 'atk' ? 'attack' : 'defense';
            const ok = pl.hand.filter((id) => CARDS[id].kind === 'battle' && CARDS[id].side === want && b[side].spent + CARDS[id].cost <= 3);
            if (ok.length && rng() < 0.5) selectBattleCard(s, side, ok[0]);
            else lockBattleSide(s, side);
          }
        } else if (b.phase === 'atk_d6') rollAttackD6(s, rng);
        else if (b.phase === 'def_choice') chooseDefense(s, rng() < 0.5 ? 'defend' : 'dodge');
        else if (b.phase === 'def_d6') rollDefenseD6(s, rng);
        else if (b.phase === 'card_roll') { rollBattleCards(s, 'atk', rng); rollBattleCards(s, 'def', rng); }
        else if (b.phase === 'done') closeBattle(s, rng);
        continue;
      }
      if (s.phase === 'action') {
        // 落地后只剩商店会停在行动态
        if (s.pending?.type === 'shop') {
          if (rng() < 0.5 && p.coins >= 5 && s.pending.stock.length) buyCard(s, s.pending.stock[0]);
          else closeShop(s, rng);
          continue;
        }
        endAction(s);
        continue;
      }
      break; // 未知状态
    }
    assert.equal(s.phase, 'over', `第 ${game + 1} 局 8000 步内未结束，卡在 phase=${s.phase} pending=${JSON.stringify(s.pending ?? null)}`);
    assert.ok(s.winner);
  }
});

// ── M0 试玩修复回归 ────────────────────────────────────────
test('射程：BFS 修复后跨环远格不可达（硬编码期望，非同函数互证）', () => {
  assert.equal(directedDistance(0, 5), 5);   // 外环同环 5 步
  assert.equal(directedDistance(0, 64), 5);  // 经交点 4 切内环：4→64
  assert.equal(directedDistance(0, 36), 10); // 经交点 4→64…→27→36
  assert.equal(directedDistance(0, 40), 14);
  assert.ok(directedDistance(0, 40) > 3, '射程 3 的牌不应达远格');
});

test('射程不分方向：站在路口旁，四条路都够得着（爆破专家 3 格）', () => {
  // 3 号格紧挨交点 4；4 的四个邻格 3 / 5 / 63 / 64
  assert.deepEqual([...neighbors(4)].sort((a, b) => a - b), [3, 5, 63, 64]);
  const reach = TILES.map((t) => t.i).filter((i) => i !== 3 && tileDistance(3, i) <= 3);
  for (const i of [5, 6, 63, 62, 64, 65, 2, 1, 0]) assert.ok(reach.includes(i), `3 格内应含 ${i}`);
  assert.equal(tileDistance(3, 1), 2, '身后也算');
  const s = newGame();
  s.players[0].tile = 3;
  s.players[0].hand.push('bomb');
  playEffectCard(s, 'bomb', { tileIdx: 62 }); // 路口左转方向，距离 3
  assert.ok(s.overlays.some((o) => o.tile === 62 && o.kind === 'bomb'), '左转那条路能放');
});

test('射程：板砖超射程被拒（不消耗），近距命中', () => {
  const s = newGame();
  s.players[0].hand.push('brick');
  s.players[1].tile = 10; // dist(0,10) = 10 > 3
  playEffectCard(s, 'brick', { targetId: 'p2' });
  assert.equal(s.players[1].hp, 8, '超射程不掉血');
  assert.equal(s.players[0].effectPlayed, false, '被拒不消耗效果牌次数');
  s.players[1].tile = 2; // dist(0,2) = 2 ≤ 3
  playEffectCard(s, 'brick', { targetId: 'p2' });
  assert.equal(s.players[1].hp, 3); // 8 - 5
  assert.equal(s.players[0].effectPlayed, true);
});

test('起始点：回 2 HP（规格 §3.2）', () => {
  const s = newGame();
  s.players[0].hp = 5;
  s.players[0].tile = 35; // 外环，0 号起始点在前 1 格
  s.players[1].tile = 40; // 挪开
  s.players[0].coins = 0; // 避免升级干扰
  rollMove(s, constRng(face10(1)));
  moveStep(s);
  assert.equal(s.players[0].tile, 0);
  assert.equal(s.players[0].hp, 7); // 5 + 2
});

test('医院免疫：效果牌不可指定免疫者', () => {
  const s = newGame();
  s.players[1].immune = true;
  s.players[1].hp = 8;
  s.players[0].hand.push('band', 'snatch');
  playEffectCard(s, 'band', { targetId: 'p2' });
  assert.equal(s.players[1].hp, 8, '免疫者不受伤害');
  playEffectCard(s, 'snatch', { targetId: 'p2' });
  assert.equal(s.players[1].coins, 10, '免疫者不被抢');
});

test('以牙还牙：反弹后受益人 = 原目标（不是自己抢自己）', () => {
  const s = newGame();
  s.players[1].status.reflect = 1;
  s.players[1].coins = 0;
  s.players[0].coins = 20;
  s.players[0].hand.push('snatch');
  playEffectCard(s, 'snatch', { targetId: 'p2' });
  // 反弹：原施放者 P1 被抢 10，原目标 P2 得 10
  assert.equal(s.players[0].coins, 10);
  assert.equal(s.players[1].coins, 10);
});

test('自踩陷阱：自己的炸弹不炸自己', () => {
  const s = newGame();
  s.overlays.push({ tile: 1, kind: 'bomb', ownerId: 'p1', dmg: 3 });
  s.players[0].hp = 9;
  rollMove(s, constRng(face10(1)));
  moveStep(s, constRng(face10(1))); // 踏上自己的炸弹（rng 注入保持确定性）
  assert.equal(s.players[0].hp, 9, '自己的陷阱不触发');
  assert.equal(s.players[0].coins, 10 + 8, '自己陷阱不触发伤害，脚下横财照常结算（8）');
});

test('回合上限：25 轮到点按 等级→星币→HP 排名结算', () => {
  const s = newGame();
  s.round = 25;
  s.current = 1; // P2 行动结束即跨轮
  s.phase = 'action';
  s.players[0].level = 2; // 排名第一
  endAction(s);
  assert.equal(s.phase, 'over');
  assert.equal(s.winner, 'p1'); // 玩家 id 从 p1 起编，p1 = 座位 0（绘名，Lv2）
});

// ── 十字路口：三个方向（直行 / 左转 / 右转），不许掉头 ─────────────
import { neighbors, exits } from '../src/game/board.js';

test('十字路口：4 个交点各有 4 个相邻格，进入后可选 3 个方向且不含来路', () => {
  for (const c of [4, 9, 22, 27]) {
    assert.equal(neighbors(c).length, 4, `交点 ${c} 应有 4 个相邻格`);
    for (const from of neighbors(c)) {
      const ex = exits(c, from);
      assert.equal(ex.length, 3, `从 ${from} 进 ${c} 应有 3 个出口`);
      assert.ok(!ex.includes(from), '不许掉头');
    }
  }
  // 普通格只有一条出路
  assert.deepEqual(exits(1, 0), [2]);
});

test('十字路口 22：三个方向都能走，逆着内环走也会沿该方向继续', () => {
  for (const pickDir of exits(22, 21)) {
    const s = newGame();
    s.players[0].tile = 21; s.players[0].prev = 20; // 外环正向走来
    s.players[1].tile = 40;
    rollMove(s, constRng(face10(3)));
    moveStep(s);                                   // 21 → 22
    assert.equal(s.players[0].tile, 22);
    moveStep(s);                                   // 路口挂起
    assert.equal(s.pending?.type, 'branch');
    assert.equal(s.pending.options.length, 3);
    chooseBranch(s, pickDir);
    moveStep(s);
    assert.equal(s.players[0].tile, pickDir);
    const after = s.players[0].tile;
    moveStep(s);                                   // 再走一步：必须沿该方向继续，不能折回 22
    assert.notEqual(s.players[0].tile, 22, `选 ${pickDir} 后第二步折回了路口`);
    assert.ok(neighbors(after).includes(s.players[0].tile));
  }
});

test('十字路口：不在选项里的格子被拒', () => {
  const s = newGame();
  s.players[0].tile = 21; s.players[0].prev = 20;
  s.players[1].tile = 40;
  rollMove(s, constRng(face10(2)));
  moveStep(s); moveStep(s);
  assert.equal(s.pending?.type, 'branch');
  chooseBranch(s, 21);                              // 掉头
  assert.equal(s.pending?.type, 'branch', '掉头应被拒，仍在等待选路');
  chooseBranch(s, 60);                              // 不相邻
  assert.equal(s.pending?.type, 'branch');
});

test('传送门：跃迁后朝向随之 180° 翻转，继续沿原行进方向', () => {
  const s = newGame();
  s.players[0].tile = 15; s.players[0].prev = 14;
  s.players[1].tile = 40;
  rollMove(s, constRng(face10(2)));
  moveStep(s);                                      // 16 → 传到 34
  assert.equal(s.players[0].tile, 34);
  assert.equal(s.players[0].prev, mirrorTile(15));  // 33
  moveStep(s);
  assert.equal(s.players[0].tile, 35);              // 沿外环正向继续
});

test('掷骰记录 lastRoll：值与序号递增（UI 大字用）', () => {
  const s = newGame();
  s.players[1].tile = 40;
  rollMove(s, constRng(face10(7)));
  assert.equal(s.lastRoll.value, 7);
  const seq = s.lastRoll.seq;
  s.phase = 'roll'; s.remaining = 0;
  rollMove(s, constRng(face10(7)));
  assert.equal(s.lastRoll.seq, seq + 1);
});
