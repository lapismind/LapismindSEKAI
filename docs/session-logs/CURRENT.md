# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-15
> 性质：设计语言统一（延续上一轮；代码已完成并推送；**部署被 wrangler 登录卡住**）
> 上一轮：turtle-soup 接入 design-kit（语义颜色层 + 202 处 slate 迁移）
> → [`2026-09-15-turtle-soup-接入设计语言-handoff.md`](./2026-09-15-turtle-soup-接入设计语言-handoff.md)

## 本轮目标

把设计语言统一推到底：**lobby-kit 的浅色路径** + **showhand / abracadawhat 两个游戏**，
然后验证、部署。结束时 **博客 + 三个游戏全部同源**。

## 执行摘要

- **lobby-kit 浅色路径也收敛到令牌**：`ProfileEditor` / `AuthBadge` 的浅色值由硬编码 hex
  改为 `var(--令牌, 原硬编码)`。上一轮只给了 `dark` 变体，浅色仍写死，所以严格说
  lobby-kit 当时还没真正接入 design-kit。
- **`AuthBadge` 主按钮改用 `var(--primary)`**（原 `#6b6bd0`）：白字对比度约 4.4:1 → 约 5.5:1，过 AA。
  **不要**用 `--primary-brand`（亮色 `#8888cc`，白字只有 3.3:1）。
- **showhand + abracadawhat：182 处硬编码 hex → 语义令牌**（UI 颜色 100% 是 Tailwind 任意值形式）。
- **`sync.ps1` 加 UTF-8 BOM**：Windows PowerShell 5.1 现在也能跑（原本在 5.1 下直接语法错误）。
- **修 turtle-soup 的 `deploy` 脚本**：`"deploy": "vite build && wrangler deploy"` → `"npm run build && wrangler deploy"`。
  `vite build` 会**绕过 `prebuild` 钩子**（同步 97 个字体子集），而 `public/fonts/` 是 gitignore 的
  ——全新 clone 上部署会发出一个没有字体的站。已实测修复有效。
- **新增三个验证脚本**，都在 `docs/agent/scripts/`：`playwright-game-shot.py`（通用截图）、
  `playwright-design-token-probe.py`（探针：查旧调色板残留）、
  `playwright-two-player-table.py`（**双人开局**，覆盖对局中的牌桌界面）。

## 关键决策（git 查不到的部分）

- **中性色从"紫调灰"收敛到 design-kit 的"冷调蓝灰"**。两个游戏原本用 `#8a8299` / `#5f586b` /
  `#d8d0e4` 这一族**紫调**灰；design-kit 的中性色是从 `--hue-accent` 减 34°（落进蓝区）派生的。
  这是设计语言自己的取舍（README 明说冷调中性、紫色留给品牌色承担），实测变化极细微。
- **只动 UI chrome，绝不动"游戏物件"色**：保留 `showhand/src/core/tableShape.js` 的牌桌 SVG 配色、
  `ChipIcon` 的筹码红 `#e05a4e`、以及作为 **prop 传入**的颜色（`<ChipIcon color="#8888cc" />`）。
  两条理由：这些值在 JS/prop 上下文里**用 `var()` 本就无效**；且牌桌/筹码是游戏物件，
  design-kit 规则明确允许游戏元素有强对比固有色（与 turtle-soup 保留判定色同一原则）。
  迁移脚本靠"只替换 Tailwind 任意值字面量"保证这条边界，并已核对这三处未被触碰。
- **`lobby-kit` 的 fallback 一律给全**（`var(--x, 原值)`）：lobby-kit 不依赖 design-kit，
  引了的项目自动同源，没引的完全不变。
- **BOM 修复方式**：不用 `Set-Content`，用 Node 前置写 `EF BB BF` 字节
  （`Buffer.concat([Buffer.from([0xEF,0xBB,0xBF]), readFileSync(p)])`）。
  `.gitattributes` 的 `* text=auto eol=lf` 只归一行尾，不会剥 BOM。

## 验证证据

- **测试全绿**：`design-kit`（30 令牌/色相一致）；`lobby-kit` 7 文件；`turtle-soup` 1 passed；
  `showhand` 8 passed；`abracadawhat` **119 passed**（含 `emoji-assets`）。
- **构建全绿**：三个游戏 `npm run build` 通过；abracadawhat 的 `postbuild` → `copy-emojis.mjs`
  → `Emoji copy complete` 日志**按部署文档要求出现**。
- **对局中界面已截图 + 探针（本轮补上的关键一环）**：用两个独立 browser context 模拟两名玩家，
  A 建房 → B 加入 → A 开局，覆盖了上一轮够不到的牌桌界面：
  - `showhand`：牌桌 SVG、两个座位、暗牌牌背、底池、右侧下注面板（闷牌半价、看牌/跟注/弃牌）
  - `abracadawhat`：战绩、牌堆/秘密牌计数、两行玩家区（暗牌用琥珀深色牌背）、施法按钮列
  - **探针（两游戏 × 两玩家，共 4 次）：旧调色板残留 = 0 处**；实际色值全是品牌色阶
    （showhand `#6363a0`=brand-700 / `#cfcfe9`=brand-200；abracadawhat `#505085`=brand-800 /
    `#7676b8`=brand-600 / `#f2f2fa`=brand-50）
- **编码无损**：46 个 `.vue/.js/.css` 用 Node 按 utf8 读回，无 `\uFFFD`。
- **BOM 修复实测**：`powershell`（5.1）+ `pwsh`（7）**都能跑** `sync.ps1 status`（修复前 5.1 直接语法错误）。
- **turtle-soup deploy 修复实测**：删掉 `public/fonts` 后走 build，97 个子集重新同步到
  `public/fonts/` 与 `dist/fonts/`（修复前该路径会发出 0 字体）。
- **仍未验证**：本仓库对 CSS 没有自动化测试，验证仍是"截图 + 探针抽样"，不是全量；
  对局只跑到开局第一轮，没走完整局（结算弹窗、秀牌等状态未截）。

## 生产状态

- **未部署 —— 被 wrangler 登录卡住**。本机 `npx wrangler whoami` 返回
  `You are not authenticated. Please run wrangler login.`
  排查过：无 `CLOUDFLARE_API_TOKEN` 等环境变量、文档提到的凭证文件
  （`%APPDATA%\xdg.config\.wrangler\config\default.toml`）不存在、`~/.wrangler` 不存在。
  项目里的 `.wrangler/` 只是 `wrangler dev` 的本地 DO 状态，不是登录凭证。
  **推测原因**：`MIGRATION-NOTES` 说 wrangler 登录状态随增量包迁移，而本机没解压过那个包。
- **登录后即可部署**（代码与构建都已就绪，见上方验证）：
  ```powershell
  cd turtle-soup;  npm run deploy
  cd ../showhand;      npm run deploy
  cd ../abracadawhat;  npm run deploy
  ```
- **线上目前仍是旧样式**（三个游戏都没变）；blog 本轮未动，仍是 Version `bc42df85`。
- 回滚：Cloudflare 控制台 Workers 版本历史退回上一个 Version，或 `git revert` 后重部署。

## 关键文件

| 文件 | 作用 |
|---|---|
| `packages/lobby-kit/src/vue/{ProfileEditor,AuthBadge}.vue` | 浅色 + 深色两套值都走 `var(--令牌, 回退)` |
| `.planning/2026-09-15-design-language-light-games/migrate-hex.mjs` | 182 处 hex → 语义令牌 |
| `docs/agent/scripts/playwright-two-player-table.py` | **双人开局**截图 + 对局中探针 |
| `docs/agent/scripts/playwright-design-token-probe.py` | 探针：旧调色板残留 / 令牌是否生效 |
| `docs/agent/scripts/playwright-game-shot.py` | 通用截图（前后对比） |
| `scripts/sync.ps1` | 已加 UTF-8 BOM（5.1 / 7 都能跑） |
| `turtle-soup/package.json` | `deploy` 改为 `npm run build && …`，不再绕过 prebuild |
| `docs/lessons-learned.md` | 新增两条：`grep -o` 让排除失效；PowerShell BOM 结论更新为"已修复" |

## 踩坑记录

1. **`grep -o` 会让后面的"排除模式"失效，据此得出的结论是错的**。我用
   `grep -roiE "#hex" src | grep -viE "\-\[#"` 判断"哪些 hex 不在 Tailwind 任意值里"，
   结果**每一条都通过排除**（`-o` 只输出匹配片段，片段里当然不含 `-[#`），
   于是我误判"有大量 hex 写在 scoped CSS/script 里"，还照这个错误前提设计了第二趟替换。
   是 dry-run 的计数（"style 内 hex 0 处"）与预期矛盾才让我回头读文件。已记入根 `lessons-learned.md`。
   **教训：工具输出与预期冲突时，先怀疑工具用法。**
2. **`/api/identity` 返回 500 不是回归**：三个游戏都没有 `.dev.vars`，而该 handler 有显式守卫
   `if (!secret) return ... { error: 'server not configured' }, 500`。属本地环境缺口
   （`.dev.vars` 随增量包迁移，本机没有），且 `GAME-DEPLOY.md` 写了未配密钥时走降级路径
   （`/ws` 跳过验签、以客户端自报身份为准）。游戏功能正常。
3. **`vite build` 会绕过 `prebuild`**：turtle-soup 的 `deploy` 原本直接调 `vite build`，
   而字体同步挂在 `prebuild` 上，`public/fonts/` 又是 gitignore 的——全新 clone 部署会没有字体。
   这正是 `GAME-DEPLOY.md`「不要自行拆成 vite build 和 wrangler deploy」那条规矩要防的事。
4. **5.1 控制台回显中文乱码 ≠ 文件损坏**：BOM 修复后跑 `sync.ps1`，脚本自身输出正常，
   但我在 bash 里 echo 的中文标签被 5.1 控制台按 GBK 显示成乱码。判断文件好坏要读字节（Node utf8），别信终端。

## 环境与权限

- **wrangler 未登录（本轮新增的重要事实）**：上一份 `CURRENT.md` 与环境小节曾写"wrangler 已登录"，
  在本机**不成立**，已在此更正。部署前先 `npx wrangler login`（交互式 OAuth，需要你自己完成）。
- **本机 Playwright 是 Python 3.14** 的 1.62.0 + Chromium headless shell。
  仓库文档写的"Python 3.13 的 playwright"在本机不成立（只有 3.14 / 3.11）。
- **`scripts/sync.ps1` 现在 `pwsh` 与 `powershell` 都能跑**（BOM 已加）。
- 联机页面验证必须 `npx wrangler dev`（`vite dev` 没有 `/ws`、`/api` 代理）。
  本轮用过端口：8789 showhand、8790 abracadawhat、8788 turtle-soup。
- 不跑本地 auth（`localhost:8787`）时的 CORS / `net::ERR_FAILED` 属**预期现象**。

## 阻塞项

- **部署阻塞在 `wrangler login`**（需要用户交互完成 OAuth）。除此之外无阻塞，代码与构建均已就绪。

## 下次可做之事（按推荐排序）

1. **`npx wrangler login` 然后部署三个游戏**（命令见上）。这是唯一未完成的用户目标。
2. 部署后按 `abracadawhat/docs/deployment-v2.md` 验收：两个表情 URL 必须返回
   `200 image/png`（`/chat-kit/emojis/1/stamp0008.png`、`/chat-kit/emojis/21/stamp0943.png`），
   并开聊天面板确认表情显示为图片而非文件名。三个站的首页与房间页也各抽查一次。
3. 把 `playwright-two-player-table.py` 补成能跑完整局（结算/秀牌状态），目前只到开局第一轮。
4. `design-kit` 的 `brand-600` 配白字是 4.16:1，低于 AA 正文标准（既有问题，非本轮引入）；
   浅色底白字按钮可考虑统一用 `--primary`。
5. 把 `migrate-hex.mjs` 从 `.planning/` 沉淀成 `docs/agent/scripts/` 下的正式工具。

**不建议**：把 `tableShape.js` 的牌桌配色、`ChipIcon` 的筹码红迁到令牌——游戏物件色，
`var()` 在那些上下文无效，design-kit 也明确允许游戏元素有强对比固有色。
