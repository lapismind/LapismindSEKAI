# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-20
> 性质：**首页两个板块重做 + 已部署上线**（「SEKAI 精选」「SEKAI is running」）
> 生产版本：blog `5ff59956`
> 上一轮 → [`2026-09-20-出包封面与实机图-上线-handoff.md`](./2026-09-20-出包封面与实机图-上线-handoff.md)（出包封面 + 详情页实机图，`1fe8047b`）

## 当前状态

**本轮（家机）**：首页动了两块，均已上线、已做生产验证。

### 1. 「精选游戏」→「SEKAI 精选」（跨栏目）

起因：用户问"精选游戏有没有存在的必要性"。实测下来它有三个问题同时成立：

- **"精选"是假的**：`featured: true` 标在**全部三个**游戏上，`featured` 等于全集；
- **和 `/projects/` 是同一份数据的两次渲染**（同样的标题/副标题/描述/技术标签，链接也指向同样的详情页），
  省下的只是一个点击，代价是手机端这一块独占**整页 37%**（1563px / 4183px）；
- **执行方向反了**：首页是全站曝光最高的地方，三张卡却只有 1 张有图，另外两张退化成一个汉字占位
  （「出」「梭」），而唯一有图的那张用的还是**旧的大厅实机截图**——正是上一轮做封面时想取代掉的那类图。

改法：`featured` 收成两条——出包魔法师（游戏，详情页 `/projects/`）+ 法杖盾斧（Projects，详情页 `/works/`）；
卡片 href 在数据层拼好（游戏与项目分属两个路由）；标题行右侧从单个"全部游戏 →"扩成两个入口。
手机端这块 1563px → **1081px**，整页 4183px → **3700px**。

盾斧那张卡片图是裁出来的：`works/preview_staff.jpg` 顶部 y=25–345（640×320）→
`blog/src/assets/works/staff-card.jpg`（28 KB，构建后 webp 13 KB）。理由见下"经验"。

### 2. 「现在在做」→「SEKAI is running」运行面板

起因：用户说这张卡"属于早期项目占位符级别的东西"。看下来比占位符更硬——**它在说假话**：
第一行写着「正在开发：出包魔法师 —— 2–5 人联机魔法对决」，而那个游戏在 `projects.ts` 里是 `status: 'online'`，
站点统计里也算作已上线。样式上则是"桌面 1100px 宽的卡里只有三行手写短句 + 右侧三个竖排数字"，中间大片死空间。

改法：三段式布局——顶行（`status · 运行状态` + 右上角「最近更新 日期」）、
中间（呼吸式运行指示灯 + `SEKAI is running` + 副行）、底行（横线之上四格读数：游戏 / 已上线 / 曲库 / 文章）。
**所有数字与日期都在构建期算出来**（`projects.ts` / `music-player.json` / 博客集合），不会再过期。
手机端卡片 498px → **372px**；桌面 297px。

副行文案是用户定的捏他：**「现在，我将演示 SEKAI 运行的框架。」**（出自牛顿那句，
把"世界"换成"SEKAI"）。注意它承担的是**姿态**而不是状态陈述——"还在运营"这个意思现在由
标题、指示灯、以及「最近更新」的日期表达。若日后想显式留住那句话的意思，可在它下面再加一行短状态行。

## 经验（本轮学到的，值得跨轮复用）

- **"精选"必须先确认它不是全集**。判据：看它和目的页是不是同一份数据的两次渲染。若是，这个板块就只是
  一次多余的点击成本，而首页的垂直空间是按屏付账的。
- **写死的状态文案必然过期**。`blog/docs/review-2026-08-29.md` 第 80 条早记过"写死状态文案：首页'现在在做'"，
  本轮撞上的正是它烂掉的样子。规则：凡**事实**（有几个游戏、几首歌、几篇文章、最近更新何时）
  一律构建期从数据算；只有**意图**（下一步做什么）才允许手写，而意图只有用户能提供。
- **2:1 画幅塞竖长物体是硬伤**。给盾斧 mod 做卡片图时试过三条路：640×1760 竖图直接裁 → 只剩一条横切片；
  合成"产品板"（缩小居中 + 主色辉光）→ 物体细得像一根线，两侧全空；
  实机截图居中裁（`defend.png` / `axe.png`）→ 法阵清楚但分辨率低（446 宽）、暖沙色调与站点冷色体系打架、
  画面里还有货车兽骨与按键提示。最后取的是**顶部杖首/表盘特写**（金属环 + 罗马数字 + 背后蓝六芒星），
  既保住"时钟法阵"这个签名特征，又和站点冷色同族，而且它是 mod 自己的主视图、不是新造的东西。
- **`.section-title .more-link` 的 `margin-left:auto` 只适合单个链接**（写在 `global.css`）。
  两条并排时各自抢空白会互相推开，要用容器接管 `margin-left`、再收回子项的——本轮加的 `.more-links` 就是干这个。

## 验证证据（本轮）

- 门禁四绿：`npm run build`（17 pages）/ `npm run check`（0 errors, 0 warnings, 2 hints 既有）/
  `npm run lint` / `npm test`。
- 本地 Playwright 复核 1440 / 390 / 320 × 亮暗：断言 2 张卡、2 张图、**0 个字母占位**、
  href 分别为 `/projects/abracadawhat/` 与 `/works/runestaff/`、徽章 `online` / `V1.0`、两个入口链接、
  无横向溢出；`prefers-reduced-motion: reduce` 下指示灯实测退化成静态点（`animation-name: none`、`opacity: 0`）。
- 回归：`/projects/`（3 项 3 图无占位）、`/works/`（下载 + GitHub 链接完整）、
  `/works/runestaff/`（3 张实机图 + 主视图）均无变化。
- 生产（`blog.qmzhj.top`，版本 `5ff59956`）：10 项内容断言全 PASS（含旧文案「正在开发」「精选游戏」已消失、
  `card-media-fallback` 已消失）、新素材 `/_astro/staff-card.*.webp` 返回 200、
  线上渲染几何与本地一致（卡片 297/372、精选 642/1081、2 图 0 占位）。

## 下一步最该做的两件

1. **`/about/` 的同一份数据还在说假话**：`blog/src/data/profile.ts` 的 `profileStatus`
   （「正在开发：出包魔法师 —— 2–5 人联机魔法对决」）现在只被 `/about/` 使用（`about.astro` 第 404 行）。
   本轮**没有动它**——因为"正在开发 / 最近在学 / 下一步"写的是用户的意图，Agent 编不出来。
   需要用户说一句现在在做什么；或者按首页同样思路改成不写死的形式。
2. **挑一份生图提案落地**：`.planning/2026-09-20-生图元素提案/proposal.md`（主美视角，6 条候选
   + 8 类"不要加图的地方" + "只做一条选哪条"）。其中最便宜的是 P0——全站 `og:image` 兜底至今仍是
   海龟汤大厅截图（`BaseHead.astro`），而 11 个页面/布局没有一处传 `image=`，分享任何页面预览图都是错的。
   这条**不需要生图能力也能做**。

## 遗留清单（承接前几轮，均未做，按建议排序）

1. **abracadawhat 的 v2 上报在生产仍未被证实**（已查清不是 bug，v2 之路从未跑过）：
   下次有人完整打一局后，查 `player_match_reports` 有没有行就能定案。
2. **design-kit 的按钮档位要一个决定**：白字压 `brand-600` 是 4.16:1，AA 要 4.5:1——所有
   `bg-brand-600 text-white` 不达标；改 700 是 5.49:1，涉及三个游戏约 18 个按钮。
3. **重连 / 加入失败 UI 只做了一半**：掉线有提示了，但 worker 用 HTTP 409/410 拒绝加入时
   客户端仍忽略，表现还是"点了没反应"。
4. **全仓 `bg-white` → `bg-surface-solid` 清扫**（约 28 处，浅色下零视觉影响，为深色主题铺路）。
5. **abracadawhat 扣牌区可读性**：8 个无标签 emoji 在约 20px 上辨认。
6. **小型清理**：showhand `RoomView.vue` 的 `v-if="false"`、`GameHelp.vue` 未使用的 `open`、
   结算弹窗两个同义「关闭」按钮；`--tap-min` / `--dur-*` / `--ease-soft` 在 showhand 零引用。
7. **文档更正**：`docs/agent/deploy.md` 第四节写"三个游戏 `/api/identity` 返回 500"，
   但海龟汤没有这个路由（生产 404）。
8. **showhand 手机端约 140px 空白**（顶栏与牌桌之间）。
9. **320 宽下页头横向溢出 43px**（本轮实测确认：把 `#featured` 整个 `display:none` 后
   `scrollWidth` 一点没变，仍是 363，溢出源全在页头——导航 + 主题按钮）。既有问题，本轮未修。
10. **首页统计只数游戏**（3 游戏 / 3 已上线），未含 Projects 的 1 个作品。若要贯彻
    "SEKAI 不只是游戏"，可加一格；`.now-stats` 是 grid，加一格只改列数。
11. **「SEKAI 精选」的卡片上没有直接下载入口**（盾斧的下载按钮在详情页）。卡片整体是一个 `<a>`，
    内嵌 `<a>` 是非法 HTML；要做需把卡片结构改成"容器 + 覆盖式链接"。
12. **`blog/public/cursors/` 约 433KB 未被引用**：只有 `mfy-normal.png` / `mfy-link.png` 被 `global.css` 用；
    其余含 2 个 `.cur`（338KB）、`mfy-candidate.png`（45KB）、`preview-sheet.png` 与 20 张带中文标签的开发预览图，
    全部随 dist 上线且文件名不带哈希（落 7 天缓存区）；`site-features.md` 第 2 节对光标的描述也已过期。
    主美怀疑是留给未来的候选集，**删前先问用户**。

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、首页手机端减法。

## 环境与权限

- **blog 验证不必起 wrangler**：它是纯静态站，本轮改用 `python -m http.server` 指向 `blog/dist` +
  Playwright，比 `npm run dev` / `astro preview` 快得多，也绕开了下面那个 preview 残留的坑。
  联机游戏页面仍必须 `npx wrangler dev`（`vite dev` / `vite preview` 没有 `/ws`、`/api` 代理）。
- blog 部署：`cd blog && npx wrangler deploy`（**家机** wrangler 已登录，本轮实测通过）。
  `npm run build` 会触发 `postbuild` 预压 Live2D moc3；**绕过 build 直接 deploy 会部署上一次的 `dist/`**。
- **`astro preview` 是常驻守护进程**：`TaskStop` 杀外壳后它仍活着并占着 3000，用 `npx astro preview stop` 停。
- **Playwright 验证四条纪律**：轮询到条件成立（别 sleep）；`data-testid` 定位（别按显示名）；
  不用 `networkidle` 判成败；**滚动触发型页面必须 `behavior: 'instant'` 滚动**（站点开了 smooth scroll，
  否则 `scrollTo` 全程是动画，`.reveal` 假不触发）。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**（否则 Cloudflare 403）；
  Git Bash 的 curl 有 TLS 握手问题，直接用 Python urllib。
- 临时验证产物别留在仓库：`_out/` **不在 gitignore 里**，用完记得删
  （`docs/agent/scripts/out/` 才是被 gitignore 的那个）。仓库里不写盘符，脚本用自身位置定位。
- workerd 子进程不随父进程退出，残留按 PID 杀；别按命令行批量杀（会匹配到自己）。
- 更多：根与 blog 各自的 `docs/lessons-learned.md`。

## 阻塞项

无。
