<script setup>
/**
 * 统一身份徽章 —— 各游戏大厅 / 房间共用的登录入口。
 *
 * - 页面加载时 init()：博客登录的用户（GitHub / 账号）自动带会话进来；
 *   游客自动登录（服务端签发 playerId 写入会话 cookie）。
 * - 游客可一键 GitHub 登录，或用用户名密码注册（游客注册 = 升级，战绩保留）/ 登录。
 * - 登录态变化通过 @identity-change 事件通知宿主（同步大厅身份、必要时重连）。
 *
 * 复用方：
 *   <AuthBadge @identity-change="onIdentityChange" />
 */
import { computed, onMounted, ref } from 'vue'
import { createAuthClient, getSharedAuth } from '../auth.js'

const props = defineProps({
  // 认证服务地址；留空用默认（生产 auth.qmzhj.top，非 qmzhj 域 fallback localhost:8787）
  authBaseUrl: { type: String, default: '' },
  // GitHub 登录成功后的回跳路径（默认当前 pathname+search，游戏内可传房间路径）
  redirectPath: { type: String, default: '' },
  // 紧凑模式（房间内）：只显示身份 + 登录按钮，隐藏注册弹层按钮与退出
  compact: { type: Boolean, default: false },
  // 深色主题（如海龟汤暗色大厅）：切换文字/边框配色
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['identity-change'])

const user = ref(null)
const loading = ref(true)
const modalOpen = ref(false)
const regName = ref('')
const regPass = ref('')
const logName = ref('')
const logPass = ref('')
const msg = ref('')
const msgErr = ref(false)

let auth = null

const isGuest = computed(() => user.value?.provider === 'guest')
const displayName = computed(() => user.value?.displayName || user.value?.nickname || '玩家')
const initial = computed(() => (displayName.value || '?').slice(0, 1).toUpperCase())

function notify() {
  emit('identity-change', user.value)
}

onMounted(async () => {
  // 与 main.js 预加载共用同一实例：不重复 init，登录后各模块读到同一身份
  auth = props.authBaseUrl ? createAuthClient({ baseUrl: props.authBaseUrl }) : getSharedAuth()
  try {
    await auth.init()
  } catch { /* init 内部已静默降级 */ }
  user.value = auth.getUser()
  loading.value = false
  notify()
})

function githubLogin() {
  const dest =
    props.redirectPath || (typeof location !== 'undefined' ? location.pathname + location.search : '/')
  auth.loginWithGithub(dest)
}

async function logout() {
  try {
    await auth.logout()
  } catch { /* 认证服务不可达时也清本地身份 */ }
  user.value = null
  notify()
}

function showMsg(text, err = false) {
  msg.value = text
  msgErr.value = err
}

const ERROR_MAP = {
  'invalid name': '用户名需 3-20 位字母/数字/下划线',
  'invalid password': '密码至少 6 位',
  'name taken': '这个用户名已被占用',
  'wrong name or password': '用户名或密码不对',
  'rate limited, try later': '操作太频繁，稍后再试',
}
function mapError(code) {
  return ERROR_MAP[code] || '出错了，请稍后再试'
}

async function submitRegister() {
  const r = await auth.register(regName.value.trim(), regPass.value)
  if (!r.ok) return showMsg(mapError(r.error), true)
  user.value = auth.getUser()
  modalOpen.value = false
  notify()
}

async function submitLogin() {
  const r = await auth.loginWithPassword(logName.value.trim(), logPass.value)
  if (!r.ok) return showMsg(mapError(r.error), true)
  user.value = auth.getUser()
  modalOpen.value = false
  notify()
}
</script>

<template>
  <div class="lk-authbadge" :class="{ 'is-dark': dark }">
    <div v-if="loading" class="lk-auth-row lk-muted">
      <span class="lk-avatar-fallback">···</span>
      <span>身份获取中…</span>
    </div>

    <!-- 已登录（GitHub / 账号） -->
    <div v-else-if="user && !isGuest" class="lk-auth-row">
      <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="lk-avatar-img" />
      <span v-else class="lk-avatar-fallback">{{ initial }}</span>
      <span class="lk-name" :title="user.provider === 'github' ? 'GitHub 账号' : '账号用户'">
        {{ displayName }}
      </span>
      <button v-if="!compact" type="button" class="lk-btn lk-btn-ghost" @click="logout">退出</button>
      <button v-else type="button" class="lk-btn lk-btn-icon" title="退出登录" @click="logout">×</button>
    </div>

    <!-- 游客 -->
    <div v-else-if="user" class="lk-auth-row">
      <span class="lk-avatar-fallback">👤</span>
      <span class="lk-name lk-muted">{{ user.nickname || '游客' }}</span>
      <button type="button" class="lk-btn lk-btn-primary" @click="githubLogin">GitHub 登录</button>
      <button
        v-if="!compact"
        type="button"
        class="lk-btn lk-btn-ghost"
        @click="modalOpen = true"
      >
        注册/登录
      </button>
      <button
        v-else
        type="button"
        class="lk-btn lk-btn-icon"
        title="用户名密码登录"
        @click="modalOpen = true"
      >
        🔑
      </button>
    </div>
  </div>

  <!-- 账号登录 / 注册弹层 -->
  <div v-if="modalOpen" class="lk-mask" @click.self="modalOpen = false">
    <div class="lk-modal">
      <div class="lk-modal-head">
        <span>账号登录</span>
        <button type="button" class="lk-btn lk-btn-icon" @click="modalOpen = false">×</button>
      </div>
      <p class="lk-hint">游客注册后，战绩和成就直接保留到新账号。</p>

      <form @submit.prevent="submitRegister" class="lk-form">
        <label>
          注册用户名
          <input v-model="regName" type="text" minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" placeholder="3-20 位字母/数字/下划线" autocomplete="username" required />
        </label>
        <label>
          注册密码
          <input v-model="regPass" type="password" minlength="6" maxlength="72" placeholder="至少 6 位" autocomplete="new-password" required />
        </label>
        <button type="submit" class="lk-btn lk-btn-primary lk-btn-wide">注册并登录</button>
      </form>

      <div class="lk-divider">或</div>

      <form @submit.prevent="submitLogin" class="lk-form">
        <label>
          用户名
          <input v-model="logName" type="text" autocomplete="username" required />
        </label>
        <label>
          密码
          <input v-model="logPass" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit" class="lk-btn lk-btn-ghost lk-btn-wide">登录</button>
      </form>

      <p class="lk-msg" :class="{ 'is-err': msgErr }">{{ msg }}</p>
    </div>
  </div>
</template>

<style scoped>
.lk-authbadge {
  display: flex;
  justify-content: center;
}

.lk-auth-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(127, 127, 127, 0.08);
  border: 1px solid rgba(127, 127, 127, 0.18);
  font-size: 13px;
}

.lk-avatar-img {
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  object-fit: cover;
  border: 1px solid rgba(127, 127, 127, 0.35);
}

.lk-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background: rgba(127, 127, 127, 0.2);
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.lk-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333333;
}

.is-dark .lk-name {
  color: #e2e8f0;
}

.lk-muted {
  color: #8a8299;
}

.is-dark .lk-muted {
  color: #94a3b8;
}

.lk-btn {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: opacity 0.15s ease, border-color 0.15s ease;
}

.lk-btn:hover {
  opacity: 0.85;
}

.lk-btn-primary {
  background: #6b6bd0;
  color: #ffffff;
}

.lk-btn-ghost {
  background: transparent;
  border-color: rgba(127, 127, 127, 0.4);
  color: #555555;
}

.is-dark .lk-btn-ghost {
  border-color: #475569;
  color: #cbd5e1;
}

.lk-btn-icon {
  background: transparent;
  border-color: rgba(127, 127, 127, 0.3);
  color: #666666;
  min-width: 26px;
  padding: 2px 8px;
}

.is-dark .lk-btn-icon {
  border-color: #475569;
  color: #cbd5e1;
}

.lk-btn-wide {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
}

.lk-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 30, 0.45);
  padding: 16px;
}

.lk-modal {
  width: 100%;
  max-width: 340px;
  max-height: 88vh;
  overflow-y: auto;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(20, 20, 40, 0.35);
  padding: 16px 18px;
}

.lk-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #333333;
}

.lk-hint {
  margin: 8px 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #8a8299;
}

.lk-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lk-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #555555;
}

.lk-form input {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d8d0e4;
  background: #ffffff;
  font-size: 13px;
  color: #333333;
  outline: none;
}

.lk-form input:focus {
  border-color: #6b6bd0;
}

.lk-divider {
  margin: 10px 0;
  text-align: center;
  font-size: 12px;
  color: #b0a8bd;
}

.lk-msg {
  min-height: 1.2em;
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: oklch(0.55 0.13 150);
}

.lk-msg.is-err {
  color: #d64545;
}
</style>
