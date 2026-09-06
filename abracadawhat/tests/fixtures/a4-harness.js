import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import RoomView from '../../src/views/RoomView.vue'
import A4Harness from './A4Harness.vue'
import A4LobbyHarness from './A4LobbyHarness.vue'
import '../../src/styles/global.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: A4LobbyHarness },
    { path: '/room/:code', component: RoomView },
  ],
})

await router.push('/room/A4TEST')
await router.isReady()
createApp(A4Harness).use(createPinia()).use(router).mount('#app')
