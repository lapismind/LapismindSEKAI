<script setup>
// 骨架占位。玩法与界面等 docs/specs/ 的规格定了再做。
const stage = '脚手架'
</script>

<template>
  <main class="mx-auto max-w-2xl p-8 text-slate-200">
    <h1 class="text-2xl font-semibold">niigo-party</h1>
    <p class="mt-2 text-sm text-slate-400">
      25時、ナイトコードで。四人回合制联机派对游戏 · 当前阶段：{{ stage }}
    </p>

    <div class="mt-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-sm leading-relaxed">
      <p class="font-medium">下一步要做的</p>
      <ol class="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
        <li>写玩法规格 → <code>docs/specs/</code></li>
        <li>接 lobby-kit（大厅 / 房间码 / 邀请链接）</li>
        <li>图版层：棋盘 + 战斗 + 卡牌</li>
        <li>小游戏层</li>
      </ol>
    </div>
  </main>
</template>
