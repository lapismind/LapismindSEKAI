<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7EFF8] p-4 text-[#333333]">
    <h1 class="text-xl font-bold">A4 测试大厅</h1>
    <button
      type="button"
      class="min-h-[44px] rounded-xl bg-brand-600 px-8 py-3 font-bold text-white"
      @click="router.push('/room/ROOMB')"
    >进入房间 B</button>
  </main>
</template>
