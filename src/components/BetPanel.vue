<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  currentBet: { type: Number, default: 0 }, // 当前最高注额
  myBet: { type: Number, default: 0 }, // 我已投入
  myChips: { type: Number, default: 0 },
  enabled: { type: Boolean, default: false }, // 是否轮到我可操作
  timeoutMs: { type: Number, default: 30000 },
})

const emit = defineEmits(['bet'])

const raiseAmount = ref(0)
const timeLeft = ref(props.timeoutMs / 1000)
let timer = null

const toCall = computed(() => Math.max(0, props.currentBet - props.myBet))
const minRaise = computed(() => props.currentBet + Math.max(props.currentBet, 10))
const canRaise = computed(() => props.enabled && props.myChips > toCall.value && props.myChips >= minRaise.value - props.myBet)

function tick() {
  timeLeft.value = Math.max(0, Math.round((Date.now() - startTs) / 1000))
  if (timeLeft.value <= 0) {
    emit('bet', { action: 'fold', timeout: true })
    clearInterval(timer)
  }
}

let startTs = Date.now()
onMounted(() => {
  startTs = Date.now()
  timer = setInterval(tick, 500)
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
</script>

<template>
  <div class="rounded-2xl border border-slate-700 bg-slate-800/80 p-4">
    <!-- 倒计时 -->
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs text-slate-400">行动倒计时</span>
      <span class="font-mono text-sm font-bold" :class="timeLeft <= 5 ? 'text-red-400' : 'text-slate-200'">
        {{ timeLeft }}s
      </span>
    </div>
    <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-700">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="timeLeft <= 5 ? 'bg-red-500' : 'bg-brand-500'"
        :style="{ width: `${(timeLeft / (props.timeoutMs / 1000)) * 100}%` }"
      ></div>
    </div>

    <div v-if="enabled" class="flex flex-col gap-2">
      <div class="text-sm text-slate-300">
        跟注 <span class="font-bold text-white">{{ toCall }}</span>（我还有 {{ myChips }}）
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          class="rounded-lg bg-slate-600 py-2.5 font-bold text-white transition hover:bg-slate-500"
          @click="doCall"
        >
          跟注 {{ toCall }}
        </button>
        <button
          class="rounded-lg bg-red-600 py-2.5 font-bold text-white transition hover:bg-red-500"
          @click="doFold"
        >
          弃牌
        </button>
        <button
          class="rounded-lg bg-amber-600 py-2.5 font-bold text-white transition hover:bg-amber-500"
          @click="doAllIn"
        >
          全下 {{ myChips }}
        </button>
        <div class="flex gap-2">
          <input
            v-model.number="raiseAmount"
            type="number"
            :min="minRaise"
            :max="myChips"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2.5 text-center text-sm font-bold text-white outline-none focus:border-brand-500"
            placeholder="加注额"
          />
          <button
            class="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2.5 font-bold text-white transition hover:bg-brand-500 disabled:opacity-40"
            :disabled="!canRaise || !raiseAmount || raiseAmount <= currentBet"
            @click="doRaise"
          >
            加注
          </button>
        </div>
      </div>
    </div>
    <div v-else class="text-center text-sm text-slate-500">
      等待其他玩家行动…
    </div>
  </div>
</template>
