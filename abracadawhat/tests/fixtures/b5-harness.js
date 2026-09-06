import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import RoomView from '../../src/views/RoomView.vue'
import B5Harness from './B5Harness.vue'
import '../../src/styles/global.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/room/:code', component: RoomView }],
})

await router.push('/room/B5TEST')
await router.isReady()
createApp(B5Harness).use(createPinia()).use(router).mount('#app')
