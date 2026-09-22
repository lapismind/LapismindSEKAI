# 2026-09-20 全站分享卡（OGP）修复 + 站名与描述收口 · 上线归档

> 已收口。当时这份内容写在 `docs/session-logs/CURRENT.md` 里，归档时原样搬过来，只改了标题与页脚。
> 生产版本 blog `c5e1f1fd`。后续接力棒见 [`CURRENT.md`](./CURRENT.md)。

> 日期：2026-09-20
> 性质：**全站分享卡（OGP）修复 + 站名与描述收口 + 已部署上线**
> 生产版本：blog `c5e1f1fd`（本轮两次部署：`78c52d1c` 分享卡 + 站名描述；`c5e1f1fd` 标题后缀 + og:site_name）
> 上一轮 → [`2026-09-20-首页精选与运行面板-上线-handoff.md`](./2026-09-20-首页精选与运行面板-上线-handoff.md)（`5ff59956`）；再上一轮 → [`2026-09-20-出包封面与实机图-上线-handoff.md`](./2026-09-20-出包封面与实机图-上线-handoff.md)（`1fe8047b`）

## 当前状态

**本轮（家机）**：接主美提案（`.planning/2026-09-20-生图元素提案/proposal.md`）落地了它的 P0，并做了站名收口。
两块都已上线、已做生产验证。

### 1. 全站分享卡（OGP）——提案 A2，已修完

**原状**：`BaseHead.astro` 的 `og:image` 兜底是 `soup-lobby.png`——一张海龟汤大厅截图，227KB PNG，
还铺满 26 张官方头像；而全仓 **14 个调用点 0 处传参**（提案说 11 处，实际 14）。所以分享 `/about/`、
`/works/`、任何文章，预览图都是错的，且是版权暴露面最大的一张图。

**做法**：新增 `blog/scripts/gen-og-card.py`，用 Playwright 把一张 HTML 渲染成 **1200×630 jpeg**（59KB）。
文案读 `src/consts.ts`、域名读 `astro.config.mjs`、配色与字体读 `packages/design-kit`、拉丁字用站内那份
Atkinson——全是真源。做法照搬既有的 `scripts/gen-token-cover.py`（同一套"读真源再渲染"的路子）。
**没有用 AI 生图**：这一步的收益全在"接线正确"，而卡片文字必须锐利，脚本渲染正好绕开 AI 渲染文字的老问题；
想要插画版底图，把 `src/assets/site/og-card.jpg` 换掉即可，代码不用改。

**接线**：`BaseHead.astro` 的 `image?: ImageMetadata` 改成 `imageUrl?: string`——原来直接吐 `ImageMetadata.src`，
会把**源文件**发出去（文章 hero 最大 1.5MB PNG，抓取器要的只是几百 KB 的图）；兜底换成新站点卡；
补上此前缺失的 `twitter:image`，并给固定尺寸的默认卡声明 `og:image:width/height`。
`BlogPost.astro` 用 `getImage()` 把文章 hero 转成 1200 宽 jpg 再传进去。
**13 个页面调用点一个都没改**——比提案估的"改 8 个调用点传参"更省。

**实测**（扫 `dist/` 全部 17 个页面）：`og:image` 与 `twitter:image` 覆盖率 100%，仍指向 `soup-lobby` 的 **0 个**；
12 个页面用站点卡，5 篇文章各用自己 hero 转出的小 jpg。**源图 1485KB / 711KB 的交付成 54KB / 113KB**，
抓取器再也不用拉大图。全部 200 + `image/jpeg`。另外验了两件事：重跑脚本 md5 一致（雪点写死、不随机）；
把卡片缩到 **500px / 320px** 看——那是抓取器实际显示的尺寸，"LAPISMIND SEKAI" 一眼可读。

### 2. 站名与描述收口（用户定稿）

- `SITE_DESCRIPTION` → **「可能是一位马批的 SEKAI，有一些作品在这里涌现了。」**（用户给的捏他，原样采用，
  只在 SEKAI 两侧按站内排印习惯留空格）
- `SITE_TITLE` → **`Lapismind SEKAI`**（原 `Lapismind 的博客`）

这两个常量的影响面比看起来大，改一处五处生效：页面 `<title>`、`og:title`、`og:description` /
`meta description`、RSS 频道标题、页头那条 RSS 备用链接的 `title`、以及**分享卡本身**（它读这两个常量）。
关键事实：**页头与页脚显示的品牌名是写死的**（`Header.astro` 的 `.brand-name`、`Footer.astro` 的版权行），
所以本轮**没有动任何可见版式**——变的只有标签页标题、搜索/社交分享显示的标题与描述。
顺带修掉一处会变成重复的标题：登录页原本 `进入 SEKAI - Lapismind SEKAI`（同一条里两个 SEKAI），
改成只留 `进入 SEKAI`（该页不指望被收录，风味价值更高）。
分享卡脚本也改成**读 `SITE_TITLE`** 再按第一个空格拆两行做字标——改完比对 md5 **前后完全一致**，
证明是行为等价的改写，但从此站名只有一个真相。

同轮的收尾两件（用户定，同在 `c5e1f1fd`）：① **文章页标题接上站点名后缀**——此前全站只有文章页与
登录页没有，现在是 16 个页面统一成「页面名 - Lapismind SEKAI」的形式（登录页刻意只留「进入 SEKAI」，
因为站点名已含 SEKAI，接上去等于同一条标题里两个 SEKAI；要严格统一就改成 `登录 - Lapismind SEKAI`）；
② 补上**全站一直缺失的 `og:site_name`**（17/17 页）。两者是一对：`og:site_name` 让抓取器从独立字段
拿到站名，`og:title` 里就不必再带它——但 `BaseHead` 现在同一个 `title` 同时喂 `<title>` 与 `og:title`
（全站一贯如此），所以文章页的 `og:title` 也带后缀，与其余页面的 `og:title` 形状一致。
**代价**：后缀占约 18 字符，最长的一条文章标题现在 **57 字符**，搜索结果里可能中段截断
（浏览器标签与分享卡不受影响，会自行截断加省略号）。

## 经验（本轮）

1. **提案里的"实测数字"也会错——要复核的是归因，不只是数字。** 提案 A3 断言"浅色主题下 Hero 官方卡面被
   `color-mix(...) 55%` 洗到几乎不可辨"。我按它的数字去修之前先复跑：浅色下那张图**清晰可辨**，
   而且被指为元凶的 `background-color` 夹在**不透明**背景图下面，**从未生效**（改它等于什么都没改）。
   真正叠在图上的是 `::after` 的五段渐变，作用是把底部融进页面底色，是刻意收尾。
   **教训：上一轮我据此建议"Hero 现在就修"，是错的；先验再改。**
2. **OGP 兜底必须是"站点级"的图，不能拿某个功能的截图当兜底**——否则每一次外链都带错的第一印象，
   而且会持续几个月没人发现（真正发现它的是另一份提案，不是站点的任何检查）。
3. **出图脚本的两条纪律**：① 读真源（文案/颜色/字体都从仓库里取，别在脚本里写第二份）；
   ② 固定随机量（我用写死的雪点坐标），这样重跑得到**同一张图**，否则每次构建都在改素材。
   另外尺寸必须和声明一致——`device_scale_factor` 要设 1，否则 1200×630 的声明与 2400×1260 的实际不符。
4. **站名与描述是链条的源头**：它们只该有一份，改一处让 `<title>`/meta/RSS/分享卡一起走。
   本轮把分享卡也接上去之后，"改站名"才真的是一处改动。

## 验证证据（本轮）

- 门禁四绿：`npm run build`（17 pages）/ `npm run check`（0 errors, 0 warnings, 2 hints 既有）/
  `npm run lint` / `npm test`。
- 构建产物扫描（17 个 HTML）：`og:image` + `twitter:image` 100% 覆盖、两者一致、均为 https 绝对地址、
  0 处指向 `soup-lobby`；`og:image:width=1200` 只出现在用默认卡的页面（文章页尺寸随原图，不声明）。
- 生产（`blog.qmzhj.top`，版本 `78c52d1c`）抽样 8 个页面：标题与描述全部正确
  （首页/博客列表页是新的"马批"句，其余页面用自己的描述）；`og:image`+`twitter:image` 全部 200 +
  `image/jpeg`（站点卡 59KB ×7、文章图 56KB ×1）；首页渲染正常（`SEKAI is running`、`SEKAI 精选`、
  2 卡 0 占位、无横向溢出、无 pageerror）。
- 生产第二次（版本 `c5e1f1fd`）抽样 12 个页面（含全部 5 篇文章）：`og:site_name` 全部为
  `Lapismind SEKAI`、文章页标题后缀到位、`og:image` 无回归（无一条指向旧兜底）。
- 文案链核对：全站无残留把站点叫成 `Lapismind 的博客` 的地方（搜出的三处都是正文普通用词）。

## 下一步最该做的

1. **A1：`/about/` 单推角色卡的真冬半身插画**（提案里"只做一条就选它"，也是唯一"该有画却没有"的地方）。
   两个前置它没写清、需要知道：
   - **它声称"不动 `.oshi-moon`"与自己的作画窗口矛盾**：那个 220×220 光斑锚 `top:-70 right:-60`，
     位置正是人物头部该在的地方（暗色主题下是卡里最显眼的东西）。所以 A1 的真实性质是
     「新增 + 移除一层占位」，不是零接触。
   - "右侧余 118px"是**盒子**差；视觉上真实空出约 230px（`.oshi-facts` 第三列文字填不满格子）。
     这也意味着作画区能存在靠的是那几行字短，资料写长了会被压回 118px。
   - 起手优势：`.planning/2026-09-17-游戏封面/refs/mafuyu-casual.jpg`（上一轮裁掉水印的常服参考）。
   - **要用户拍板 + 用生图流**，所以它需要用户在场。
2. **`/about/` 的 `profileStatus` 还在说假话**：`blog/src/data/profile.ts` 里「正在开发：出包魔法师」
   而该游戏早已上线；它现在只被 `/about/`（`about.astro:404`）使用。**Agent 编不出"意图"**，
   需要用户说一句现在在做什么，或按首页同样思路改成不写死的形式。
3. **A4（IntroOverlay 三块卡面）需要用户在三个选项里选一个**：统一色温 / 完全原创重绘 / 不动。
   没有这个选择它不能开工；且脸心锚点是几何硬约束（重绘后必须用同一套红圈质心法复核，偏差 ≤1%）。
4. **A2 的余量**（不急）：`/projects/` 的专属分享卡（三张已有封面横向拼贴成 1200×630，**不需要生图**）；
   `/about/` 的专属卡（原计划复用 A1 的真冬半身图，所以它跟 A1 一起走）。

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
9. **320 宽下页头横向溢出 43px**（实测确认：把 `#featured` 整个 `display:none` 后 `scrollWidth`
   一点没变，仍 363，溢出源全在页头——导航 + 主题按钮）。既有问题，未修。
10. **首页统计只数游戏**（3 游戏 / 3 已上线），未含 Projects 的 1 个作品。若要贯彻
    "SEKAI 不只是游戏"，可加一格；`.now-stats` 是 grid，加一格只改列数。
11. **「SEKAI 精选」的卡片上没有直接下载入口**（盾斧的下载按钮在详情页）。卡片整体是一个 `<a>`，
    内嵌 `<a>` 是非法 HTML；要做需把卡片结构改成"容器 + 覆盖式链接"。
12. **`blog/public/cursors/` 约 437KB 未被引用**（本轮实量）：只有 `mfy-normal.png` / `mfy-link.png`
    被 `global.css` 用；其余含 2 个 `.cur`（330KB）、`mfy-candidate.png`（45KB）、`preview-sheet.png`
    与 20 张带中文标签的开发预览图，全部随 dist 上线且文件名不带哈希（落 7 天缓存区）；
    `site-features.md` 第 2 节对光标的描述也已过期。主美怀疑是留给未来的候选集，**删前先问用户**。

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、首页手机端减法。

## 环境与权限

- **blog 验证不必起 wrangler**：纯静态站，本轮与上一轮都用 `python -m http.server` 指向 `blog/dist`
  + Playwright，比 `npm run dev` / `astro preview` 快得多，也绕开了下面那个 preview 残留的坑。
  联机游戏页面仍必须 `npx wrangler dev`（`vite dev` / `vite preview` 没有 `/ws`、`/api` 代理）。
- blog 部署：`cd blog && npx wrangler deploy`（**家机** wrangler 已登录，两轮实测通过）。
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

---

**本条已归档**：本轮工作全部提交并部署，接力棒已移交给下一件事（`/about/` 单推角色卡）。
