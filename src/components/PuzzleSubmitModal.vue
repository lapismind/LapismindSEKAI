<script setup>
import { ref } from 'vue'
import { api } from '../network/api'

const emit = defineEmits(['submitted'])

const open = ref(false)
const title = ref('')
const story = ref('')
const answer = ref('')
const submitting = ref(false)
const error = ref('')
const done = ref(false)

function reset() {
  title.value = ''
  story.value = ''
  answer.value = ''
  error.value = ''
  done.value = false
}

function close() {
  open.value = false
  reset()
}

async function submit() {
  if (submitting.value) return
  if (!title.value.trim() || !story.value.trim() || !answer.value.trim()) {
    error.value = '标题、汤面、汤底都是必填的'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await api.addPuzzle({
      title: title.value.trim(),
      story: story.value.trim(),
      answer: answer.value.trim(),
    })
    done.value = true
    emit('submitted')
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- 触发按钮 -->
    <button
      type="button"
      class="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
      @click="open = true"
    >
      📝 提交我的海龟汤
    </button>

    <!-- 弹窗 -->
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="close">
      <div class="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <!-- 头部 -->
        <div class="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <span class="text-sm font-bold text-slate-100">📝 提交你的海龟汤</span>
          <button type="button" class="text-slate-400 hover:text-slate-200" @click="close">✕</button>
        </div>

        <!-- 成功提示 -->
        <div v-if="done" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10">
          <div class="text-3xl">🎉</div>
          <div class="text-sm font-semibold text-slate-200">提交成功！</div>
          <div class="text-center text-xs text-slate-500">
            你的谜题已加入题库，房主选谜题时就能看到。
          </div>
          <button
            type="button"
            class="mt-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-500"
            @click="close"
          >
            完成
          </button>
        </div>

        <!-- 表单 -->
        <div v-else class="flex flex-col gap-3 overflow-y-auto px-5 py-4">
          <div>
            <label class="mb-1 block text-xs text-slate-500">标题（名字）</label>
            <input
              v-model="title"
              class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="给谜题取个名字"
              maxlength="30"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">汤面（谜题描述）</label>
            <textarea
              v-model="story"
              class="h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="描述一个奇怪的场景或结局…"
              maxlength="500"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">汤底（真相答案）</label>
            <textarea
              v-model="answer"
              class="h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="写下完整真相…（玩家猜中前不会被看到）"
              maxlength="1000"
            />
          </div>
          <p class="text-[11px] leading-relaxed text-slate-600">
            提示：汤底写清楚关键真相，AI 主持人会用它来判断玩家的提问。
          </p>

          <div v-if="error" class="rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-300">{{ error }}</div>

          <button
            type="button"
            class="mt-1 rounded-xl bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-500 disabled:opacity-50"
            :disabled="submitting"
            @click="submit"
          >
            {{ submitting ? '提交中…' : '提交谜题' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
