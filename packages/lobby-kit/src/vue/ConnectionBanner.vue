<script setup>
/**
 * ConnectionBanner.vue —— 连接中断 / 已断开时的可见状态。
 *
 * 为什么需要它：ws-client 在重试耗尽后会放弃，而**放弃原本是一个静默行为**——
 * 客户端不再有任何动作，界面上还留着最后一个画面。玩家看到的是"桌面上其他人都还在，
 * 只是没人动"，于是等一个永远不会来的操作；实际这一局对他来说已经废了。
 * 掉线必须说出来，并且给一个能按的重连入口。
 *
 * 两档：
 *   reconnecting  顶部细条，不挡操作（多数情况几秒内就恢复）
 *   offline       居中卡片，挡住游戏界面 —— 此时点任何按钮都发不出去，
 *                 让玩家继续点只会加深"游戏卡了"的误解
 *
 * 颜色写成 var(--令牌, 旧值)：引了 design-kit 的项目跟着令牌走（含深色主题），
 * 没引的项目用 fallback。lobby-kit 不依赖 design-kit。
 */
const props = defineProps({
  status: { type: String, required: true }, // idle | connecting | open | reconnecting | offline
  attempt: { type: Number, default: 0 }, // 已重试次数
  maxRetry: { type: Number, default: 5 },
})

const emit = defineEmits(['retry'])
</script>

<template>
  <!-- 重连中：顶部细条，不挡画面 -->
  <div v-if="status === 'reconnecting'" class="lk-conn-strip" role="status">
    <span class="lk-conn-dot" aria-hidden="true"></span>
    <span>
      连接中断，正在重连…（第 <span class="lk-conn-num">{{ attempt }}</span> /
      <span class="lk-conn-num">{{ maxRetry }}</span> 次）
    </span>
  </div>

  <!-- 已放弃：居中卡片，挡住界面并给出唯一有效的动作 -->
  <div v-else-if="status === 'offline'" class="lk-conn-mask" role="alert" aria-live="assertive">
    <div class="lk-conn-card">
      <div class="lk-conn-icon" aria-hidden="true">⚠</div>
      <h2 class="lk-conn-title">连接已断开</h2>
      <p class="lk-conn-body">
        自动重连了 <span class="lk-conn-num">{{ maxRetry }}</span> 次都没成功。
        现在这幅画面已经不再更新，你的操作也发不出去 —— 桌上其他人看到的还是你掉线前的状态。
      </p>
      <p class="lk-conn-hint">网络恢复后点下面重新连接，牌局还在，会接着打。</p>
      <button type="button" class="lk-conn-btn" @click="emit('retry')">重新连接</button>
    </div>
  </div>
</template>

<style scoped>
.lk-conn-num {
  font-variant-numeric: tabular-nums;
}

/* ── 重连中：顶部细条 ── */
.lk-conn-strip {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  background: var(--danger-soft, #fdecea);
  color: var(--danger, #c0392b);
  border-bottom: 1px solid var(--danger-line, #f5c6c0);
}
.lk-conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: currentColor;
  animation: lk-conn-pulse 1.2s ease-in-out infinite;
}
@keyframes lk-conn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lk-conn-dot {
    animation: none;
  }
}

/* ── 已断开：居中卡片 ── */
.lk-conn-mask {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--overlay, rgba(20, 20, 30, 0.45));
  backdrop-filter: blur(2px);
}
.lk-conn-card {
  width: 100%;
  max-width: 380px;
  padding: 24px 22px;
  text-align: center;
  background: var(--card-solid, #ffffff);
  border: 1px solid var(--line, #d8d0e4);
  border-radius: var(--radius, 18px);
  box-shadow: var(--shadow-lg, 0 4px 12px rgba(0, 0, 0, 0.08), 0 24px 60px rgba(0, 0, 0, 0.13));
}
.lk-conn-icon {
  font-size: 28px;
  line-height: 1;
  color: var(--danger, #c0392b);
}
.lk-conn-title {
  margin: 10px 0 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ink, #333333);
}
.lk-conn-body {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-soft, #555555);
}
.lk-conn-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted, #8a8299);
}
.lk-conn-btn {
  margin-top: 18px;
  width: 100%;
  min-height: var(--tap-min, 44px);
  border: 0;
  border-radius: 12px;
  background: var(--primary, #6b6bd0);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: filter var(--dur-fast, 0.22s) var(--ease-soft, cubic-bezier(0.22, 1, 0.36, 1));
}
.lk-conn-btn:hover {
  filter: brightness(1.06);
}
.lk-conn-btn:focus-visible {
  outline: 2px solid var(--primary-bright, #8888cc);
  outline-offset: 2px;
}
</style>
