<script setup>
import { computed } from 'vue'
import SpellCard from './SpellCard.vue'
import { avatarUrl } from '../game/avatars'
const props = defineProps({
  player: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
  isCurrent: { type: Boolean, default: false },
})

const avatar = computed(() => avatarUrl(props.player.avatarId))

// 我自己的手牌显示为背面；别人的手牌正面朝上
const showFaceDown = computed(() => props.isMe)

// 手牌按魔法序号升序排列（古代巨龙1 → 魔法药水8），便于快速找牌
const sortedHand = computed(() =>
  [...(props.player.hand ?? [])].sort((a, b) => a - b)
)
</script>

<template>
  <div
    class="flex flex-row items-center gap-2 rounded-xl border p-2.5 transition"
    :class="[
      isCurrent ? 'border-brand-500 bg-white shadow-lg' : 'border-[#D8D0E4] bg-white',
      !player.alive ? 'opacity-50 grayscale' : '',
    ]"
  >
    <!-- 头像 + 昵称/分数（紧凑纵排） -->
    <div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#D8D0E4] bg-[#F7EFF8]">
      <img v-if="avatar" :src="avatar" :alt="player.nickname" class="h-full w-full object-cover" />
      <span v-else class="flex h-full items-center justify-center text-xs text-[#A29BB5]">{{ player.nickname.slice(0,1) }}</span>
    </div>
    <div class="shrink-0">
    <div class="truncate text-sm font-semibold leading-tight text-[#333333]">
        {{ player.nickname }}
        <span v-if="player.isHost">👑</span>
        <span v-if="isMe" class="text-brand-600">我</span>
      </div>
      <div class="text-xs text-[#8A8299]">{{ player.score }} 分</div>
      <!-- 生命 + 秘密牌：数字呈现，收进头像列下方，收紧横向空间适配手机 -->
      <div class="mt-0.5 flex items-center gap-2 text-xs leading-none">
        <span :title="'生命 ' + player.health + '/6'">♥ {{ player.health }}</span>
        <span class="text-purple-500">🔮×{{ player.secretsCount }}</span>
      </div>
    </div>

    <!-- 手牌（始终单行横排，五张牌不换行；手牌区瓜分头像列右边全部空间） -->
    <div class="ml-auto flex flex-nowrap items-center justify-end gap-1.5 min-w-0">
      <template v-if="showFaceDown">
        <div v-for="i in (player.handSize || 5)" :key="i" class="flex-1 min-w-0">
          <SpellCard face-down size="sm" fluid />
        </div>
      </template>
      <template v-else>
        <div v-for="(id, i) in sortedHand" :key="i" class="flex-1 min-w-0">
          <SpellCard :spell-id="id" size="sm" fluid />
        </div>
      </template>
    </div>
  </div>
</template>
