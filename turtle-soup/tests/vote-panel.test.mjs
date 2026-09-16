/**
 * tests/vote-panel.test.mjs —— 投票面板（Phase 3）的接线回归。
 *
 * 守两类容易回退的东西：
 * 1. 结束覆盖层曾经把 click 绑在容器上（没有 .self），揭底后点到卡片里任何位置
 *    都会直接"返回大厅"。有了投票面板之后这个误触的代价更大（打字/点选都会被踢出去）。
 * 2. appleCounts 在投票结束前是 null（"还没公开"），前端不能把它当成 0
 *    —— 那是"没有人投他"，两件事不一样，补零就直接泄露了结果。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8')

test('结束覆盖层不再把"返回大厅"绑在容器 click 上', async () => {
  const src = await read('../src/views/RoomView.vue')
  const overlay = src.match(/v-if="game\.phase === 'ended'"[\s\S]*?<VotePanel/)?.[0] ?? ''
  assert.ok(overlay, '找不到结束覆盖层')
  assert.doesNotMatch(overlay, /@click="game\.revealed/)
  assert.doesNotMatch(overlay, /resetAndLeave\(\) : game\.reveal\(\)/)
  // 推进揭底的那一下只挂在庆祝块（button）上
  assert.match(overlay, /@click="game\.reveal\(\)"/)
})

test('面板结构：上半区汤面+汤底，下半区投票', async () => {
  const src = await read('../src/components/VotePanel.vue')
  assert.match(src, /🍲 汤面/)
  assert.match(src, /🔑 汤底/)
  assert.match(src, /这一局谁发挥最好/)
})

test('返回大厅始终可点，不被投票状态挡住', async () => {
  const src = await read('../src/components/VotePanel.vue')
  // 按 testid 精确定位到那一个 <button>：别用"从 <button 起算 N 个字符内出现某文案"
  // 这种范围表达式——加一个属性就会把它撑爆，而且失败信息只会说"找不到"。
  const buttonAround = (testid) => {
    const at = src.indexOf(`data-testid="${testid}"`)
    assert.ok(at > 0, `找不到 ${testid}`)
    return src.slice(src.lastIndexOf('<button', at), src.indexOf('</button>', at))
  }

  const leave = buttonAround('vote-leave')
  assert.doesNotMatch(leave, /v-if/, '返回大厅不能被 v-if 包住')
  assert.match(leave, /@click="emit\('leave'\)"/)

  // 「结束投票」才是房主专属、会随状态隐藏的那个
  assert.match(buttonAround('vote-close'), /v-if="isHost && !game\.votingClosed"/)
})

test('未公开的 🍎 计数不能被当成 0', async () => {
  const panel = await read('../src/components/VotePanel.vue')
  // 只有在 v-if="game.appleCounts" 守卫下的展示才允许 ?? 0
  assert.match(panel, /v-if="game\.appleCounts"/)
  const store = await read('../src/stores/gameStore.js')
  assert.match(store, /appleCounts\.value = s\.appleCounts \?\? null/)
})

test('store 接上了三个投票指令，并在 hydrate/reset 里覆盖了全部投票字段', async () => {
  const store = await read('../src/stores/gameStore.js')
  assert.match(store, /Msg\.SEND_GIVE_APPLE/)
  assert.match(store, /Msg\.SEND_GIVE_FLOWER/)
  assert.match(store, /Msg\.SEND_CLOSE_VOTING/)
  const votedFields = ['myApples', 'myFlowers', 'appleQuota', 'appleCounts', 'flowerCounts', 'votingClosed', 'votingComplete', 'voted', 'voters']
  for (const field of votedFields) {
    assert.match(store, new RegExp(`${field}\\.value = `), `${field} 没有在 hydrate/reset 里赋值`)
    // 声明 + hydrate 都对了，但忘了放进 return，pinia store 上取到的就是 undefined，
    // 组件里 .includes 直接抛 TypeError、面板整块消失——构建和单测都发现不了。
    // 所以"导出了"必须单独断言一次。
    assert.match(store, new RegExp(`^\\s*${field},\\s*$`, 'm'), `${field} 没有从 store 导出`)
  }
  // 三个 action 同理
  for (const action of ['giveApple', 'giveFlower', 'closeVoting']) {
    assert.match(store, new RegExp(`^\\s*${action},\\s*$`, 'm'), `${action} 没有从 store 导出`)
  }
})

test('候选与出口带稳定的 data-testid —— 浏览器验证不该依赖昵称', async () => {
  // 教训：生产环境有 auth，游客身份会把玩家在大厅输入的名字覆盖掉，
  // 于是"按昵称找候选按钮"的脚本在本地过、在生产找不到。锚点要跟显示名解耦。
  const src = await read('../src/components/VotePanel.vue')
  assert.match(src, /:data-testid="'vote-candidate-' \+ p\.id"/)
  assert.match(src, /data-testid="vote-close"/)
  assert.match(src, /data-testid="vote-leave"/)
})

test('面板点击不再重复实现名额规则，一律交给服务端仲裁', async () => {
  const panel = await read('../src/components/VotePanel.vue')
  // 前端只做"置灰"这一层体验，不做资格判定的真源
  assert.match(panel, /!isSpectator\.value && playerId === game\.myPlayerId/)
  assert.match(panel, /game\.giveApple\(playerId\)/)
  assert.match(panel, /game\.giveFlower\(playerId\)/)
})
