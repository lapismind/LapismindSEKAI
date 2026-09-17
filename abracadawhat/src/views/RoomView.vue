<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLobbyStore } from '../stores/lobbyStore'
import { useGameStore } from '../stores/gameStore'
import PlayerZone from '../components/PlayerZone.vue'
import CastPanel from '../components/CastPanel.vue'
import CastFeedback from '../components/CastFeedback.vue'
import PublicArea from '../components/PublicArea.vue'
import GameHelp from '../components/GameHelp.vue'
import GameChatPanel from '../components/GameChatPanel.vue'
import SpellCard from '../components/SpellCard.vue'
import { avatarChoices, avatarUrl } from '../game/avatars'
import { SPELLS } from '../core/rules'
import { formatStory } from '../core/storyPresentation'
import {
  buildInviteUrl,
  copyToClipboard,
  generateRoomCode,
} from '@lapismind/lobby-kit'
import { AuthBadge, ConnectionBanner, ProfileEditor } from '@lapismind/lobby-kit/vue'

const route = useRoute()
const router = useRouter()
const lobby = useLobbyStore()
const game = useGameStore()

const roomCode = computed(() => (route.params.code ?? '').toString().toUpperCase())
const helpOpen = ref(false)
const copied = ref(false)
const chatOpen = ref(false)
const hasUnread = ref(false)
const gameOverDialog = ref(null)
const gameOverCloseButton = ref(null)
const gameOverReopenButton = ref(null)
const postGameActions = ref(null)
let gameOverReturnFocus = null
let unsubs = []
let lastIdentityPlayerId = lobby.myPlayerId

onMounted(() => {
  if (!game.inRoom || game.roomId !== roomCode.value) {
    game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
    unsubs = game.hydrate({
      onCastResult: () => {},
      onRoundEnd: () => {},
    })
  }
})

// 聊天面板关闭时收到新消息 → 亮红点；打开面板 → 消掉
watch(() => game.chatMessageVersion, () => {
  if (!chatOpen.value) {
    hasUnread.value = true
  }
})
watch(chatOpen, (open) => {
  if (open) hasUnread.value = false
})
watch(() => game.gameOverOpen, async (open) => {
  await nextTick()
  if (open) {
    gameOverCloseButton.value?.focus()
  } else if (game.lastGameOver) {
    const returnTarget = gameOverReturnFocus?.isConnected ? gameOverReturnFocus : gameOverReopenButton.value
    ;(returnTarget || postGameActions.value)?.focus()
    gameOverReturnFocus = null
  }
}, { immediate: true, flush: 'post' })

onUnmounted(() => {
  unsubs = []
  game.leaveRoom()
})

function goToLobby() {
  router.push('/')
}

function closeGameOverDetails() {
  game.clearGameOver()
}

function openGameOverDetails(event) {
  gameOverReturnFocus = event.currentTarget
  game.openGameOver()
}

function onGameOverKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeGameOverDetails()
    return
  }
  if (event.key !== 'Tab') return
  const focusableSelector = [
    'a[href]', 'area[href]', 'button', 'input', 'select', 'textarea', 'summary',
    'iframe', 'object', 'embed', 'audio[controls]', 'video[controls]',
    '[contenteditable="true"]', '[tabindex]',
  ].join(', ')
  const focusable = [...gameOverDialog.value.querySelectorAll(focusableSelector)]
    .filter(element => {
      const style = getComputedStyle(element)
      return !element.matches(':disabled')
        && element.tabIndex >= 0
        && !element.closest('[hidden], [aria-hidden="true"]')
        && !element.closest('[inert]')
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && element.getClientRects().length > 0
    })
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const showProfile = ref(false)
const profileDraft = ref({ nickname: lobby.myNickname, avatarId: lobby.myAvatarId })

function openProfile() {
  profileDraft.value = { nickname: lobby.myNickname, avatarId: lobby.myAvatarId }
  showProfile.value = true
}

/** 昵称/头像要重连才会同步到服务端（与本文件 onIdentityChange 同一套做法） */
function saveProfile() {
  lobby.setNickname(profileDraft.value.nickname)
  lobby.setAvatar(profileDraft.value.avatarId)
  showProfile.value = false
  game.disconnect()
  game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
  unsubs.forEach(u => u())
  unsubs = game.hydrate({ onCastResult: () => {}, onRoundEnd: () => {} })
}

function onIdentityChange(user) {
  const prev = lastIdentityPlayerId
  lobby.syncIdentity(user)
  const next = user?.playerId ?? null
  lastIdentityPlayerId = next
  if (game.inRoom && next && next !== prev) {
    game.disconnect()
    game.connect(roomCode.value, lobby.myNickname, lobby.myPlayerId, lobby.myAvatarId)
    unsubs.forEach(u => u())
    unsubs = game.hydrate({
      onCastResult: () => {},
      onRoundEnd: () => {},
    })
  }
}

const isHost = computed(() => game.roomState?.hostId === game.myPlayerId)
const me = computed(() => game.roomState?.players.find(p => p.id === game.myPlayerId))
const isMyTurn = computed(() => game.roomState?.currentPlayerId === game.myPlayerId)
const isRoundEnd = computed(() => game.roomState?.phase === 'round_end')
const roundSummary = computed(() => game.roomState?.summary ?? game.roundEndSummary)
const roundWinner = computed(() => game.roomState?.players.find(player => player.id === roundSummary.value?.winnerId))
const decisiveSpell = computed(() => SPELLS.find(spell => spell.id === roundSummary.value?.decisiveSpellId))
const roundReason = computed(() => ({
  kill: '击杀结束',
  all_spells: '清空手牌结束',
  self_destruct: '施法失败自爆结束',
}[roundSummary.value?.reason] ?? '本轮结束'))
const startingHandCounts = computed(() => {
  const counts = new Map()
  for (const spellId of game.roomState?.startingHand ?? []) counts.set(spellId, (counts.get(spellId) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([spellId, count]) => ({ spell: SPELLS.find(spell => spell.id === spellId), count }))
    .filter(item => item.spell)
})
const formattedStories = computed(() => (game.lastGameOver?.stories ?? [])
  .slice(0, 3)
  .map(story => formatStory(story, { players: game.lastGameOver?.standings ?? [], spells: SPELLS }))
  .filter(Boolean))
const highlightedAchievements = computed(() => game.newAchievements.slice(0, 2))
const remainingAchievements = computed(() => game.newAchievements.slice(2))

function standingId(row) {
  return row.id ?? row.playerId
}

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
        <h1 class="text-lg font-bold text-ink">🧙 <span class="hidden sm:inline">出包魔法师</span></h1>
        <span class="text-xs text-muted"><span class="hidden sm:inline">房间号: </span>{{ roomCode }}</span>
        <span v-if="game.roomState && game.roomState.round > 0" class="hidden sm:inline text-sm text-brand-600">
          【第 {{ game.roomState.round }} 轮】
        </span>
      </div>
      <div class="flex gap-1.5">
        <button type="button" class="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 hover:border-brand-300 hover:text-brand-500" @click="helpOpen = true">
          📖 <span class="hidden sm:inline">规则</span>
        </button>
        <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500" @click="copyInvite">
            {{ copied ? '✓' : '🔗' }} <span class="hidden sm:inline">{{ copied ? '已复制' : '邀请' }}</span>
          </button>
          <button type="button" class="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-500 hover:border-red-300 hover:bg-red-50" @click="goToLobby">
            🚪 <span class="hidden sm:inline">退出</span>
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <!-- 手机上顶栏放不下登录徽章（约 215px，会独占一行），
               改到「⚙️ 我」弹层里，登录/改名入口不丢失 -->
          <button
            type="button"
            class="rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 sm:hidden"
            @click="openProfile"
          >⚙️ 我</button>
          <div class="hidden items-center sm:flex">
            <AuthBadge compact @identity-change="onIdentityChange" />
          </div>
        </div>
    </header>

    <!-- 等待中 -->
    <div v-if="!game.roomState || game.roomState.phase === 'waiting'" class="flex flex-col items-center justify-center gap-4 py-16">
      <p class="text-lg text-ink">等待玩家加入（{{ game.roomState?.players.length ?? 0 }}/5）…</p>
      <div class="flex flex-wrap justify-center gap-2">
        <div
          v-for="p in game.roomState?.players ?? []"
          :key="p.id"
          class="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-ink"
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
      <p v-if="isHost && (game.roomState?.players.length ?? 0) < 2" class="text-sm text-muted">
        至少需要 2 名玩家才能开始
      </p>
    </div>

    <!-- 游戏中 -->
    <template v-else>
      <PublicArea
        :cast-counts="game.roomState.castCounts ?? {}"
        :players="game.roomState.players ?? []"
        :match-history="game.roomState.matchHistory ?? []"
        :deck-remaining="game.roomState.deckRemaining ?? 0"
        :secret-pile-remaining="game.roomState.secretPileRemaining ?? 0"
      />

      <div class="my-3 text-center text-sm">
        <span v-if="isRoundEnd" class="text-brand-600 font-bold">🔮 本轮结束 — 查看所有牌面进行复盘</span>
        <span v-else-if="isMyTurn" class="font-bold text-brand-600">轮到你施法了！</span>
        <span v-else class="text-muted">
          等待 {{ game.roomState.players.find(p => p.id === game.roomState.currentPlayerId)?.nickname ?? '…' }} 施法…
        </span>
      </div>

      <div class="flex flex-col gap-3">
        <PlayerZone
          v-for="(p, i) in game.roomState?.players ?? []"
          :key="p.id"
          :player="p"
          :is-me="p.id === game.myPlayerId"
          :is-current="game.roomState.currentPlayerId === p.id"
          :score-delta="game.roundScoreDeltas[p.id] ?? 0"
          :reveal="isRoundEnd"
          :revealed-secrets="p.secrets ?? []"
        />
      </div>

      <CastPanel
        class="mt-3"
        :my-hand-size="game.myHandSize"
        :last-cast-level="game.roomState.lastCastLevel"
        :cast-counts="game.roomState.castCounts ?? {}"
        :is-my-turn="isMyTurn"
        :has-successful-cast="!!game.roomState.castSucceeded?.[game.myPlayerId]"
        :has-failed-cast="!!game.roomState.castFailed?.[game.myPlayerId]"
        :has-declared="game.declared"
        :cast-locked="game.castLocked"
        @cast="game.cast($event)"
        @end-turn="game.endTurn()"
      />

      <CastFeedback />

      <div v-if="game.mySecrets.length > 0" class="mt-3 rounded-xl border border-brand-300/50 bg-brand-100 p-3">
        <div class="mb-2 text-xs text-brand-700">🔮 你的秘密牌（轮末存活时每张 +1 分）</div>
        <div class="flex flex-wrap gap-1.5">
          <SpellCard
            v-for="(id, i) in [...game.mySecrets].sort((a, b) => a - b)"
            :key="i"
            :spell-id="id"
            size="sm"
          />
        </div>
      </div>


      <!-- 轮结束：权威摘要与下一轮操作 -->
      <section v-if="isRoundEnd" data-testid="round-recap" class="mt-4 rounded-2xl border border-brand-300 bg-gradient-to-b from-brand-100 to-white p-4 shadow-sm sm:p-5">
        <div class="text-center">
          <p class="text-xs font-bold tracking-wider text-brand-600">第 {{ game.roomState.round }} 轮结算</p>
          <h2 class="mt-1 text-xl font-bold text-ink">
            {{ roundWinner?.nickname ?? '本轮无人获胜' }}
          </h2>
          <p class="mt-1 text-sm text-ink-soft">
            <span v-if="decisiveSpell">决定性魔法：{{ decisiveSpell.name }} · </span>{{ roundReason }}
          </p>
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <article
            v-for="row in roundSummary?.standings ?? []"
            :key="row.id"
            class="rounded-xl border border-line bg-white p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate text-sm font-bold text-ink">{{ row.nickname }}</span>
              <span class="shrink-0 text-sm font-bold text-brand-700">本轮 +{{ row.gained ?? 0 }} 分</span>
            </div>
            <dl class="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
              <div class="rounded-lg bg-brand-50 px-1 py-2"><dt class="text-muted">轮胜分</dt><dd class="font-bold">{{ row.scoreBySource?.roundWinPoints ?? 0 }}</dd></div>
              <div class="rounded-lg bg-brand-50 px-1 py-2"><dt class="text-muted">幸存分</dt><dd class="font-bold">{{ row.scoreBySource?.survivalPoints ?? 0 }}</dd></div>
              <div class="rounded-lg bg-brand-50 px-1 py-2"><dt class="text-muted">秘密牌分</dt><dd class="font-bold">{{ row.scoreBySource?.secretPoints ?? 0 }}</dd></div>
            </dl>
          </article>
        </div>

        <div v-if="startingHandCounts.length" class="mt-4 rounded-xl border border-line bg-white p-3">
          <h3 class="text-sm font-bold text-ink">你手里原来有</h3>
          <p class="mt-1 text-sm leading-6 text-ink-soft">
            <span v-for="(item, index) in startingHandCounts" :key="item.spell.id">
              {{ index ? '、' : '' }}{{ item.spell.name }} × {{ item.count }}
            </span>
          </p>
        </div>

        <div class="mt-4 rounded-xl bg-brand-50 p-3">
          <div class="text-sm font-bold text-brand-700">先到 {{ game.roomState.targetScore ?? 8 }} 分</div>
          <div class="mt-2 flex flex-wrap gap-2 text-xs text-ink-soft">
            <span v-for="player in game.roomState.players" :key="player.id" class="rounded-full bg-white px-3 py-1.5">
              {{ player.nickname }} {{ player.score }} 分，还差 {{ Math.max(0, (game.roomState.targetScore ?? 8) - player.score) }} 分
            </span>
          </div>
        </div>

        <div class="mt-4 text-center">
        <button
          v-if="isHost"
          type="button"
          class="min-h-[44px] rounded-xl bg-brand-600 px-8 py-3 font-bold text-white shadow-lg hover:bg-brand-500"
          @click="game.nextRound()"
        >开启下一轮</button>
        <p v-else class="text-xs text-muted">等待房主开启下一轮…</p>
        </div>
      </section>

      <!-- 整场结束 -->
      <div v-if="game.lastGameOver && game.gameOverOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          ref="gameOverDialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
           class="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-gradient-to-b from-brand-100 to-white p-4 shadow-2xl sm:p-8"
          @keydown="onGameOverKeydown"
        >
         <button
           ref="gameOverCloseButton"
           type="button"
           @click="closeGameOverDetails"
           aria-label="关闭比赛结算详情"
           class="absolute top-2 right-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-sm text-muted hover:bg-white/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
           title="关闭，继续准备再来一局"
         >✕</button>
          <div class="text-center text-5xl">🏆</div>
           <h3 id="game-over-title" class="mt-3 text-center text-2xl font-bold text-ink">
             {{ game.lastGameOver.standings[0]?.nickname }} 获胜！
           </h3>
           <p v-if="game.lastGameOver.rounds" class="mt-1 text-center text-sm text-muted">共进行 {{ game.lastGameOver.rounds }} 轮</p>
           <div class="mt-4 grid gap-2 sm:grid-cols-2">
             <div
               v-for="(row, i) in game.lastGameOver.standings"
               :key="standingId(row)"
               class="rounded-xl border border-line bg-white px-3 py-3 text-sm"
             >
               <div class="flex items-center justify-between gap-2">
                 <span class="min-w-0 truncate font-bold text-ink">{{ row.rank ?? i + 1 }}. {{ row.nickname }}</span>
                 <span class="shrink-0 font-bold text-amber-600">{{ row.score }} 分</span>
               </div>
               <div class="mt-2 grid grid-cols-3 gap-1 text-center text-xs text-ink-soft">
                 <span class="rounded-lg bg-brand-50 px-1 py-1.5">轮胜 {{ row.roundWins ?? '—' }}</span>
                 <span class="rounded-lg bg-brand-50 px-1 py-1.5">击杀 {{ row.kills ?? '—' }}</span>
                 <span class="rounded-lg bg-brand-50 px-1 py-1.5">最长连放 {{ row.maxTurnCastCount ?? '—' }}</span>
               </div>
             </div>
           </div>

           <section v-if="formattedStories.length" aria-labelledby="match-stories-title" class="mt-5">
             <h4 id="match-stories-title" class="text-sm font-bold text-brand-700">本局故事</h4>
             <div class="mt-2 grid gap-2 sm:grid-cols-3">
               <article v-for="story in formattedStories" :key="story.title + story.body" class="rounded-xl border border-brand-200 bg-brand-50 p-3">
                 <div class="text-sm font-bold text-amber-600">{{ story.stars }}</div>
                 <h5 class="mt-1 text-sm font-bold text-ink">{{ story.title }}</h5>
                 <p class="mt-1 text-xs leading-5 text-ink-soft">{{ story.body }}</p>
               </article>
             </div>
           </section>

           <section v-if="game.newAchievements.length" aria-labelledby="new-achievements-title" class="mt-5">
             <h4 id="new-achievements-title" class="text-sm font-bold text-brand-700">新解锁成就</h4>
             <div class="mt-2 grid gap-2 sm:grid-cols-2">
             <div
               v-for="a in highlightedAchievements"
               :key="a.key + a.playerId"
               class="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-left"
             >
              <div class="text-sm font-bold text-amber-700">{{ '★'.repeat(a.stars) || '🥚' }} {{ a.name }}</div>
              <div class="text-xs text-muted">{{ a.desc }}</div>
              <div class="mt-1 text-xs text-muted">
                 {{ game.lastGameOver.standings.find(s => s.id === a.playerId)?.nickname || '' }}
               </div>
             </div>
             </div>
             <details v-if="remainingAchievements.length" class="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 text-left">
               <summary class="flex min-h-[44px] cursor-pointer items-center px-4 py-2 text-sm font-bold text-amber-700">
                 其余 {{ remainingAchievements.length }} 个成就
               </summary>
               <div class="space-y-2 px-4 pb-4">
                 <div v-for="a in remainingAchievements" :key="a.key + a.playerId" class="rounded-lg bg-white/80 p-3">
                   <div class="text-sm font-bold text-amber-700">{{ '★'.repeat(a.stars) || '🥚' }} {{ a.name }}</div>
                   <div class="text-xs text-muted">{{ a.desc }}</div>
                 </div>
               </div>
             </details>
           </section>

           <p v-if="game.matchReportStatus?.saved === false" role="status" class="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800">
             战报暂未保存，不影响继续游戏
           </p>

           <details v-if="game.lastGameOver.standings.some(row => row.scoreBySource || row.roundWinsByReason)" class="mt-4 rounded-xl border border-line bg-white text-left">
             <summary class="flex min-h-[44px] cursor-pointer items-center px-4 py-2 text-sm font-bold text-brand-700">查看完整统计</summary>
             <div class="space-y-3 px-4 pb-4 text-xs text-ink-soft">
               <div v-for="row in game.lastGameOver.standings" :key="'stats-' + standingId(row)" class="rounded-lg bg-brand-50 p-3">
                 <div class="font-bold text-ink">{{ row.nickname }}</div>
                 <p class="mt-1">得分：轮胜 {{ row.scoreBySource?.roundWinPoints ?? 0 }}、幸存 {{ row.scoreBySource?.survivalPoints ?? 0 }}、秘密牌 {{ row.scoreBySource?.secretPoints ?? 0 }}</p>
                 <p>轮胜方式：击杀 {{ row.roundWinsByReason?.kill ?? 0 }}、清空手牌 {{ row.roundWinsByReason?.all_spells ?? 0 }}</p>
                 <p>巨龙击杀 {{ row.dragonKills ?? 0 }}、死亡 {{ row.deaths ?? 0 }}、最多不同魔法 {{ row.maxTurnDistinctSpells ?? 0 }}</p>
               </div>
             </div>
           </details>

           <div data-testid="game-over-dialog-actions" class="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
             <button
               v-if="isHost"
               type="button"
               aria-label="结算详情内再来一局"
               class="min-h-[44px] rounded-xl bg-brand-600 px-8 py-3 font-bold text-white shadow-lg hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
               @click="game.rematch()"
             >再来一局</button>
             <p v-else class="flex min-h-[44px] items-center justify-center px-4 text-sm text-muted">等待房主再来一局…</p>
             <button
               type="button"
               aria-label="结算详情内返回大厅"
               class="min-h-[44px] rounded-xl border border-brand-200 bg-white px-8 py-3 font-bold text-brand-600 hover:border-brand-300 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
               @click="goToLobby"
             >返回大厅</button>
           </div>
         </div>
      </div>

      <div
        v-if="game.lastGameOver && !game.gameOverOpen"
        ref="postGameActions"
        tabindex="-1"
        data-testid="post-game-actions"
        class="mt-4 rounded-xl border border-brand-300 bg-brand-100 p-4 text-center"
      >
        <p class="mb-3 text-sm font-bold text-brand-700">本场已结束</p>
        <div class="flex flex-col justify-center gap-2 sm:flex-row">
          <button
            v-if="!game.gameOverOpen"
            ref="gameOverReopenButton"
            type="button"
            class="min-h-[44px] rounded-xl border border-brand-200 bg-white px-8 py-3 font-bold text-brand-600 hover:border-brand-300 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            @click="openGameOverDetails"
          >查看结算详情</button>
          <button
            v-if="isHost"
            type="button"
            class="min-h-[44px] rounded-xl bg-brand-600 px-8 py-3 font-bold text-white shadow-lg hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            @click="game.rematch()"
          >再来一局</button>
          <p v-else class="flex min-h-[44px] items-center justify-center px-4 text-sm text-muted">等待房主再来一局…</p>
          <button
            type="button"
            class="min-h-[44px] rounded-xl border border-brand-200 bg-white px-8 py-3 font-bold text-brand-600 hover:border-brand-300 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            @click="goToLobby"
          >返回大厅</button>
        </div>
      </div>
    </template>

    <!-- 连接中断/已断开：掉线必须说出来，否则玩家会以为只是别人慢 -->
    <ConnectionBanner
      :status="game.connStatus"
      :attempt="game.connAttempt"
      :max-retry="game.connMaxRetry"
      @retry="game.retryConnection()"
    />

    <!-- 我的资料（含登录入口；手机上顶栏只留这个入口） -->
    <div v-if="showProfile" class="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/25 p-4">
      <div class="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-6">
        <h2 class="mb-4 text-lg font-bold text-ink">⚙️ 我的资料</h2>
        <ProfileEditor v-model="profileDraft" :avatar-choices="avatarChoices" />
        <div class="mt-4 border-t border-line pt-4">
          <AuthBadge compact @identity-change="onIdentityChange" />
        </div>
        <div class="mt-4 flex gap-2">
          <button type="button" class="flex-1 rounded-lg border border-brand-200 bg-white py-2.5 text-sm font-bold text-brand-600" @click="showProfile = false">取消</button>
          <button type="button" class="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-bold text-white hover:bg-brand-500" @click="saveProfile">保存</button>
        </div>
      </div>
    </div>

    <GameHelp :open="helpOpen" @close="helpOpen = false" />

    <!-- 错误提示 -->
    <div
      v-if="game.error"
      class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600/90 px-4 py-2 text-sm text-white shadow-lg"
    >{{ game.error }}</div>

    <!-- 浮动聊天按钮 -->
    <button
      type="button"
      aria-label="打开聊天室"
      class="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all duration-200 hover:bg-brand-500"
      @click="chatOpen = !chatOpen"
    >
      💬
      <span v-if="hasUnread" class="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
        <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
      </span>
    </button>

    <!-- 聊天面板 -->
    <div
      v-if="chatOpen"
      class="fixed bottom-34 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-2xl"
      style="height: 420px;"
    >
      <GameChatPanel />
    </div>
  </div>
</template>
