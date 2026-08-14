<script setup>
import { ref } from 'vue'
import { api } from '../network/api'

const emit = defineEmits(['close'])

const open = ref(true)
const content = ref('')
const contact = ref('')
const submitting = ref(false)
const error = ref('')
const done = ref(false)

const QQ = '123456789' // TODO: 替换为真实 QQ 号

async function submit() {
  if (submitting.value) return
  if (!content.value.trim()) {
    error.value = '请写下你的反馈内容'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await api.feedback({ content: content.value.trim(), contact: contact.value.trim() })
    done.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

function close() {
  open.value = false
  emit('close')
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="close">
    <div class="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-brand-700/40 bg-slate-900 shadow-2xl">
      <!-- 头部 -->
      <div class="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <span class="text-sm font-bold text-brand-300">💬 意见反馈</span>
        <button type="button" class="text-slate-400 transition hover:text-slate-200" @click="close">✕</button>
      </div>

      <!-- 成功 -->
      <div v-if="done" class="flex flex-col items-center gap-3 px-6 py-10">
        <div class="text-3xl">🎉</div>
        <div class="text-sm font-semibold text-slate-200">感谢你的反馈！</div>
        <div class="text-center text-xs text-slate-500">我们会认真查看每条建议，让游戏变得更好。</div>
        <button type="button" class="mt-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-500" @click="close">
          完成
        </button>
      </div>

      <!-- 表单 -->
      <div v-else class="flex flex-col gap-3 overflow-y-auto px-5 py-4">
        <!-- QQ 联系 -->
        <div class="rounded-xl border border-sky-700/50 bg-sky-900/20 p-3">
          <div class="text-sm font-semibold text-sky-300">📮 想直接聊？</div>
          <div class="mt-1 flex items-center justify-between">
            <span class="text-xs text-slate-400">加 QQ：</span>
            <button
              type="button"
              class="rounded-md bg-sky-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-sky-500"
              @click="navigator.clipboard?.writeText(QQ)"
            >
              复制 {{ QQ }}
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">反馈内容</label>
          <textarea
            v-model="content"
            class="h-28 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            placeholder="遇到问题？有建议？写下想说的话…"
            maxlength="2000"
          />
        </div>

        <div>
          <label class="mb-1 block text-xs text-slate-500">联系方式（选填，方便我们回复你）</label>
          <input
            v-model="contact"
            class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
            placeholder="QQ / 微信 / 邮箱"
            maxlength="100"
          />
        </div>

        <div v-if="error" class="rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{{ error }}</div>

        <button
          type="button"
          class="mt-1 rounded-xl bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-500 disabled:opacity-50"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交反馈' }}
        </button>
      </div>
    </div>
  </div>
</template>
