/**
 * src/stores/game.js —— Pinia store：包一层引擎，M0 热座用；
 * 联机时把这里的本地调用换成 ws 消息（engine 的纯函数形态可直接搬到服务端）。
 */
import { defineStore } from 'pinia';
import * as E from '@/game/engine';
import { CHARACTERS } from '@/game/characters';

const SAVE_KEY = 'niigo-party-save-v1';

export const useGameStore = defineStore('game', {
  state: () => ({
    s: null,        // 引擎状态（普通对象，整体响应式）
    view: 'setup',  // setup | game
    moving: false,  // 自动步进动画中
    lastFx: null,   // {type, playerId} 触发全屏特效（KO/复活/传送/升级）
    picked: [],     // 设置界面选中的角色键
    hasSave: !!localStorage.getItem(SAVE_KEY), // 热座存档（F5 恢复用）
  }),

  getters: {
    started: (st) => st.view === 'game',
    current: (st) => (st.s ? st.s.players[st.s.current] : null),
    log: (st) => (st.s ? [...st.s.log].reverse().slice(0, 60) : []),
    canRoll(st) {
      if (!st.s) return false;
      const p = st.s.players[st.s.current];
      return !st.moving && !st.s.pending && !st.s.battle
        && (st.s.phase === 'roll' || (st.s.phase === 'action' && (p.extraRoll || p.fixedRollPending)));
    },
  },

  actions: {
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
      if (!raw) return;
      try {
        this.s = JSON.parse(raw);
        this.view = 'game';
      } catch { localStorage.removeItem(SAVE_KEY); this.hasSave = false; }
    },
    discardSave() {
      localStorage.removeItem(SAVE_KEY);
      this.hasSave = false;
    },
    persist() {
      if (!this.s || this.s.phase === 'over') { localStorage.removeItem(SAVE_KEY); this.hasSave = false; return; }
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); this.hasSave = true; } catch { /* 存储满等，忽略 */ }
    },

    // ── 回合 ──
    roll(fixed) {
      if (!this.s) return;
      E.rollMove(this.s, Math.random, { fixed });
this.persist();
      if (this.s.phase === 'moving') this.autoMove();
    },
    async autoMove() {
      // 逐步自动推进（220ms/格），遇 pending 停下等玩家决策
      if (this.moving) return;
      this.moving = true;
      await new Promise((r) => setTimeout(r, 60));
      while (this.s && this.s.phase === 'moving' && !this.s.pending) {
        E.moveStep(this.s, Math.random);
        this.consumeFx();
        await new Promise((r) => setTimeout(r, 220));
      }
      this.consumeFx();
      this.moving = false;
      this.persist();
    },
    chooseBranch(loop) {
      if (!this.s) return;
      E.chooseBranch(this.s, loop);
this.persist();
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },
    acceptBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, true, Math.random);
this.persist();
    },
    declineBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, false, Math.random);
this.persist();
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },

    // ── 战斗 ──
    playBattle(cardId) {
      if (!this.s) return;
      E.playBattleCard(this.s, cardId, Math.random);
this.persist();
    },
    confirmCards() {
      if (!this.s) return;
      E.confirmBattleCards(this.s);
this.persist();
    },
    chooseDefense(mode) {
      if (!this.s) return;
      E.chooseDefense(this.s, mode, Math.random);
this.persist();
      this.consumeFx();
    },
    closeBattle() {
      if (!this.s) return;
      E.closeBattle(this.s, Math.random);
this.persist();
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },

    // ── 行动阶段 ──
    playCard(cardId, opts) {
      if (!this.s) return;
      E.playEffectCard(this.s, cardId, opts || {}, Math.random);
this.persist();
      this.consumeFx();
    },
    buy(cardId) {
      if (!this.s) return;
      E.buyCard(this.s, cardId);
this.persist();
    },
    closeShop() {
      if (!this.s) return;
      E.closeShop(this.s);
this.persist();
    },
    endTurn() {
      if (!this.s) return;
      E.endAction(this.s);
this.persist();
      this.consumeFx();
    },

    consumeFx() {
      if (this.s?.fx?.length) {
        this.lastFx = this.s.fx[this.s.fx.length - 1];
        this.s.fx = [];
        setTimeout(() => { if (this.lastFx) this.lastFx.consumed = true; }, 900);
      }
    },
  },
});
