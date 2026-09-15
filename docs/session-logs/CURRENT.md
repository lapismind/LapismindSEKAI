# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。

> 日期：2026-09-15
> 性质：功能 + 性能 + 修复 + 工作流（本轮已完成并上线，下面是可继续的方向）
> Git：`02a3182`（main 已推送；本轮共 5 个提交）

## 本轮目标

1. 给博客加一批"不太动感"的柔和动效，符合站点既有气质。
2. 用户提出看板娘首屏加载慢，要求**不压画质**地优化。
3. 修两个右下角浮动控件的定位问题（都是改动过程中暴露的）。

## 执行摘要

- **动效落地 + 令牌源收敛**（`03927b8`）：design-kit 新增动效令牌与入场基元；卡片悬停减半；章节标题装饰线；`.more-link` 下划线滑出；卡片图淡入。顺手把博客 `global.css` 里抄的一整份 design-kit 令牌改成 `@import`。
- **Live2D 首屏 3465KB → 1756KB（−49%）**（`bcf7857`）：纹理 PNG→WebP 无损（逐位相同）、moc3 构建期 brotli 预压缩、补全站缓存头。
- **播放器按钮被顶到屏幕上边缘**（`489cec1`）：DOM 顺序 `[按钮, 面板]` + 贴底对齐，面板一长就把按钮挤上去。改 `column-reverse` + 面板加视口高度上限。
- **回到顶部压住电台按钮**（`9e720e5`）：两个浮动控件同角，位置各写一份必然相撞。抽 `--corner-*` 变量同源。
- **Agent 接力机制**（本文件 + `docs/agent/` + `scripts/sync.ps1`）：把"跨设备交接"从靠自觉变成有固定入口和一条命令。

## 关键决策（git 查不到的部分）

- **动效基调定成硬约束**：缓动统一 `--ease-soft`（无回弹），时长只四档（0.15/0.22/0.35/0.7s），只动 opacity / 小位移 / 颜色 / 阴影，位移 ≤6px、缩放 ≤3%。理由是站点已有全站细雪这类常驻动效，再来弹跳会互相抢。
- **不做"背景柔光呼吸"**：站上已有细雪，两个常驻动效叠加会互相抢注意力。这是主动放弃，不是遗漏。
- **纹理 WebP 用 `exact=True`**：默认模式省得多（2074→757KB），差异全在 alpha=0 的不可见像素；但 Live2D 混合模式写在二进制 moc3 里，无法排除 multiply 这类"alpha=0 时 RGB 仍参与合成"的模式。多花 460KB 买一个不用赌的保证，符合"不压画质"的字面要求。
- **moc3 走构建期预压缩，不用 CF Compression Rule**：控制台规则不在 git 里、不可 review；`.br` 产物 + Worker 协商全部在代码里。
- **不做 Accept-Encoding 协商**：`wrangler dev` 会把进来的 `Accept-Encoding` 一律改写成 `br, gzip`，负面路径本地测不出来；CF 边缘本身会在客户端不支持 br 时自动解压。测不了的逻辑不如不写。
- **看板娘位置定死**：用户明确说那是反复微调的结果。已写进 `blog/AGENTS.md` 的「不要动的地方」，并明确"防重叠/挪位置/缩放自适应一律不做"。
- **根 `AGENTS.md` 只做编排**：细则放 `docs/agent/`，避免根文件膨胀成细节堆。

## 验证证据

- 动效与令牌重构：11 页 × 4400 元素 × 40 个计算属性做全量快照比对，**令牌重构零差异**；动效版 72 处差异全部对应预期改动。
- 无损性：纹理转 WebP 后用 numpy 逐位比对（最大通道差 0）；上线后浏览器 `crypto.subtle` 复核 moc3 的 sha256 与原始文件一致。
- 首屏：4 次重复测量 Live2D 字节数完全一致（1756KB）；生产用 brotli 真解 moc3 得到 1,185,728 字节、开头 `4D4F4333`（MOC3 魔数），确认 CF 未二次压缩。
- 控件：6 视口 × 3 状态（关闭/迷你条/字幕剧场）异常 0；用 `elementFromPoint` 确认按不到被遮挡的按钮。
- 全站冒烟：11 页无 pageerror、无失败请求、无破图、入场动效正常。
- 门禁：`npm run build` / `check`（0 errors）/ `lint` / `test` 全绿。

## 生产状态

- `blog.qmzhj.top`，Version `bc42df85`（与 `main` = `02a3182` 的代码一致）。
- 回滚：Cloudflare 控制台 Workers 版本历史，回退到上一个 Version 即可；或 `git revert` 后重新 `npm run build && npx wrangler deploy`。
- 三个游戏站未受影响，本轮未动。

## 关键文件

| 文件 | 作用 |
|---|---|
| `packages/design-kit/tokens.css` | 动效令牌（`--ease-*` / `--dur-*` / `--stagger`）唯一真源 |
| `packages/design-kit/base.css` | 入场基元 `.reveal` / `.reveal-stagger`、`.glass` |
| `blog/src/styles/global.css` | 博客自有令牌（`--cursor-*` / `--lift-hover` / `--corner-*`） |
| `blog/src/worker.ts` | `/live2d/*` 防盗链 + moc3 返回 `.br` + 缓存头 |
| `blog/public/_headers` | 非 Worker 路径的缓存头（`_astro` immutable、字体/音乐 7 天） |
| `blog/scripts/precompress-live2d.mjs` | `postbuild`：moc3 预压成 `.br` |
| `blog/AGENTS.md` | 项目约定 + **不要动的地方** |
| `docs/agent/` | Agent 规范索引 + 接力协议 + 归档规范 |

## 踩坑记录

全部记在 `blog/docs/lessons-learned.md` 第 18—28 条。最容易再犯的三个：

1. **Worker 返回已压缩 body 必须 `encodeBody: 'manual'`**，否则二次压缩——**只看字节数发现不了**，要比对解码后的 sha256。
2. **同优先级 CSS 规则靠源码顺序决定胜负**：`display: flex` 写在前面会被后面的 `display: block` 覆盖（我第一版改法就栽在这，靠量各层实际高度才发现）。
3. **`wrangler dev` 会改写 `Accept-Encoding`**，本地测不出协商分支。

## 当前状态

本轮 5 个提交全部完成、已推送、已上线，工作区干净。**没有进行中的半成品。**

## 推荐技能

- 接手本文件 → 直接读即可，本文件是自足的。
- 继续做游戏侧工作 → `cloudflare` / `durable-objects` / `workers-best-practices`。
- 要动设计语言 → 先读 `packages/design-kit/README.md`（令牌唯一真源，禁止在项目里重写）。

## 环境与权限

- 部署：`blog` 目录下 `npm run build && npx wrangler deploy`（wrangler 已登录，Cloudflare 账号可用）。
- 本地验证：`npx astro preview`（注意它**不跑 Worker**，验证 Worker 行为要用 `npx wrangler dev`）。
- 浏览器验证：Python 3.13 的 Playwright（见 `docs/agent/scripts/`）。
- 本地 auth 服务默认指向 `http://localhost:8787`，不启动时页面会出现 `net::ERR_FAILED`——**这是预期现象**，不是回归。

## 阻塞项

无。

## 下次可做之事（按我的推荐排序，未与用户确认）

1. **把本轮工作写成一篇博客**：站点定位是"开发记录"，目前只有 4 篇。素材现成（令牌收敛 + 无损瘦身 + 三个坑），半小时能出。成本低、立刻有产出。
2. **三个游戏串成一个 SEKAI**：三个域名各玩各的，但 auth 已有跨游戏战绩（`POST /api/matches`）、成就、最近战绩接口，资料页在用。可做跨游戏战绩/成就看板。把"三个孤立小游戏"变成"一个作品集"，回访动机最强。
3. **游戏动效只统一一半**：三个游戏几乎没用 design-kit 的动效令牌，且是回弹风格（showhand `fx-pop` 的 `cubic-bezier(0.34, 1.56, …)`、abracadawhat `dragon-pop`）。建议**统一时长与缓动，但保留出牌/判定这类关键反馈的回弹**——回弹是游戏手感，全砍会变温吞。另需清掉 abracadawhat `Card.vue` 的 `revealed-glow` 常驻无限动画。
4. **首页手机端减法**：09-04 审阅实测手机首屏同屏 8 个"主角"。用户否决了 Live2D 折叠，但"今日箱曲""滚动提示"往后挪仍可做。
5. **性能残余**：首页 6.25MB 里 Live2D 已从 3.31MB 降到 1.6MB；剩下可榨的是曲绘 0.72MB + Footer 横幅 0.51MB 转 AVIF。

**不建议**：站内搜索（才 4 篇，加了是空转）、友链页（没有真实友链对象）。

## 已知但明确不做的

- **看板娘懒加载 / 折叠 / 减弱动效时静态化**：用户已确认不实施（见 `docs/ui-ux-review-v2-2026-09-04.md` §5.1）。
- **看板娘位置**：定死，见 `blog/AGENTS.md`。
