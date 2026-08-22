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
      <label class="lk-field">昵称</label>
      <input
        :value="model.nickname"
        maxlength="12"
        placeholder="给自己取个名字"
        class="lk-input"
        @input="model = { ...model, nickname: $event.target.value }"
      />
    </div>

    <div>
      <label class="lk-field">选择头像</label>
      <div class="lk-grid">
        <button
          v-for="a in avatarChoices"
          :key="a.id"
          type="button"
          class="lk-avatar"
          :class="{ 'is-active': String(model.avatarId) === String(a.id) }"
          @click="model = { ...model, avatarId: a.id }"
        >
          <img :src="a.url" :alt="'头像' + a.id" class="h-full w-full object-cover" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lk-field {
  margin-bottom: 4px;
  font-size: 12px;
  color: #8a8299;
}

.lk-input {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #d8d0e4;
  background: #ffffff;
  padding: 10px 12px;
  font-size: 14px;
  color: #333333;
  outline: none;
}

.lk-input:focus {
  border-color: #8888cc;
}

.lk-grid {
  margin-top: 6px;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.lk-avatar {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 9999px;
  border: 2px solid #d8d0e4;
  transition: border-color 0.15s ease;
  padding: 0;
  cursor: pointer;
}

.lk-avatar:hover {
  border-color: #8a8299;
}

.lk-avatar.is-active {
  border-color: #8888cc;
  box-shadow: 0 0 0 2px rgba(136, 136, 204, 0.3);
}

.lk-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>

