<script setup>
import { computed } from 'vue'

const props = defineProps({
  map: { type: Object, required: true },
  currentNodeId: String,
  availableNodeIds: Array,
  visitedNodeIds: Array,
})
const emit = defineEmits(['node-click'])

function iconFor(type){
  return {monster:'⚔️',elite:'💀',event:'❓',rest:'🔥',shop:'🏪',treasure:'🎁',boss:'👑'}[type]||'❔'
}
function isAvailable(n){ return (props.availableNodeIds||[]).includes(n.id) }
function isVisited(n){ return (props.visitedNodeIds||[]).includes(n.id) }

// 展开所有连线为 {x1,y1,x2,y2}
const FLOORS=15; const NODE_W=600; const NODE_H=1200
const lines = computed(()=>{
  if(!props.map?.nodes)return[]
  const nodes=[...props.map.nodes.values()]
  const out=[]
  for(const n of nodes){
    for(const cid of (n.children||[])){
      const c=props.map.nodes.get(cid)
      if(!c)continue
      out.push({
        x1:n.x*90+5, y1:(FLOORS-1-n.floor)*5.5+3.5,
        x2:c.x*90+5, y2:(FLOORS-1-c.floor)*5.5+3.5,
        active:isAvailable(n)&&isAvailable(c),
      })
    }
  }
  return out
})
</script>

<template>
  <section class="screen map-screen">
    <h2 class="map-title">地图</h2>
    <div class="map-scroll">
      <div class="map-canvas">
        <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line v-for="(l,i) in lines" :key="i"
            :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2"
            :class="{active:l.active}" />
        </svg>
        <div v-for="n in [...map.nodes.values()].sort((a,b)=>b.floor-a.floor)"
             :key="n.id"
             class="mnode"
             :class="{avail:isAvailable(n),visited:isVisited(n),cur:n.id===currentNodeId}"
             :style="{left:(n.x*90+5)+'%', top:(14-n.floor)*5.2+'%'}"
             @click="isAvailable(n) && emit('node-click', n.id)">
           {{ iconFor(n.type) }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-screen{background:linear-gradient(180deg,#0b0a0f,#131019);padding-top:40px}
.map-title{text-align:center;color:var(--gold2);letter-spacing:4px;margin:0}
.map-scroll{flex:1;overflow:auto;position:relative}
.map-canvas{position:relative;width:600px;height:1200px;margin:0 auto}
.lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.lines line{stroke:#2e2820;stroke-width:.5}
.lines line.active{stroke:var(--gold);stroke-width:.8;opacity:.6}
.mnode{position:absolute;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;
  background:#14121a;border:2px solid #3d3628;color:#666;transition:.15s}
.mnode.avail{cursor:pointer;border-color:var(--gold);color:var(--gold2);background:#241d14;animation:pulse 1.6s infinite}
.mnode.avail:hover{transform:scale(1.18)}
.mnode.visited{opacity:.45}
.mnode.cur{border-color:#fff3cf;box-shadow:0 0 20px rgba(255,240,192,.55)}
@keyframes pulse{0%,100%{box-shadow:0 0 6px rgba(217,180,106,.3)}50%{box-shadow:0 0 16px rgba(217,180,106,.7)}}
</style>
