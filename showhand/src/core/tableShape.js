/**
 * core/tableShape.js —— 牌桌几何与配色（纯函数，无 DOM 依赖）。
 *
 * 为什么单独抽出来：游戏内的 PokerTable.vue 和博客作品页用的牌桌配图
 * 必须是同一个形状。两处各写一份，改了一处忘另一处，博客上就会挂着一张
 * 与线上不一致的旧桌面 —— 生成配图的脚本直接引这个模块就不会漂移。
 */

export const TABLE_VIEW_W = 1350
export const TABLE_VIEW_H = 900

/** 台框内收（外层八角形距边界） */
export const RAIL_INSET = 8
/** 台面内收（相对短边的比例，小尺寸下边框才不会显得过厚） */
export const FELT_INSET_RATIO = 0.049
/** 切角量（相对短边的比例） */
export const CORNER_CUT_RATIO = 0.19

export const TABLE_COLORS = {
  rail: '#ffffff',
  railStroke: '#cfcfe9',
  feltTop: '#fbf7ff',
  feltBottom: '#efe6f8',
  feltStroke: '#e6e6f5',
  glow: 'rgba(136,136,204,0.16)',
  glowFade: 'rgba(136,136,204,0)',
}

/**
 * 八角形顶点串。inset 是向内收的距离；
 * 切角量随 inset 同步收窄，两层轮廓的边缘才看起来平行。
 */
export function octagonPoints(width, height, inset) {
  const x = inset
  const y = inset
  const w = width - inset * 2
  const h = height - inset * 2
  const baseCut = Math.min(width, height) * CORNER_CUT_RATIO
  const cut = Math.max(24, baseCut - inset * 0.55)
  return [
    [x + cut, y],
    [x + w - cut, y],
    [x + w, y + cut],
    [x + w, y + h - cut],
    [x + w - cut, y + h],
    [x + cut, y + h],
    [x, y + h - cut],
    [x, y + cut],
  ]
    .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ')
}

export function feltInset(width, height) {
  return Math.max(16, Math.min(width, height) * FELT_INSET_RATIO)
}

/**
 * 完整桌面 SVG 字符串。供生成静态配图的脚本使用；
 * 游戏内的组件不走这里（它用 Vue 模板绑定，便于响应尺寸变化）。
 */
export function tableSvgMarkup(width = TABLE_VIEW_W, height = TABLE_VIEW_H) {
  const c = TABLE_COLORS
  const outer = octagonPoints(width, height, RAIL_INSET)
  const felt = octagonPoints(width, height, feltInset(width, height))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="felt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.feltTop}" />
      <stop offset="100%" stop-color="${c.feltBottom}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="58%">
      <stop offset="0%" stop-color="${c.glow}" />
      <stop offset="100%" stop-color="${c.glowFade}" />
    </radialGradient>
  </defs>
  <polygon points="${outer}" fill="${c.rail}" stroke="${c.railStroke}" stroke-width="2" />
  <polygon points="${felt}" fill="url(#felt)" stroke="${c.feltStroke}" stroke-width="1.5" />
  <polygon points="${felt}" fill="url(#glow)" />
</svg>`
}
