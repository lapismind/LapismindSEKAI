<script setup>
import { avatarUrl } from '../game/avatars'

const props = defineProps({
  players: { type: Array, default: () => [] },
  myPlayerId: { type: String, default: null },
})

function playerAvatar(p) {
  return avatarUrl(p.avatarId) ?? null
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <div
      v-for="p in players"
      :key="p.id"
      class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
      :class="p.id === myPlayerId ? 'border-brand-400 bg-brand-500/20' : 'border-slate-700 bg-slate-800/60'"
    >
      <img
        v-if="playerAvatar(p)"
        :src="playerAvatar(p)"
        :alt="p.nickname"
        class="h-5 w-5 rounded-full object-cover"
      />
      <span
        v-else
        class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
        :class="p.id === myPlayerId ? 'bg-brand-400 text-white' : 'bg-slate-600 text-slate-200'"
      >
        {{ p.nickname?.slice(0, 1) }}
      </span>
      <span class="text-slate-200">{{ p.nickname }}</span>
      <span v-if="p.isHost" class="ml-0.5 text-amber-300">👑</span>
      <span v-if="p.isModerator" class="ml-0.5 text-sky-300">🕵️</span>
      <span v-if="!p.connected" class="ml-0.5 text-slate-500">(离线)</span>
    </div>
  </div>
</template>
