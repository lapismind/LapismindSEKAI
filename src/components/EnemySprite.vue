<script setup>
import SvgArt from './SvgArt.vue'

defineProps({
  enemy: { type: Object, required: true },
  isTargeting: { type: Boolean, default: false },
})
</script>

<template>
  <div class="enemy" :class="{targeting:isTargeting}">
    <div v-if="enemy.intent" class="intent">
      <span v-if="enemy.intent.type==='attack'||enemy.intent.intentType==='attack'">⚔️ {{ enemy.intent.dmg || enemy.intent.damage }}<template v-if="enemy.intent.times">×{{ enemy.intent.times }}</template></span>
      <span v-else-if="enemy.intent.type==='defend'">🛡️</span>
      <span v-else-if="enemy.intent.type==='buff'">⬆️</span>
      <span v-else-if="enemy.intent.type==='debuff'">⬇️</span>
      <span v-else>❓</span>
    </div>
    <div class="sprite"><SvgArt :kind="enemy.id" :size="72" /></div>
    <div class="name">{{ enemy.name }}</div>
    <div class="hp-bar"><div class="hp-fill" :style="{width:(Math.max(0,enemy.hp)/enemy.maxHp*100)+'%'}"></div><div class="hp-text">{{ Math.max(0,enemy.hp) }}/{{ enemy.maxHp }}</div></div>
    <div class="buffs-row">
      <span v-if="enemy.block>0" class="block-shield">{{ enemy.block }}</span>
      <span v-for="(v,k) in enemy.buffs||{}" :key="k" class="buff-chip" :title="k">{{ k }} {{ v }}</span>
    </div>
  </div>
</template>

<style scoped>
.enemy{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px;border-radius:10px;min-width:130px;transition:.15s}
.enemy.targeting{outline:2px dashed var(--gold);background:rgba(217,180,106,.1);cursor:pointer}
.intent{font-size:13px;color:#f3dda6;background:#14121a;border:1px solid #4a4034;padding:3px 9px;border-radius:14px}
.sprite{font-size:52px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.6))}
.name{color:#cfc7b5;font-size:12px}
.hp-bar{width:110px;height:16px;position:relative;background:#241a17;border:1px solid #4d3a2c;border-radius:3px;overflow:hidden}
.hp-fill{height:100%;background:linear-gradient(90deg,#c0392b,#e05a49)}
.hp-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;text-shadow:0 1px 2px #000}
.buffs-row{display:flex;flex-wrap:wrap;gap:3px;font-size:10px}
.buff-chip{background:#2a2333;border:1px solid #555;padding:1px 5px;border-radius:8px;color:#aaa}
</style>
