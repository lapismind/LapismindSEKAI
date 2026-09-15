# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-15
> 性质：设计语言统一（功能 + 重构；已完成；**未部署**，线上无变化）
> 上一轮：路径约定统一为相对路径，已归档到 [`2026-09-15-路径约定统一-handoff.md`](./2026-09-15-路径约定统一-handoff.md)
> 更早：blog 动效 / Live2D 性能 / 浮动控件修复 → [`2026-09-15-blog-动效与性能-handoff.md`](./2026-09-15-blog-动效与性能-handoff.md)

## 本轮目标

把 **turtle-soup 接入 `@lapismind/design-kit`**（设计语言通用件）。它是三个游戏里最后一个未接入的：
CSS 只引 `theme.css`，组件里有 **207 处 `slate-*` 硬编码深色**，而 showhand / abracadawhat 是 0 处
（分别 122 / 76 处 `brand-*`）。同时它字体是自带的 `system-ui` 栈，没有字体同步。

## 执行摘要

- **design-kit 补真缺口**：新增 6 个令牌（`--field-bg` / `--surface-raised` / `--btn-neutral(-hover)` /
  `--overlay` / `--on-accent`，浅深两段都有）＋ 用 `@theme inline` 加了**语义颜色层**
  （`bg-surface` / `text-ink` / `border-line` / `text-on-accent` …），三个游戏自此有了按角色取名、
  且跟随 `data-theme` 切换的工具类。
- **turtle-soup 机制层**：补 `tokens.css` + `base.css` 引入；`<html data-theme="dark">` 常驻深色；
  接上 `predev`/`prebuild` 字体同步（97 子集）与 `index.html` 的 `<link>`；`body` 改 `var(--font-body)`
  霞鹜文楷；删掉自己声明的 4 个 hex 变量（其中 3 个从未被引用）；`theme-color` 对齐到深色页底。
- **202 处 `slate-*` → 语义令牌**（脚本迁移，见下方踩坑）。
- **清死代码**：`IdentityBadge.vue`（57 行，无人 import，只剩一句过期注释）＋ no-op 的 `animate-bounce-slow`
  （keyframes 全仓库不存在）。
- **lobby-kit 的 `ProfileEditor` 新增 `dark` 变体**（`AuthBadge` 早就有，`ProfileEditor` 没有，
  导致 turtle-soup 大厅里出现一个刺眼的白底输入框）。
- **新增可复用的验证资产**：`docs/agent/scripts/playwright-turtle-soup-design-check.py`
  ＋ `.planning/2026-09-15-turtle-soup-design-kit/` 下的迁移脚本与对比度审计脚本。

## 关键决策（git 查不到的部分）

- **`@theme inline` 是整件事的技术前提**。design-kit 原注释写"Tailwind 的 `@theme` 只吃静态值"，
  所以品牌色阶被迫用静态 hex 重复一份。这句话一半对：普通 `@theme` 要静态值，但 **`@theme inline`
  会把 `var()` 原样保留进产物、不预先求值**。我先写最小 spike 实测确认（产物形如
  `.bg-surface{background-color:var(--card-bg)}` 与 `color-mix(in oklab, var(--card-bg) 80%, transparent)`），
  确认 hover 变体与 `/NN` 透明度都能用、且切主题自动生效，**然后才动手**。
  判断标准：**值要不要跟着主题走**——要就用 `inline` 指向 tokens.css，不要才用普通 `@theme` 写死。
- **深色外观允许变化，完整向设计语言靠拢**（用户拍板）。原话是"海龟汤本来就是一开始拿来练手的，
  风格那时都没定下来，现在统一向设计语言靠拢"。所以走了 design-kit 的 `data-theme="dark"`
  派生令牌，而不是把 turtle-soup 现有 hex 固化成令牌值。**代价：页底由 `#1c1c33`（紫调深蓝）
  变成 `#09111a`（更深的冷蓝）**，整体比原来暗一档——这是有意接受的，且从此与博客的深色主题同源。
- **保留的"游戏内容"不动**（不属于设计语言）：`GameBoard` 的四个判定色
  （`#34d399`/`#f87171`/`#94a3b8`/`#fbbf24`）、`fx-pop` 的回弹与判定指针动画（关键反馈手感）、
  以及 `RoomView` 那张**浅琥珀"汤面"纸质卡**——它是深色游戏里刻意的浅色面板，
  里面那两处 `slate`（`bg-slate-900/10` 难度徽章 + `text-slate-600`）**故意保留**，
  因为换成深色主题令牌会把对比度搞反。迁移脚本为此设了"受保护行"。
- **不迁圆角/阴影到 `--radius-*`/`--shadow-*`**：showhand / abracadawhat 其实也都在用 Tailwind 默认
  的 `rounded-2xl` / `shadow-lg`。跟它们保持一致，比单方面"更正确"重要。
- **lobby-kit 的 `dark` 值写成 `var(--令牌, 硬编码回退)`**，而不是复制一套 hex。
  lobby-kit 不依赖 design-kit，所以回退必须给全：引了 design-kit 的项目自动同源，没引的行为完全不变。
  复制 hex 正是当初产生"白底输入框"这种漂移的原因。
- **先归档再改写 `CURRENT.md`**（按 `docs/agent/archiving.md`）：上一轮（路径约定）收口时
  从 `CURRENT.md` 原样转存成 `2026-09-15-路径约定统一-handoff.md`，再改写本文件。

## 验证证据

- **测试全绿**：`packages/design-kit` `npm test`（30 令牌、brand-500 色相一致、97 字体子集一一对应）；
  `packages/lobby-kit` `npm test`（7 个测试文件全过）；`turtle-soup` `npm test`（1 passed / 0 failed）。
- **构建全绿**：turtle-soup / showhand / abracadawhat 三个 `npm run build` 通过。
  （blog 未跑构建——它只引 `tokens.css` + `base.css`，不引 `theme.css`；且 `tokens.css` 的改动经
  `git diff` 确认**纯新增**：唯一被删的一行是旧注释文字，没有任何既有令牌值被改动，因此不受影响。）
- **编码无损**：`.vue` 用 Node 按 utf8 读回，无 `\uFFFD`、无 mojibake 标记。
  （这条检查是 turtle-soup 自己的教训要求的——2026-08-14 用 PowerShell 批量改 9 个 `.vue` 把中文全弄乱过。）
- **对比度（数值）**：脚本从 `tokens.css` 解析深色真值、合成 alpha 后算 WCAG。
  **文字 21 项里 20 项达 AA**；唯一未达的是 `text-white on brand-600` = 4.16:1，属**既有状况**
  （没改过任何 `brand-*`，showhand 本来就这么用，design-kit README 自己称 brand-600 为"白字可读性下限"）。
  判定气泡在四个判定色上**都比原来好**（+0.64 ~ +1.07）。表面/描边分离度比原来的 slate 更含蓄
  （描边 vs 卡片 1.72→1.32），但**实机看着是清楚的**（见下条）——深色层次本来靠描边+阴影。
- **浏览器实机验证（8 张截图）**：`docs/agent/scripts/out/turtle-soup-design/`。
  跑通大厅 → 建房间 → 选谜题 → 开局 → 抽屉 → 帮助，实测 `body` 的 computed `font-family`
  就是 `"LXGW WenKai Screen"`、`html[data-theme]=dark`、`--card-bg` 解析成深色值。
  控制台只有 2 条 error，都是没起本地 auth 服务导致的 CORS / `net::ERR_FAILED`——**仓库文档记录的预期现象**。
- **未验证（明确标注）**：
  - 判定气泡（`text-on-accent`）**没有截图**——它要 AI 主持真的回答一句才会出现，而 AI 主持依赖外部 API。
    用户已明确"AI 主持人这个暂时不管了，没有廉价 API 了"。该处只有数值证据。
  - **多玩家状态未覆盖**：只能在本地起单人局，房间内多人环绕、观战等界面没跑到。
  - 本仓库**对 CSS 没有任何自动化测试**，所以"配色迁移正确"终究依赖人眼；上面的截图是抽样，不是全量。

## 生产状态

- **未部署，四个线上站点均无变化**（本轮没有触碰 Worker、协议或线上配置）。
- 线上仍是上一轮状态：`blog.qmzhj.top` Version `bc42df85`。
- 无需回滚。

## 关键文件

| 文件 | 作用 |
|---|---|
| `packages/design-kit/theme.css` | 品牌色阶（普通 `@theme`）＋ **语义颜色层（`@theme inline`）** |
| `packages/design-kit/tokens.css` | 令牌真源；深色段现在被 turtle-soup 常驻使用 |
| `packages/design-kit/README.md` | 语义类对照表 + `@theme` vs `@theme inline` 的判断标准 |
| `turtle-soup/src/assets/main.css` | 只留应用外壳；三个 import；`fade-up` 收敛到令牌 |
| `turtle-soup/index.html` | `data-theme="dark"`、字体 `<link>`、`theme-color` |
| `packages/lobby-kit/src/vue/ProfileEditor.vue` | 新增 `dark` 变体（`AuthBadge` 的 dark 值也改为读令牌） |
| `docs/agent/scripts/playwright-turtle-soup-design-check.py` | 浏览器验证脚本（可复用） |
| `.planning/2026-09-15-turtle-soup-design-kit/` | 迁移脚本（`migrate-slate.mjs`）＋对比度审计（`contrast-audit.mjs`） |
| `docs/lessons-learned.md` | 新增"漏装一个包的依赖，报错长在消费方"条目 |

## 踩坑记录

1. **漏装一个包的依赖，报错出现在"消费它的项目"里，极易误判为自己改坏了共享包**。
   在 abracadawhat 跑 build 报 `failed to resolve import "@lapismind/lobby-kit" from
   packages/chat-kit/src/chat-client.js`，而我刚改过 design-kit，第一反应是"我把共享包改坏了"。
   实际是 `packages/chat-kit` 自己没装依赖（仓库不是 workspace，9 个目录各自安装）。
   判断法：**改 CSS 不可能造成模块解析失败**；把缺的依赖装上、其他改动不动、通过即证清。
   已记入 `docs/lessons-learned.md`。
2. **批量改 `.vue` 仍然必须用 Node（显式 utf8），绝不用 PowerShell 写文件**——这是 turtle-soup
   自己的血泪教训，本次迁移脚本按此写，并用 Node 读回字节确认中文完好。
3. **开局按钮点不动，是 `:disabled="waitingForPlayers || !game.puzzle"`**——光把人数设成 1 不够，
   必须先在"更换"里选一个谜题。写验证脚本时在这上面绕过一圈。
4. **`animate-bounce-slow` 一直是 no-op**（keyframes 全仓库不存在），通关 GIF 其实没有任何动画。
   本次删掉死类；若想要庆祝效果，用 `--dur-*`/`--ease-*` 另做。
5. **`tran slate-x-1/2` 会污染 `grep slate-` 的结果**（`translate` 含 `slate`）——核对残留时要用
   `\bslate-` 或 `-[0-9]` 之类更严的模式。

## 环境与权限

- **本机新增**：Python **3.14** 的 Playwright 1.62.0 + Chromium headless shell。
  注意仓库文档写的"Python 3.13 的 playwright"在本机**不成立**（只有 3.14 / 3.11），
  `C:\Program Files\Python313` 并不存在。
- **联机调试验证必须用 `npx wrangler dev`**：turtle-soup 的 `vite.config.js` **没有配 `/ws`、`/api` 代理**，
  `npm run dev` 跑不了房间。验证脚本默连 `http://127.0.0.1:8788`。
- 本地不跑 auth（`localhost:8787`）时页面出现 CORS / `net::ERR_FAILED` 是**预期现象**，不是回归。
- **收工/开工命令必须用 `pwsh`，不要用 `powershell`**（5.1 读无 BOM 的 UTF-8 中文脚本会报语法错误）。
- 部署：`blog` 目录下 `npm run build && npx wrangler deploy`（本轮不需要）。

## 阻塞项

无。

## 下次可做之事（按推荐排序，均未与用户确认）

1. **lobby-kit 浅色路径仍是硬编码**。本轮只给 `dark` 变体接上了 design-kit 令牌；浅色值
   （`#ffffff` / `#d8d0e4` / `#333333` / `#8a8299`）仍写死在组件里，只是"接近"design-kit 的浅色令牌。
   要两端都同源，把它们也改成 `var(--令牌, 回退)`。收益中等、风险低。
2. **showhand / abracadawhat 也可以照做**。审计发现它们**也没用语义表面令牌**，
   而是硬编码 `#8A8299` / `#333333` / `#D8D0E4` 等 hex（各 100+ 处）。turtle-soup 是第一个真正
   消费语义令牌的游戏，模式已跑通并有验证脚本，另两个可以照着迁。
3. **`AuthBadge` 的 `.lk-btn-primary` 背景是 `#6b6bd0`，不在 `brand-*` 色阶里**，
   所以它不跟随主色色相变化。本轮没动（会改变另两个浅色游戏的观感），可单独处理。
4. **给 `scripts/sync.ps1` 加 UTF-8 BOM**（上一轮遗留，仍未做）：让 5.1 与 7 都能跑。
5. **AI 主持相关一律暂缓**：用户明确"暂时不管了，没有廉价 API 了"。
   这包含 `turtle-soup/docs/todos.md` 里那条"AI 复盘按钮始终不显示"。

**不建议**：为了让深色表面分离度"达到 3:1"去改 design-kit 的深色 `--line`——WCAG 对表面/描边没有
这个要求，且实机看着是清楚的；真要改会同时影响博客的深色主题。
