<script setup>
defineProps({
  event: { type: Object, required: true }
})

const emit = defineEmits(['choose'])

function optionText(opt) {
  if (opt == null) return ''
  if (typeof opt === 'string') return opt
  return opt.text || opt.label || opt.desc || ''
}
</script>

<template>
  <section class="event-room">
    <div class="event-panel">
      <h2 class="event-title">{{ event.title }}</h2>
      <p class="event-desc">{{ event.desc }}</p>
      <div class="event-options">
        <button
          v-for="(opt, i) in event.options || []"
          :key="i"
          class="option-btn"
          @click="emit('choose', i)"
        >
          {{ optionText(opt) }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.event-room {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, #241c12 0%, #120d08 70%);
  padding: 24px;
}
.event-panel {
  width: min(640px, 94vw);
  background: linear-gradient(165deg, #2b2118, #1a130d);
  border: 2px solid #6b5636;
  border-radius: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.65);
  padding: 32px 36px;
}
.event-title {
  margin: 0 0 16px;
  color: #f0c75e;
  font-size: 24px;
  letter-spacing: 3px;
  text-align: center;
}
.event-desc {
  margin: 0 0 26px;
  color: #d8ccb4;
  line-height: 1.8;
  font-size: 15px;
  white-space: pre-wrap;
}
.event-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.option-btn {
  padding: 13px 18px;
  border-radius: 9px;
  border: 1px solid #5a4a30;
  background: #33291d;
  color: #e8dcc0;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
}
.option-btn:hover {
  background: #463823;
  border-color: #d4af37;
  transform: translateX(4px);
}
</style>
