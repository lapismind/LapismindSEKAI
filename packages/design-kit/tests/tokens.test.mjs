/**
 * design-kit 自检 —— 防止令牌在无人察觉时漂移。
 *
 * 覆盖三类会静默出错的点：
 *   1. 必需令牌被删/改名（消费方用了却拿不到，样式悄悄失效）
 *   2. theme.css（静态 hex）与 tokens.css（oklch 推导）指向两个色相
 *      —— 这是本包最真实的漂移风险：Tailwind 的 @theme 只吃静态值，
 *         品牌色因此不得不在两处以两种写法各存一份
 *   3. 字体子集同步了一半：CSS 里的 url() 指向不存在的文件，
 *      表现为"字体偶尔没生效"，极难排查
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const pkgRoot = join(import.meta.dirname, '..')
const read = (name) => readFileSync(join(pkgRoot, name), 'utf8')

const theme = read('theme.css')
const tokens = read('tokens.css')
const base = read('base.css')

// ---------- 1. 必需令牌 ----------
const REQUIRED_TOKENS = [
  '--hue-accent',
  '--primary-brand',
  '--font-body',
  '--font-mono',
  '--page-bg',
  '--card-solid',
  '--ink',
  '--ink-soft',
  '--muted',
  '--line',
  '--line-strong',
  '--primary',
  '--primary-2',
  '--primary-soft',
  '--gradient',
  '--glass-bg',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--radius-sm',
  '--radius',
  '--radius-lg',
  '--tap-min',
]
for (const token of REQUIRED_TOKENS) {
  assert.ok(tokens.includes(`${token}:`), `tokens.css 缺少必需令牌 ${token}`)
}
assert.ok(
  tokens.includes("[data-theme='dark']"),
  'tokens.css 缺少深色主题覆盖块（消费方按 data-theme 切换）',
)

// ---------- 2. 色阶档位齐全 ----------
const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
for (const stop of STOPS) {
  assert.ok(theme.includes(`--color-brand-${stop}:`), `theme.css 缺少 --color-brand-${stop}`)
}

// ---------- 3. 两处定义色相一致 ----------
function srgbToOklch(hex) {
  const n = parseInt(hex.slice(1), 16)
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const r = toLin(((n >> 16) & 0xff) / 255)
  const g = toLin(((n >> 8) & 0xff) / 255)
  const b = toLin((n & 0xff) / 255)

  const l = 0.4123908 * r + 0.3575843 * g + 0.1804808 * b
  const m = 0.212639 * r + 0.7151687 * g + 0.0721923 * b
  const s = 0.0193308 * r + 0.1191948 * g + 0.9505322 * b

  const lc = Math.cbrt(0.8189330101 * l + 0.3618667424 * m - 0.1288597137 * s)
  const mc = Math.cbrt(0.0329845436 * l + 0.9293118715 * m + 0.0361456387 * s)
  const sc = Math.cbrt(0.0482003018 * l + 0.2643662691 * m + 0.633851707 * s)

  const L = 0.2104542553 * lc + 0.793617785 * mc - 0.0040720468 * sc
  const A = 1.9779984951 * lc - 2.428592205 * mc + 0.4505937099 * sc
  const B = 0.0259040371 * lc + 0.7827717662 * mc - 0.808675766 * sc

  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C: Math.hypot(A, B), H }
}

const brandHex = theme.match(/--color-brand-500:\s*(#[0-9a-fA-F]{6})/)?.[1]
assert.ok(brandHex, 'theme.css 里找不到 --color-brand-500 的 hex 值')

const { L, C, H } = srgbToOklch(brandHex)
const hueMatch = tokens.match(/--hue-accent:\s*([\d.]+)/)
assert.ok(hueMatch, 'tokens.css 里找不到 --hue-accent')
const hueAccent = Number(hueMatch[1])

const near = (a, b, tol) => Math.abs(a - b) <= tol
assert.ok(
  near(H, hueAccent, 4),
  `色相漂移：theme.css 的 brand-500 (${brandHex}) 实际色相 ${H.toFixed(1)}°，` +
    `但 tokens.css 的 --hue-accent 是 ${hueAccent}°。改主色时两处必须一起改。`,
)
assert.ok(
  near(L, 0.654, 0.03) && near(C, 0.1, 0.03),
  `品牌色明度/饱和度与文档不符：实际 oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})，` +
    `--primary-brand 注释按 oklch(0.654 0.1) 写。`,
)

// ---------- 4. 字体应用规则 --------
assert.ok(base.includes('.font-num'), 'base.css 缺少 .font-num（数字必须用等宽栈）')
assert.ok(
  base.includes('tabular-nums'),
  'base.css 的 .font-num 应带 tabular-nums，否则数字竖向对不齐',
)
assert.ok(
  base.includes('prefers-reduced-motion'),
  'base.css 缺少动效降级（prefers-reduced-motion）',
)

// ---------- 5. 字体子集与 CSS 引用一一对应 ----------
const fontCssPath = join(pkgRoot, 'fonts', 'lxgwwenkaiscreen.css')
assert.ok(existsSync(fontCssPath), '缺少 fonts/lxgwwenkaiscreen.css')

const fontCss = readFileSync(fontCssPath, 'utf8')
const referenced = [...fontCss.matchAll(/url\('\.\/files\/([^']+)'\)/g)].map((m) => m[1])
assert.ok(referenced.length > 0, 'fonts/lxgwwenkaiscreen.css 里没有 url(./files/...) 引用')
assert.equal(
  new Set(referenced).size,
  referenced.length,
  'fonts CSS 里有重复的 url() 引用',
)

const filesDir = join(pkgRoot, 'fonts', 'files')
const missing = referenced.filter((name) => !existsSync(join(filesDir, name)))
assert.equal(
  missing.length,
  0,
  `字体子集同步不完整：CSS 引用了 ${referenced.length} 个文件，缺少 ${missing.length} 个，` +
    `例如 ${missing.slice(0, 3).join(', ')}。请重跑 sync-fonts。`,
)

const onDisk = readdirSync(filesDir).filter((name) => name.endsWith('.woff2'))
const orphan = onDisk.filter((name) => !referenced.includes(name))
assert.equal(
  orphan.length,
  0,
  `fonts/files/ 里有 ${orphan.length} 个 CSS 未引用的多余子集，例如 ${orphan.slice(0, 3).join(', ')}`,
)

console.log(
  `design-kit tokens ok（${REQUIRED_TOKENS.length} 个令牌，brand-500=${brandHex} ` +
    `≈ oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})，${onDisk.length} 个字体子集）`,
)
