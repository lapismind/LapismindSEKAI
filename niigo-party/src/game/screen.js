/**
 * src/game/screen.js —— 棋盘格在 2.5D 底图上的屏幕坐标（渲染层用，引擎不依赖）
 *
 * 来源：Blender 渲染时从同一相机导出（niigo-board/_out/board_25d.json），基准 2400×1800。
 * 底图（素材仓 art/04_scene/board_bg.jpeg）与之同构图、同宽高比，只做统一缩放，
 * 所以 SVG 直接用 viewBox 0 0 2400 1800 叠放即可。
 */
import screen from './maps/twin-cross-68.screen.json' with { type: 'json' };

export const SCREEN_W = screen.width;
export const SCREEN_H = screen.height;
export const BOARD_BG = '/assets/niigo/scene/board_bg.jpeg';

/** i → { c: [x, y], poly: [[x, y] × 4] } */
export const SCREEN_TILES = Object.fromEntries(screen.tiles.map((t) => [t.i, { c: t.c, poly: t.poly }]));

export const polyPoints = (i) => SCREEN_TILES[i].poly.map((p) => p.join(',')).join(' ');
