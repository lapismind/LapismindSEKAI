<script setup>
import ChipIcon from './ChipIcon.vue'
import { computed } from 'vue'
import Card from './Card.vue'
import { avatarUrl } from '../game/avatars'

const props = defineProps({
  player: { type: Object, required: true }, // 来自 room_state 的公开玩家信息
  hand: { type: Array, default: () => [] }, // 当前玩家自己的完整手牌
  isMe: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }, // 当前行动者
  spectate: { type: Boolean, default: false }, // 观众上帝视角（显示完整手牌）
  cardSize: { type: String, default: 'sm' }, // 手牌尺寸 sm | md | lg
})

const avatar = computed(() => avatarUrl(props.player.avatarId) ?? null)

// 展示的牌：
//   自己 / 观众上帝视角：暗牌翻开（闷牌占位符必须原样保留 —— 它没有牌面可翻）
//   看别人：明牌翻开 + 暗牌显示牌背占位
const displayCards = computed(() => {
  if (props.spectate || props.isMe) {
    return (props.hand || []).map((c) =>
      c.concealed ? { ...c } : { ...c, hidden: false, revealed: !!c.hidden },
    )
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
    class="flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition"
    :class="[
      isActive
        ? 'border-brand-500 bg-white ring-2 ring-brand-300/70 shadow-lg'
        : 'border-brand-200 bg-white shadow-md',
      player.folded ? 'opacity-70' : '',
    ]"
  >
    <!-- 头像 + 信息 -->
    <div class="flex items-center gap-2">
      <div class="relative">
        <img
          v-if="avatar"
          :src="avatar"
          :alt="player.nickname"
          class="h-10 w-10 rounded-full border object-cover"
          :class="player.connected ? 'border-brand-300' : 'border-[#D8D0E4] opacity-40'"
        />
        <span
          v-else
          class="flex h-10 w-10 items-center justify-center rounded-full border border-brand-300 bg-brand-50 text-lg text-brand-600"
        >{{ player.nickname?.[0] }}</span>
        <span v-if="player.isHost" class="absolute -top-1 -right-1 text-xs">👑</span>
      </div>
      <div class="text-left">
        <div class="truncate text-sm font-bold text-[#333333]">
          {{ player.nickname }}
          <span v-if="isMe" class="text-xs text-brand-600">(我)</span>
        </div>
        <div class="flex items-center gap-1 text-xs text-[#8A8299]">
          <ChipIcon :size="14" color="#8888cc" />
          <span class="font-num">{{ player.chips }}</span>
        </div>
      </div>
    </div>

    <!-- 手牌 -->
    <div class="flex flex-nowrap justify-center gap-1">
      <Card
        v-for="(c, i) in displayCards"
        :key="i"
        :card="c"
        :size="cardSize"
      />
    </div>

    <!-- 状态：闷牌标记优先于下注额，因为它是这一轮的决策状态 -->
    <div class="flex h-4 items-center gap-1.5 text-xs font-semibold">
      <span
        v-if="player.blind"
        class="rounded-full bg-brand-100 px-1.5 py-px text-[10px] text-brand-700"
        title="闷牌中：没看牌，下注半价"
      >闷</span>
      <span :class="player.folded ? 'text-[#A29BB5]' : 'text-brand-700'">{{ betLabel }}</span>
    </div>
  </div>
</template>
