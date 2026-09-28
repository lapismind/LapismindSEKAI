import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

// M0 调试探针：仅 dev 构建暴露 store，供 Playwright / 控制台注入状态做验证
if (import.meta.env.DEV) {
  import('@/stores/game.js').then(({ useGameStore }) => {
    window.__game = useGameStore()
  })
}
