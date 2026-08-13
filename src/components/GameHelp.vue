<script setup>
import { ref } from 'vue'

const open = ref(false)

const SECTIONS = [
  {
    icon: '🎯',
    title: '怎么玩',
    items: [
      '房主创建房间，选择「AI 主持」或「真人主持」，设置人数（2-8）和问题上限。',
      '房主选一个谜题（汤面）并开始游戏。',
      '玩家轮流提问，主持人只能回答「是 / 否 / 是也不是 / 无关」。',
      '大家根据回答推理出完整真相（汤底）后，房主/主持人点击「揭底」公布答案。',
    ],
  },
  {
    icon: '🤖',
    title: 'AI 主持（大肥鱼）',
    items: [
      'AI 模式由 deepseek-v4-flash 扮演主持人「大肥鱼」，自动判定每个提问。',
      '「是也不是」表示你的方向部分正确但没到真相，是重要的推理线索。',
      'AI 只回答固定几个字，不带分析，防止剧透。',
    ],
  },
  {
    icon: '🕵️',
    title: '真人主持',
    items: [
      '游戏开始前可「报名当主持人」，多人报名随机抽一位，没人报名则随机选。',
      '主持人负责回答玩家的提问：点「是 / 否 / 是也不是 / 无关」。',
      '主持人也可以主动「揭底」结束游戏。',
    ],
  },
  {
    icon: '👁',
    title: '观战',
    items: [
      '房间满员后，新进入的玩家自动成为观战者，不占玩家名额。',
      '也可手动切换「观战 / 加入对局」（游戏中不能加入，要等下一局）。',
      '观战不能提问，但可以看牌局、参与右侧的复盘讨论。',
    ],
  },
  {
    icon: '📜',
    title: '问答记录 & 复盘',
    items: [
      '右侧按钮打开侧边栏，可切换「问答记录」和「复盘」两个页面。',
      '复盘：所有人可写共享笔记，房主/主持人还能点「AI 复盘」让大肥鱼给出不剧透的提示。',
    ],
  },
  {
    icon: '⏳',
    title: '规则细节',
    items: [
      '3 秒内只能有一个玩家提问（节流，防止刷屏）。',
      '房主可设置全场问题上限，用尽后自动等待揭底。',
      '汤面是纸片卡片，点击左上角展开查看。',
    ],
  },
]
</script>

<template>
  <!-- 悬浮帮助按钮 -->
  <button
    type="button"
    class="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-brand-500/40 bg-slate-900/80 text-xl text-brand-300 shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-slate-800"
    title="游戏说明"
    @click="open = true"
  >
    ❓
  </button>

  <!-- 弹窗 -->
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="open = false">
    <div class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-brand-700/40 bg-slate-900 shadow-2xl">
      <!-- 头部 -->
      <div class="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <span class="text-sm font-bold text-brand-300">🫕 真冬的海龟汤 · 游戏说明</span>
        <button type="button" class="text-slate-400 transition hover:text-slate-200" @click="open = false">✕</button>
      </div>

      <!-- 内容 -->
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div class="flex flex-col gap-4">
          <div v-for="sec in SECTIONS" :key="sec.title" class="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
            <div class="mb-1.5 text-sm font-bold text-slate-100">
              {{ sec.icon }} {{ sec.title }}
            </div>
            <ul class="flex flex-col gap-1.5">
              <li
                v-for="(item, i) in sec.items"
                :key="i"
                class="flex gap-1.5 text-xs leading-relaxed text-slate-300"
              >
                <span class="shrink-0 text-brand-400">·</span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="border-t border-slate-800 px-5 py-3 text-center text-[11px] text-slate-600">
        祝推理愉快 🍲
      </div>
    </div>
  </div>
</template>
