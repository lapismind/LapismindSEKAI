<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { JUDGE_LABEL } from '../game/judge'
import { JUDGE_FX, judgeHasFx } from '../game/judgeFx'
import { avatarUrl } from '../game/avatars'
import deepseekPng from '../assets/deepseek.png'

const AI_NAME = '大肥鱼'

/** 头像：优先图片，无则首字占位 */
function playerAvatar(p) {
  return avatarUrl(p.avatarId) ?? null
}

const props = defineProps({
  players: { type: Array, default: () => [] },
  myPlayerId: { type: String, default: null },
  moderatorId: { type: String, default: null },
  mode: { type: String, default: 'ai' },
  messages: { type: Array, default: () => [] },
})

/**
 * 布局：主持人居中，玩家环形环绕。
 * 自己固定底部，其余人按加入顺序均匀分布。 */
const SEAT_RADIUS_PCT = 36 // 座位半径（相对容器对角线/2）
const moderator = computed(
  () => props.players.find((p) => p.id === props.moderatorId) ?? null,
)

const otherPlayers = computed(() =>
  props.players.filter((p) => p.id !== props.moderatorId),
)

/** 计算每位玩家的环形位置（百分比坐标） */
const seatPositions = computed(() => {
  const count = otherPlayers.value.length
  if (count === 0) return []
  // 自己固定在底部（90°），其余按顺时针依次排开
  const selfIdx = otherPlayers.value.findIndex((p) => p.id === props.myPlayerId)
  const base = selfIdx === -1 ? 0 : selfIdx

  return otherPlayers.value.map((p, i) => {
    // 从底部开始逆时针编号，但把"我"放在正下方
    const rel = (i - base + count) % count
    const angle = (rel / count) * 360 - 90 // -90° 让第0个在最上方
    const rad = (angle * Math.PI) / 180
    const cx = 50 + SEAT_RADIUS_PCT * Math.cos(rad)
    const cy = 50 + SEAT_RADIUS_PCT * Math.sin(rad)
    return { x: cx, y: cy }
  })
})

/** 最近一条主持人回答（用于指向动画） */
const lastJudge = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    const m = props.messages[i]
    if (m.judge && m.from === 'moderator') {
      return m
    }
  }
  return null
})

/** 指向动画 + 动图：当出现新判定时，指向被回答的玩家并弹动图 */
const pointer = ref(null) // { fromX, fromY, toX, toY, judge, targetName, gif }
const pointerTimer = ref(null)

function findPlayerPos(playerId) {
  const idx = otherPlayers.value.findIndex((p) => p.id === playerId)
  if (idx === -1) return null
  return seatPositions.value[idx]
}

watch(
  () => props.messages.length,
  () => {
    const j = lastJudge.value
    if (!j) return
    const targetId = j.forPlayer
    if (!targetId) return
    const targetPos = findPlayerPos(targetId)
    if (!targetPos) return
    const target = otherPlayers.value.find((p) => p.id === targetId)
    pointer.value = {
      ...targetPos,
      judge: j.judge,
      targetName: target?.nickname ?? '',
      gif: judgeHasFx(j.judge) ? JUDGE_FX[j.judge] : null,
    }
    if (pointerTimer.value) clearTimeout(pointerTimer.value)
    pointerTimer.value = setTimeout(() => (pointer.value = null), 4000)
  },
)

onBeforeUnmount(() => {
  if (pointerTimer.value) clearTimeout(pointerTimer.value)
})

const judgeColor = (judge) =>
  ({ yes: '#34d399', no: '#f87171', irrelevant: '#94a3b8', ambiguous: '#fbbf24', correct: '#fbbf24' }[judge] ?? '#94a3b8')

const moderatorLabel = computed(() => (props.mode === 'ai' ? AI_NAME : '主持人'))
</script>

<template>
  <div class="relative h-full w-full">
    <!-- 环形座位 -->
    <template v-for="(p, i) in otherPlayers" :key="p.id">
      <div
        class="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        :style="{ left: seatPositions[i]?.x + '%', top: seatPositions[i]?.y + '%' }"
      >
        <div
          class="flex flex-col items-center gap-1"
          :class="p.id === myPlayerId ? 'scale-110' : ''"
        >
          <!-- 头像：优先图片，无则首字 -->
          <img
            v-if="playerAvatar(p)"
            :src="playerAvatar(p)"
            :alt="p.nickname"
            class="h-14 w-14 rounded-full border-2 object-cover shadow-lg"
            :class="p.id === myPlayerId ? 'border-brand-400' : 'border-slate-600'"
          />
          <div
            v-else
            class="flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold shadow-lg"
            :class="p.id === myPlayerId
              ? 'border-brand-400 bg-brand-500/30 text-white'
              : 'border-slate-600 bg-slate-800 text-slate-100'"
          >
            {{ p.nickname?.slice(0, 1) }}
          </div>
          <div class="rounded-full bg-slate-900/80 px-2 py-0.5 text-xs text-slate-300">
            {{ p.nickname }}<span v-if="p.id === myPlayerId" class="ml-0.5 text-brand-300">(我)</span>
          </div>
        </div>
      </div>
    </template>

    <!-- 中央主持人 -->
    <div class="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
      <div class="flex flex-col items-center gap-1.5">
        <!-- AI 主持：大肥鱼头像 -->
        <img
          v-if="mode === 'ai'"
          :src="deepseekPng"
          class="h-20 w-20 rounded-full border-2 border-brand-300 object-cover shadow-xl"
          :alt="AI_NAME"
        />
        <!-- 真人主持：头像/首字 -->
        <img
          v-else-if="moderator && playerAvatar(moderator)"
          :src="playerAvatar(moderator)"
          :alt="moderator.nickname"
          class="h-20 w-20 rounded-full border-2 border-sky-300 object-cover shadow-xl"
        />
        <div
          v-else
          class="flex h-20 w-20 items-center justify-center rounded-full border-2 text-2xl font-bold shadow-xl border-sky-300 bg-gradient-to-br from-sky-500 to-indigo-600 text-white"
        >
          {{ moderator ? moderator.nickname?.slice(0, 1) : '🕵️' }}
        </div>
        <div class="rounded-full bg-slate-900/90 px-3 py-1 text-sm font-semibold text-slate-200">
          {{ moderatorLabel }}
          <span v-if="moderator" class="ml-1 text-xs text-slate-500">{{ moderator.nickname }}</span>
        </div>

        <!-- 最近一次判定气泡 -->
        <div
          v-if="lastJudge"
          class="rounded-full px-3 py-1 text-xs font-bold text-slate-900 animate-fade-up"
          :style="{ backgroundColor: judgeColor(lastJudge.judge) }"
        >
          {{ JUDGE_LABEL[lastJudge.judge] }}
        </div>
      </div>
    </div>

    <!-- SVG 指向线 -->
    <svg class="pointer-events-none absolute inset-0 z-30 h-full w-full" v-if="pointer">
      <line
        :x1="50 + '%'" :y1="50 + '%'"
        :x2="pointer.x + '%'" :y2="pointer.y + '%'"
        :stroke="judgeColor(pointer.judge)"
        :stroke-width="3"
        stroke-dasharray="6 4"
        class="pointer-line"
      />
      <circle :cx="pointer.x + '%'" :cy="pointer.y + '%'" r="5" :fill="judgeColor(pointer.judge)" />
    </svg>

    <!-- 判定动图：弹出在提问玩家头顶 -->
    <div
      v-if="pointer?.gif"
      class="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
      :style="{ left: pointer.x + '%', top: 'calc(' + pointer.y + '% - 76px)' }"
    >
      <img
        :src="pointer.gif"
        class="fx-img"
        :alt="JUDGE_LABEL[pointer.judge]"
      />
    </div>
  </div>
</template>

<style scoped>
.pointer-line {
  animation: pointer-fade 0.3s ease-out;
}
.fx-img {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  animation: fx-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes pointer-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fx-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
