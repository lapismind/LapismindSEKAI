<script setup>
import { computed, ref } from 'vue'
import { SPELLS } from '../core/rules'

const props = defineProps({
  castCounts: { type: Object, default: () => ({}) },
  players: { type: Array, default: () => [] },
  matchHistory: { type: Array, default: () => [] },
  deckRemaining: { type: Number, default: 0 },
  secretPileRemaining: { type: Number, default: 0 },
})

// 牌堆紧张时高亮提醒（≤5 张算告急）
const deckLow = computed(() => props.deckRemaining <= 5)

// 得分榜：按分数降序
const standings = computed(() => {
  const players = props.players.filter(p => p.score > 0 || p.health > 0 || p.alive)
  return [...players].sort((a, b) => b.score - a.score)
})

// 全局总得分
const globalTotals = computed(() => {
  const totals = {}
  ;(props.matchHistory || []).forEach(match => {
    match.standings?.forEach(s => {
      if (!totals[s.id]) totals[s.id] = { ...s, score: 0 }
      totals[s.id].nickname = s.nickname
      totals[s.id].avatarId = s.avatarId
      totals[s.id].score += s.score
    })
  })
  return Object.values(totals).sort((a, b) => b.score - a.score)
})

const tableOpen = ref(false)
</script>

<template>
  <div class="rounded-xl border border-[#D8D0E4] bg-white p-4 shadow-sm">
    <div class="mb-2 flex items-center justify-between text-xs text-[#8A8299]">
      <button
        type="button"
        @click="tableOpen = !tableOpen"
        class="flex items-center gap-1 text-xs font-medium text-[#8A8299] hover:text-[#333333]"
      >
        <span>🏆 战绩</span>
        <span class="text-[#B3B3DD]">{{ tableOpen ? '▼' : '▶' }}</span>
      </button>
      <span class="flex items-center gap-3">
        <span class="rounded-full px-2.5 py-1 font-bold" :class="deckLow ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'">
          🂠 牌堆 {{ deckRemaining }}
        </span>
        <span class="rounded-full bg-[#F7EFF8] px-2.5 py-1 text-[#8A8299]">🔮 秘密牌 {{ secretPileRemaining }}</span>
      </span>
    </div>
    <!-- 已出牌展示：每种魔法已用/总数（常显，不用点开战绩） -->
    <div class="mb-2 flex flex-wrap justify-center gap-2">
      <div
        v-for="spell in SPELLS"
        :key="spell.id"
        class="flex flex-col items-center rounded-lg bg-[#F7EFF8] px-2 py-1"
        :title="spell.desc"
      >
        <span class="text-base leading-none">{{ spell.emoji }}</span>
        <span class="mt-0.5 text-[8px] leading-none text-[#8A8299]">{{ spell.name }}</span>
        <span class="text-[10px] font-bold text-brand-600">
          {{ castCounts[spell.id] ?? 0 }}/{{ spell.count }}
        </span>
      </div>
    </div>
    <!-- 战绩榜：点击展开/收起 -->
    <transition name="slide">
      <div v-if="tableOpen" class="mt-2 space-y-3 overflow-hidden">
        <!-- 本轮实时战绩 -->
        <div>
          <div class="mb-1.5 text-[9px] font-medium text-[#8A8299] uppercase">本轮实时</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-[#8A8299]">
                  <th class="pb-1.5 text-[9px] font-medium uppercase">排名</th>
                  <th class="pb-1.5 text-[9px] font-medium uppercase">玩家</th>
                  <th class="pb-1.5 text-[9px] font-medium uppercase text-right">分数</th>
                  <th class="pb-1.5 text-[9px] font-medium uppercase text-right">♥</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E6E1F0]">
                <tr v-for="(row, i) in standings" :key="row.id">
                  <td class="py-1.5">
                    <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-600">
                      {{ i + 1 }}
                    </span>
                  </td>
                  <td class="py-1.5">
                    <span class="font-medium text-[#333333]">{{ row.nickname }}</span>
                    <span v-if="row.isHost" class="ml-1 text-xs">👑</span>
                  </td>
                  <td class="py-1.5 text-right font-bold text-amber-600">{{ row.score }}</td>
                  <td class="py-1.5 text-right">
                    <span :class="row.health >= 4 ? 'text-green-600' : row.health >= 2 ? 'text-amber-600' : 'text-red-600'">
                      ♥ {{ row.health }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 历史对局 -->
        <div v-if="matchHistory.length > 0">
          <div class="mb-1.5 text-[9px] font-medium text-[#8A8299] uppercase">历史对局 ({{ matchHistory.length }} 局)</div>
          <div class="space-y-2 text-[10px]">
            <div
              v-for="(match, mi) in matchHistory"
              :key="mi"
              class="rounded-lg border border-[#E6E1F0] p-2"
            >
              <div class="mb-1 flex items-center justify-between">
                <span class="text-[#8A8299]">第 {{ matchHistory.length - mi }} 局 · {{ new Date(match.endedAt).toLocaleDateString() }}</span>
                <span class="text-[#8A8299]">冠军: {{ match.standings?.[0]?.nickname || '—' }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(s, si) in match.standings"
                  :key="s.id"
                  class="inline-flex items-center gap-1 rounded-full bg-[#F7EFF8] px-2 py-0.5"
                >
                  <span class="text-xs">{{ s.nickname }}</span>
                  <span class="text-amber-600">★ {{ s.score }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 全局总得分 -->
        <div v-if="globalTotals.length > 0">
          <div class="mb-1.5 text-[9px] font-medium text-[#8A8299] uppercase">全局总得分</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-[#8A8299]">
                  <th class="pb-1 text-[9px] font-medium uppercase">玩家</th>
                  <th class="pb-1 text-[9px] font-medium uppercase text-right">积分</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E6E1F0]">
                <tr v-for="(t, i) in globalTotals" :key="t.id">
                  <td class="py-1">
                    <span class="font-medium text-[#333333]">{{ t.nickname }}</span>
                  </td>
                  <td class="py-1 text-right">
                    <span class="text-amber-600 font-bold">{{ t.score }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
