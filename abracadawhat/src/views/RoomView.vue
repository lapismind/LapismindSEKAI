<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useLobbyStore } from '../stores/lobbyStore'
import { useGameStore } from '../stores/gameStore'
import PlayerZone from '../components/PlayerZone.vue'
import CastPanel from '../components/CastPanel.vue'
import CastFeedback from '../components/CastFeedback.vue'
import PublicArea from '../components/PublicArea.vue'
import GameHelp from '../components/GameHelp.vue'
import { avatarUrl } from '../game/avatars'
import {
  buildInviteUrl,
  copyToClipboard,
  generateRoomCode,
} from '@lapismind/lobby-kit'

const route = useRoute()
const lobby = useLobbyStore()
const game = useGameStore()

const roomCode = computed(() => (route.params.code ?? '').toString().toUpperCase())
const helpOpen = ref(false)
const copied = ref(false)
let unsubs = []

onMounted(() => {
  if (!game.inRoom || game.roomId !== roomCode.value) {
    game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
    unsubs = game.hydrate({
      onCastResult: () => {},
      onRoundEnd: () => {},
    })
  }
})

onUnmounted(() => {
  unsubs.forEach(u => u())
  game.disconnect()
})

const isHost = computed(() => game.roomState?.hostId === game.myPlayerId)
const me = computed(() => game.roomState?.players.find(p => p.id === game.myPlayerId))
const isMyTurn = computed(() => game.roomState?.currentPlayerId === game.myPlayerId)

async function copyInvite() {
  const url = buildInviteUrl(window.location.origin, roomCode.value)
  try {
    await copyToClipboard(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    alert('复制链接：' + url)
  }
}
</script>

<template>
  <div class="mx-auto min-h-full max-w-6xl px-4 py-4">
    <!-- 顶栏 -->
    <header class="mb-3 flex items-center justify-between gap-2">
      <div class="flex items-baseline gap-3">
        <h1 class="text-lg font-bold text-[#333333]">🧙 出包魔法师</h1>
        <span class="text-xs text-[#8A8299]">房间号: {{ roomCode }}</span>
        <span v-if="game.roomState && game.roomState.round > 0" class="text-sm text-brand-600">
          【第 {{ game.roomState.round }} 轮】
        </span>
      </div>
      <div class="flex gap-1.5">
        <button type="button" class="rounded-lg border border-[#CFCFE9] bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 hover:border-brand-300 hover:text-brand-500" @click="helpOpen = true">
          📖 规则
        </button>
        <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500" @click="copyInvite">
          {{ copied ? '✓ 已复制' : '🔗 邀请' }}
        </button>
      </div>
    </header>

    <!-- 等待中 -->
    <div v-if="!game.roomState || game.roomState.phase === 'waiting'" class="flex flex-col items-center justify-center gap-4 py-16">
      <p class="text-lg text-[#444444]">等待玩家加入（{{ game.roomState?.players.length ?? 0 }}/5）…</p>
      <div class="flex flex-wrap justify-center gap-2">
        <div
          v-for="p in game.roomState?.players ?? []"
          :key="p.id"
          class="flex items-center gap-1.5 rounded-full border border-[#D8D0E4] bg-white px-3 py-1.5 text-sm text-[#333333]"
        >
          <img :src="avatarUrl(p.avatarId)" :alt="p.nickname" class="h-6 w-6 rounded-full object-cover" />
          <span>{{ p.isHost ? '👑 ' : '' }}{{ p.nickname }}</span>
        </div>
      </div>
      <button
        v-if="isHost && (game.roomState?.players.length ?? 0) >= 2"
        type="button"
        class="mt-4 rounded-xl bg-brand-600 px-8 py-3 font-bold text-white shadow-lg hover:bg-brand-500"
        @click="game.startRound()"
      >
        🎲 开始游戏
      </button>
      <p v-if="isHost && (game.roomState?.players.length ?? 0) < 2" class="text-sm text-[#8A8299]">
        至少需要 2 名玩家才能开始
      </p>
    </div>

    <!-- 游戏中 -->
    <template v-else>
      <!-- 公共区 -->
      <PublicArea
        :cast-counts="game.roomState.castCounts ?? {}"
        :deck-remaining="game.roomState.deckRemaining ?? 0"
        :secret-pile-remaining="game.roomState.secretPileRemaining ?? 0"
      />

      <!-- 回合提示 -->
      <div class="my-3 text-center text-sm">
        <span v-if="isMyTurn" class="font-bold text-brand-600">轮到你施法了！</span>
        <span v-else class="text-[#8A8299]">
          等待 {{ game.roomState.players.find(p => p.id === game.roomState.currentPlayerId)?.nickname ?? '…' }} 施法…
        </span>
      </div>

      <!-- 牌桌：每人一行，按加入房间的座位顺序排 -->
      <div class="flex flex-col gap-3">
        <PlayerZone
          v-for="(p, i) in game.roomState?.players ?? []"
          :key="p.id"
          :player="p.id === game.myPlayerId ? { ...p, hand: [] } : p"
          :is-me="p.id === game.myPlayerId"
          :is-current="game.roomState.currentPlayerId === p.id"
        />
      </div>

      <!-- 施法区 -->
      <CastPanel
        class="mt-3"
        :my-hand-size="game.myHandSize"
        :last-cast-level="game.roomState.lastCastLevel"
        :cast-counts="game.roomState.castCounts ?? {}"
        :is-my-turn="isMyTurn"
        :has-successful-cast="!!game.roomState.castSucceeded?.[game.myPlayerId]"
        :has-failed-cast="!!game.roomState.castFailed?.[game.myPlayerId]"
        @cast="game.cast($event)"
        @end-turn="game.endTurn()"
      />

      <!-- 施法结果反馈 -->
      <CastFeedback />

      <!-- 我的秘密牌 -->
      <div v-if="game.mySecrets.length > 0" class="mt-3 rounded-xl border border-[#B3B3DD]/50 bg-brand-100 p-3">
        <div class="text-xs text-brand-700">🔮 你的秘密牌 ×{{ game.mySecrets.length }}（轮末存活时每张 +1 分）</div>
      </div>

      <!-- 回合结算弹窗 -->
      <div v-if="game.roundEndSummary" class="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h3 class="mb-3 text-center text-xl font-bold text-[#333333]">本轮结束</h3>
          <div class="space-y-2">
            <div
              v-for="(row, i) in game.roomState.summary?.standings ?? []"
              :key="row.id"
              class="flex items-center justify-between rounded-lg bg-[#F7EFF8] px-3 py-2"
            >
              <span class="text-sm text-[#333333]">{{ row.nickname }}</span>
              <span class="font-bold" :class="i === 0 ? 'text-amber-500' : 'text-[#444444]'">{{ row.score }} 分</span>
            </div>
          </div>
          <button
            v-if="isHost"
            type="button"
            class="mt-4 w-full rounded-xl bg-brand-600 py-3 font-bold text-white hover:bg-brand-500"
            @click="game.nextRound()"
          >
            下一轮
          </button>
          <p v-else class="mt-3 text-center text-xs text-[#8A8299]">等待房主开启下一轮…</p>
        </div>
      </div>

      <!-- 整场结束 -->
      <div v-if="game.lastGameOver" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-md rounded-2xl bg-gradient-to-b from-brand-100 to-white p-8 text-center shadow-2xl">
          <div class="text-5xl">🏆</div>
          <h3 class="mt-3 text-2xl font-bold text-[#333333]">
            {{ game.lastGameOver.standings[0]?.nickname }} 获胜！
          </h3>
          <div class="mt-4 space-y-1.5">
            <div
              v-for="(row, i) in game.lastGameOver.standings"
              :key="row.id"
              class="flex items-center justify-between rounded-lg bg-[#F7EFF8] px-3 py-2 text-sm"
            >
                <span class="text-[#333333]">{{ i + 1 }}. {{ row.nickname }}</span>
                <span class="font-bold text-amber-600">{{ row.score }} 分</span>
            </div>
          </div>
          <!-- 新达成成就（上报后由 auth Worker 返回，可能比 game_over 晚 1-2 秒） -->
          <div v-if="game.newAchievements.length" class="mt-4 space-y-2">
            <div
              v-for="a in game.newAchievements"
              :key="a.key + a.playerId"
              class="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-left"
            >
              <div class="text-sm font-bold text-amber-700">
                {{ '★'.repeat(a.stars) || '🥚' }} {{ a.name }}
              </div>
              <div class="text-xs text-[#8A8299]">{{ a.desc }}</div>
              <div class="mt-1 text-xs text-[#8A8299]">
                {{ game.lastGameOver.standings.find(s => s.id === a.playerId)?.nickname || '' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <GameHelp :open="helpOpen" @close="helpOpen = false" />

    <!-- 错误提示 -->
    <div
      v-if="game.error"
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600/90 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ game.error }}
    </div>
  </div>
</template>
