<script setup>
import { ref } from 'vue'
import SvgArt from '../components/SvgArt.vue'

const emit = defineEmits(['start','continue'])
const selected = ref('ironclad')
const seed = ref('')

function start(){ emit('start',{character:selected.value, seed:seed.value||null}) }
</script>

<template>
  <section class="screen title-screen">
    <h1 class="game-title"><span>杀戮</span><em>尖塔</em></h1>
    <p class="sub">SLAY THE SPIRE · WEB EDITION</p>
    <div class="chars">
      <div :class="['char-card',{sel:selected==='ironclad'}]" @click="selected='ironclad'">
        <div class="face"><SvgArt kind="ironclad" :size="72" /></div>
        <h4>铁甲战士</h4>
        <p>80 HP · 稳健的近战大师</p>
      </div>
      <div :class="['char-card',{sel:selected==='silent'}]" @click="selected='silent'">
        <div class="face"><SvgArt kind="silent" :size="72" /></div>
        <h4>静默猎手</h4>
        <p>70 HP · 毒素与飞刀的舞者</p>
      </div>
    </div>
    <div class="seed-row">
      <label>种子：<input v-model="seed" placeholder="留空随机" /></label>
    </div>
    <div class="actions">
      <button class="btn" @click="start">开始新征程</button>
      <button class="btn ghost" @click="emit('continue')">继续游戏</button>
    </div>
  </section>
</template>

<style scoped>
.title-screen{align-items:center;justify-content:center;background:
  radial-gradient(ellipse at 50% 110%,#3a1d18,transparent 62%),
  radial-gradient(ellipse at 50% -20%,#1b2438,transparent 60%),
  linear-gradient(180deg,#07070a,#12101a 55%,#1c1218);
}
.game-title{font-size:60px;letter-spacing:12px;margin:0;line-height:1}
.game-title span{color:#e9dcc0;text-shadow:0 0 26px #000}
.game-title em{font-style:normal;color:#c0392b;text-shadow:0 0 30px rgba(192,57,43,.6)}
.sub{color:#8d8271;letter-spacing:6px;font-size:12px;margin:12px 0 32px}
.chars{display:flex;gap:18px;margin-bottom:26px}
.char-card{width:190px;padding:18px 14px;border:1px solid #40382c;border-radius:8px;background:#191620;cursor:pointer;text-align:center;transition:.15s}
.char-card:hover{transform:translateY(-4px)}
.char-card.sel{border-color:var(--gold);box-shadow:0 0 20px rgba(217,180,106,.3)}
.face{font-size:44px;margin-bottom:8px}
h4{margin:0 0 6px;color:var(--gold2)}
p{margin:0;font-size:11px;color:#9c917e}
.seed-row input{margin-left:8px;background:#15131a;border:1px solid #423a2e;color:var(--ink);padding:5px;border-radius:3px}
.actions{margin-top:22px;display:flex;gap:16px}
</style>
