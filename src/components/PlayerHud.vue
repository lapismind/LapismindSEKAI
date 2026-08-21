<script setup>
defineProps({
  player: { type: Object, required: true }
})
</script>

<template>
  <aside class="hud">
    <div class="hud-avatar">🛡️</div>
    <div class="hud-hp">
      <div class="hp-bar"><div class="hp-fill" :style="{width:(player.hp/player.maxHp*100)+'%'}"></div></div>
      <span class="hp-text">{{ player.hp }}/{{ player.maxHp }}</span>
    </div>
    <div class="orb-energy">{{ player.energy ?? 0 }}<small>/{{ player.energyMax ?? 3 }}</small></div>
    <div v-if="(player.block||0)>0" class="block-shield">{{ player.block }}</div>
    <div class="gold">💰 {{ player.gold ?? 0 }}</div>
    <div class="floor-tag">第 {{ player.floor ?? 0 }} 层</div>
    <div class="relics">
      <span v-for="r in player.relics" :key="r" class="relic-dot" :title="r"></span>
    </div>
  </aside>
</template>

<style scoped>
.hud{
  position:absolute;left:14px;top:70px;width:180px;padding:14px;
  background:linear-gradient(180deg,rgba(10,10,13,.94),rgba(10,10,13,.78));
  border:1px solid #302a22;border-radius:8px;display:flex;flex-direction:column;gap:10px;z-index:20;
}
.hud-avatar{font-size:32px;text-align:center}
.gold,.floor-tag{font-size:12px;color:#a89b84;text-align:center}
.relics{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.relic-dot{width:22px;height:22px;border-radius:50%;background:#5a4c37;border:1px solid #6d5c40;display:inline-grid;place-items:center;font-size:11px}
</style>
