import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    watch: {
      ignored: ['**/.wrangler/**', '**/node_modules/**'],
    },
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Deduplicate pinia/vue for file: linked sub-packages
      pinia: path.resolve(import.meta.dirname, 'node_modules/pinia'),
      vue: path.resolve(import.meta.dirname, 'node_modules/vue'),
      'pinia/': path.resolve(import.meta.dirname, 'node_modules/pinia/'),
      'vue/': path.resolve(import.meta.dirname, 'node_modules/vue/'),
    },
  },
  build: { outDir: 'dist' },
})
