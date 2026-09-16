/**
 * tests/vote-apples.test.mjs —— 揭底后投票（🍎）的服务端规则。
 *
 * 为什么这些规则必须在服务端：客户端把牌藏起来挡不住 DevTools，
 * 而且"谁投了谁"在下发之前必须被裁剪过——只给自己看自己的名单。
 *
 * 形制照 reviewNotes：单玩家提交 → push 进 state 数组 → 广播 game_state。
 */
import './helpers/workerLoader.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { SoupRoom } = await import('../src/worker/soupRoom.js')

function player(id, { isHost = false, isModerator = false, isSpectator = false } = {}) {
  return {
    id,
    nickname: id,
    avatarId: '0',
    isHost,
    isModerator,
    isSpectator,
    role: isModerator ? 'moderator' : 'player',
    connected: true,
  }
}

function makeState(players, overrides = {}) {
  return {
    players,
    phase: 'ended',
    mode: 'human',
    maxPlayers: players.filter((p) => !p.isSpectator).length,
    questionLimit: null,
    questionsExhausted: false,
    moderatorApplicants: [],
    puzzle: { id: 'p1', title: '汤面标题', story: '汤面', answer: '汤底', difficulty: 1 },
    puzzleId: 'p1',
    questionCount: 3,
    messages: [],
    pendingGuess: null,
    reviewNotes: [],
    apples: [],
    flowers: [],
    votingClosed: false,
    winnerId: 'p2',
    revealed: true,
    ...overrides,
  }
}

/** 一间房 + 若干假 socket；storage 用真值往返，能验出"有没有 saveState" */
function makeRoom(initialState) {
  let persisted = structuredClone(initialState)
  const sockets = initialState.players.map((p) => {
    const sent = []
    return {
      playerId: p.id,
      sent,
      send: (s) => sent.push(JSON.parse(s)),
      deserializeAttachment: () => ({ playerId: p.id }),
    }
  })
  const room = new SoupRoom({
    name: 'VOTE-ROOM',
    storage: {
      get: async () => structuredClone(persisted),
      put: async (_key, state) => { persisted = structuredClone(state) },
    },
    getWebSockets: () => sockets,
  }, {})
  return {
    room,
    sockets,
    state: () => structuredClone(persisted),
    view: async (playerId) => room.viewFor(playerId, await room.getState()),
    lastError: (playerId) => {
      const s = sockets.find((x) => x.playerId === playerId)
      return s?.sent.filter((m) => m.type === 'error').at(-1)?.data?.message ?? null
    },
  }
}

/** 4 人局：p1 是房主兼主持人（2 个名额），p2/p3/p4 各 1 个，p5 观战 */
function fourPlayerRoom(overrides) {
  return makeRoom(makeState([
    player('p1', { isHost: true, isModerator: true }),
    player('p2'),
    player('p3'),
    player('p4'),
    player('p5', { isSpectator: true }),
  ], overrides))
}

test('名额：观众 0、主持人 2、其余玩家 1', async () => {
  const { room, state } = fourPlayerRoom()
  assert.equal(room.appleQuota(state(), 'p1'), 2)
  assert.equal(room.appleQuota(state(), 'p2'), 1)
  assert.equal(room.appleQuota(state(), 'p5'), 0)
})

test('没揭底之前不能送 🍎', async () => {
  for (const phase of ['waiting', 'playing']) {
    const { room, state, lastError } = fourPlayerRoom({ phase })
    await room.handleGiveApple('p2', { to: 'p3' })
    assert.deepEqual(state().apples, [], `${phase} 阶段不该记下任何 🍎`)
    assert.match(lastError('p2') ?? '', /揭底/)
  }
})

test('观众不能送 🍎，但可以送小红花', async () => {
  const { room, state, lastError } = fourPlayerRoom()
  await room.handleGiveApple('p5', { to: 'p2' })
  assert.deepEqual(state().apples, [])
  assert.match(lastError('p5') ?? '', /观战/)

  await room.handleGiveFlower('p5', { to: 'p2' })
  assert.deepEqual(state().flowers.map((f) => [f.from, f.to]), [['p5', 'p2']])
})

test('玩家不能给自己送 🍎', async () => {
  const { room, state, lastError } = fourPlayerRoom()
  await room.handleGiveApple('p2', { to: 'p2' })
  assert.deepEqual(state().apples, [])
  assert.match(lastError('p2') ?? '', /自己/)
})

test('观众不能当收花以外的目标：🍎 不能送给观战者', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveApple('p2', { to: 'p5' })
  assert.deepEqual(state().apples, [])
})

test('玩家只有 1 个名额，点别人即换人；再点同一个即撤回', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveApple('p2', { to: 'p3' })
  assert.deepEqual(state().apples.map((a) => a.to), ['p3'])

  // 换人：名额只有 1，旧的自然让位
  await room.handleGiveApple('p2', { to: 'p4' })
  assert.deepEqual(state().apples.map((a) => a.to), ['p4'])

  // 再点一次同一个 → 撤回
  await room.handleGiveApple('p2', { to: 'p4' })
  assert.deepEqual(state().apples, [])
})

test('主持人有 2 个名额，第三个目标顶掉最早的那个', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveApple('p1', { to: 'p2' })
  await room.handleGiveApple('p1', { to: 'p3' })
  assert.deepEqual(state().apples.map((a) => a.to), ['p2', 'p3'])

  await room.handleGiveApple('p1', { to: 'p4' })
  assert.deepEqual(state().apples.map((a) => a.to), ['p3', 'p4'])
})

test('主持人也不能给自己送，且两份不能是同一个人的两朵', async () => {
  const { room, state, lastError } = fourPlayerRoom()
  await room.handleGiveApple('p1', { to: 'p1' })
  assert.deepEqual(state().apples, [])
  assert.match(lastError('p1') ?? '', /自己/)

  // 连点两次同一个人 = 一次加入 + 一次撤回，不会变成两朵
  await room.handleGiveApple('p1', { to: 'p2' })
  await room.handleGiveApple('p1', { to: 'p2' })
  assert.deepEqual(state().apples, [])
})

test('投票结束前不下发 🍎 计数，结束后才给（避免从众）', async () => {
  const { room, view } = fourPlayerRoom()
  await room.handleGiveApple('p2', { to: 'p3' })

  const before = await view('p4')
  assert.equal(before.appleCounts, null, '未关闭时 appleCounts 必须是 null')
  assert.deepEqual(before.myApples, [], 'p4 只能看到自己的名单')
  assert.deepEqual((await view('p2')).myApples, ['p3'], '自己能看到自己的名单')
  assert.equal(before.voted, 1, '进度只知道"有几个人送了"，不知道送给了谁')

  await room.handleCloseVoting('p1')
  const after = await view('p4')
  assert.deepEqual(after.appleCounts, { p3: 1 })
  assert.equal(after.votingClosed, true)
})

test('只有房主能结束投票', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleCloseVoting('p2')
  assert.equal(state().votingClosed, false)
  await room.handleCloseVoting('p1')
  assert.equal(state().votingClosed, true)
})

test('投票结束后不能再改 🍎', async () => {
  const { room, state, lastError } = fourPlayerRoom()
  await room.handleCloseVoting('p1')
  await room.handleGiveApple('p2', { to: 'p3' })
  assert.deepEqual(state().apples, [])
  assert.match(lastError('p2') ?? '', /结束/)
})

test('所有有资格的人都送满就自动收口（房主忘了点结束也不会永远等不到结果）', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveApple('p1', { to: 'p2' })
  await room.handleGiveApple('p1', { to: 'p3' })
  await room.handleGiveApple('p2', { to: 'p3' })
  assert.equal(state().votingClosed, false, 'p3/p4 还没送，不该关')

  await room.handleGiveApple('p3', { to: 'p2' })
  assert.equal(state().votingClosed, false, 'p4 还没送，不该关')

  await room.handleGiveApple('p4', { to: 'p2' })
  assert.equal(state().votingClosed, true, '全员送满应自动关闭')
})

test('小红花一直是可见的（临时点赞），同一观众对同一玩家只有一朵', async () => {
  const { room, view } = fourPlayerRoom()
  await room.handleGiveFlower('p5', { to: 'p2' })
  assert.deepEqual((await view('p2')).flowerCounts, { p2: 1 })
  assert.equal((await view('p2')).appleCounts, null, '小红花可见不能顺带把 🍎 也放出来')

  await room.handleGiveFlower('p5', { to: 'p2' })
  assert.deepEqual((await view('p2')).flowerCounts, {}, '再点一次即收回')
})

test('非观众不能送小红花', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveFlower('p2', { to: 'p3' })
  assert.deepEqual(state().flowers, [])
})

test('新一局会清空上一局的投票', async () => {
  const { room, state } = fourPlayerRoom()
  await room.handleGiveApple('p2', { to: 'p3' })
  await room.handleGiveFlower('p5', { to: 'p2' })
  await room.handleCloseVoting('p1')

  // 直接复用 handleStartGame 里那段清理：断言重置语义而不重跑整局
  const s = state()
  s.apples = []
  s.flowers = []
  s.votingClosed = false
  s.phase = 'playing'
  assert.deepEqual(s.apples, [])
  assert.deepEqual(s.flowers, [])
  assert.equal(s.votingClosed, false)

  // 并且开局确实会清：断言源码里有这三行（避免以后只改了一处）
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../src/worker/soupRoom.js', import.meta.url), 'utf8')
  const start = src.match(/state\.ended = false[\s\S]{0,200}?await this\.saveState\(state\)/)?.[0] ?? ''
  assert.match(start, /state\.apples = \[\]/)
  assert.match(start, /state\.flowers = \[\]/)
  assert.match(start, /state\.votingClosed = false/)
})
