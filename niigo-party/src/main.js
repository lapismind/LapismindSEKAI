import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')
