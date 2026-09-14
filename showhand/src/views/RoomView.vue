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
import { AuthBadge, ProfileEditor } from '@lapismind/lobby-kit/vue'

const route = useRoute()
const game = useGameStore()
const lobby = useLobbyStore()

const roomCode = computed(() => String(route.params.code || '').toUpperCase())
const showConfig = ref(false)
const showProfile = ref(false)
const copied = ref(false)
const showHelp = ref(false)
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })
let lastIdentityPlayerId = lobby.myPlayerId
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
const matchFinished = computed(() => game.roomState?.finished === true)
// 整场最终排名（含中途输光退席的玩家），服务端按筹码降序下发
const finalStandings = computed(() => game.lastGameOver?.standings ?? [])
const matchRoundTotal = computed(() => game.roomState?.config?.rounds ?? 0)

// 虚拟牌桌坐标系。尺寸随可用空间的宽高比调整：手机上若还用 3:2 的宽桌面，
// 宽度会卡死缩放比例、上下留一大片空白。座位用比例定位，换尺寸不会跑偏。
const stageW = ref(1350)
const stageH = ref(900)
// 座位环半径（相对桌面的比例）：落在台面之内，而不是骑在边框上
const SEAT_RX_RATIO = 0.415
const SEAT_RY_RATIO = 0.391
const seatRx = computed(() => stageW.value * SEAT_RX_RATIO)
const seatRy = computed(() => stageH.value * SEAT_RY_RATIO)
// 席位的额外放大系数。桌面相对固定，纯按 stageScale 缩放时席位太小读不清；
// 这是**全局常量**，所有座位一致，不会破坏席位与坐标的比例关系
// （早先的 bug 是 scale(stageScale * 2)，尺寸两倍而位置一倍，才会互相挤压错位）。
const SEAT_SCALE = 1.35
const stageRef = ref(null)
const stageWrapRef = ref(null)
const stageScale = ref(1)

// 座位角度：i=0 固定底部中央（我自己），逆时针分布一圈
function seatXY(i, total) {
  const angle = Math.PI / 2 + (2 * Math.PI * i) / Math.max(total, 1)
  return {
    x: stageW.value / 2 + seatRx.value * Math.cos(angle),
    y: stageH.value / 2 + seatRy.value * Math.sin(angle),
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
  const availW = Math.max((stageWrapRef.value?.clientWidth ?? stageW.value) - 8, 200)
  // 顶部栏 + 底部留白；手机端下注面板贴底，要多留出一块
  const reservedH = window.innerWidth < 640 ? 330 : 250
  const availH = Math.max(window.innerHeight - reservedH, 200)

  // 竖屏/窄屏换成更方的桌面，把高度用起来
  if (availW / availH < 1.15) {
    stageW.value = 1100
    stageH.value = 900
  } else {
    stageW.value = 1350
    stageH.value = 900
  }

  // 下限 0.3：原先是 0.55，导致桌面最多只能缩到原宽的 55%，
  // 在 390px 宽的手机上必然被裁掉一半
  stageScale.value = Math.max(
    0.3,
    Math.min(1.5, availW / stageW.value, availH / stageH.value),
  )
}

// 我的手牌视图：观众看上帝视角，玩家看自己的
const myDisplayHand = computed(() => {
  if (game.myRole === 'spectator') return []
  return game.myHand
})
const myBet = computed(() => me.value?.bet ?? 0)
const myChips = computed(() => me.value?.chips ?? 0)
// 闷牌轮（本局第一次下注）：闷牌者按下注额半价支付
const isBlindRound = computed(() => game.roomState?.stage === 'blind')
const myBlind = computed(() => me.value?.blind === true)

onMounted(() => {
  profileDraft.value = { nickname: lobby.myNickname, avatarId: lobby.myAvatarId }
  // 从大厅跳进来时还没有连接；组件重建（例如 HMR / 路由复入）时房间还在，不要重复连
  if (!game.inRoom || game.roomId !== roomCode.value) {
    game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
  }
  rehydrate()
  updateStageScale()
  window.addEventListener('resize', updateStageScale)
})
let unsub = null

/** 重装消息监听：hydrate 内部会先撤销上一次的注册，不会叠加 */
function rehydrate() {
  unsub?.()
  unsub = game.hydrate({})
}

onUnmounted(() => {
  unsub?.()
  unsub = null
  window.removeEventListener('resize', updateStageScale)
  game.leaveRoom()
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
  rehydrate()
}

// 身份变化（游客在房间内登录/注册升级）：同步大厅后以新身份重连，
// 旧身份座位留在房间（如仍在游戏中则由房间逻辑处理）
function onIdentityChange(user) {
  const prev = lastIdentityPlayerId
  lobby.syncIdentity(user)
  const next = user?.playerId ?? null
  lastIdentityPlayerId = next
  if (game.inRoom && next && next !== prev) {
    game.disconnect()
    game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
    rehydrate()
  }
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
    <div class="flex min-h-screen flex-col bg-[var(--page-bg)] text-[#333333]">
    <!-- 顶部栏：窄屏允许换行，否则徽章会被 flex 挤成竖排文字 -->
    <header class="flex flex-wrap items-center justify-between gap-y-2 border-b border-[#D8D0E4] bg-white/80 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
        <a href="/" class="whitespace-nowrap text-sm text-[#8A8299] transition hover:text-[#333333]">← 退出</a>
        <span class="font-num whitespace-nowrap text-sm font-bold text-brand-700">房间 {{ roomCode }}</span>
        <button
          type="button"
          class="whitespace-nowrap rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          @click="copyRoomLink"
        >
          {{ copied ? '✓ 已复制' : '🔗 邀请' }}
        </button>
        <span class="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-brand-700">
          {{ game.roomState?.config.mode === 'seven' ? '七张' : '五张' }}
        </span>
        <span class="font-num whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-xs text-brand-700">
          第 {{ game.roomState?.round ?? 0 }} / {{ game.roomState?.config.rounds ?? 10 }} 局
        </span>
        <span v-if="isBlindRound" class="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
          闷牌轮
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="whitespace-nowrap rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          @click="showHelp = true"
        >
          规则
        </button>
        <button
          type="button"
          class="whitespace-nowrap rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          @click="openProfile"
        >
          ⚙️ 我
        </button>
        <span v-if="game.myRole === 'spectator'" class="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
          观众
        </span>
        <button
          v-if="isHost && game.phase === 'waiting'"
          type="button"
          class="whitespace-nowrap rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
          @click="showConfig = true"
        >
          房间设置
        </button>
        <button
          v-if="isHost && game.phase === 'waiting'"
          type="button"
          class="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500"
          @click="nextHand"
        >
          开始游戏
        </button>
        <button
          v-else-if="isHost && game.phase === 'settled' && !matchFinished"
          type="button"
          class="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500"
          @click="nextHand"
        >
          下一局
        </button>
        <button
          v-else-if="isHost && matchFinished"
          type="button"
          class="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-500"
          @click="game.rematch()"
        >
          🔄 再来一局
        </button>
        <span
          v-else-if="matchFinished"
          class="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700"
        >
          🏆 整场结束
        </span>
        <AuthBadge compact @identity-change="onIdentityChange" />
      </div>
    </header>

    <!-- 个人资料编辑弹层 -->
    <div v-if="showProfile" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2a48]/25 p-4">
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
  <div v-if="showConfig" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2a48]/25 p-4">
    <div class="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6">
      <h2 class="mb-4 text-lg font-bold">房间设置</h2>
      <div v-if="false" /> <!-- spacer for indentation match -->

 <!-- 个人资料编辑弹层 -->
        <div class="mb-4">
          <label class="mb-1 block text-xs text-[#8A8299]">玩法</label>
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
          <label class="mb-1 block text-xs text-[#8A8299]">局数</label>
          <input v-model.number="configRounds" type="number" min="1" max="100"
            class="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-[#333333] outline-none focus:border-brand-500" />
        </div>
        <div class="mb-6">
          <label class="mb-1 block text-xs text-[#8A8299]">初始筹码</label>
          <input v-model.number="configChips" type="number" min="100" step="100"
            class="w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-[#333333] outline-none focus:border-brand-500" />
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
         :style="{ width: stageW * stageScale + 'px', height: stageH * stageScale + 'px' }"
       >
        <PokerTable :width="stageW" :height="stageH" />
        <!-- 底池 -->
        <div
          class="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-brand-200 bg-white/95 px-5 py-2 shadow-md"
          :style="{ left: (stageW / 2) * stageScale + 'px', top: (stageH / 2) * stageScale + 'px' }"
        >
          <span class="text-sm text-[#8A8299]">底池</span>
          <span class="flex items-center gap-1 font-num text-lg font-bold text-brand-700">
            <ChipIcon :size="18" color="#8888cc" /> {{ pot }}
          </span>
        </div>
        <div
          v-for="(p, i) in ringSeats"
          :key="p.id"
          class="absolute w-max"
          :style="[{ transform: 'translate(-50%, -50%) scale(' + stageScale * SEAT_SCALE + ')', left: seatStyle(i, ringSeats.length).left, top: seatStyle(i, ringSeats.length).top }]"
        >
          <PlayerSeat
            :player="p"
            :hand="seatHand(p.id)"
            :is-me="p.id === game.myPlayerId"
            :is-active="p.id === game.roomState?.currentPlayerId"
            :spectate="game.myRole === 'spectator'"
           :card-size="p.id === game.myPlayerId ? 'md' : 'sm'"
        />
       </div>
       </div>
     </div>


    <!-- 操作区：手机贴底铺满，sm 以上右下角悬浮，不挤占牌桌 -->
      <div class="absolute inset-x-2 bottom-2 z-20 sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-80">
        <!-- 整场结束：最终排名 + 再来一局 -->
        <div v-if="matchFinished" class="rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-lg">
          <div class="text-center">
            <div class="text-2xl">🏆</div>
            <p class="mt-1 text-sm font-bold text-[#333333]">
              {{ finalStandings[0]?.nickname ?? '—' }} 夺冠
            </p>
            <p class="font-num text-xs text-[#8A8299]">共 {{ game.roomState?.round ?? 0 }} / {{ matchRoundTotal }} 局</p>
          </div>
          <ol class="mt-3 space-y-0.5">
            <li
              v-for="(row, i) in finalStandings"
              :key="row.playerId"
              class="flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
              :class="row.playerId === game.myPlayerId ? 'bg-brand-100 font-bold text-brand-700' : 'text-[#5F586B]'"
            >
              <span class="font-num w-4 shrink-0 text-right">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate">{{ row.nickname }}</span>
              <span class="font-num shrink-0 font-bold">{{ row.chips }}</span>
            </li>
          </ol>
          <button
            v-if="isHost"
            type="button"
            class="mt-3 min-h-[44px] w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white transition hover:bg-brand-500"
            @click="game.rematch()"
          >
            🔄 再来一局
          </button>
          <p v-else class="mt-3 text-center text-xs text-[#8A8299]">等待房主再来一局…</p>
          <a
            href="/"
            class="mt-2 block rounded-lg border border-brand-200 bg-white py-2 text-center text-sm font-bold text-brand-700 transition hover:bg-brand-50"
          >返回大厅</a>
        </div>

        <!-- 房主等待区 -->
        <div v-else-if="isHost && game.phase === 'waiting'" class="rounded-2xl border border-[#D8D0E4] bg-white/95 p-4 text-center shadow-lg">
          <p class="text-sm text-[#5F586B]">等待玩家加入…（至少 2 人开局）</p>
          <p class="mt-1 text-xs text-[#8A8299]">分享链接邀请好友加入</p>
        </div>

        <!-- 玩家下注 -->
        <BetPanel
          v-else-if="game.myRole === 'player' && game.phase === 'playing'"
          :current-bet="game.roomState?.currentBet ?? 0"
          :my-bet="myBet"
          :my-chips="myChips"
          :enabled="myTurn"
          :locked="game.betLocked"
          :half-price="isBlindRound"
          :my-blind="myBlind"
          @bet="doBet"
          @look="game.look()"
        />

        <!-- 观众提示 -->
        <div v-else-if="game.myRole === 'spectator' && game.phase === 'playing'" class="rounded-2xl border border-brand-200 bg-white/95 p-4 text-center shadow-lg">
          <p class="text-sm text-[#5F586B]">👀 你在观众席，可查看所有玩家的手牌</p>
          <p v-if="isBlindRound" class="mt-1 text-xs text-[#8A8299]">闷牌轮中，没看牌的玩家连你也看不到</p>
        </div>

        <!-- 错误提示 -->
        <div v-if="game.error" class="mt-2 rounded-lg border border-red-200 bg-white/95 px-4 py-2 text-center text-sm font-bold text-red-600 shadow-lg">
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
    <div v-if="game.showdown" class="fixed inset-0 z-40 flex items-center justify-center bg-[#2a2a48]/30 p-4" @click.self="closeShowdown">
      <div class="w-full max-w-lg rounded-2xl border border-brand-200 bg-white p-6">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xl font-bold text-[#333333]">摊牌</h2>
          <button class="rounded-lg bg-brand-100 hover:bg-brand-200 px-3 py-1.5 text-sm text-[#5F586B] transition hover:bg-brand-200" @click="closeShowdown">
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
                <div class="text-sm font-bold text-[#333333]">{{ h.nickname }}</div>
                <div class="text-xs text-[#8A8299]">{{ h.folded ? '弃牌' : (h.handName || '') }}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
            <div v-if="!h.folded" class="flex gap-0.5">
              <Card v-for="(c, i) in h.cards" :key="i" :card="{ ...c, hidden: false }" size="sm" />
            </div>
              <span
                class="font-num min-w-14 rounded-md px-2 py-0.5 text-right text-sm font-bold"
                :class="h.delta > 0 ? 'bg-emerald-50 text-emerald-700' : h.delta < 0 ? 'bg-red-50 text-red-600' : 'bg-brand-100 text-[#8A8299]'"
              >
                {{ h.delta > 0 ? '+' : '' }}{{ h.delta }}
              </span>
            </div>
          </div>
        </div>
        <div class="mb-4 text-center">
          <span class="text-sm text-[#8A8299]">赢家</span>
          <span class="ml-2 text-lg font-bold text-brand-700">
            {{ game.showdown.winners.map(w => players.find(p => p.id === w.playerId)?.nickname || w.playerId).join(', ') }}
            净赢 +{{ game.showdown.winners.reduce((s, w) => s + (w.netDelta ?? 0), 0) }}
          </span>
        </div>
        <div v-if="game.lastGameOver" class="mb-4 rounded-xl bg-[#F7EFF8] px-4 py-3 border border-[#E6E1F0]">
          <div class="text-center text-xs text-[#8A8299]">当前筹码</div>
          <div class="mt-1 flex justify-center gap-4 text-sm">
            <span v-for="s in [...game.lastGameOver.standings].sort((a, b) => b.chips - a.chips).slice(0, 3)" :key="s.playerId"
              class="font-num font-bold" :class="s.playerId === game.myPlayerId ? 'text-brand-600' : 'text-[#333333]'">
              {{ players.find(p => p.id === s.playerId)?.nickname }}: {{ s.chips }}
            </span>
          </div>
        </div>
        <div class="flex justify-center">
          <button
            type="button"
            class="min-h-[44px] rounded-lg bg-brand-600 px-6 py-2.5 font-bold text-white transition hover:bg-brand-500"
            @click="closeShowdown"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>












