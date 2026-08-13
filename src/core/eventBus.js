/**
 * core/eventBus.js
 * 极简事件总线 —— 组件间解耦通信。
 *
 * 适用场景：两个无父子关系的组件需要通信（如出牌动画完成时通知倒计时重置）。
 * 不适用：有数据依赖的状态（请走 Pinia）。
 */

class EventBus {
  constructor() {
    this._map = new Map()
  }

  on(event, handler) {
    if (!this._map.has(event)) {
      this._map.set(event, new Set())
    }
    this._map.get(event).add(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    this._map.get(event)?.delete(handler)
  }

  emit(event, payload) {
    for (const handler of this._map.get(event) ?? []) {
      handler(payload)
    }
  }

  /** 清空某事件所有监听，房间切换时防止旧监听泄漏 */
  clear(event) {
    this._map.delete(event)
  }
}

export const bus = new EventBus()
