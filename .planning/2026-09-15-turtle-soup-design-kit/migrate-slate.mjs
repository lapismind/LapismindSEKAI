#!/usr/bin/env node
/**
 * turtle-soup: slate-* → design-kit 语义令牌（一次性迁移脚本）
 *
 * 为什么用 Node 而不是 PowerShell：见 turtle-soup/docs/lessons-learned.md 第 1 条——
 * 2026-08-14 用 PowerShell Set-Content 批量改 9 个 .vue，中文全部乱码，靠运气才救回约 90%。
 * 铁律：批量改文件用 Node（readFileSync/writeFileSync 显式 utf8），不用 PowerShell 写文件。
 *
 * 用法：
 *   node .planning/2026-09-15-turtle-soup-design-kit/migrate-slate.mjs --dry   # 只报告
 *   node .planning/2026-09-15-turtle-soup-design-kit/migrate-slate.mjs        # 实际写入
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'turtle-soup', 'src')
const DRY = process.argv.includes('--dry')

// 顺序即语义：必须"长模式优先"。先把带 hover: / 透明度修饰符 / 浅色遮罩的形式换掉，
// 再用基础名兜底；否则 bg-slate-800/60 会先被 bg-slate-800 吃掉，变成 bg-field/60（错）。
const MAP = [
  // ── 带修饰符的形式 ──
  ['hover:bg-slate-600', 'hover:bg-neutral-hover'],
  ['hover:bg-slate-700', 'hover:bg-neutral-hover'],
  ['hover:bg-slate-800', 'hover:bg-raised'],
  ['hover:border-slate-500', 'hover:border-line-strong'],
  ['hover:text-slate-100', 'hover:text-ink'],
  ['hover:text-slate-200', 'hover:text-ink'],
  // 汤面展开遮罩：原来是 bg-black/60，design-kit 禁止纯黑重遮罩，与另一处 backdrop 统一
  ['bg-black/60', 'bg-overlay'],
  ['bg-slate-950/90', 'bg-overlay'],
  // 半透明 chrome（顶/底栏、浮条）
  ['bg-slate-900/90', 'bg-surface/90'],
  ['bg-slate-900/80', 'bg-surface/80'],
  ['bg-slate-900/70', 'bg-surface/70'],
  ['bg-slate-900/60', 'bg-surface/60'],
  // 半透明"抬起表面"（工具提示、浮片）
  ['bg-slate-800/95', 'bg-raised/95'],
  ['bg-slate-800/90', 'bg-raised/90'],
  ['bg-slate-800/80', 'bg-raised/80'],
  ['bg-slate-800/70', 'bg-raised/70'],
  ['bg-slate-800/60', 'bg-raised/60'],
  ['bg-slate-800/40', 'bg-raised/40'],
  ['border-slate-700/60', 'border-line/60'],
  ['border-slate-600/60', 'border-line-strong/60'],

  // ── 基础名 ──
  ['bg-slate-900', 'bg-surface'], // 弹窗/抽屉表面
  ['bg-slate-800', 'bg-field'], // 表单字段、分段控件底槽（凹陷）
  ['bg-slate-700', 'bg-neutral'], // 中性按钮填充
  ['bg-slate-600', 'bg-neutral'],
  ['border-slate-800', 'border-line'],
  ['border-slate-700', 'border-line'],
  ['border-slate-600', 'border-line-strong'],
  ['text-slate-900', 'text-on-accent'], // 压在亮色判定芯片上的深字
  ['text-slate-100', 'text-ink'],
  ['text-slate-200', 'text-ink'],
  ['text-slate-300', 'text-ink-soft'],
  ['text-slate-400', 'text-ink-soft'],
  ['text-slate-500', 'text-muted'],
  ['text-slate-600', 'text-muted'],
]

// 整行跳过：这行在"浅琥珀纸质卡片"里（深色游戏里刻意的浅色面板，属游戏内容）。
// 那里的底色是浅的，深色主题的 text-muted / bg-surface 对比度是错的，必须原样保留。
const SKIP_LINE_MARKERS = ['bg-slate-900/10']

// IdentityBadge.vue 是死代码（无人 import），Stage 5 直接删除，不参与迁移。
const SKIP_FILES = ['IdentityBadge.vue']

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

let totalHits = 0
const report = []

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const base = rel.split('/').pop()
  if (SKIP_FILES.includes(base)) {
    report.push(`  SKIP  ${rel}  (死代码，Stage 5 删除)`)
    continue
  }

  const original = readFileSync(file, 'utf8')
  const lines = original.split('\n')
  let fileHits = 0
  let skipped = 0

  const next = lines.map((line) => {
    if (SKIP_LINE_MARKERS.some((m) => line.includes(m))) {
      skipped++
      return line
    }
    let out = line
    for (const [from, to] of MAP) {
      if (out.includes(from)) {
        const before = out
        out = out.split(from).join(to)
        if (out !== before) fileHits++
      }
    }
    return out
  })

  const result = next.join('\n')
  // 兜底断言：只允许出现"预期内"的 slate 残留（受保护行）
  const leftover = result.split('\n').filter((l) => /slate-\d/.test(l))

  if (result !== original) {
    if (!DRY) writeFileSync(file, result, 'utf8')
    totalHits += fileHits
    report.push(
      `  ${DRY ? 'WOULD ' : 'WRITE '}${rel}  替换 ${fileHits} 处` +
        (skipped ? `，跳过 ${skipped} 行（受保护）` : ''),
    )
  }
  if (leftover.length) {
    report.push(`        剩余 slate：${leftover.length} 行（应仅受保护行）`)
    leftover.forEach((l) => report.push(`          ${l.trim().slice(0, 110)}`))
  }
}

console.log(report.join('\n'))
console.log(`\n合计替换 ${totalHits} 处${DRY ? '（dry-run，未写入）' : ''}`)
