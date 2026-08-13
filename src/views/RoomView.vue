<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { useLobbyStore } from '../stores/lobbyStore'
import { avatarUrl } from '../game/avatars'
import winGif from '../assets/win.gif'
import GameBoard from '../components/GameBoard.vue'
import DrawerPanel from '../components/DrawerPanel.vue'
import HostConfigPanel from '../components/HostConfigPanel.vue'
import ModeratorPanel from '../components/ModeratorPanel.vue'
import PuzzleCard from '../components/PuzzleCard.vue'
import PlayerList from '../components/PlayerList.vue'

const avatarUrlOf = (p) => avatarUrl(p.avatarId) ?? null

const game = useGameStore()
const lobby = useLobbyStore()

const questionText = ref('')
const showPuzzlePicker = ref(false)
const storyOpen = ref(true)
const pendingGuess = ref(null) // 真人模式下待确认的玩家答案
const hintLoading = ref(false)
const moderatorPending = ref(null) // 真人主持人待判定的问题
let unbind = null
let openOff = null

onMounted(() => {
  unbind = game.bindServer({
    onModeratorQuestion: (q) => {
      moderatorPending.value = q
    },
    onGuessProposed: (g) => {
      pendingGuess.value = g
    },
  })
  openOff = game.onConnected(() => {})
  if (!lobby.puzzles.length) {
    lobby.fetchPuzzles().catch(() => {})
  }
})

onBeforeUnmount(() => {
  unbind?.()
  openOff?.()
})

// ---- 房主配置 ----
const cfg = computed(() => ({
  mode: game.mode,
  maxPlayers: game.maxPlayers,
  questionLimit: game.questionLimit,
}))

function emitConfig(patch) {
  game.setHostConfig({ ...cfg.value, ...patch })
}

function emitLimit(n) {
  game.setHostConfig({ ...cfg.value, questionLimit: n })
}

// ---- 提问/回答 ----
function ask() {
  const t = questionText.value.trim()
  if (!t) return
  game.askQuestion(t)
  questionText.value = ''
}

function judge(j) {
  game.moderatorJudge(j)
  moderatorPending.value = null
}

function confirmGuess(ok) {
  if (ok) {
    game.moderatorJudge('correct')
    pendingGuess.value = null
  } else {
    pendingGuess.value = null
  }
}

function aiHint() {
  if (hintLoading.value) return
  hintLoading.value = true
  game.aiHint()
  setTimeout(() => (hintLoading.value = false), 3000)
}

function resetAndLeave() {
  game.disconnect()
}

const showQuestionInput = computed(
  () => game.phase === 'playing' && !game.amModerator && !game.isSpectator,
)

const canReveal = computed(
  () => game.phase === 'playing' && !game.isSpectator && (game.amModerator || game.isHost),
)

const waitingForPlayers = computed(
  () => game.phase === 'waiting' && game.players.length < game.maxPlayers,
)

const hasApplied = computed(() =>
  game.moderatorApplicants.includes(game.myPlayerId),
)
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- 顶栏 -->
    <header class="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-slate-200">房间 {{ game.roomId }}</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-bold"
          :class="game.mode === 'ai' ? 'bg-brand-500/20 text-brand-300' : 'bg-sky-500/20 text-sky-300'"
        >
          {{ game.mode === 'ai' ? 'AI 主持' : '真人主持' }}
        </span>
        <span v-if="game.questionLimit" class="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
          限 {{ game.questionLimit }} 问
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- 观战切换（玩家 ↔ 观战） -->
        <button
          v-if="game.phase === 'waiting' || game.isSpectator"
          type="button"
          class="rounded-lg border px-3 py-1 text-xs transition"
          :class="game.isSpectator
            ? 'border-emerald-600/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : 'border-slate-700 text-slate-300 hover:bg-slate-800'"
          @click="game.setSpectator(!game.isSpectator)"
        >
          {{ game.isSpectator ? '加入对局' : '转观战' }}
        </button>
        <!-- 揭底（房主/主持人，游戏中显示） -->
        <button
          v-if="canReveal"
          type="button"
          class="rounded-lg border border-amber-600/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
          @click="game.reveal()"
        >
          揭底
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
          @click="game.disconnect()"
        >
          离开
        </button>
      </div>
    </header>

    <!-- 等待阶段：房主配置 + 选谜题 -->
    <div v-if="game.phase === 'waiting'" class="flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-300">玩家（{{ game.players.length }}/{{ game.maxPlayers }}）</span>
          <span v-if="game.amI?.isHost" class="text-xs text-amber-300">👑 你是房主</span>
        </div>
        <PlayerList :players="game.players" :my-player-id="game.myPlayerId" />

        <HostConfigPanel
          v-if="game.amI?.isHost"
          :mode="game.mode"
          :max-players="game.maxPlayers"
          :question-limit="game.questionLimit"
          @update:mode="emitConfig({ mode: $event })"
          @update:maxPlayers="emitConfig({ maxPlayers: $event })"
          @update:questionLimit="emitLimit"
        />

        <!-- 真人模式：报名当主持人 -->
        <div v-if="game.mode === 'human'" class="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-200">主持报名</span>
            <span class="text-xs text-slate-500">
              已报名 {{ game.moderatorApplicants.length }} 人              <span v-if="game.moderatorApplicants.length > 1">· 开局时随机抽取</span>
            </span>
          </div>
          <p class="text-xs text-slate-500">
            {{ game.moderatorApplicants.length === 0 ? '还没人报名，开局时将随机抽一名玩家当主持人' : '报名者会优先成为主持人' }}
          </p>
          <button
            type="button"
            class="rounded-lg py-2 text-sm font-bold transition"
            :class="hasApplied
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-sky-600 text-white hover:bg-sky-500'"
            @click="game.applyModerator(!hasApplied)"
          >
            {{ hasApplied ? '✓ 已报名（点击取消）' : '报名当主持人' }}
          </button>
        </div>

        <!-- 选谜题 -->
        <div v-if="game.amI?.isHost">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-300">选择谜题</span>
            <button
              type="button"
              class="text-xs text-brand-400 hover:text-brand-300"
              @click="showPuzzlePicker = !showPuzzlePicker"
            >
              {{ showPuzzlePicker ? '收起' : '更换' }}
            </button>
          </div>
          <div v-if="showPuzzlePicker" class="flex flex-col gap-2">
            <PuzzleCard
              v-for="p in lobby.puzzles"
              :key="p.id"
              :puzzle="p"
              :selected="game.puzzle?.id === p.id"
              @select="(id) => { game.selectPuzzle(id); showPuzzlePicker = false }"
            />
            <div v-if="lobby.puzzles.length === 0" class="py-4 text-center text-xs text-slate-600">
              谜题加载中…
            </div>
          </div>
          <div v-else-if="game.puzzle" class="text-xs text-slate-500">
            已选：{{ game.puzzle.title }}
          </div>
        </div>

        <!-- 非房主视角：显示已选谜题 -->
        <div v-else-if="game.puzzle" class="text-xs text-slate-500">
          房主已选谜题：{{ game.puzzle.title }}
        </div>

        <!-- 开局按钮 -->
        <button
          v-if="game.amI?.isHost"
          type="button"
          class="rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          :disabled="waitingForPlayers || !game.puzzle"
          @click="game.startGame()"
        >
          {{ waitingForPlayers ? `等待玩家加入（${game.players.length}/${game.maxPlayers}）` : '开始游戏' }}
        </button>
        <div v-else class="py-3 text-center text-sm text-slate-500">
          等待房主配置并开始…
        </div>
      </div>
    </div>

    <!-- 游戏阶段：牌桌布局 -->
    <div v-else class="flex min-h-0 flex-1 flex-col">
      <!-- 中央棋盘（主持人 + 玩家环绕 + 指向） -->
      <div class="relative min-h-0 flex-1">
        <GameBoard
          :players="game.players"
          :my-player-id="game.myPlayerId"
          :moderator-id="game.moderatorId"
          :mode="game.mode"
          :messages="game.messages"
        />

        <!-- 汤面矩形卡片（悬浮在棋盘左上角，不占布局） -->
        <div class="absolute left-3 top-3 z-20">
          <!-- 收起态：竖版矩形小卡片 -->
          <button
            v-if="!storyOpen"
            type="button"
            class="flex h-40 w-28 flex-col rounded-lg border border-brand-600/50 bg-gradient-to-br from-amber-50 to-amber-100 p-2 text-left shadow-xl transition hover:scale-105 hover:shadow-2xl"
            @click="storyOpen = true"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm">🍲</span>
              <span class="rounded bg-slate-900/10 px-1 text-[9px] text-slate-600">难度{{ game.puzzle?.difficulty ?? '-' }}</span>
            </div>
            <div class="mt-1 text-[11px] font-bold leading-tight text-amber-900">{{ game.puzzle?.title }}</div>
            <div class="mt-auto text-center text-[10px] text-amber-700">👆 点击展开汤面</div>
          </button>

          <!-- 展开态：浮层覆盖（不挤压下方布局） -->
          <div v-else class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="storyOpen = false">
            <div class="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-50 to-amber-100 shadow-2xl">
              <!-- 纸张纹理角（放在左侧，避免遮挡右上角关闭按钮） -->
              <div class="absolute left-0 top-0 h-8 w-8 rounded-br-xl border-b-8 border-r-8 border-amber-400/30" />
              <div class="flex items-center justify-between border-b border-amber-900/10 px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🍲</span>
                  <span class="text-sm font-bold text-amber-900">{{ game.puzzle?.title }}</span>
                </div>
                <button type="button" class="relative z-10 rounded-full bg-amber-900/10 px-2 py-0.5 text-amber-800/70 transition hover:bg-amber-900/20 hover:text-amber-900" @click="storyOpen = false">✕</button>
              </div>
              <div class="px-5 py-4">
                <p class="text-sm leading-relaxed text-amber-900/90">{{ game.puzzle?.story }}</p>
                <div class="mt-3 text-right text-[10px] text-amber-800/50">—— 汤面</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 问题耗尽提示 -->
        <div
          v-if="game.questionsExhausted"
          class="absolute left-1/2 top-8 z-30 -translate-x-1/2 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-300"
        >
          ⏳ 问题已用尽，等待揭底
        </div>

        <!-- 真人主持人面板 -->
        <div v-if="game.mode === 'human' && game.amI?.isModerator" class="absolute bottom-2 left-2 z-30 w-64">
          <ModeratorPanel
            :pending="moderatorPending"
            @judge="judge"
          />
        </div>

        <!-- 观战区（左侧靠下，只显示头像+昵称） -->
        <div
          v-if="game.spectators.length > 0"
          class="absolute bottom-2 left-2 z-20 flex flex-col gap-1.5"
          :class="game.mode === 'human' && game.amI?.isModerator ? 'bottom-2 left-2 mt-24' : ''"
        >
          <div class="rounded-lg border border-slate-700/60 bg-slate-900/70 px-2 py-1.5 backdrop-blur-sm">
            <div class="mb-1 text-[10px] font-semibold text-slate-500">👁 观战（{{ game.spectators.length }}）</div>
            <div class="flex flex-wrap gap-2">
              <div v-for="s in game.spectators" :key="s.id" class="flex items-center gap-1">
                <img
                  v-if="avatarUrlOf(s)"
                  :src="avatarUrlOf(s)"
                  :alt="s.nickname"
                  class="h-6 w-6 rounded-full border border-slate-600 object-cover"
                />
                <div
                  v-else
                  class="flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-700 text-[10px] font-bold text-slate-200"
                >
                  {{ s.nickname?.slice(0, 1) }}
                </div>
                <span class="text-xs text-slate-300">{{ s.nickname }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作区 -->
      <footer class="flex flex-col gap-2 border-t border-slate-800 bg-slate-900/80 px-3 py-2">
        <!-- 观战提示 -->
        <div v-if="game.isSpectator && game.phase === 'playing'" class="py-1 text-center text-xs text-slate-500">
          👁 观战中，可参与右侧复盘讨论
        </div>

        <!-- 提问输入（玩家） -->
        <div v-if="showQuestionInput && !game.questionsExhausted" class="flex gap-2">
          <input
            v-model="questionText"
            class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            placeholder="向主持人提问…"
            maxlength="200"
            @keyup.enter="ask"
          />
          <button
            type="button"
            class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-400"
            @click="ask"
          >
            提问
          </button>
        </div>

        <!-- 提交答案（玩家）已移除：大家问明白后由主持人/房主揭底 -->

        <!-- 真人主持人提示 -->
        <div v-if="game.amI?.isModerator" class="flex items-center justify-between">
          <span class="text-xs text-sky-300">🕵️ 主持人：回答玩家问题</span>
        </div>

        <!-- 真人主持人待确认答案 -->
        <div v-if="pendingGuess" class="rounded-lg bg-sky-900/40 px-3 py-2 text-sm text-sky-200">
          <span class="font-semibold">{{ game.players.find((p) => p.id === pendingGuess.from)?.nickname }}</span>
          提交了答案：{{ pendingGuess.text }}
          <div class="mt-2 flex gap-2">
            <button class="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white" @click="confirmGuess(true)">答对了</button>
            <button class="rounded-md bg-slate-600 px-3 py-1 text-xs font-bold text-white" @click="confirmGuess(false)">不对</button>
          </div>
        </div>

        <div v-if="game.error" class="text-center text-xs text-red-400">{{ game.error }}</div>
      </footer>
    </div>

    <!-- 结束覆盖层：猜中 → win.gif 庆祝；揭底 → 显示汤底 -->
    <div
      v-if="game.phase === 'ended'"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm"
      @click="game.revealed ? resetAndLeave() : game.reveal()"
    >
      <template v-if="!game.revealed">
        <img
          :src="winGif"
          class="mb-4 h-40 w-40 rounded-2xl shadow-2xl animate-bounce-slow"
          alt="通关"
        />
        <div class="text-2xl font-bold text-amber-300">
          {{ game.winnerId === game.myPlayerId ? '🎉 你猜中汤底了！' : '🎉 有人猜中汤底！' }}
        </div>
        <div class="mt-2 text-sm text-slate-400">点击查看汤底真相</div>
      </template>
      <template v-else>
        <div class="mx-4 max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
          <div class="text-lg font-bold text-brand-300">汤底真相</div>
          <div class="mt-2 text-sm font-semibold text-slate-200">{{ game.puzzle?.title }}</div>
          <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ game.puzzle?.answer }}</p>
          <button
            type="button"
            class="mt-5 rounded-xl bg-brand-600 px-6 py-2.5 font-bold text-white transition hover:bg-brand-500"
            @click="resetAndLeave()"
          >
            返回大厅
          </button>
        </div>
      </template>
    </div>

    <!-- 右侧侧边栏（问答记录 / 复盘），按钮与面板均自身 fixed 定位 -->
    <DrawerPanel
      v-if="game.phase !== 'waiting'"
      :messages="game.messages"
      :review-notes="game.reviewNotes"
      :my-player-id="game.myPlayerId"
      :mode="game.mode"
      :players="game.players"
      :can-ai-hint="game.amModerator || game.isHost"
      :question-count="game.questionCount"
      :question-limit="game.questionLimit"
      @note="game.reviewNote"
      @ai-hint="aiHint"
    />
  </div>
</template>
