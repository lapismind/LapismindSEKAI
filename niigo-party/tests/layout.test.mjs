/**
 * tests/layout.test.mjs —— 地块注册表 + 布局文件 + 布局校验
 * node --test tests/*.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES, LAYOUT, LOOP_A, LOOP_B, mirrorTile, ringOfTile } from '../src/game/board.js';
import { TILE_TYPES, PLACEABLE_TYPES, tileDef } from '../src/game/tiles.js';
import { validateLayout, CROSS_TILES } from '../src/game/layout.js';
import { createGame, rollMove, moveStep } from '../src/game/engine.js';

const topo = { mirrorTile, ringOfTile, LOOP_A, LOOP_B };
const face10 = (v) => (v - 1) / 10 + 0.01;

test('布局文件：68 格且全部是注册表里的类型', () => {
  assert.equal(LAYOUT.types.length, 68);
  for (const t of LAYOUT.types) assert.ok(TILE_TYPES[t], `未注册的类型 ${t}`);
  assert.deepEqual(TILES.map((t) => t.type), LAYOUT.types);
});

test('布局校验：当前布局无错误、无警告', () => {
  const r = validateLayout(LAYOUT.types, topo);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.count.cross, 4);
});

test('布局校验：交点被改 / 非交点放交点 → 错误', () => {
  const t = [...LAYOUT.types];
  t[4] = 'coin';
  t[1] = 'cross';
  const r = validateLayout(t, topo);
  assert.ok(r.errors.some((e) => e.includes('4 号格')));
  assert.ok(r.errors.some((e) => e.includes('1 号格')));
});

test('布局校验：长度不对 / 未知类型 / 无法升级 → 错误', () => {
  assert.ok(validateLayout(LAYOUT.types.slice(1), topo).errors.length);
  const t = [...LAYOUT.types]; t[1] = 'nope';
  assert.ok(validateLayout(t, topo).errors.some((e) => e.includes('未知')));
  const noLv = LAYOUT.types.map((x) => (x === 'start' || x === 'upgrade' ? 'blank' : x));
  assert.ok(validateLayout(noLv, topo).errors.some((e) => e.includes('无法升级')));
});

test('布局校验：打破中心对称只给警告', () => {
  const t = [...LAYOUT.types];
  t[1] = 'misfortune';
  const r = validateLayout(t, topo);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes(`1↔${mirrorTile(1)}`)));
});

test('注册表：交点锁定不可放置；每个可放置类型都有展示信息', () => {
  assert.ok(TILE_TYPES.cross.locked);
  assert.ok(!PLACEABLE_TYPES.includes('cross'));
  for (const k of PLACEABLE_TYPES) {
    const d = TILE_TYPES[k];
    assert.ok(d.name && d.label && d.icon && d.color && d.desc, `${k} 缺展示字段`);
  }
  assert.equal(tileDef('不存在').name, TILE_TYPES.blank.name);
});

test('空格：落地无效果，直接进入行动阶段', () => {
  const s = createGame([{ charKey: 'ena', playerName: 'P1' }, { charKey: 'knd', playerName: 'P2' }]);
  const saved = TILES[1].type;
  TILES[1].type = 'blank';           // 临时改地块（TILES 是可变数组，测完还原）
  try {
    s.players[1].tile = 40;
    const before = { ...s.players[0], hand: [...s.players[0].hand] };
    rollMove(s, () => face10(1));
    moveStep(s);
    assert.equal(s.players[0].tile, 1);
    assert.equal(s.phase, 'action');
    assert.equal(s.players[0].coins, before.coins);
    assert.equal(s.players[0].hp, before.hp);
    assert.equal(s.players[0].hand.length, before.hand.length);
  } finally {
    TILES[1].type = saved;
  }
});

test('交点格号与拓扑一致', () => {
  assert.deepEqual(CROSS_TILES, TILES.filter((t) => t.type === 'cross').map((t) => t.i));
});
