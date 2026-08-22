<script setup>
/**
 * 个人资料编辑 —— 昵称输入 + 头像九宫格。
 * 复用方传入 avatarChoices（[{ id, url }]），v-model 绑定 { nickname, avatarId }。
 */
const model = defineModel({ type: Object, required: true })

defineProps({
  avatarChoices: { type: Array, required: true },
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <label class="mb-1 block text-xs text-slate-500">昵称</label>
      <input
        :value="model.nickname"
        maxlength="12"
        placeholder="给自己取个名字"
        class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
        @input="model = { ...model, nickname: $event.target.value }"
      />
    </div>

    <div>
      <label class="mb-1.5 block text-xs text-slate-500">选择头像</label>
      <div class="grid grid-cols-7 gap-2">
        <button
          v-for="a in avatarChoices"
          :key="a.id"
          type="button"
          class="relative aspect-square overflow-hidden rounded-full border-2 transition"
          :class="String(model.avatarId) === String(a.id)
            ? 'border-brand-400 ring-2 ring-brand-400/40'
            : 'border-slate-700 hover:border-slate-500'"
          @click="model = { ...model, avatarId: a.id }"
        >
          <img :src="a.url" :alt="'头像' + a.id" class="h-full w-full object-cover" />
        </button>
      </div>
    </div>
  </div>
</template>
