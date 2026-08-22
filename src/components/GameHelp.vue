<script setup>
import { ref } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'five' },
})
const emit = defineEmits(['close'])

const open = ref(true)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="emit('close')">
    <div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <h2 class="mb-4 text-lg font-bold text-white">梭哈规则</h2>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-300">发牌</h3>
        <p class="text-sm text-slate-300">
          {{ mode === 'seven' ? '七张梭哈：每人最终 3 张暗牌 + 4 张明牌（共 7 张）' : '五张梭哈：每人 1 张暗牌 + 4 张明牌（共 5 张）' }}
          ，明牌全桌可见，暗牌只有自己知道。
        </p>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-300">每局流程</h3>
        <ol class="list-inside list-decimal space-y-1.5 text-sm text-slate-300">
          <li>开局：每人先付底注（初始筹码的 1%）入池</li>
          <template v-if="mode === 'five'">
            <li><b>第 1 轮</b>：每人发 1 张暗牌 + 1 张明牌 → 下注</li>
            <li><b>第 2 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 3 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 4 轮</b>：每人发最后 1 张明牌 → 下注</li>
          </template>
          <template v-else>
            <li><b>第 1 轮</b>：每人发 2 张暗牌 + 1 张明牌 → 下注</li>
            <li><b>第 2 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 3 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 4 轮</b>：每人发最后 1 张明牌 + 1 张暗牌 → 下注</li>
          </template>
          <li>第 4 轮下注结束 → 全部亮牌摊牌，比大小分底池</li>
        </ol>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-300">下注</h3>
        <ul class="space-y-1 text-sm text-slate-300">
          <li>· 跟注：补足到当前最高下注</li>
          <li>· 加注：提高当前下注额（可多次）</li>
          <li>· 弃牌：放弃本局，已投入的筹码不退</li>
          <li>· 全下：押上全部筹码，之后不再行动但保留比牌资格</li>
          <li>· 每轮 30 秒倒计时，超时自动弃牌</li>
        </ul>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-300">牌型（大到小）</h3>
        <p class="text-sm text-slate-300">同花顺 &gt; 四条 &gt; 葫芦 &gt; 同花 &gt; 顺子 &gt; 三条 &gt; 两对 &gt; 一对 &gt; 高牌</p>
        <p class="mt-2 text-xs text-slate-500">
          {{ mode === 'seven' ? '七张牌中取最佳 5 张比大小。' : '用 5 张牌直接比大小。' }}
        </p>
      </section>

      <section class="mb-6">
        <h3 class="mb-1.5 text-sm font-bold text-brand-300">赛制</h3>
        <p class="text-sm text-slate-300">
          固定局数（房主设定），筹码即积分。输光筹码的玩家转为观众，可看全桌手牌。全部局数结束后按总筹码排名。
        </p>
      </section>

      <button class="w-full rounded-lg bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-500" @click="emit('close')">
        知道了
      </button>
    </div>
  </div>
</template>
