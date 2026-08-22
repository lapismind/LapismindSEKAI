<script setup>
import { computed } from 'vue'
import Card from './Card.vue'
import { avatarUrl } from '../game/avatars'

const props = defineProps({
  player: { type: Object, required: true }, // 来自 room_state 的公开玩家信息
  hand: { type: Array, default: () => [] }, // 当前玩家自己的完整手牌
  isMe: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }, // 当前行动者
  spectate: { type: Boolean, default: false }, // 观众上帝视角（显示完整手牌）
})

const avatar = computed(() => avatarUrl(props.player.avatarId) ?? null)

// 展示的牌：
//   自己 / 观众上帝视角：全部翻开（包括暗牌）
//   看别人：明牌翻开 + 暗牌显示牌背占位
const displayCards = computed(() => {
  if (props.spectate || props.isMe) {
    return (props.hand || []).map((c) => ({ ...c, hidden: false, revealed: !!c.hidden }))
  }
  const pub = props.player.publicCards || []
  const total = props.player.cardCount ?? pub.length
  const cards = pub.map((c) => ({ ...c, hidden: false }))
  for (let i = 0; i < total - pub.length; i++) {
    cards.push({ suit: '', rank: 0, hidden: true })
  }
  return cards
})

const betLabel = computed(() => {
  if (props.player.allIn) return 'ALL IN'
  if (props.player.folded) return '弃牌'
  if (props.player.bet > 0) return `下注 ${props.player.bet}`
  return ''
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-1.5 rounded-2xl p-2.5"
    :class="isActive ? 'bg-brand-500/15 ring-2 ring-brand-400' : 'bg-slate-800/60'"
  >
    <!-- 头像 + 信息 -->
    <div class="flex items-center gap-2">
      <div class="relative">
        <img
          v-if="avatar"
          :src="avatar"
          :alt="player.nickname"
          class="h-10 w-10 rounded-full border-2 object-cover"
          :class="player.connected ? 'border-slate-500' : 'border-slate-700 opacity-40'"
        />
        <span
          v-else
          class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-700 text-lg"
        >{{ player.nickname?.[0] }}</span>
        <span v-if="player.isHost" class="absolute -top-1 -right-1 text-xs">👑</span>
      </div>
      <div class="text-left">
        <div class="text-sm font-bold text-white">
          {{ player.nickname }}
          <span v-if="isMe" class="text-xs text-brand-300">(我)</span>
        </div>
        <div class="text-xs text-amber-400">🪙 {{ player.chips }}</div>
      </div>
    </div>

    <!-- 手牌 -->
    <div class="flex gap-1">
      <Card
        v-for="(c, i) in displayCards"
        :key="i"
        :card="c"
        size="sm"
      />
    </div>

    <!-- 状态 -->
    <div class="h-4 text-xs font-semibold" :class="player.folded ? 'text-slate-500' : 'text-sky-300'">
      {{ betLabel }}
    </div>
  </div>
</template>
