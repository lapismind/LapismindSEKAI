<script setup>
/**
 * 博客评论岛 —— 评论列表 + 输入框 + 登录按钮。
 * 游客可读；GitHub/账号登录后可发（≤500 字）。身份来自统一认证服务 auth.qmzhj.top。
 */
import { computed, onMounted, ref } from 'vue'
import { avatarUrlById } from '../lib/avatarChoices.js'

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
const loadingMore = ref(false)
const errorMsg = ref('')

const canPost = computed(() => user.value?.provider === 'github' || user.value?.provider === 'account')
const hasMore = computed(() => comments.value.length < total.value && !loading.value)

// 评论头像：GitHub 用户用 avatar_url；账号用户用自选本地头像（avatarId）
function commentAvatar(c) {
  if (c.avatarUrl) return c.avatarUrl
  return c.avatarId ? avatarUrlById(c.avatarId) : null
}

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

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await api(`/api/comments?page_path=${encodeURIComponent(props.pagePath)}&page=${next}&page_size=${pageSize}`)
    if (res.ok) {
      const data = await res.json()
      comments.value = comments.value.concat(data.comments ?? [])
      total.value = data.total ?? total.value
      page.value = next
    }
  } finally {
    loadingMore.value = false
  }
}

onMounted(async () => {
  loadComments()
  try {
    const me = await api('/api/me')
    if (me.ok) {
      const data = await me.json()
      // 已登录会话（GitHub 或账号）直接用；游客不主动种 cookie，发帖时再提示登录
      user.value = data?.user?.provider === 'github' || data?.user?.provider === 'account' ? data.user : null
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
      errorMsg.value = '发布评论需要先登录'
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
  <section class="comment-section mx-auto mt-12 w-full max-w-3xl">
    <h2 class="cs-title">评论 <span class="cs-title-count">({{ total }})</span></h2>

    <!-- 登录状态 / 输入区 -->
    <div v-if="canPost" class="cs-form">
      <textarea
        v-model="draft"
        rows="3"
        maxlength="500"
        placeholder="说点什么…（≤500 字）"
        class="cs-input"
      ></textarea>
      <div class="cs-form-foot">
        <span class="cs-count">{{ draft.length }}/500</span>
        <button
          type="button"
          class="cs-btn"
          :disabled="submitting || !draft.trim()"
          @click="submit"
        >
          {{ submitting ? '发布中…' : '发布' }}
        </button>
      </div>
    </div>
    <div v-else class="cs-hint">
      想参与讨论？
      <button type="button" class="cs-link" @click="login">GitHub 登录</button>
      或到
      <a href="/login" class="cs-link">进入 SEKAI 注册账号</a>
      后即可评论
    </div>
    <p v-if="errorMsg" class="cs-error">{{ errorMsg }}</p>

    <!-- 列表 -->
    <ul class="cs-list">
      <li v-for="c in comments" :key="c.id" class="cs-item">
        <img v-if="commentAvatar(c)" :src="commentAvatar(c)" alt="" class="cs-avatar" />
        <span v-else class="cs-avatar cs-avatar-fallback" aria-hidden="true">👤</span>
        <div class="cs-item-body">
          <div class="cs-item-head">
            <span class="cs-name">{{ c.nickname }}</span>
            <span class="cs-date">{{ c.createdAt }}</span>
          </div>
          <p class="cs-content">{{ c.content }}</p>
        </div>
      </li>
    </ul>
    <p v-if="!loading && comments.length === 0" class="cs-empty">还没有评论，来抢沙发吧</p>
    <p v-if="loading" class="cs-empty">加载中…</p>
    <div v-if="hasMore" class="cs-more-wrap">
      <button type="button" class="cs-more" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.comment-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--line);
}
.cs-title {
  margin: 0 0 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink);
}
.cs-title-count { font-size: 0.8rem; font-weight: 400; color: var(--muted); }
.cs-form { display: flex; flex-direction: column; gap: 0.5rem; }
.cs-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 0.6rem 0.8rem;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: var(--card-solid);
  color: var(--ink);
  font-size: 0.92rem;
  line-height: 1.6;
  outline: none;
  transition: border-color 0.15s ease;
  cursor: text;
}
.cs-input:focus { border-color: var(--primary); }
.cs-form-foot { display: flex; align-items: center; justify-content: space-between; }
.cs-count { font-size: 0.75rem; color: var(--muted); font-family: var(--font-mono); }
.cs-btn {
  padding: 0.45em 1.1em;
  border: 0;
  border-radius: 10px;
  background: var(--gradient);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: var(--cursor-pointer);
  transition: filter 0.2s ease, opacity 0.2s ease;
}
.cs-btn:hover:not(:disabled) { filter: brightness(1.08); }
.cs-btn:disabled { opacity: 0.4; cursor: default; }
.cs-hint {
  padding: 0.9rem 1rem;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  text-align: center;
  font-size: 0.9rem;
  color: var(--muted);
}
.cs-link {
  background: none;
  border: 0;
  padding: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--primary);
  cursor: var(--cursor-pointer);
  text-decoration: none;
}
.cs-link:hover { text-decoration: underline; }
.cs-error { margin: 0.5rem 0 0; text-align: center; font-size: 0.8rem; color: #d64545; }
.cs-list {
  list-style: none;
  margin: 1.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cs-item { display: flex; gap: 0.75rem; }
.cs-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--line);
  object-fit: cover;
  background: var(--primary-ghost);
}
.cs-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: var(--muted);
}
.cs-item-body { min-width: 0; }
.cs-item-head { display: flex; align-items: baseline; gap: 0.5rem; }
.cs-name { font-size: 0.88rem; font-weight: 600; color: var(--ink); }
.cs-date { font-size: 0.72rem; color: var(--muted); font-family: var(--font-mono); }
.cs-content {
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ink-soft);
  overflow-wrap: break-word;
}
.cs-empty { margin: 1.5rem 0 0; text-align: center; font-size: 0.85rem; color: var(--muted); }
.cs-more-wrap { margin-top: 1.2rem; text-align: center; }
.cs-more {
  padding: 0.4em 1.4em;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--card-solid);
  color: var(--primary);
  font-size: 0.85rem;
  font-family: var(--font-mono);
  cursor: var(--cursor-pointer);
  transition: border-color 0.2s ease, color 0.2s ease;
}
.cs-more:hover:not(:disabled) { border-color: var(--primary); }
.cs-more:disabled { opacity: 0.5; cursor: default; }
</style>
