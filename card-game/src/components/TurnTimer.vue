<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  seconds: { type: Number, default: 30 },
  active: { type: Boolean, default: true },
  resetKey: { type: [Number, String], default: 0 },
})

const remaining = ref(props.seconds)
const total = computed(() => props.seconds)

let timer = null

function reset() {
  remaining.value = props.seconds
}

function start() {
  clearInterval(timer)
  timer = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1)
    if (remaining.value === 0) clearInterval(timer)
  }, 1000)
}

watch(
  () => [props.active, props.resetKey, props.seconds],
  () => {
    if (props.active) {
      reset()
      start()
    } else {
      clearInterval(timer)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => clearInterval(timer))

const pct = computed(() => (remaining.value / total.value) * 100)
const urgent = computed(() => remaining.value <= 5 && remaining.value > 0)
</script>

<template>
  <div
    class="flex items-center gap-2"
    :class="[active ? 'opacity-100' : 'opacity-40']"
  >
    <div class="relative h-2 w-28 overflow-hidden rounded-full bg-slate-700">
      <div
        class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear"
        :class="urgent ? 'bg-red-500' : 'bg-emerald-400'"
        :style="{ width: pct + '%' }"
      />
    </div>
    <span
      class="text-sm font-mono tabular-nums"
      :class="urgent ? 'font-bold text-red-400' : 'text-slate-300'"
    >
      {{ remaining }}s
    </span>
  </div>
</template>
