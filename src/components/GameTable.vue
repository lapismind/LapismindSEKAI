<script setup>
import { computed } from 'vue'
import PlayerSeat from './PlayerSeat.vue'
import { cardLabel } from '../game/cardDefs'

const props = defineProps({
  players: { type: Array, default: () => [] },
  currentPlayerId: { type: String, default: null },
  myPlayerId: { type: String, default: null },
  topCard: { type: Object, default: null },
  phase: { type: String, default: 'waiting' },
})

/** 自己固定放底部（主视角），其余人按座位顺时针围一圈 */
const layout = computed(() => {
  const idx = props.players.findIndex((p) => p.id === props.myPlayerId)
  const n = props.players.length
  if (idx === -1) return { me: null, others: props.players }
  const me = props.players[idx]
  const others = Array.from({ length: n - 1 }, (_, k) => props.players[(idx + 1 + k) % n])
  return { me, others }
})
</script>

<template>
  <div class="relative flex h-full flex-col">
    <!-- 中央牌面 -->
    <div class="flex min-h-24 flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-1">
        <span class="text-xs text-slate-500">{{ phase === 'ended' ? '本局结束' : '桌面' }}</span>
        <div class="flex items-center gap-2">
          <div
            v-if="topCard"
            class="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-xl font-bold text-slate-900 shadow-lg animate-card-flip"
          >
            {{ cardLabel(topCard) }}
          </div>
          <div v-else class="text-sm text-slate-600">等待首手…</div>
        </div>
      </div>
    </div>

    <!-- 其他玩家（手机：上一条，桌面：环绕左右） -->
    <div
      class="grid grid-cols-1 gap-2 px-2 sm:grid-cols-2 md:grid-cols-3"
      :class="layout.others.length === 1 ? '' : 'lg:grid-cols-4'"
    >
      <PlayerSeat
        v-for="p in layout.others"
        :key="p.id"
        :player="p"
        :is-active="p.id === currentPlayerId"
      />
    </div>

    <!-- 底部自己的座位 -->
    <div v-if="layout.me" class="mt-2">
      <PlayerSeat
        :player="layout.me"
        :is-me="true"
        :is-active="layout.me.id === currentPlayerId"
        :is-local-player="true"
      />
    </div>
  </div>
</template>
