# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-15
> 性质：设计语言统一（延续上一轮；已完成；**未部署**，线上无变化）
> 上一轮：turtle-soup 接入 design-kit（语义颜色层 + 202 处 slate 迁移）
> → [`2026-09-15-turtle-soup-接入设计语言-handoff.md`](./2026-09-15-turtle-soup-接入设计语言-handoff.md)

## 本轮目标

把设计语言统一推到底：**lobby-kit 的浅色路径** + **showhand / abracadawhat 两个游戏**。
上一轮只做了 turtle-soup（深色）；这一轮结束时，**博客 + 三个游戏全部同源**。

## 执行摘要

- **lobby-kit 浅色路径也收敛到令牌**：`ProfileEditor` / `AuthBadge` 的浅色值由硬编码 hex
  改为 `var(--令牌, 原硬编码)`。上一轮只给了 `dark` 变体，浅色仍是写死的，所以严格说
  lobby-kit 那时还没有真正接入 design-kit；这轮补上了。
- **`AuthBadge` 主按钮改用 `var(--primary)`**（原 `#6b6bd0`）：`--primary` 是品牌色的
  "可读档位"，白字对比度从约 4.4:1 提到约 5.5:1，过 AA。**不要**用 `--primary-brand`
  （白字只有 3.3:1）。
- **showhand + abracadawhat：182 处硬编码 hex → 语义令牌**。这两个游戏的 UI 颜色
  100% 是 Tailwind 任意值形式（`text-[#8a8299]`），全部迁掉。
- 新增两个可复用脚本：`playwright-game-shot.py`（任意游戏落截图）与
  `playwright-design-token-probe.py`（**探针**：查页面里还有没有旧调色板残留、实际色值是不是令牌）。

## 关键决策（git 查不到的部分）

- **中性色从"紫调灰"收敛到 design-kit 的"冷调蓝灰"**。两个游戏原本用 `#8a8299` / `#5f586b` /
  `#d8d0e4` 这一族**紫调**灰；design-kit 的中性色是从 `--hue-accent` 减去 34°（落进蓝区）派生的，
  所以收敛后整体偏蓝。**这是设计语言自己的取舍，不是妥协**——design-kit README 明说
  页面/中性色走冷调，"香芋紫的存在感由品牌色、渐变与卡片承担"。实测变化很细微
  （前后截图几乎看不出差异），属于精修而非改版。
- **只动 UI chrome，绝不动"游戏物件"色**。明确保留：
  - `showhand/src/core/tableShape.js` 的牌桌 SVG 配色（`rail` / `feltTop` / `feltStroke` …）
  - `ChipIcon.vue` 的筹码红 `#e05a4e`（语义色，design-kit 没有 danger 令牌）
  - 模板里作为 **prop 传入**的颜色（如 `<ChipIcon color="#8888cc" />`）
  理由有两条：这些值在 JS / prop 上下文里**用 `var()` 本就无效**；而且牌桌、筹码是游戏物件，
  按 design-kit 的规则本就不受 UI 约束（与 turtle-soup 保留判定色、牌桌回弹同一原则）。
  迁移脚本用"只替换 Tailwind 任意值字面量"来保证这条边界，实测这三处**确实未被触碰**。
- **`lobby-kit` 的 fallback 一律给全**。lobby-kit 自身不依赖 design-kit，所以每处都写成
  `var(--x, 原值)`：引了 design-kit 的项目自动同源，没引的项目行为完全不变。

## 验证证据

- **构建**：`showhand`、`abracadawhat` 均通过；`turtle-soup` 不受本轮影响。
- **测试**：`packages/lobby-kit` 7 个测试文件全过（改过它，必须跑）。
- **编码无损**：46 个 `.vue/.js/.css` 用 Node 按 utf8 读回，无 `\uFFFD`。
- **探针（本轮最硬的证据）**：在两个游戏的真实渲染页面上遍历所有元素的
  computed `color` / `background-color` / `border-*-color`——
  - **旧调色板残留 = 0 处**（`#8a8299`/`#333333`/`#5f586b`/`#d8d0e4`/`#a29bb5`/`#f7eff8`/`#2a2a48` 全无）
  - 实际色值是 design-kit 令牌：文本 `oklch(0.25 0.028 250)`（=`--ink`）×67、
    描边 `oklch(0.9 0.012 249)`（=`--line`，色相 249 = `--hue-bg`）×108、
    `oklch(0.654 0.1 283)`（=`--primary-brand`）×4
  - 以及品牌色阶的**精确值**：`#b3b3dd`（=brand-300）×4、`#cfcfe9`（=brand-200）×4
- **前后截图**：`docs/agent/scripts/out/design-language/`（before/after 各两张）。
  肉眼几乎无差异——这正是预期：这是一次精修级收敛，不是改版。
- **未验证（明确标注）**：
  - **只截到大厅**。牌桌/对局中的界面（`PokerTable`、`PlayerSeat`、`PublicArea`、`SpellCard` 等，
    恰好是改动最集中的地方）**没有截图**——需要多人开局或走完整局，单人跑不到。
    这些文件的改动是同一套机械替换，且探针在大厅已验证令牌生效，但**不能说已经看过**。
  - 本仓库对 CSS 没有自动化测试，所以仍是"截图 + 探针抽样"，不是全量。

## 生产状态

- **未部署，四个线上站点均无变化**。三个游戏线上仍跑旧样式，本轮改动只在本地与 git 里。
- 若要上线：`cd showhand && npm run deploy`、`cd abracadawhat && npm run deploy`（各自独立部署）。
- 无需回滚。

## 关键文件

| 文件 | 作用 |
|---|---|
| `packages/lobby-kit/src/vue/ProfileEditor.vue` | 浅色 + 深色两套值都改为 `var(--令牌, 回退)` |
| `packages/lobby-kit/src/vue/AuthBadge.vue` | 同上；主按钮改用 `--primary` |
| `.planning/2026-09-15-design-language-light-games/migrate-hex.mjs` | 182 处 hex → 语义令牌的迁移脚本 |
| `docs/agent/scripts/playwright-design-token-probe.py` | 探针：查旧调色板残留 / 令牌是否生效 |
| `docs/agent/scripts/playwright-game-shot.py` | 通用截图（前后对比用） |

## 踩坑记录

1. **`grep -o` 会让后续的"排除模式"彻底失效，据此得出的结论是错的**。
   我原本用 `grep -roiE "#[0-9a-f]{3,8}" … | grep -viE "\-\[#"` 来判断"哪些 hex 不在
   Tailwind 任意值里"，结果**每一条都通过了排除**——因为 `-o` 只输出匹配到的片段（`#D8D0E4`），
   片段里当然不含 `-[#`。我据此误判"有大量 hex 写在 scoped CSS / script 里"，还照这个错误前提
   设计了第二趟替换。**正确做法**：要按整行过滤就别加 `-o`（或用 `grep -v` 作用于 `grep -rn` 的整行输出），
   或者干脆打开文件看上下文。这次是 dry-run 的计数（`style 内 hex 0 处`）与我预期的"很多"矛盾，
   才回头去读文件、发现前提错了。
2. 顺带确认一个事实：**这两个游戏的 UI 颜色 100% 是 Tailwind 任意值形式**，没有写进 scoped CSS。
   所以真正的工作量只有一趟替换，第二趟（`<style>` 内裸 hex）是防御性的、当前匹配 0 处。

## 环境与权限

- 沿用上一轮：`pwsh`（不能用 `powershell` 5.1）、Python **3.14** 的 Playwright、
  联机页面必须用 `npx wrangler dev`（`vite dev` 没有 `/ws`、`/api` 代理）。
- 本地验证端口：`8789` showhand、`8790` abracadawhat、`8788` turtle-soup。
- 不跑本地 auth（`localhost:8787`）时页面出现 CORS / `net::ERR_FAILED` 属**预期现象**。

## 阻塞项

无。

## 下次可做之事（按推荐排序，均未与用户确认）

1. **牌桌/对局中界面还没看过**。本轮改动最集中的几个组件（`PokerTable` / `PlayerSeat` /
   `PublicArea` / `SpellCard` / `CastPanel`）只在大厅侧验证了令牌生效，没截到实际对局画面。
   要补的话需要开两局（或起两个浏览器上下文模拟两名玩家）。
2. **三个游戏现在都同源了**，可以考虑把 `migrate-hex.mjs` 这套流程沉淀成
   `docs/agent/scripts/` 下的正式工具（目前它在 `.planning/` 里，属于本轮证据）。
3. **`design-kit` 的 `brand-600` 配白字是 4.16:1，低于 AA 正文标准**（既有问题，非本轮引入）。
   浅色底上的白字按钮可以考虑统一改用 `--primary`（`AuthBadge` 本轮已经这么做了）。
4. **给 `scripts/sync.ps1` 加 UTF-8 BOM**（两轮遗留，仍未做）。
5. **部署三个游戏**：改动都还在本地，线上是旧样式。需要用户确认后再 `npm run deploy`。

**不建议**：把 `tableShape.js` 的牌桌配色、`ChipIcon` 的筹码红也迁到令牌——它们是游戏物件色，
`var()` 在那些上下文无效，design-kit 的规则也明确允许游戏元素有强对比固有色。
