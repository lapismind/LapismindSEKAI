<script setup>
/**
 * 博客评论岛 —— 评论列表 + 输入框 + 登录按钮。
 * 游客可读；GitHub 登录后可发（≤500 字）。身份来自统一认证服务。
 */
import { onMounted, ref, computed } from 'vue'

const props = defineProps({
  pagePath: { type: String, required: true },
  authBaseUrl: { type: String, default: 'https://auth.qmzhj.top' },
})

const user = ref(null)
const comments = ref([])
 const total = ref(0)
const page = ref(1)
const pageSize = 20
const draft = ref('')
const submitting = ref(false)
const loading = ref(true)
const errorMsg = ref('')

const canPost = computed(() => user.value?.provider === 'github')

async function api(path, opts = {}) {
  return fetch(`${props.authBaseUrl}${path}`, { credentials: 'include', ...opts })
}

async function loadComments() {
  try {
    const res = await api(`/api/comments?page_path=${encodeURIComponent(props.pagePath)}&page=${page.value}`)
    if (res.ok) {
      const data = await res.json()
      comments.value = data.comments ?? []
      total.value = data.total ?? 0
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loadComments()
  try {
    const me = await api('/api/me')
    if (me.ok) {
      const data = await me.json()
      // 已有 GitHub 会话直接用；游客不主动种（避免无谓写 cookie），发帖时再提示登录
      user.value = data?.user?.provider === 'github' ? data.user : null
    }
  } catch {
    /* 认证服务不可达时评论区仍可读 */
  }
})

function login() {
  // 完整 URL：Worker 端按域名白名单校验后回跳
  location.href = `${props.authBaseUrl}/login?redirect_to=${encodeURIComponent(location.href)}`
}

async function submit() {
  const content = draft.value.trim()
  if (!content || content.length > 500 || submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const res = await api('/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page_path: props.pagePath, content }),
    })
    if (res.status === 401) {
      errorMsg.value = '发布评论需要 GitHub 登录'
      return
    }
    if (res.status === 429) {
      errorMsg.value = '发太快啦，一分钟后再试'
      return
    }
    if (!res.ok) {
      errorMsg.value = '发布失败，请稍后再试'
      return
    }
    draft.value = ''
    page.value = 1
    await loadComments()
  } catch {
    errorMsg.value = '网络异常，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="comments mx-auto mt-12 w-full max-w-3xl border-t border-slate-200 pt-8 dark:border-slate-700">
    <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">评论 <span class="text-sm font-normal text-slate-500">({{ total }})</span></h2>

    <!-- 登录状态 / 输入区 -->
    <div v-if="canPost" class="mt-4">
      <textarea
        v-model="draft"
        rows="3"
        maxlength="500"
        placeholder="说点什么…（≤500 字）"
        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      ></textarea>
      <div class="mt-2 flex items-center justify-between">
        <span class="text-xs text-slate-400">{{ draft.length }}/500</span>
        <button
          type="button"
          :disabled="submitting || !draft.trim()"
          class="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-40"
          @click="submit"
        >
          {{ submitting ? '发布中…' : '发布' }}
        </button>
      </div>
    </div>
    <div v-else class="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-600">
      想参与讨论？
      <button type="button" class="font-semibold text-purple-600 hover:underline dark:text-purple-400" @click="login">GitHub 登录</button>
      后即可评论
    </div>
    <p v-if="errorMsg" class="mt-2 text-center text-xs text-red-500">{{ errorMsg }}</p>

    <!-- 列表 -->
    <ul class="mt-6 space-y-4">
      <li v-for="c in comments" :key="c.id" class="flex gap-3">
        <img
          v-if="c.avatarUrl"
          :src="c.avatarUrl"
          alt=""
          class="h-9 w-9 shrink-0 rounded-full border border-slate-200 dark:border-slate-600"
        />
        <span v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm dark:bg-slate-700">👤</span>
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ c.nickname }}</span>
            <span class="text-xs text-slate-400">{{ c.createdAt }}</span>
          </div>
          <p class="mt-0.5 break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">{{ c.content }}</p>
        </div>
      </li>
    </ul>
    <p v-if="!loading && comments.length === 0" class="mt-6 text-center text-sm text-slate-400">
      还没有评论，来抢沙发吧
    </p>
    <p v-if="loading" class="mt-6 text-center text-sm text-slate-400">加载中…</p>
  </section>
</template>
