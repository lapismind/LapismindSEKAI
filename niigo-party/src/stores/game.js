/**
 * src/stores/game.js —— Pinia store：包一层引擎，M0 热座用；
 * 联机时把这里的本地调用换成 ws 消息（engine 的纯函数形态可直接搬到服务端）。
 *
 * 节奏（pace）：移动每格、掷骰大字、落地结算缓冲、事件通知停留、战斗自动步进都由这里按
 * 「常态 / 快速」两档计时驱动。玩家只做真正的决定（出牌、选路、战斗/放过、选牌、防御/躲避、买卡），
 * 纯展示的环节（掷 D6、掷战斗牌、结算、事件通知、结束回合）一律自动推进。
 */
import { defineStore } from 'pinia';
import * as E from '@/game/engine';
import { CHARACTERS } from '@/game/characters';
import { pickVoiceLine, speakLine, cancelSpeech } from '@/game/voices';

const SAVE_KEY = 'niigo-party-save-v1';
const FAST_KEY = 'niigo-party-fast';

/** 两档节奏（毫秒）：常态比快速慢，给动画与通知留足时间 */
export const PACES = {
  normal: { step: 340, rollShow: 1100, settle: 1800, popup: 3000, battleStep: 950, battleEnd: 2000 },
  fast: { step: 150, rollShow: 600, settle: 1100, popup: 1500, battleStep: 480, battleEnd: 1100 },
};

let dropSeq = 0;
let settleSeq = 0;
let popupTimer = null;
let battleTimer = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const useGameStore = defineStore('game', {
  state: () => ({
    s: null,        // 引擎状态（普通对象，整体响应式）
    view: 'setup',  // setup | game
    moving: false,  // 自动步进动画中
    lastFx: null,   // {type, playerId} 触发全屏特效（KO/复活/传送/升级）
    coinDrops: [],  // 头顶掉金币：{id, playerId, amount}
    popups: [],     // 事件特写队列：{title, text, tone, art, playerId, charKey, line}，按节奏自动轮播
    popupHold: 0,   // 队首特写本次的停留毫秒（与 EventPopup 的进度条同步）
    battleLive: false, // 战斗过场已播完，可以自动步进
    fast: localStorage.getItem(FAST_KEY) === '1',
    picked: [],     // 设置界面选中的角色键
    hasSave: !!localStorage.getItem(SAVE_KEY), // 热座存档（F5 恢复用）
  }),

  getters: {
    started: (st) => st.view === 'game',
    current: (st) => (st.s ? st.s.players[st.s.current] : null),
    log: (st) => (st.s ? [...st.s.log].reverse().slice(0, 60) : []),
    pace: (st) => (st.fast ? PACES.fast : PACES.normal),
    canRoll(st) {
      if (!st.s) return false;
      return !st.moving && !st.s.pending && !st.s.battle && st.s.phase === 'roll';
    },
  },

  actions: {
    setFast(v) {
      this.fast = !!v;
      localStorage.setItem(FAST_KEY, this.fast ? '1' : '0');
    },

    // ── 设置 ──
    togglePick(key) {
      const at = this.picked.indexOf(key);
      if (at >= 0) this.picked.splice(at, 1);
      else if (this.picked.length < 4) this.picked.push(key);
    },
    start(names) {
      if (this.picked.length < 2) return;
      this.s = E.createGame(this.picked.map((charKey, i) => ({
        charKey,
        playerName: names?.[i] || CHARACTERS[charKey].name,
      })));
      this.view = 'game';
      this.persist();
    },
    /** F5 恢复：从 localStorage 读回引擎状态快照 */
    resume() {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        // 只接受稳定态存档。moving 态存档属历史遗留，丢弃让玩家重掷
        if (parsed.phase === 'moving' || !Array.isArray(parsed.players)) {
          localStorage.removeItem(SAVE_KEY);
          this.hasSave = false;
          return false;
        }
        this.s = parsed;
        this.view = 'game';
        this.settleIfIdle(); // 存档停在结算态：照常自动轮到下一位
        return true;
      } catch { localStorage.removeItem(SAVE_KEY); this.hasSave = false; return false; }
    },
    discardSave() {
      localStorage.removeItem(SAVE_KEY);
      this.hasSave = false;
    },
    persist() {
      // 只在稳定态落盘：moving 态绝不覆盖上一次的稳定快照（F5 恢复后从掷骰前重掷，绝不卡死）
      if (!this.s || this.s.phase === 'moving') return;
      if (this.s.phase === 'over') { localStorage.removeItem(SAVE_KEY); this.hasSave = false; return; }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); this.hasSave = true; } catch { /* 存储满等，忽略 */ }
    },

    /** 每次调完引擎：取特效、落盘，然后按状态决定下一步（继续走 / 结算后换人） */
    afterEngine() {
      this.consumeFx();
      this.persist();
      if (!this.s) return;
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
      else this.settleIfIdle();
    },

    /**
     * 落地结算完（结算态、没有挂起、不在战斗）：先等动画与事件通知播完，再自动轮到下一位。
     * 同一时刻只保留最后一次调度（settleSeq 令牌），防止重复换人。
     */
    async settleIfIdle() {
      if (!this.s || this.s.phase !== 'action' || this.s.pending || this.s.battle) return;
      const token = ++settleSeq;
      await sleep(this.pace.settle);
      while (this.popups.length && token === settleSeq) await sleep(120);
      if (token !== settleSeq) return;
      if (!this.s || this.s.phase !== 'action' || this.s.pending || this.s.battle) return;
      E.endAction(this.s);
      this.consumeFx();
      this.persist();
    },

    // ── 回合 ──
    roll(fixed) {
      if (!this.s) return;
      E.rollMove(this.s, Math.random, { fixed });
      this.persist();
      if (this.s.phase === 'moving') this.autoMove(this.pace.rollShow); // 先让大字骰点亮一会儿再走
    },
    async autoMove(delay = 60) {
      // 逐格自动推进，遇 pending（路口 / 遭遇）停下等玩家决策
      if (this.moving) return;
      this.moving = true;
      try {
        await sleep(delay);
        while (this.s && this.s.phase === 'moving' && !this.s.pending) {
          E.moveStep(this.s, Math.random);
          this.consumeFx();
          if (this.s.phase !== 'moving') break;
          await sleep(this.pace.step);
        }
      } finally {
        this.moving = false;
        this.persist();
      }
      this.consumeFx();
      this.settleIfIdle();
    },
    chooseBranch(next) {
      if (!this.s) return;
      E.chooseBranch(this.s, next);
      this.afterEngine();
    },
    acceptBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, true, Math.random);
      this.persist();
      // 战斗自动步进等过场播完（BattleOverlay 调 battleReady）
    },
    declineBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, false, Math.random);
      this.afterEngine();
    },

    // ── 战斗：玩家只选牌与 防御/躲避，其余自动 ──
    battleReady() {
      this.battleLive = true;
      this.battleTick();
    },
    /** 按阶段安排下一次自动步进：掷攻骰 → 掷防骰 → 掷战斗牌（攻、守各一拍）→ 结算后自动收尾 */
    battleTick() {
      clearTimeout(battleTimer);
      const b = this.s?.battle;
      if (!b || !this.battleLive) return;
      const P = this.pace;
      const s = this.s;
      const steps = {
        atk_d6: () => { E.rollAttackD6(s, Math.random); this.persist(); this.battleTick(); },
        def_d6: () => { E.rollDefenseD6(s, Math.random); this.consumeFx(); this.persist(); this.battleTick(); },
        card_roll: () => {
          E.rollBattleCards(s, b.atk.rolled ? 'def' : 'atk', Math.random);
          this.consumeFx(); this.persist(); this.battleTick();
        },
        done: () => this.closeBattle(),
      };
      const step = steps[b.phase];
      if (step) battleTimer = setTimeout(step, b.phase === 'done' ? P.battleEnd : P.battleStep);
    },
    selectBattleCard(side, cardId) {
      if (!this.s) return;
      E.selectBattleCard(this.s, side, cardId);
      this.persist();
      this.battleTick();
    },
    lockBattleSide(side) {
      if (!this.s) return;
      E.lockBattleSide(this.s, side);
      this.persist();
      this.battleTick();
    },
    chooseDefense(mode) {
      if (!this.s) return;
      E.chooseDefense(this.s, mode);
      this.persist();
      this.battleTick();
    },
    closeBattle() {
      if (!this.s) return;
      clearTimeout(battleTimer);
      this.battleLive = false;
      E.closeBattle(this.s, Math.random);
      this.afterEngine();
    },

    // ── 掷骰前出牌 / 商店 ──
    playCard(cardId, opts) {
      if (!this.s) return;
      E.playEffectCard(this.s, cardId, opts || {}, Math.random);
      this.persist();
      this.consumeFx();
    },
    buy(cardId) {
      if (!this.s) return;
      E.buyCard(this.s, cardId); // 买到再也买不了会自动关店
      this.afterEngine();
    },
    closeShop() {
      if (!this.s) return;
      E.closeShop(this.s);
      this.afterEngine();
    },

    consumeFx() {
      if (this.s?.fx?.length) {
        for (const f of this.s.fx) {
          if (f.type === 'coins') {
            const drop = { id: ++dropSeq, playerId: f.playerId, amount: f.amount };
            this.coinDrops.push(drop);
            setTimeout(() => { this.coinDrops = this.coinDrops.filter((d) => d.id !== drop.id); }, 1600);
          } else {
            this.lastFx = f;
            setTimeout(() => { if (this.lastFx === f) this.lastFx.consumed = true; }, 900);
          }
        }
        this.s.fx = [];
      }
      if (this.s?.popups?.length) {
        // 补上角色键与占位台词（引擎只发事件，语音展示是 UI 层的事）
        const byId = new Map(this.s.players.map((p) => [p.id, p]));
        this.popups.push(...this.s.popups.map((pp) => {
          const pl = byId.get(pp.playerId);
          return { ...pp, charKey: pl?.charKey ?? null, line: pl ? pickVoiceLine(pl.charKey, pp.tone) : null };
        }));
        this.s.popups = [];
        this.armPopup();
      }
    },

    /**
     * 事件特写自动轮播：队首停留后换下一条（点一下可提前跳过）。
     * 常态档朗读占位电子音，停留按台词长度保底；快速档不读，保节奏。
     */
    armPopup() {
      if (popupTimer || !this.popups.length) return;
      const head = this.popups[0];
      let hold = this.pace.popup;
      if (head.line && !this.fast) {
        speakLine(head.charKey, head.line);
        hold = Math.max(hold, Math.min(6000, 700 + head.line.length * 280));
      } else {
        cancelSpeech();
      }
      this.popupHold = hold;
      popupTimer = setTimeout(() => {
        popupTimer = null;
        if (this.popups[0] === head) this.popups.shift();
        if (this.popups.length) this.armPopup();
        else { this.popupHold = 0; cancelSpeech(); }
      }, hold);
    },
    skipPopup() {
      clearTimeout(popupTimer);
      popupTimer = null;
      this.popups.shift();
      if (this.popups.length) this.armPopup();
      else { this.popupHold = 0; cancelSpeech(); }
    },
  },
});
