/**
 * core/stateMachine.js
 * 通用回合状态机 —— 不绑定具体游戏玩法。
 *
 * 设计意图：
 * - 回合制游戏的核心抽象：phase（阶段）流转 + 当前行动者。
 * - 纯逻辑、无 UI、无网络依赖，方便单测与复用。
 * - 具体游戏的 phase 列表通过构造函数传入，换玩法只换配置。
 */

export class StateMachine {
  /**
   * @param {Object} config
   * @param {string[]} config.phases 允许的阶段，如 ['dealing','playing','scoring','ended']
   * @param {string} config.initial  初始阶段
   */
  constructor({ phases, initial }) {
    if (!phases.includes(initial)) {
      throw new Error(`initial phase "${initial}" 不在 phases 列表中`)
    }
    this.phases = phases
    this.phase = initial
    this.currentPlayerId = null
    this.turnNumber = 0
    this.listeners = new Set()
  }

  /** 进入下一阶段，可携带数据 */
  transition(nextPhase, data = {}) {
    if (!this.phases.includes(nextPhase)) {
      throw new Error(`非法阶段跳转: "${this.phase}" -> "${nextPhase}"`)
    }
    this.phase = nextPhase
    if (data.currentPlayerId !== undefined) {
      this.currentPlayerId = data.currentPlayerId
    }
    if (data.turnNumber !== undefined) {
      this.turnNumber = data.turnNumber
    }
    this._emit({ type: 'transition', phase: nextPhase, ...data })
  }

  /** 开始一个新回合 */
  startTurn(playerId) {
    this.turnNumber += 1
    this.currentPlayerId = playerId
    this._emit({ type: 'turn-start', playerId, turnNumber: this.turnNumber })
  }

  /** 结束当前玩家回合，交给下家（由调用方决定下家是谁） */
  endTurn(nextPlayerId) {
    this.currentPlayerId = nextPlayerId
    this._emit({ type: 'turn-end', playerId: nextPlayerId, turnNumber: this.turnNumber })
  }

  on(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _emit(event) {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}
