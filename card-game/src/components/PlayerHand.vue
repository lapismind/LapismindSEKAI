<script setup>
import { computed, ref } from 'vue'
import Card from './Card.vue'

const props = defineProps({
  cards: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false }, // 是否可选中
  cardSize: { type: String, default: 'md' },
})

const emit = defineEmits(['play'])

const selectedIndexes = ref(new Set())

const maxVisible = computed(() => Math.min(props.cards.length, 13))

function toggleSelect(card, index) {
  if (!props.interactive) return
  const next = new Set(selectedIndexes.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  selectedIndexes.value = next
}

function handleSelect(card) {
  const index = props.cards.indexOf(card)
  toggleSelect(card, index)
}

function onPlayClick() {
  const selected = [...selectedIndexes.value].map((i) => props.cards[i])
  if (selected.length === 0) return
  emit('play', selected)
  selectedIndexes.value = new Set()
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div class="flex items-end justify-center gap-0.5 px-2">
      <Card
        v-for="(card, i) in cards"
        :key="card.id"
        :card="card"
        :face-up="true"
        :selected="selectedIndexes.has(i)"
        :disabled="!interactive"
        :size="cardSize"
        :style="{ marginLeft: i > 0 && maxVisible < cards.length ? '-0.75rem' : 0 }"
        @select="handleSelect"
      />
    </div>

    <button
      v-if="interactive"
      type="button"
      class="rounded-full bg-amber-500 px-5 py-1.5 text-sm font-bold text-slate-900 shadow transition hover:bg-amber-400 disabled:opacity-40"
      :disabled="selectedIndexes.size === 0"
      @click="onPlayClick"
    >
      出牌 ({{ selectedIndexes.size }})
    </button>
  </div>
</template>
