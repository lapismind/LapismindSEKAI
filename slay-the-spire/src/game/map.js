// 地图生成

const NODE_TYPES=['monster','elite','event','rest','shop','treasure']

export function generateMap(act=1, seedFn=Math.random){
  const nodes=new Map()
  const FLOORS=15
  // 第 0 层起点（monster）
  const startId='n_0_0'
  nodes.set(startId,{id:startId,floor:0,type:'monster',x:0.5,children:[],parents:[]})
  let prevLayer=[startId]

  for(let floor=1;floor<=FLOORS-1;floor++){
    const isBoss=(floor===FLOORS-1)
    const isTreasureFloor=(floor===9)
    const isRestFloor=(floor===13)
    const layerCount = isBoss?1 : Math.min(6, 3 + (seedFn()*3|0))
    const layer=[]
    for(let i=0;i<layerCount;i++){
      const id=`n_${floor}_${i}`
      let type
      if(isBoss) type='boss'
      else if(isTreasureFloor) type='treasure'
      else if(isRestFloor) type='rest'
      else {
        // 前5层不出精英/营火
        const pool = floor<=5 ? NODE_TYPES.filter(t=>t!=='elite'&&t!=='rest') : [...NODE_TYPES]
        type=pool[Math.floor(seedFn()*pool.length)]
        // 避免连续同类特殊房间
        const parentTypes = prevLayer.map(pid=>nodes.get(pid)?.type)
        if(parentTypes.includes(type)&&type!=='monster'){
          type=pool[Math.floor(seedFn()*pool.length)]
        }
      }
      const x= layerCount===1?0.5:(i/(layerCount-1))
      nodes.set(id,{id,floor,type,x,children:[],parents:[]})
      layer.push(id)
    }
    // 连边：每条 prev 连到最近的下一层节点
    for(let pIdx=0;pIdx<prevLayer.length;pIdx++){
      const pid=prevLayer[pIdx]
      const targetIdx = Math.min(layer.length-1, Math.floor(pIdx*layer.length/prevLayer.length))
      nodes.get(pid).children.push(layer[targetIdx])
      nodes.get(layer[targetIdx]).parents.push(pid)
      // 额外随机连一条增加分支感
      if(layer.length>1 && seedFn()<0.35){
        const extra=(targetIdx+1)%layer.length
        if(!nodes.get(pid).children.includes(layer[extra])){
          nodes.get(pid).children.push(layer[extra])
          nodes.get(layer[extra]).parents.push(pid)
        }
      }
    }
    // 确保每个下一层节点至少有一个父节点（防止孤岛）
    for(const cid of layer){
      const c=nodes.get(cid)
      if(c.parents.length===0){
        // 找 x 最接近的 prev 节点连上
        let best=prevLayer[0],bestDist=Math.abs(nodes.get(prevLayer[0]).x-c.x)
        for(const pid of prevLayer){
          const d=Math.abs(nodes.get(pid).x-c.x)
          if(d<bestDist){bestDist=d;best=pid}
        }
        nodes.get(best).children.push(cid)
        c.parents.push(best)
      }
    }
    prevLayer=layer
  }
  return { nodes, roots:[startId], act }
}
