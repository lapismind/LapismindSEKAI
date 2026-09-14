<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { callCost, priceFor } from '../core/betting'

const props = defineProps({
  currentBet: { type: Number, default: 0 }, // 当前档位（闷牌轮里闷牌者只需付一半）
  myBet: { type: Number, default: 0 }, // 我已投入的筹码
  myChips: { type: Number, default: 0 },
  enabled: { type: Boolean, default: false }, // 是否轮到我可操作
  locked: { type: Boolean, default: false }, // 已提交、等服务端确认：期间禁用操作防重复下注
  halfPrice: { type: Boolean, default: false }, // 当前是否闷牌轮（本轮启用半价）
  myBlind: { type: Boolean, default: false }, // 我本轮还没看牌
  timeoutMs: { type: Number, default: 30000 },
})

const emit = defineEmits(['bet', 'look'])

const raiseAmount = ref(0)
const timeLeft = ref(Math.ceil(props.timeoutMs / 1000))
let timer = null
let deadlineTs = 0

// 与服务端共用 core/betting 的换算，避免两边各写一份半价规则而慢慢漂移
const roundLike = computed(() => ({ currentLevel: props.currentBet, halfPrice: props.halfPrice }))
const meLike = computed(() => ({ bet: props.myBet, blind: props.myBlind }))

const toCall = computed(() => callCost(roundLike.value, meLike.value))
// 闷牌者每 2 点档位只付 1 点，所以同样的筹码能顶到更高的档位
const levelRate = computed(() => (props.halfPrice && props.myBlind ? 2 : 1))
const maxRaiseTo = computed(() => props.myBet + props.myChips * levelRate.value)
const minRaiseTo = computed(() =>
  Math.min(props.currentBet + Math.max(props.currentBet, 10), maxRaiseTo.value),
)
const canRaise = computed(
  () => props.enabled && props.myChips > toCall.value && maxRaiseTo.value > props.currentBet,
)
const raisePrice = computed(() => {
  const target = Number(raiseAmount.value)
  if (!target || target <= props.currentBet) return null
  return priceFor(roundLike.value, meLike.value, target)
})
const raiseAffordable = computed(
  () => raisePrice.value !== null && raisePrice.value <= props.myChips,
)
// 闷牌轮不允许全下：全下筹码按档位怎么折算没有直觉答案，要求先看牌
const canAllIn = computed(() => !(props.halfPrice && props.myBlind))

function tick() {
  timeLeft.value = Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000))
  if (timeLeft.value <= 0) {
    clearInterval(timer)
    // 归零后仅保留红色视觉标记，超时弃牌由服务端 Alarm 处理
  }
}

function startCountdown() {
  clearInterval(timer)
  deadlineTs = Date.now() + props.timeoutMs
  timeLeft.value = Math.ceil(props.timeoutMs / 1000)
  timer = setInterval(tick, 500)
}

// 每次轮到我（enabled 由 false 变 true）都重新计时，避免沿用上一回合的旧进度
watch(
  () => props.enabled,
  (enabled) => {
    if (enabled) {
      startCountdown()
    } else {
      clearInterval(timer)
      timeLeft.value = Math.ceil(props.timeoutMs / 1000)
    }
  },
)

onMounted(() => {
  if (props.enabled) startCountdown()
})
onUnmounted(() => clearInterval(timer))

function doCall() {
  emit('bet', { action: 'call' })
}
function doRaise() {
  emit('bet', { action: 'raise', amount: Number(raiseAmount.value) })
}
function doFold() {
  emit('bet', { action: 'fold' })
}
function doAllIn() {
  emit('bet', { action: 'all-in' })
}
function doLook() {
  emit('look')
}
</script>

<template>
  <div class="rounded-2xl border border-[#D8D0E4] bg-white/95 p-4 shadow-lg backdrop-blur">
    <!-- 倒计时 -->
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs text-[#8A8299]">行动倒计时</span>
      <span class="font-num text-sm font-bold" :class="timeLeft <= 5 ? 'text-red-600' : 'text-[#333333]'">
        {{ timeLeft }}s
      </span>
    </div>
    <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-brand-100">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="timeLeft <= 5 ? 'bg-red-500' : 'bg-brand-500'"
        :style="{ width: `${(timeLeft / (props.timeoutMs / 1000)) * 100}%` }"
      ></div>
    </div>

    <div v-if="enabled" class="flex flex-col gap-2">
      <!-- 闷牌中：先给一个明确的二选一 -->
      <div v-if="halfPrice && myBlind" class="rounded-xl bg-brand-100 px-3 py-2">
        <p class="text-xs font-semibold text-brand-700">闷牌中 · 下注半价</p>
        <p class="mt-0.5 text-[11px] leading-4 text-[#5F586B]">
          你还没看这张牌。看牌后恢复全价，但要补齐之前省下的差额。
        </p>
        <button
          type="button"
          class="mt-2 min-h-[36px] w-full rounded-lg border border-brand-300 bg-white text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          :disabled="locked"
          :class="locked ? 'opacity-40' : ''"
          @click="doLook"
        >👁 看牌</button>
      </div>

      <div class="text-sm text-[#5F586B]">
        跟注 <span class="font-num font-bold text-brand-700">{{ toCall }}</span>
        <span class="text-xs text-[#8A8299]">（我还有 {{ myChips }}）</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="min-h-[44px] rounded-lg bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-500 disabled:opacity-40"
          :disabled="locked"
          @click="doCall"
        >
          跟注 <span class="font-num">{{ toCall }}</span>
          <span v-if="halfPrice && myBlind" class="ml-1 text-[11px] font-normal opacity-90">半价</span>
        </button>
        <button
          type="button"
          class="min-h-[44px] rounded-lg border border-red-200 bg-white py-2.5 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
          :disabled="locked"
          @click="doFold"
        >
          弃牌
        </button>

        <button
          v-if="canAllIn"
          type="button"
          class="min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 py-2.5 font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
          :disabled="locked"
          @click="doAllIn"
        >
          ALL IN <span class="font-num">{{ myChips }}</span>
        </button>
        <p v-else class="flex min-h-[44px] items-center justify-center rounded-lg bg-brand-50 px-2 text-center text-[11px] leading-4 text-[#8A8299]">
          闷牌时不能全下<br />先看牌再压
        </p>

        <div class="flex gap-2">
          <input
            v-model.number="raiseAmount"
            type="number"
            :min="minRaiseTo"
            :max="maxRaiseTo"
            :disabled="locked"
            class="font-num w-full rounded-lg border border-[#D8D0E4] bg-white px-2 py-2.5 text-center text-sm font-bold text-[#333333] outline-none focus:border-brand-500 disabled:opacity-40"
            placeholder="加注到"
          />
          <button
            type="button"
            class="min-h-[44px] whitespace-nowrap rounded-lg border border-brand-300 bg-white px-3 py-2.5 font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
            :disabled="locked || !canRaise || !raiseAffordable"
            @click="doRaise"
          >
            加注
          </button>
        </div>
      </div>

      <p v-if="raisePrice !== null && !raiseAffordable" class="text-[11px] text-red-600">
        加到 {{ raiseAmount }} 需要 {{ raisePrice }} 筹码，不够
      </p>
      <p v-else-if="halfPrice && myBlind" class="text-[11px] text-[#8A8299]">
        加注同样按半价支付
      </p>
    </div>
    <div v-else class="text-center text-sm text-[#8A8299]">
      等待其他玩家行动…
    </div>
  </div>
</template>
