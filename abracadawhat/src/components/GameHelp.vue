<script setup>
import { SPELLS } from '../core/rules'

defineProps({ open: Boolean })
const emit = defineEmits(['close'])
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    @click.self="emit('close')"
  >
    <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-bold text-white">📖 游戏规则</h2>
        <button type="button" class="text-[#A29BB5] hover:text-[#444444]" @click="emit('close')">✕</button>
      </div>

      <div class="space-y-3 text-sm text-[#444444]">
        <p>每人每轮 6❤️、5 张暗手牌。你能看别人的牌，但看不到自己的。</p>
        <p>
          轮到你时，喊出一种魔法名：手里真有就打出并生效，可以继续施法（下次不能比这次更罕见），
          或主动结束回合（必须先成功施法一次）。没有这张牌则失败扣血，回合结束。
        </p>

        <h3 class="pt-2 font-bold text-brand-300">八种魔法（成功效果）</h3>
        <ul class="space-y-1.5">
          <li v-for="s in SPELLS" :key="s.id" class="flex gap-2 rounded-lg bg-[#F7EFF8] p-2">
            <span class="text-lg">{{ s.emoji }}</span>
            <div>
              <div class="font-semibold text-[#333333]">{{ s.name }} <span class="text-xs font-normal text-[#8A8299]">×{{ s.count }}</span></div>
              <div class="text-xs text-[#8A8299]">{{ s.desc }}</div>
            </div>
          </li>
        </ul>

        <h3 class="pt-2 font-bold text-brand-300">计分</h3>
        <p>击败他人：你 +3、存活者 +1；清空所有魔法：你 +3、其他人 0；用错魔法自杀：其他人 +1。</p>
        <p>🔮 秘密牌不能打出——轮末你还活着时，每张秘密牌额外 +1 分。</p>
        <p>先达到 {{ 8 }} 分者获胜 🏆</p>
      </div>
    </div>
  </div>
</template>
