import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import LobbyView from './views/LobbyView.vue'
import RoomView from './views/RoomView.vue'
import './styles/global.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LobbyView },
    { path: '/room/:code', component: RoomView },
  ],
})

createApp(App).use(createPinia()).use(router).mount('#app')

