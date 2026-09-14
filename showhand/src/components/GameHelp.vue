<script setup>
import { ref } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'five' },
})
const emit = defineEmits(['close'])

const open = ref(true)
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2a48]/25 p-4" @click.self="emit('close')">
    <div class="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#D8D0E4] bg-white p-6 shadow-lg">
      <h2 class="mb-4 text-lg font-bold text-[#333333]">梭哈规则</h2>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-600">发牌</h3>
        <p class="text-sm text-[#5F586B]">
          {{ mode === 'seven' ? '七张梭哈：每人最终 3 张暗牌 + 4 张明牌（共 7 张）' : '五张梭哈：每人 1 张暗牌 + 4 张明牌（共 5 张）' }}
          ，明牌全桌可见，暗牌只有自己知道。
        </p>
      </section>

      <section class="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
        <h3 class="mb-1.5 text-sm font-bold text-brand-700">闷牌轮（每局第一轮）</h3>
        <p class="text-sm text-[#5F586B]">
          开局只发 <b>1 张暗牌</b>，先下注、后补牌。这一轮你可以不看牌就下注：
        </p>
        <ul class="mt-2 space-y-1 text-sm text-[#5F586B]">
          <li>· <b>闷牌</b>：不看牌，跟注和加注都只付<b>一半</b>（向上取整）</li>
          <li>· <b>看牌</b>：亮牌给自己，之后按全额下注</li>
        </ul>
        <p class="mt-2 text-xs leading-5 text-[#8A8299]">
          本轮起注额是底注的 2 倍。底注算作已投入，所以闷牌者不用再补，看牌者要补足差额。
          轮末所有人自动亮牌，下一轮的档位按实际最大投入重算 —— 也就是说
          <b>闷牌省下的一半会在下次跟注时补回来</b>：它买到的是"用一半价钱先看一张牌"，
          而不是永久打折。中途弃牌的话，省下的就是省下了。
        </p>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-600">每局流程</h3>
        <ol class="list-inside list-decimal space-y-1.5 text-sm text-[#5F586B]">
          <li>开局：每人先付底注（初始筹码的 1%）入池，各发 1 张暗牌</li>
          <li><b>第 1 轮（闷牌轮）</b>：可选看牌，或直接闷牌半价下注 → 轮末补发剩余起手牌并自动亮牌</li>
          <template v-if="mode === 'five'">
            <li><b>第 2 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 3 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 4 轮</b>：每人发最后 1 张明牌 → 下注</li>
          </template>
          <template v-else>
            <li><b>第 2 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 3 轮</b>：每人再发 1 张明牌 → 下注</li>
            <li><b>第 4 轮</b>：每人发最后 1 张明牌 + 1 张暗牌 → 下注</li>
          </template>
          <li>最后一轮下注结束 → 全部亮牌摊牌，比大小分底池</li>
        </ol>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-600">下注</h3>
        <ul class="space-y-1 text-sm text-[#5F586B]">
          <li>· 跟注：补足到当前最高下注</li>
          <li>· 加注：提高当前下注额（可多次）</li>
          <li>· 弃牌：放弃本局，已投入的筹码不退</li>
          <li>· 全下：押上全部筹码，之后不再行动但保留比牌资格</li>
          <li>· 每轮 30 秒倒计时，超时自动弃牌</li>
        </ul>
        <p class="mt-2 text-xs leading-5 text-[#8A8299]">
          闷牌时不能全下（筹码按档位怎么折算没有公认算法），要先看牌。
          看牌只能在你自己的回合进行；超时按弃牌处理，不会替你亮牌。
        </p>
      </section>

      <section class="mb-4">
        <h3 class="mb-1.5 text-sm font-bold text-brand-600">牌型（大到小）</h3>
        <p class="text-sm text-[#5F586B]">同花顺 &gt; 四条 &gt; 葫芦 &gt; 同花 &gt; 顺子 &gt; 三条 &gt; 两对 &gt; 一对 &gt; 高牌</p>
        <p class="mt-2 text-xs text-[#A29BB5]">
          {{ mode === 'seven' ? '七张牌中取最佳 5 张比大小。' : '用 5 张牌直接比大小。' }}
        </p>
      </section>

      <section class="mb-6">
        <h3 class="mb-1.5 text-sm font-bold text-brand-600">赛制</h3>
        <p class="text-sm text-[#5F586B]">
          固定局数（房主设定），筹码即积分。输光筹码的玩家转为观众，可看全桌手牌
          （但闷牌轮里没看牌的玩家，连观众也看不到）。全部局数结束后按总筹码排名。
        </p>
      </section>

      <button
        type="button"
        class="focus-ring min-h-[44px] w-full rounded-lg bg-brand-600 py-2.5 font-bold text-white transition hover:bg-brand-500"
        @click="emit('close')"
      >
        知道了
      </button>
    </div>
  </div>
</template>
