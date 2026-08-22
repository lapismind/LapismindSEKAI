<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import PlayerSeat from '../components/PlayerSeat.vue'
import BetPanel from '../components/BetPanel.vue'
import GameHelp from '../components/GameHelp.vue'
import Card from '../components/Card.vue'
import { avatarUrl } from '../game/avatars'

const route = useRoute()
const game = useGameStore()
const lobby = useLobbyStore()

const roomCode = computed(() => String(route.params.code || '').toUpperCase())
const showConfig = ref(false)
const showHelp = ref(false)
const configMode = ref('five')
const configRounds = ref(10)
const configChips = ref(1000)

const me = computed(() =>
  game.roomState?.players.find((p) => p.id === game.myPlayerId),
)
const isHost = computed(() => game.roomState?.hostId === game.myPlayerId)
const myTurn = computed(() => game.roomState?.currentPlayerId === game.myPlayerId)
const players = computed(() => game.roomState?.players ?? [])
const seats = computed(() => players.value.filter((p) => p.role === 'player'))
const pot = computed(() => game.roomState?.pot ?? 0)

// 我的手牌视图：观众看上帝视角，玩家看自己的
const myDisplayHand = computed(() => {
  if (game.myRole === 'spectator') return []
  return game.myHand
})
const myBet = computed(() => me.value?.bet ?? 0)
const myChips = computed(() => me.value?.chips ?? 0)

onMounted(() => {
  game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
  unsub = game.hydrate({})
})
let unsub = null
onUnmounted(() => {
  unsub?.()
  game.disconnect()
})

function saveConfig() {
  game.setHostConfig({
    mode: configMode.value,
    rounds: configRounds.value,
    initialChips: configChips.value,
  })
  showConfig.value = false
}

function doBet(payload) {
  game.sendBet(payload.action, payload.amount)
}

function nextHand() {
  game.startGame()
}

function closeShowdown() {
  game.clearShowdown()
}

// 观众视角：从 spectate_state 拿全桌完整牌
const spectateHand = computed(() => {
  if (game.myRole !== 'spectator' || !game.spectateState) return {}
  const map = {}
  for (const p of game.spectateState.players) map[p.id] = p.cards
  return map
})

function seatHand(playerId) {
  if (game.myRole === 'spectator') return spectateHand.value[playerId] ?? []
  if (playerId === game.myPlayerId) return game.myHand
  return []
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100">
    <!-- 顶部栏 -->
    <header class="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <a href="/" class="text-sm text-slate-400 hover:text-slate-200">← 退出</a>
        <span class="font-mono text-sm font-bold text-brand-300">房间 {{ roomCode }}</span>
        <span class="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
          {{ game.roomState?.config.mode === 'seven' ? '七张梭哈' : '五张梭哈' }}
        </span>
        <span class="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
          第 {{ game.roomState?.round ?? 0 }} / {{ game.roomState?.config.rounds ?? 10 }} 局
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-600"
          @click="showHelp = true"
        >
          规则
        </button>
        <span v-if="game.myRole === 'spectator'" class="rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs text-amber-300">
          观众
        </span>
        <button
          v-if="isHost && game.phase === 'waiting'"
          class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-600"
          @click="showConfig = true"
        >
          房间设置
        </button>
        <button
          v-if="isHost && game.phase === 'waiting'"
          class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold transition hover:bg-brand-500"
          @click="nextHand"
        >
          开始游戏
        </button>
        <button
          v-if="isHost && game.phase === 'settled' && !game.roomState?.finished"
          class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold transition hover:bg-emerald-500"
          @click="nextHand"
        >
          下一局
        </button>
        <span
          v-else-if="game.phase === 'settled' && game.roomState?.finished"
          class="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs text-emerald-300"
        >
          🏆 整场结束
        </span>
      </div>
    </header>

    <!-- 房间设置弹层 -->
    <div v-if="showConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h2 class="mb-4 text-lg font-bold">房间设置</h2>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-500">玩法</label>
          <div class="flex gap-2">
            <button
              class="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
              :class="configMode === 'five' ? 'bg-brand-600' : 'bg-slate-800 hover:bg-slate-700'"
              @click="configMode = 'five'"
            >五张梭哈</button>
            <button
              class="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
              :class="configMode === 'seven' ? 'bg-brand-600' : 'bg-slate-800 hover:bg-slate-700'"
              @click="configMode = 'seven'"
            >七张梭哈</button>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-500">局数</label>
          <input v-model.number="configRounds" type="number" min="1" max="100"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-brand-500" />
        </div>
        <div class="mb-6">
          <label class="mb-1 block text-xs text-slate-500">初始筹码</label>
          <input v-model.number="configChips" type="number" min="100" step="100"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:border-brand-500" />
        </div>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-slate-700 py-2.5 text-sm font-bold" @click="showConfig = false">取消</button>
          <button class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold hover:bg-brand-500" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>

    <!-- 牌桌 -->
    <main class="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6">
      <!-- 底池 -->
      <div class="flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-900/20 px-5 py-2">
        <span class="text-sm text-amber-300">底池</span>
        <span class="text-lg font-bold text-amber-200">🪙 {{ pot }}</span>
      </div>

      <!-- 座位（环形/网格布局） -->
      <div class="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        <PlayerSeat
          v-for="p in seats"
          :key="p.id"
          :player="p"
          :hand="seatHand(p.id)"
          :is-me="p.id === game.myPlayerId"
          :is-active="p.id === game.roomState?.currentPlayerId"
          :spectate="game.myRole === 'spectator'"
        />
      </div>

      <!-- 操作区 -->
      <div class="w-full max-w-md">
        <!-- 房主等待区 -->
        <div v-if="isHost && game.phase === 'waiting'" class="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 text-center">
          <p class="text-sm text-slate-300">等待玩家加入…（至少 2 人开局）</p>
          <p class="mt-1 text-xs text-slate-500">分享链接邀请好友加入</p>
        </div>

        <!-- 玩家下注 -->
        <BetPanel
          v-if="game.myRole === 'player' && game.phase === 'playing'"
          :current-bet="game.roomState?.currentBet ?? 0"
          :my-bet="myBet"
          :my-chips="myChips"
          :enabled="myTurn"
          @bet="doBet"
        />

        <!-- 观众提示 -->
        <div v-if="game.myRole === 'spectator' && game.phase === 'playing'" class="rounded-2xl border border-amber-700/40 bg-amber-900/10 p-4 text-center">
          <p class="text-sm text-amber-200">👀 你在观众席，可查看所有玩家的手牌</p>
        </div>

        <!-- 错误提示 -->
        <div v-if="game.error" class="mt-2 rounded-lg bg-red-900/40 px-4 py-2 text-center text-sm text-red-300">
          {{ game.error }}
        </div>
      </div>
    </main>

    <!-- 规则说明 -->
    <GameHelp
      v-if="showHelp"
      :mode="game.roomState?.config.mode ?? 'five'"
      @close="showHelp = false"
    />

    <!-- 摊牌结果弹层 -->
    <div v-if="game.showdown" class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" @click.self="closeShowdown">
      <div class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xl font-bold text-white">摊牌</h2>
          <button class="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-600" @click="closeShowdown">
            关闭
          </button>
        </div>
        <div class="mb-4 space-y-2">
          <div
            v-for="h in game.showdown.hands"
            :key="h.playerId"
            class="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-2.5"
          >
            <div class="flex items-center gap-2">
              <img v-if="avatarUrl(players.find(p => p.id === h.playerId)?.avatarId)"
                :src="avatarUrl(players.find(p => p.id === h.playerId)?.avatarId)"
                class="h-8 w-8 rounded-full object-cover" />
              <div>
                <div class="text-sm font-bold text-white">{{ h.nickname }}</div>
                <div class="text-xs text-slate-400">{{ h.folded ? '弃牌' : (h.handName || '') }}</div>
              </div>
            </div>
            <div v-if="!h.folded" class="flex gap-0.5">
              <Card v-for="(c, i) in h.cards" :key="i" :card="{ ...c, hidden: false }" size="sm" />
            </div>
          </div>
        </div>
        <div class="mb-4 text-center">
          <span class="text-sm text-amber-300">赢家</span>
          <span class="ml-2 text-lg font-bold text-amber-200">
            {{ game.showdown.winners.map(w => players.find(p => p.id === w.playerId)?.nickname || w.playerId).join(', ') }}
            +{{ game.showdown.winners.reduce((s, w) => s + w.amount, 0) }}
          </span>
        </div>
        <div v-if="game.lastGameOver" class="mb-4 rounded-xl bg-slate-800 px-4 py-3">
          <div class="text-center text-xs text-slate-400">当前积分</div>
          <div class="mt-1 flex justify-center gap-4 text-sm">
            <span v-for="s in [...game.lastGameOver.standings].sort((a, b) => b.chips - a.chips).slice(0, 3)" :key="s.playerId"
              class="font-bold" :class="s.playerId === game.myPlayerId ? 'text-brand-300' : 'text-slate-200'">
              {{ players.find(p => p.id === s.playerId)?.nickname }}: {{ s.chips }}
            </span>
          </div>
        </div>
        <div class="flex justify-center">
          <button
            class="rounded-lg bg-brand-600 px-6 py-2.5 font-bold text-white transition hover:bg-brand-500"
            @click="closeShowdown"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
