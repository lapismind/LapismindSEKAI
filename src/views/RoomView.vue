<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import PlayerSeat from '../components/PlayerSeat.vue'
import BetPanel from '../components/BetPanel.vue'
import GameHelp from '../components/GameHelp.vue'
import Card from '../components/Card.vue'
import PokerTable from '../components/PokerTable.vue'
import ChipIcon from '../components/ChipIcon.vue'
import { avatarUrl } from '../game/avatars'
import { avatarChoices } from '../game/avatars'
import { buildInviteUrl, copyToClipboard } from '@lapismind/lobby-kit'
import { ProfileEditor } from '@lapismind/lobby-kit/vue'

const route = useRoute()
const game = useGameStore()
const lobby = useLobbyStore()

const roomCode = computed(() => String(route.params.code || '').toUpperCase())
const showConfig = ref(false)
const showProfile = ref(false)
const copied = ref(false)
const showHelp = ref(false)
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })
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
// 环形座位：把'我'旋转到 index 0，其余按原顺序排开
const ringSeats = computed(() => {
  const list = seats.value
  if (!list.length) return []
  const myIdx = list.findIndex((p) => p.id === game.myPlayerId)
  const start = myIdx >= 0 ? myIdx : 0
  return list.map((_, i) => list[(start + i) % list.length])
})
const pot = computed(() => game.roomState?.pot ?? 0)

// 虚拟牌桌坐标系：所有座位按 620×400 布局，再整体缩放适配屏幕
const STAGE_W = 1350
const STAGE_H = 900
const stageRef = ref(null)
const stageWrapRef = ref(null)
const stageScale = ref(1)

// 座位角度：i=0 固定底部中央（我自己），逆时针分布一圈
function seatXY(i, total) {
  const angle = Math.PI / 2 + (2 * Math.PI * i) / Math.max(total, 1)
  return {
    x: STAGE_W / 2 + 540 * Math.cos(angle),
    y: STAGE_H / 2 + 345 * Math.sin(angle),
  }
}
function seatStyle(i, total) {
  const pos = seatXY(i, total)
  return {
    left: pos.x * stageScale.value + 'px',
    top: pos.y * stageScale.value + 'px',
  }
}

function updateStageScale() {
  const availW = stageWrapRef.value?.clientWidth ?? STAGE_W
  const availH = Math.max(window.innerHeight - 300, 280)
  stageScale.value = Math.max(0.55, Math.min(1.6, availW / (STAGE_W + 20), availH / (STAGE_H + 20)))
}

// 我的手牌视图：观众看上帝视角，玩家看自己的
const myDisplayHand = computed(() => {
  if (game.myRole === 'spectator') return []
  return game.myHand
})
const myBet = computed(() => me.value?.bet ?? 0)
const myChips = computed(() => me.value?.chips ?? 0)

onMounted(() => {
  profileDraft.value = { nickname: lobby.myNickname, avatarId: lobby.myAvatarId }
  game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
  unsub = game.hydrate({})
  updateStageScale()
  window.addEventListener('resize', updateStageScale)
})
let unsub = null
onUnmounted(() => {
  unsub?.()
  window.removeEventListener('resize', updateStageScale)
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

function openProfile() {
  profileDraft.value = { nickname: lobby.myNickname, avatarId: lobby.myAvatarId }
  showProfile.value = true
}

async function copyRoomLink() {
   const url = buildInviteUrl(window.location.origin, roomCode.value)
   try {
     await copyToClipboard(url)
     copied.value = true
     setTimeout(() => (copied.value = false), 2000)
   } catch {
     alert('复制链接：' + url)
   }
}

function saveProfile() {
   lobby.setNickname(profileDraft.value.nickname)
   lobby.setAvatar(profileDraft.value.avatarId)
   showProfile.value = false
   // 重连以更新服务端昵称/头像
   game.disconnect()
   game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
   unsub?.()
   unsub = game.hydrate({})
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
    <div class="flex min-h-screen flex-col bg-gradient-to-br from-[#f7eff8] via-[#f2ebf7] to-[#ede6f3] text-slate-700">
    <!-- 顶部栏 -->
    <header class="flex items-center justify-between border-b border-brand-200/60 bg-white/70 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <a href="/" class="text-sm text-slate-500 hover:text-slate-700">← 退出</a>
        <span class="font-mono text-sm font-bold text-brand-300">房间 {{ roomCode }}</span>
        <button
          class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1 text-xs font-bold text-slate-800 transition hover:bg-slate-600"
          @click="copyRoomLink"
        >
          {{ copied ? "✓ 已复制" : "U0001F517 邀请链接" }}
        </button>
        <span class="rounded-full bg-brand-100/70 px-2.5 py-0.5 text-xs text-slate-600">
          {{ game.roomState?.config.mode === 'seven' ? '七张梭哈' : '五张梭哈' }}
        </span>
        <span class="rounded-full bg-brand-100/70 px-2.5 py-0.5 text-xs text-slate-600">
          第 {{ game.roomState?.round ?? 0 }} / {{ game.roomState?.config.rounds ?? 10 }} 局
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-600"
          @click="showHelp = true"
        >
          规则
        </button>
        <button
          class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-600"
          @click="openProfile"
        >
          ⚙️ 我
        </button>
        <span v-if="game.myRole === 'spectator'" class="rounded-full bg-amber-900/50 px-2.5 py-0.5 text-xs text-amber-300">
          观众
        </span>
        <button
          v-if="isHost && game.phase === 'waiting'"
          class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-600"
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

    <!-- 个人资料编辑弹层 -->
    <div v-if="showProfile" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold">⚙️ 我的资料</h2>
        <ProfileEditor
          v-model="profileDraft"
          :avatar-choices="avatarChoices"
        />
        <div class="mt-6 flex gap-2">
          <button class="flex-1 rounded-lg bg-brand-100 hover:bg-brand-200 py-2.5 text-sm font-bold" @click="showProfile = false">取消</button>
          <button class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold hover:bg-brand-500" @click="saveProfile">保存</button>
        </div>
      </div>
    </div>

  <!-- 房间设置弹层 -->
  <div v-if="showConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div class="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6">
      <h2 class="mb-4 text-lg font-bold">房间设置</h2>
      <div v-if="false" /> <!-- spacer for indentation match -->

 <!-- 个人资料编辑弹层 -->
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-500">玩法</label>
          <div class="flex gap-2">
            <button
              class="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
              :class="configMode === 'five' ? 'bg-brand-600' : 'bg-white hover:bg-brand-50 border border-brand-200'"
              @click="configMode = 'five'"
            >五张梭哈</button>
            <button
              class="flex-1 rounded-lg py-2.5 text-sm font-bold transition"
              :class="configMode === 'seven' ? 'bg-brand-600' : 'bg-white hover:bg-brand-50 border border-brand-200'"
              @click="configMode = 'seven'"
            >七张梭哈</button>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-500">局数</label>
          <input v-model.number="configRounds" type="number" min="1" max="100"
            class="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-slate-700 outline-none focus:border-brand-500" />
        </div>
        <div class="mb-6">
          <label class="mb-1 block text-xs text-slate-500">初始筹码</label>
          <input v-model.number="configChips" type="number" min="100" step="100"
            class="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-slate-700 outline-none focus:border-brand-500" />
        </div>
        <div class="flex gap-2">
          <button class="flex-1 rounded-lg bg-brand-100 hover:bg-brand-200 py-2.5 text-sm font-bold" @click="showConfig = false">取消</button>
          <button class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold hover:bg-brand-500" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>

    <!-- 牌桌 -->
    <main class="relative flex-1 px-2 py-3">
     <!-- 环形牌桌：底池居中，座位环形分布，自己在底部 -->
     <div
       ref="stageWrapRef"
       class="absolute inset-0 flex items-center justify-center"
     >
       <div
         ref="stageRef"
        class="relative"
         :style="{ width: STAGE_W * stageScale + 'px', height: STAGE_H * stageScale + 'px' }"
       >
        <PokerTable :width="STAGE_W" :height="STAGE_H" />
        <!-- 底池 -->
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full border border-amber-700/40 bg-amber-900/20 px-5 py-2"
          :style="{ left: (STAGE_W / 2) * stageScale + 'px', top: (STAGE_H / 2) * stageScale + 'px' }"
        >
          <span class="text-sm text-white/70">底池</span>
          <span class="flex items-center gap-1 text-lg font-bold text-amber-200"><ChipIcon :size="18" color="#f0a030" /> {{ pot }}</span>
        </div>
        <div
          v-for="(p, i) in ringSeats"
          :key="p.id"
          class="absolute w-max"
          :style="[{ transform: 'translate(-50%, -50%) scale(' + stageScale + ')', left: seatStyle(i, ringSeats.length).left, top: seatStyle(i, ringSeats.length).top }]"
        >
          <PlayerSeat
            :player="p"
            :hand="seatHand(p.id)"
            :is-me="p.id === game.myPlayerId"
            :is-active="p.id === game.roomState?.currentPlayerId"
            :spectate="game.myRole === 'spectator'"
           :card-size="p.id === game.myPlayerId ? 'lg' : 'sm'"
        />
       </div>
       </div>
     </div>


    <!-- 操作区：右下角悬浮，不挤占牌桌 -->
      <div class="absolute bottom-3 right-3 w-80 max-w-[calc(100vw-24px)] z-20">
        <!-- 房主等待区 -->
        <div v-if="isHost && game.phase === 'waiting'" class="rounded-2xl border border-brand-200 bg-white/80 p-4 text-center">
          <p class="text-sm text-slate-600">等待玩家加入…（至少 2 人开局）</p>
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
      <div class="w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-6">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xl font-bold text-slate-800">摊牌</h2>
          <button class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-600" @click="closeShowdown">
            关闭
          </button>
        </div>
        <div class="mb-4 space-y-2">
          <div
            v-for="h in game.showdown.hands"
            :key="h.playerId"
            class="flex items-center justify-between rounded-xl bg-white/90 px-4 py-2.5 border border-brand-100"
          >
            <div class="flex items-center gap-2">
              <img v-if="avatarUrl(players.find(p => p.id === h.playerId)?.avatarId)"
                :src="avatarUrl(players.find(p => p.id === h.playerId)?.avatarId)"
                class="h-8 w-8 rounded-full object-cover" />
              <div>
                <div class="text-sm font-bold text-slate-800">{{ h.nickname }}</div>
                <div class="text-xs text-slate-500">{{ h.folded ? '弃牌' : (h.handName || '') }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
            <div v-if="!h.folded" class="flex gap-0.5">
              <Card v-for="(c, i) in h.cards" :key="i" :card="{ ...c, hidden: false }" size="sm" />
            </div>
              <span
                class="min-w-14 rounded-md px-2 py-0.5 text-right text-sm font-bold"
                :class="h.delta > 0 ? 'bg-emerald-900/50 text-emerald-300' : h.delta < 0 ? 'bg-red-900/40 text-red-300' : 'bg-brand-100 hover:bg-brand-200/60 text-slate-500'"
              >
                {{ h.delta > 0 ? '+' : '' }}{{ h.delta }}
              </span>
            </div>
          </div>
        </div>
        <div class="mb-4 text-center">
          <span class="text-sm text-amber-300">赢家</span>
          <span class="ml-2 text-lg font-bold text-amber-200">
            {{ game.showdown.winners.map(w => players.find(p => p.id === w.playerId)?.nickname || w.playerId).join(', ') }}
            净赢 +{{ game.showdown.winners.reduce((s, w) => s + (w.netDelta ?? 0), 0) }}
          </span>
        </div>
        <div v-if="game.lastGameOver" class="mb-4 rounded-xl bg-brand-50 px-4 py-3 border border-brand-100">
          <div class="text-center text-xs text-slate-500">当前积分</div>
          <div class="mt-1 flex justify-center gap-4 text-sm">
            <span v-for="s in [...game.lastGameOver.standings].sort((a, b) => b.chips - a.chips).slice(0, 3)" :key="s.playerId"
              class="font-bold" :class="s.playerId === game.myPlayerId ? 'text-brand-300' : 'text-slate-700'">
              {{ players.find(p => p.id === s.playerId)?.nickname }}: {{ s.chips }}
            </span>
          </div>
        </div>
        <div class="flex justify-center">
          <button
            class="rounded-lg bg-brand-600 px-6 py-2.5 font-bold text-slate-800 transition hover:bg-brand-500"
            @click="closeShowdown"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>










