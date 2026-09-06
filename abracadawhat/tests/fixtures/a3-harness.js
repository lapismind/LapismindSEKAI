import { createApp } from 'vue'
import { createPinia } from 'pinia'
import A3Harness from './A3Harness.vue'
import '../../src/styles/global.css'

createApp(A3Harness).use(createPinia()).mount('#app')
