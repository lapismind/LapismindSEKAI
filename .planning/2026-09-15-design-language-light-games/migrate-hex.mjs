#!/usr/bin/env node
/**
 * showhand / abracadawhat：硬编码调色板 → design-kit 语义令牌
 *
 * 背景：这两个游戏的 UI chrome 用的是「紫调灰」硬编码 hex（#8a8299 / #5f586b /
 * #d8d0e4 …），而 design-kit 的语义令牌是从 --hue-accent 派生的「冷调蓝灰」。
 * 收敛后两个游戏与博客/海龟汤同源；代价是中性色由紫偏蓝（可见、但符合设计语言
 * 自己的取舍：紫色留给品牌色去承担）。
 *
 * 两趟替换，边界很清楚：
 *   1) 模板里的 Tailwind 任意值：text-[#8a8299] → text-muted 之类（大小写不敏感，文件里
 *      混用 #D8D0E4 / #d8d0e4）。**实测这两个游戏的 UI 颜色全部是这种形式**，是主要工作量。
 *   2) **只在 <style> 块内**：裸 hex → var(--令牌)。这是防御性的一趟：
 *      实测当前匹配 0 处（两个游戏没有把 UI 色写进 scoped CSS），留着以防将来出现。
 *      —— 不能全文件替换：JS/组件 prop 里的颜色（如 <ChipIcon color="#8888cc" />、
 *         tableShape.js 的牌桌配色）拿到 var() 是无效的，那些是「游戏物件」色，
 *         本来也不该跟着 UI 设计语言走。实测这两处确实未被触碰。
 *
 * 不在映射表里的 hex 一律原样保留（安全默认），并在报告里列出来。
 *
 * 编码：Node + 显式 utf8。绝不用 PowerShell 写文件（见 turtle-soup lessons 第 1 条）。
 *
 * 用法：
 *   node .planning/2026-09-15-design-language-light-games/migrate-hex.mjs --dry
 *   node .planning/2026-09-15-design-language-light-games/migrate-hex.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const GAMES = ['showhand', 'abracadawhat']
const DRY = process.argv.includes('--dry')

// ── 趟 1：模板里的 Tailwind 任意值（整文件替换，这些字面量只出现在 class 里）──
const UTIL = [
  ['text-[#333333]', 'text-ink'],
  ['text-[#333]', 'text-ink'],
  ['text-[#444444]', 'text-ink'],
  ['text-[#444]', 'text-ink'],
  ['text-[#8a8299]', 'text-muted'],
  ['text-[#a29bb5]', 'text-muted'],
  ['text-[#5f586b]', 'text-ink-soft'],
  ['text-[#55506b]', 'text-ink-soft'],
  ['text-[#b3b3dd]', 'text-brand-300'],
  ['bg-[#2a2a48]', 'bg-brand-950'],
  ['bg-[#f7eff8]', 'bg-brand-50'],
  ['bg-[#faf7fc]', 'bg-brand-50'],
  ['bg-[#f9f9f9]', 'bg-surface'],
  ['border-[#d8d0e4]', 'border-line'],
  ['border-[#ddd5e7]', 'border-line'],
  ['border-[#e6e1f0]', 'border-line'],
  ['border-[#e4deec]', 'border-line'],
  ['border-[#cfcfe9]', 'border-brand-200'],
  ['border-[#b3b3dd]', 'border-brand-300'],
  ['divide-[#e6e1f0]', 'divide-line'],
]

// ── 趟 2：<style> 块内的裸 hex（键一律小写）──
const HEX = {
  '#333333': 'var(--ink)',
  '#333': 'var(--ink)',
  '#444444': 'var(--ink)',
  '#444': 'var(--ink)',
  '#8a8299': 'var(--muted)',
  '#a29bb5': 'var(--muted)',
  '#5f586b': 'var(--ink-soft)',
  '#55506b': 'var(--ink-soft)',
  '#d8d0e4': 'var(--line)',
  '#ddd5e7': 'var(--line)',
  '#e6e1f0': 'var(--line)',
  '#e4deec': 'var(--line)',
  '#cfcfe9': 'var(--color-brand-200)',
  '#b3b3dd': 'var(--color-brand-300)',
  '#2a2a48': 'var(--color-brand-950)',
  '#f7eff8': 'var(--primary-ghost)',
  '#faf7fc': 'var(--primary-ghost)',
  '#f9f9f9': 'var(--card-bg)',
  '#8888cc': 'var(--primary-brand)',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|css|js)$/.test(name)) out.push(p)
  }
  return out
}

// 只在 <style>…</style> 内替换裸 hex
function replaceInStyleBlocks(src, counter) {
  return src.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => {
    const next = body.replace(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi, (hit) => {
      const key = hit.toLowerCase()
      if (HEX[key]) {
        counter.hex++
        return HEX[key]
      }
      counter.kept.add(key)
      return hit
    })
    return open + next + close
  })
}

let totalUtil = 0
let totalHex = 0
const keptHex = new Set()
const report = []

for (const game of GAMES) {
  for (const file of walk(join(ROOT, game, 'src'))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    const original = readFileSync(file, 'utf8')
    const counter = { hex: 0, kept: new Set() }
    let out = original

    // 趟 1：大小写不敏感地替换任意值字面量
    let utilHits = 0
    for (const [from, to] of UTIL) {
      const re = new RegExp(from.replace(/[[\]]/g, '\\$&'), 'gi')
      out = out.replace(re, () => {
        utilHits++
        return to
      })
    }

    // 趟 2：<style> 块
    out = replaceInStyleBlocks(out, counter)

    if (out !== original) {
      if (!DRY) writeFileSync(file, out, 'utf8')
      totalUtil += utilHits
      totalHex += counter.hex
      report.push(
        `  ${DRY ? 'WOULD ' : 'WRITE '}${rel}  任意值 ${utilHits} 处，style 内 hex ${counter.hex} 处`,
      )
    }
    counter.kept.forEach((h) => keptHex.add(h))
  }
}

console.log(report.join('\n'))
console.log(`\n合计：任意值 ${totalUtil} 处，style 内 hex ${totalHex} 处${DRY ? '（dry-run，未写入）' : ''}`)
console.log(
  `未映射、原样保留的 hex（应全是游戏物件/语义色）：${[...keptHex].sort().join(' ') || '（无）'}`,
)
