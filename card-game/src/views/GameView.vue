<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import GameTable from '../components/GameTable.vue'
import PlayerHand from '../components/PlayerHand.vue'
import TurnTimer from '../components/TurnTimer.vue'
import GameLog from '../components/GameLog.vue'
import { useGameStore } from '../stores/gameStore'

const game = useGameStore()

const turnCount = ref(0)
let unbind = null
let openOff = null

onMounted(() => {
  unbind = game.bindServer()
  openOff = game.onConnected(() => {
    turnCount.value = 0
  })
})

onBeforeUnmount(() => {
  unbind?.()
  openOff?.()
})

watch(
  () => game.currentPlayerId,
  () => {
    turnCount.value += 1
  },
)

function handlePlay(cards) {
  game.playCard(cards[0])
}

function handleSkip() {
  game.skipTurn()
  turnCount.value += 1
}

function handleLeave() {
  game.disconnect()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- 顶栏 -->
    <header class="flex items-center justify-between border-b border-slate-800 px-3 py-2">
      <div class="text-sm font-semibold text-slate-300">房间 {{ game.roomId }}</div>
      <div class="flex items-center gap-3">
        <TurnTimer
          :active="game.isMyTurn && game.phase === 'playing'"
          :reset-key="`${game.currentPlayerId}-${turnCount}`"
        />
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
          @click="handleLeave"
        >
          离开
        </button>
      </div>
    </header>

    <!-- 牌桌 -->
    <main class="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_40%,#1e3a2f,#0f172a)]">
      <GameTable
        :players="game.players"
        :current-player-id="game.currentPlayerId"
        :my-player-id="game.myPlayerId"
        :top-card="game.topCard"
        :phase="game.phase"
      />
    </main>

    <!-- 底部操作区：自己手牌 + 记录 -->
    <footer class="flex flex-col gap-2 border-t border-slate-800 bg-slate-900/80 px-2 py-2">
      <GameLog :log="game.playedLog" :my-player-id="game.myPlayerId" />

      <div v-if="game.phase === 'waiting'" class="flex justify-center py-2">
        <button
          type="button"
          class="rounded-full bg-emerald-600 px-8 py-2 font-bold text-white transition hover:bg-emerald-500"
          @click="game.setReady()"
        >
          准备
        </button>
      </div>

      <div v-else-if="game.phase === 'ended'" class="flex justify-center py-2 text-center">
        <div>
          <div class="text-lg font-bold text-amber-400">
            {{ game.winnerId === game.myPlayerId ? '你赢了！' : '本局结束' }}
          </div>
          <div class="text-xs text-slate-400">刷新页面或离开可开始新局</div>
        </div>
      </div>

      <PlayerHand
        v-else
        :cards="game.myHand"
        :interactive="game.isMyTurn && game.phase === 'playing'"
        :card-size="'md'"
        @play="handlePlay"
      />

      <div v-if="game.isMyTurn && game.phase === 'playing'" class="flex justify-center">
        <button
          type="button"
          class="rounded-full border border-slate-600 px-4 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
          @click="handleSkip"
        >
          跳过
        </button>
      </div>

      <div v-if="game.error" class="text-center text-xs text-red-400">{{ game.error }}</div>
    </footer>
  </div>
</template>
