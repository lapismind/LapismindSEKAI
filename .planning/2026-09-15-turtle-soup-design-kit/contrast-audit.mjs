#!/usr/bin/env node
/**
 * turtle-soup 迁移后对比度审计（无浏览器环境的替代验证）
 *
 * 本机没有 Playwright / 浏览器二进制，无法截图比对，所以用数值方式回答
 * 迁移最可能引入的那类 bug：**文字读不出来、表面看不见**。
 *
 * 做法：从 packages/design-kit/tokens.css 解析深色主题的令牌真值（不硬编码，
 * 避免与真源脱节），合成 alpha 后算 WCAG 对比度，并与迁移前的等价配对逐项比较。
 *
 * 判据说明（避免误报）：
 *   - 文字：WCAG AA，正文 4.5:1，大字/图形 3:1。有明确标准。
 *   - 表面之间/描边与表面之间：**WCAG 没有对应标准**。深色 UI 的层次本来靠
 *     "描边 + 阴影"，不是靠亮度差。所以这里只报数值并与迁移前比较，
 *     不判 PASS/FAIL，只在差值明显变小时标"更含蓄"。
 *
 * 用法： node .planning/2026-09-15-turtle-soup-design-kit/contrast-audit.mjs
 */
import { readFileSync } from 'node:fs'

const HUE_BG = 283 - 34 // 249

function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
    return Math.max(0, Math.min(255, Math.round(v * 255)))
  })
}
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16))
}
const lum = ([r, g, b]) =>
  0.2126 * f(r / 255) + 0.7152 * f(g / 255) + 0.0722 * f(b / 255)
function f(s) {
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const contrast = (a, b) => {
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

// ── 解析 tokens.css 的深色段真值 ──
const css = readFileSync('packages/design-kit/tokens.css', 'utf8')
const dark = css.slice(css.indexOf(":root[data-theme='dark']"))
const raw = (name) => {
  const m = dark.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error('missing dark token: ' + name)
  return m[1].trim()
}
const R = (name) => {
  const e = raw(name)
  if (e.startsWith('#')) return { rgb: hexToRgb(e), a: 1 }
  const m = e.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+|var\(--hue-bg\))\s*(?:\/\s*([\d.]+))?\s*\)/)
  return {
    rgb: oklchToRgb(parseFloat(m[1]), parseFloat(m[2]), m[3].startsWith('var') ? HUE_BG : parseFloat(m[3])),
    a: m[4] ? parseFloat(m[4]) : 1,
  }
}
const T = Object.fromEntries(
  ['page-bg', 'card-bg', 'card-solid', 'field-bg', 'surface-raised', 'btn-neutral', 'btn-neutral-hover', 'glass-bg', 'overlay', 'ink', 'ink-soft', 'muted', 'line', 'line-strong'].map((n) => [n, R(n)]),
)
const ON_ACCENT = R('on-accent')

console.log('design-kit 深色令牌真值（从 tokens.css 解析）：')
for (const [k, v] of Object.entries(T)) console.log(`  --${k.padEnd(18)} ${toHex(v.rgb)}${v.a < 1 ? ` a=${v.a}` : ''}`)
console.log(`  --${'on-accent'.padEnd(18)} ${toHex(ON_ACCENT.rgb)}`)
console.log()

// 迁移前 turtle-soup 用的 Tailwind 默认色
const S = { 100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a' }
const JUDGE = { yes: '#34d399', no: '#f87171', irrelevant: '#94a3b8', ambiguous: '#fbbf24' }

// ── 1. 文字对比：有 WCAG 标准，判 PASS/FAIL ──
console.log('══ 1. 文字对比（WCAG AA：正文 4.5 / 大字图形 3.0）══')
let textFails = 0
function text(label, fg, bgRgb, need = 4.5) {
  const c = contrast(fg, bgRgb)
  const ok = c >= need
  if (!ok) textFails++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.toFixed(2).padStart(6)}:1 (需 ${need})  ${label}`)
}
const surfaces = { 'bg-surface': T['card-bg'].rgb, 'bg-field': T['field-bg'].rgb, 'bg-raised': T['surface-raised'].rgb, 'bg-page': T['page-bg'].rgb }
for (const [tn, tok] of [['text-ink', T.ink], ['text-ink-soft', T['ink-soft']], ['text-muted', T.muted]]) {
  for (const [sn, s] of Object.entries(surfaces)) text(`${tn.padEnd(13)} on ${sn.padEnd(11)}`, tok.rgb, s)
}
// 半透明 chrome：bg-surface/80 压在页底
const chrome80 = over(T['card-bg'].rgb, 0.8, T['page-bg'].rgb)
text('text-ink-soft  on bg-surface/80', T['ink-soft'].rgb, chrome80)
text('text-muted     on bg-surface/80', T.muted.rgb, chrome80)
// 亮色判定芯片上的深字
for (const [k, hex] of Object.entries(JUDGE)) text(`text-on-accent on judge-${k.padEnd(11)}`, ON_ACCENT.rgb, hexToRgb(hex))
// 白字按钮
text('text-white     on bg-neutral ', hexToRgb('#ffffff'), T['btn-neutral'].rgb)
text('text-white     on brand-500  ', hexToRgb('#ffffff'), hexToRgb('#8888cc'), 3.0)
text('text-white     on brand-600  ', hexToRgb('#ffffff'), hexToRgb('#7676b8'))
console.log(`  小计：${textFails === 0 ? '全部通过' : textFails + ' 项未达 AA'}`)

// ── 2. 表面分离度：无 WCAG 标准，只报数值 + 前后对比 ──
console.log('\n══ 2. 表面/描边分离度（无 WCAG 标准，只报值与前后变化）══')
const sep = []
function separation(role, afterFg, afterBg, beforeFg, beforeBg) {
  const a = contrast(afterFg, afterBg)
  const b = contrast(beforeFg, beforeBg)
  sep.push({ role, after: a, before: b })
}
const card = T['card-bg'].rgb
const field = T['field-bg'].rgb
const raised = T['surface-raised'].rgb
const page = T['page-bg'].rgb
const neutral = T['btn-neutral'].rgb
const line = T.line.rgb
const lineStrong = T['line-strong'].rgb
// 迁移前：slate-800/60 压 slate-900 上（面板），slate-800 字段压 slate-900
const beforePanel = over(hexToRgb(S[800]), 0.6, hexToRgb(S[900]))
separation('弹窗表面  vs 页底', card, page, hexToRgb(S[900]), hexToRgb(S[950] ?? '#020617'))
separation('字段      vs 卡片', field, card, hexToRgb(S[800]), hexToRgb(S[900]))
separation('抬起表面  vs 卡片', raised, card, hexToRgb(S[800]), beforePanel)
separation('中性按钮  vs 卡片', neutral, card, hexToRgb(S[700]), hexToRgb(S[900]))
separation('描边      vs 卡片', line, card, hexToRgb(S[700]), hexToRgb(S[900]))
separation('强描边    vs 字段', lineStrong, field, hexToRgb(S[600]), hexToRgb(S[800]))
for (const s of sep) {
  const d = s.after - s.before
  console.log(
    `  ${s.after.toFixed(2).padStart(5)}:1  (迁移前 ${s.before.toFixed(2)}:1，${d >= 0 ? '+' : ''}${d.toFixed(2)})  ${s.role}` +
      (s.after < 1.2 ? '   ← 很含蓄' : ''),
  )
}

console.log('\n══ 3. 判定气泡（唯一用 text-on-accent 的地方）══')
for (const [k, hex] of Object.entries(JUDGE)) {
  const after = contrast(ON_ACCENT.rgb, hexToRgb(hex))
  const before = contrast(hexToRgb(S[900]), hexToRgb(hex))
  console.log(`  ${k.padEnd(11)} 迁移后 ${after.toFixed(2)}:1  / 迁移前 ${before.toFixed(2)}:1  (${after >= before ? '+' : ''}${(after - before).toFixed(2)})`)
}

console.log(`\n结论：文字对比 ${textFails === 0 ? '全部达 AA' : textFails + ' 项未达 AA'}；表面分离度需人眼确认（本机无浏览器）。`)
