import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { getSharedAuth } from '@lapismind/lobby-kit'
import { useLobbyStore } from './stores/lobbyStore'
import './assets/main.css'

const pinia = createPinia()

async function bootstrap() {
  // 统一登录预加载：解析跨子域会话（博客登录用户自动携带；游客自动登录）。
  // 有超时兜底——认证服务慢/不可达时不阻塞进游戏，身份稍后由 AuthBadge 补齐。
  const auth = getSharedAuth()
  const user = await Promise.race([
    auth.init().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
  ])

  const lobby = useLobbyStore(pinia)
  lobby.syncIdentity(user)

  createApp(App).use(pinia).mount('#app')
}

bootstrap()
