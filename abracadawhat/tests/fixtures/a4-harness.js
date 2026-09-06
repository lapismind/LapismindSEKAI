import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import RoomView from '../../src/views/RoomView.vue'
import A4Harness from './A4Harness.vue'
import '../../src/styles/global.css'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div>大厅</div>' } },
    { path: '/room/:code', component: RoomView },
  ],
})

await router.push('/room/A4TEST')
await router.isReady()
createApp(A4Harness).use(createPinia()).use(router).mount('#app')
