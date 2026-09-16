<script setup>
/**
 * 揭底后的投票面板。
 *
 * 上半区是汤面 + 汤底，下半区是投票：把 🍎 送给这一局你觉得发挥最好的玩家。
 * 观战者不能送 🍎，改成送小红花（临时点个赞，不计入任何记录）。
 *
 * 两条容易踩的规则（都在服务端判定，这里只负责别把它显示错）：
 * - appleCounts 在投票结束前是 null，**不要**用 `?? 0` 补成 0——
 *   "还没公开"和"没有人投他"是两件事，补零就泄露了，也违背"不实时显票数"的初衷。
 * - 点同一个人第二次是撤回（服务端按"名单"处理，不是按票数累加），所以选中态要如实反映。
 */
import { computed } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { avatarUrl } from '../game/avatars'

const emit = defineEmits(['leave'])

const game = useGameStore()

const isSpectator = computed(() => game.isSpectator)
const isHost = computed(() => game.amI?.isHost ?? false)
// 候选人是本局的玩家；观战者不参与评选（服务端下发的 players 已排除观战）
const candidates = computed(() => game.players)

const picks = computed(() => (isSpectator.value ? game.myFlowers : game.myApples))
const iAmCandidate = computed(() => candidates.value.some((p) => p.id === game.myPlayerId))

/** 现在能不能点：投票没结束，且我有送东西的资格（观众送花也算） */
const canPick = computed(
  () => !game.votingClosed && (isSpectator.value || game.appleQuota > 0),
)

function canPickOne(playerId) {
  if (!canPick.value) return false
  // 给自己送会被服务端拒掉；干脆置灰，省一个没必要的报错
  return !(!isSpectator.value && playerId === game.myPlayerId)
}

function isPicked(playerId) {
  return picks.value.includes(playerId)
}

function appleCount(playerId) {
  return game.appleCounts?.[playerId] ?? 0
}

function flowerCount(playerId) {
  return game.flowerCounts?.[playerId] ?? 0
}

function pick(playerId) {
  if (!canPickOne(playerId)) return
  if (isSpectator.value) game.giveFlower(playerId)
  else game.giveApple(playerId)
}

const hint = computed(() => {
  if (game.votingClosed) return ''
  if (isSpectator.value) return '你是观众，可以送小红花 🌸 —— 只是个赞，不计入任何记录'
  if (game.amModerator) return '你有 2 个 🍎：两个要送给不同的人，不能给自己。再点一下可撤回'
  if (game.appleQuota === 0) return '观战中只能看'
  return '你有 1 个 🍎。点别人即换人，再点一下撤回'
})

/** 结束后把 🍎 最多的挑出来（并列一起显示） */
const topAppleNames = computed(() => {
  if (!game.appleCounts) return []
  const entries = Object.entries(game.appleCounts)
  const max = Math.max(0, ...entries.map(([, n]) => n))
  if (max === 0) return []
  return entries
    .filter(([, n]) => n === max)
    .map(([id]) => candidates.value.find((p) => p.id === id)?.nickname)
    .filter(Boolean)
})

function chipClass(playerId) {
  if (isPicked(playerId)) return 'border-brand-400 bg-brand-500/25'
  return canPickOne(playerId)
    ? 'border-line bg-raised/60 hover:border-brand-400 hover:bg-brand-500/10 cursor-pointer'
    : 'border-line bg-raised/30 opacity-60'
}
</script>

<template>
  <div class="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
    <!-- 上半区：汤面 + 汤底 -->
    <div class="max-h-[38vh] shrink-0 overflow-y-auto border-b border-line px-5 py-4">
      <div class="text-xs font-semibold text-amber-300">🍲 汤面</div>
      <div class="mt-1 text-sm font-bold text-ink">{{ game.puzzle?.title }}</div>
      <p class="mt-1.5 text-xs leading-relaxed text-ink-soft">{{ game.puzzle?.story }}</p>

      <div class="mt-4 flex items-center gap-2">
        <span class="text-xs font-semibold text-brand-300">🔑 汤底</span>
        <span class="h-px flex-1 bg-line" />
      </div>
      <p class="mt-1.5 text-sm leading-relaxed text-ink">{{ game.puzzle?.answer }}</p>
    </div>

    <!-- 下半区：投票 -->
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-bold text-ink">这一局谁发挥最好？</span>
        <span v-if="!game.votingClosed" class="text-[11px] text-muted">
          已有 {{ game.voted }}/{{ game.voters }} 人送出
        </span>
      </div>
      <p v-if="hint" class="mt-1 text-[11px] leading-relaxed text-muted">{{ hint }}</p>

      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="p in candidates"
          :key="p.id"
          type="button"
          :disabled="!canPickOne(p.id)"
          :class="chipClass(p.id)"
          class="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition"
          @click="pick(p.id)"
        >
          <img
            v-if="avatarUrl(p.avatarId)"
            :src="avatarUrl(p.avatarId)"
            :alt="p.nickname"
            class="h-8 w-8 shrink-0 rounded-full border border-line-strong object-cover"
          />
          <span
            v-else
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-neutral text-xs font-bold text-ink"
          >{{ p.nickname?.slice(0, 1) }}</span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-semibold text-ink">
              {{ p.nickname }}<span v-if="p.id === game.myPlayerId" class="text-muted">（你）</span>
            </span>
            <span class="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none">
              <span v-if="game.appleCounts" class="text-red-300">🍎 {{ appleCount(p.id) }}</span>
              <span v-if="flowerCount(p.id)" class="text-pink-300">🌸 {{ flowerCount(p.id) }}</span>
              <span v-if="isPicked(p.id)" class="text-brand-300">✓ 已送</span>
            </span>
          </span>
        </button>
      </div>

      <p v-if="iAmCandidate && !isSpectator" class="mt-2 text-[11px] text-muted">
        你也在候选里——别人可以给你送 🍎，但你不能给自己送。
      </p>
      <p v-if="!game.votingClosed && game.votingComplete" class="mt-2 text-[11px] text-emerald-300">
        所有人都送过了，正在公布结果…
      </p>
    </div>

    <!-- 底部：结果与出口。返回大厅永远可见、永远可点 -->
    <div class="shrink-0 border-t border-line px-5 py-3">
      <div v-if="game.votingClosed" class="mb-2 text-center text-xs">
        <span v-if="topAppleNames.length" class="font-semibold text-ink">
          🍎 最多：{{ topAppleNames.join('、') }}
        </span>
        <span v-else class="text-muted">这一局没有人送出 🍎</span>
      </div>
      <div v-else class="mb-2 text-center text-[11px] text-muted">
        {{ isHost ? '点「结束投票」公布结果；全员送满会自动公布' : '等待房主结束投票…（也可以先返回大厅）' }}
      </div>

      <div class="flex gap-2">
        <button
          v-if="isHost && !game.votingClosed"
          type="button"
          class="flex-1 rounded-xl border border-brand-400/60 bg-brand-500/15 px-4 py-2.5 text-sm font-bold text-brand-200 transition hover:bg-brand-500/25"
          @click="game.closeVoting()"
        >
          结束投票
        </button>
        <button
          type="button"
          class="flex-1 rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
          @click="emit('leave')"
        >
          返回大厅
        </button>
      </div>
    </div>
  </div>
</template>
