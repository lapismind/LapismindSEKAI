<script setup>
/**
 * 个人资料编辑 —— 昵称输入 + 头像九宫格。
 * 复用方传入 avatarChoices（[{ id, url }]），v-model 绑定 { nickname, avatarId }。
 */
const model = defineModel({ type: Object, required: true })

defineProps({
  avatarChoices: { type: Array, required: true },
  // 深色主题（如海龟汤暗色大厅）：切换标签/输入框/头像描边的配色
  dark: { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex flex-col gap-3" :class="{ 'is-dark': dark }">
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
/* 浅色（默认）也优先取 design-kit 令牌，取不到再退回原硬编码——
   与文件末尾的 .is-dark 同一套约定：引了 design-kit 的项目自动同源，
   没引的项目行为不变。引了 design-kit 的三个游戏现在都在这一档。 */
.lk-field {
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--muted, #8a8299);
}

.lk-input {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--line, #d8d0e4);
  background: var(--card-solid, #ffffff);
  padding: 10px 12px;
  font-size: 14px;
  color: var(--ink, #333333);
  outline: none;
}

.lk-input:focus {
  border-color: var(--primary-brand, #8888cc);
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
  border: 2px solid var(--line, #d8d0e4);
  transition: border-color 0.15s ease;
  padding: 0;
  cursor: pointer;
}

.lk-avatar:hover {
  border-color: var(--muted, #8a8299);
}

.lk-avatar.is-active {
  border-color: var(--primary-brand, #8888cc);
  box-shadow: 0 0 0 2px rgba(136, 136, 204, 0.3);
}

.lk-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ── 深色变体 ──
   值优先取 design-kit 的令牌（消费方引了 tokens.css 就有），取不到再退回硬编码。
   这样：引了 design-kit 的项目（海龟汤）与全站设计语言同源；没引的项目
   （showhand / abracadawhat 都只传浅色）行为完全不变。
   lobby-kit 本身不依赖 design-kit，所以 fallback 必须给全。 */
.is-dark .lk-field {
  color: var(--muted, #94a3b8);
}

.is-dark .lk-input {
  border-color: var(--line, #475569);
  background: var(--field-bg, #1f2937);
  color: var(--ink, #e2e8f0);
}

.is-dark .lk-input:focus {
  border-color: var(--primary-brand, #8888cc);
}

.is-dark .lk-avatar {
  border-color: var(--line, #475569);
}

.is-dark .lk-avatar:hover {
  border-color: var(--muted, #94a3b8);
}

.is-dark .lk-avatar.is-active {
  border-color: var(--primary-brand, #8888cc);
}
</style>

