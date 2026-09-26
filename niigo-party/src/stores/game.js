/**
 * src/stores/game.js —— Pinia store：包一层引擎，M0 热座用；
 * 联机时把这里的本地调用换成 ws 消息（engine 的纯函数形态可直接搬到服务端）。
 */
import { defineStore } from 'pinia';
import * as E from '@/game/engine';
import { CHARACTERS } from '@/game/characters';

export const useGameStore = defineStore('game', {
  state: () => ({
    s: null,        // 引擎状态（普通对象，整体响应式）
    view: 'setup',  // setup | game
    moving: false,  // 自动步进动画中
    lastFx: null,   // {type, playerId} 触发全屏特效（KO/复活/传送/升级）
    picked: [],     // 设置界面选中的角色键
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
    },

    // ── 回合 ──
    roll(fixed) {
      if (!this.s) return;
      E.rollMove(this.s, Math.random, { fixed });
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
    },
    chooseBranch(loop) {
      if (!this.s) return;
      E.chooseBranch(this.s, loop);
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },
    acceptBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, true, Math.random);
    },
    declineBattle() {
      if (!this.s) return;
      E.resolveBattleOffer(this.s, false, Math.random);
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },

    // ── 战斗 ──
    playBattle(cardId) {
      if (!this.s) return;
      E.playBattleCard(this.s, cardId, Math.random);
    },
    confirmCards() {
      if (!this.s) return;
      E.confirmBattleCards(this.s);
    },
    chooseDefense(mode) {
      if (!this.s) return;
      E.chooseDefense(this.s, mode, Math.random);
      this.consumeFx();
    },
    closeBattle() {
      if (!this.s) return;
      E.closeBattle(this.s, Math.random);
      this.consumeFx();
      if (this.s.phase === 'moving' && !this.s.pending) this.autoMove();
    },

    // ── 行动阶段 ──
    playCard(cardId, opts) {
      if (!this.s) return;
      E.playEffectCard(this.s, cardId, opts || {}, Math.random);
      this.consumeFx();
    },
    buy(cardId) {
      if (!this.s) return;
      E.buyCard(this.s, cardId);
    },
    closeShop() {
      if (!this.s) return;
      E.closeShop(this.s);
    },
    endTurn() {
      if (!this.s) return;
      E.endAction(this.s);
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
