<script setup>
import { computed } from 'vue'
import { SPELLS, canCast } from '../core/rules'

const props = defineProps({
  myHandSize: { type: Number, default: 0 },
  lastCastLevel: { type: Number, default: null },
  isMyTurn: { type: Boolean, default: false },
  hasSuccessfulCast: { type: Boolean, default: false },
  hasFailedCast: { type: Boolean, default: false },
  // 本回合是否已宣告过一次魔法（客户端本地标记，不等服务端回包）
  hasDeclared: { type: Boolean, default: false },
  // 施法请求发出后到结果回来前的提交锁，防止连点重复发送
  castLocked: { type: Boolean, default: false },
})

const emit = defineEmits(['cast', 'end-turn'])

// 我不知道自己手里有什么！只能任意宣告一种魔法。
// 等级限制仍然适用：不能宣告比上一次更罕见的魔法。
const declareOptions = computed(() =>
  SPELLS.map(spell => ({
    ...spell,
    levelOk: canCast(props.lastCastLevel, spell.id),
  }))
)

// 猜错后本回合不能再施法，只能结束回合。
const lockedByFailure = computed(() => props.hasFailedCast)

// 宣告过一次魔法（无论成败）结束回合按钮就必须可用：
// 服务端规则“至少宣告一次才能结束”，客户端用 hasDeclared 兜住回包延迟。
const endTurnEnabled = computed(
  () => props.hasSuccessfulCast || props.hasFailedCast || props.hasDeclared
)

function clickSpell(spell) {
  if (props.isMyTurn && spell.levelOk && !lockedByFailure.value && !props.castLocked) {
    emit('cast', spell.id)
  }
}
</script>

<template>
  <div class="rounded-xl border border-[#D8D0E4] bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <div class="text-sm font-bold text-white">施法区</div>
      <button
        v-if="isMyTurn"
        type="button"
        :disabled="!endTurnEnabled"
        class="rounded-lg border border-[#CFCFE9] bg-white px-4 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-brand-300 hover:text-brand-500"
        :class="!endTurnEnabled ? 'cursor-not-allowed opacity-50' : ''"
        title="必须先宣告一次魔法才能结束回合"
        @click="emit('end-turn')"
      >
        结束回合
      </button>
    </div>

    <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
      <button
        v-for="spell in declareOptions"
        :key="spell.id"
        type="button"
        :disabled="!isMyTurn || !spell.levelOk || lockedByFailure || castLocked"
        class="flex flex-row items-center gap-1 rounded-full border px-3 py-1.5 transition"
        :class="[
          isMyTurn && spell.levelOk
            ? 'border-brand-400 bg-brand-100 text-brand-800 hover:border-brand-500 hover:bg-brand-200/70 cursor-pointer'
            : 'border-[#E4DEEC] bg-[#FAF7FC] text-[#A29BB5] opacity-80',
        ]"
        :title="spell.desc"
        @click="clickSpell(spell)"
      >
        <span class="text-base">{{ spell.emoji }}</span>
        <span class="text-xs">{{ spell.name }}</span>
      </button>
    </div>

    <p v-if="lockedByFailure" class="mt-2 text-xs font-medium text-red-500">
      本回合已猜错，只能点结束回合
    </p>
    <p v-else-if="castLocked && isMyTurn" class="mt-2 text-xs font-medium text-brand-600">
      施法判定中…
    </p>
  </div>
</template>
