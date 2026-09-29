# qmzhj.top 博客 · 功能与实现记录

> 归档于 2026-08-22。记录站点当前的栏目结构、设计系统、交互功能与资源获取规范，供后续维护与续作参考。

## 0. 概览

- 域名：`blog.qmzhj.top`（Cloudflare Custom Domain）
- 技术栈：Astro 7（静态输出）+ Tailwind CSS v4 + Cloudflare Workers（纯静态 assets 托管）
- 定位：个人粉丝向二次元博客 —— "真冬主题的独立游戏作者小屋"（非官方，无直接商业用途）
- **站名与文案的真源**：站名 `Lapismind SEKAI`、站内描述「可能是一位马批的 SEKAI，有一些作品在这里涌现了。」
  都在 `src/consts.ts`（`SITE_TITLE` / `SITE_DESCRIPTION`）。改一处喂五处：页面 `<title>`、`og:title`、
  `meta description` / `og:description`、RSS 频道标题、以及 OGP 分享卡。
  注意**页头页脚显示的品牌名是写死的**（`Header.astro` 的 `.brand-name`、`Footer.astro` 版权行），不随常量变。
- **OGP 分享卡**：`og:image` 的兜底是 `src/assets/site/og-card.jpg`（1200×630 jpeg），
  由 `scripts/gen-og-card.py` 渲染——它读上面两个常量 + `packages/design-kit` 的令牌 + 站内 Atkinson，
  所以**改站名/描述/品牌色后要重跑该脚本**。文章页的 `og:image` 走 `BlogPost.astro` 的 `getImage()`
  （把 hero 转成 1200 宽 jpg，避免把 1.5MB 源图发给抓取器）；`BaseHead` 收的是 `imageUrl` 字符串而非
  `ImageMetadata`，原因见该组件注释。
- 版权声明：全站涉及的《世界计划 缤纷舞台！feat. 初音未来》角色、曲绘、歌曲版权归 SEGA / Colorful Palette 及相关创作者；素材最初整理自 pjsk.moe 粉丝资源站，已在页脚与播放器内注明。

## 1. 栏目与页面

| 路由 | 栏目 | 说明 |
|---|---|---|
| `/` | 首页 | 大横幅 Hero + 玩家档案 + 音乐电台入口 + SEKAI is running 运行面板 + SEKAI 精选 + 最新博客 |
| `/projects/` | 游戏 | 个人游戏作品（海龟汤、Card Game），ACG "关卡选择" 语感 |
| `/works/` | Projects | 游戏之外的软件作品（mod / 工具 / 开源仓库），如《怪物猎人 荒野》法杖盾斧外观 mod |
| `/blog/` | 博客 | 头条大卡 + 卡片网格 + 文章页（目录/阅读时长/进度条） |
| `/about/` | 关于 | 音游与真冬主题的个人简介 + 单推角色卡（朝比奈真冬）+ 游戏、工具与 Mod |
| `/404` | 404 | 编辑式排版：墨色线 + 大号 404 + 右缘竖排「この道は、まだ。」 |

导航：首页 / 游戏 / Projects / 博客 / 关于。`Projects` 标签在 ≤480px 换成「作品」（避免五个导航项挤压换行）。

## 2. 设计系统

> **令牌的真源已移到 `packages/design-kit`**（2026-09-14）。本节只描述本站如何消费它；
> 色值表、层次规则、字体应用规则以 `packages/design-kit/README.md` 为准。
> 本站自有的令牌（`--cursor-*`、`--lift-hover`、`--corner-*`）仍留在 `src/styles/global.css`。

- 主题色：**#8888CC（朝比奈真冬代表色）**，由 `--hue-accent: 283` 一个变量经 OKLCH 推导全站主色/渐变/光晕（现定义在 `@lapismind/design-kit/tokens.css`，本站 `global.css` 通过 `@import` 引入）。
- 亮/暗双主题：右上角太阳/月亮切换，localStorage 记忆，首帧前同步避免闪烁。
- 字体：霞鹜文楷屏显（97 片子集按需加载）+ Atkinson 拉丁 + 系统中文回退；等宽字体用于 eyebrow 类小标签。
  **字体资产的唯一真源在 `packages/design-kit/fonts/`**，`public/fonts/` 由 `predev`/`prebuild` 同步生成、已 gitignore，不要手动往里放文件。
- 视觉基调（2026-09-29 改版为"编辑式排版"）：结构靠**发丝线 + 编号**组织，不靠圆角卡片。
  板块页眉 `.sec-head`（墨色线起头 → 编号 → 标题 → 小字英文 → 右侧链接）；列表页大标题 `.page-title`（左对齐 + 右侧计数 + 下接墨色线）；
  图片小圆角 `--r-media: 6px`、不加框不加影；技术栈是斜线分隔的小字（`.tag`），状态是色点 + 小字（`.status-badge`）；
  按钮 3px 圆角纯色，不用渐变。小标签/日期一律 `--font-meta`（等宽 + 文楷兜中文，别直接用 `--font-mono` 排中文）。
  玻璃卡只留给交互面板（登录、资料页）和单推卡。令牌与原语在 `src/styles/global.css` 本站区。
  改前/改后截图：`docs/agent/scripts/playwright-blog-visual-audit.py`。
- 自定义鼠标：`public/cursors/arrow.png`（默认）+ `pointer.png`（手型），带白描边适配暗色。
- 25時夜间状态（2026-09-29）：本地时间 0—5 点给 `<html>` 挂 `late-night`——首页竖排落款点亮、
  状态条亮出「现在是 25:14」（0—4 点的钟点写成 24—28 时）。逻辑在 `index.astro` 的 `initLateNight`。
- 日文明朝体（2026-09-29）：首屏日文两行（署名 + 竖排落款）用 Shippori Mincho 子集
  （`src/assets/fonts/shippori-mincho-subset.woff2`，仅这两句的字，7KB；`@font-face` 以
  `<style is:inline set:html>` 内联——Astro 的 `<style>` 不做插值，见 lessons #75）。
- 中文排版（2026-09-29）：全局 `text-autospace: normal`；`.prose` 行宽上限 42em（约 40 字/行）。
- 细雪飘落：全站固定 canvas（约 20–70 片，视口宽度自适应），`prefers-reduced-motion` 停用，后台页签暂停，不挡交互。

## 3. 首页构成（自上而下）

1. **Hero 大横幅**：真冬「交相辉映的笑容」特训前卡面（奏×真冬双人）出血铺满（≈92vh），导航压在画上时变白字、滚动后回常规底色；
   背景是真 `<img>`（`widths 640–2048 + sizes=100vw`，`fetchpriority=high`，2026-09-29 起）；
   标题"谢谢你，找到了我。"与日文署名落在**左下**（不压两人的脸），右侧竖排落款「25時、ナイトコードで。」（仅宽屏）。
   打字机脚本认 `.hero h1` / `.hero .lead`。
2. **Hero 底边信息行**（一道白色发丝线托住）：玩家档案（头像 + LAPISMIND + 在线点 + "独立开发者 · LV.1"）｜「♪ 今日箱曲 バグ」（`#md-open-chip`，打开右下角电台并发默认曲）｜scroll。
3. **「SEKAI is running」状态条 + 站点统计**：发丝线收住的一行，不再是压在 Hero 上的玻璃卡。左侧运行指示灯 + 一行说明 + 「最近更新」日期 / 访客数，
   右侧四格大号读数（游戏 / 已上线 / 曲库 / 文章）。**读数与日期全部在构建期从数据算出**
   （`projects.ts` 的 games、`music-player.json`、博客集合），不写死文案——早期那版手写的
   「正在开发 / 最近在学 / 下一步」已经下线（它会过期：曾一直写着"正在开发：出包魔法师"，
   而那个游戏早已上线）。`/about/` 也已移除这组过期状态。
4. **01 SEKAI 精选**：跨栏目精选——出包魔法师（游戏，详情页在 `/projects/`）+ 法杖盾斧（Projects，详情页在 `/works/`）。
   条目由 `src/data/projects.ts` 的 `featured` 标记决定（游戏与项目共用这一枚标记，全站只留少数几条）；标题行右侧两个入口分别指向 `/projects/` 与 `/works/`。
   排成左右交替的图文跨栏（7:5），不装卡片。
5. **02 is coming.**：niigo-party 立绘阵容条 + 一行说明。
6. **03 最新博客**：编号索引列表（编号 / 日期 / 标题 + 一行摘要 / 箭头），行间发丝线。
- 全局：右下角回到顶部按钮；右下角电台 Dock；全站细雪。

### 3.1 入场欢迎动画（IntroOverlay）

- 首次进入首页时全屏播放：三块斜切分屏（324 初雪之中 / 511 温柔的魔咒 / 786 拾起的心 特训后卡面）+ "欢迎来到 Lapismind 的 SEKAI"，会话内只播一次、`prefers-reduced-motion` 跳过。
- 画面构成：每张卡按"脸高占屏 52%"等比缩放后，脸心锚定到目标坐标（左 16.2%/39.9%、中 47.4%/41.8%、右 79.2%/38.8%），贴在 1600×719 暗色画布上（与内缩盒同比例），溢出由暗底接管——杜绝"裁切窗平移极限"问题。
- 脸心数据来源：用户红圈标注免费卡面 → 红色像素质心（见 lessons-learned 第 7 条）。
- 节奏：停留 2s → 三块依次上掀（1.2s，错峰 0.2s/0.4s）→ 淡出，全程约 4.8s，6.5s 兜底清理。

## 4. 音乐播放器（电台 Dock）

形态：右下角圆形音符钮 → 迷你条（曲绘+曲名+播放/歌词）→ 字幕剧场（中文大字幕+日文小字、进度/时间、VS/SEKAI 源切换、曲目列表、滚动歌词、缓冲提示）。全站页面通用，切页不断歌（音频对象在脚本作用域，ClientRouter 换页不销毁）。

曲库（真冬箱曲六首，按箱区时间线）：

| 序 | 箱区活动 | 曲名 | 日期 | 音源 |
|---|---|---|---|---|
| 1 | 囚われのマリオネット | ジャックポットサッドガール（Jackpot Sad Girl） | 2020-10-20 | VS+SEKAI |
| 2 | 灯のミラージュ | 再生 | 2021-09-21 | VS+SEKAI |
| 3 | 迷い子の手を引く、そのさきは | バグ（Bug） | 2022-06-20 | VS+SEKAI |
| 4 | 仮面の私にさよならを | 演劇 | 2023-07-11 | VS+SEKAI |
| 5 | 灯を手繰り寄せて | エンパープル（浸染成紫） | 2024-06-20 | VS+SEKAI |
| 6 | そして、針は動き出す | 虚無さん | 2025-04-30 | VS+SEKAI |

关键实现：
- **默认源 = SEKAI（角色翻唱版）**；无 SEKAI 的歌曲自动回退 VS 并置灰按钮（当前六首均有双版）。
- **今日箱曲（2026-09-29 起）**：周一~周六按曲库时间线各固定一首（周一=ジャックポットサッドガール……周六=虚無さん），
  周日随机（日期做种子的散列，同一天内稳定；散列见 `MusicDock.astro` 的 `defaultIndex`，直接按周取模会退化成顺序轮换）。
  首页 Hero 芯片的歌名由 `updateChipSong()` 跟随（无 JS 时回落显示バグ）。曲目列表仍按时间线排序。
- 字幕：LRC 时间轴内置（`src/data/music-player.json`，lrclib 来源）+ 运行时从 pjsk 歌词接口取中文对译，另有兜底（无 LRC 时按比例估算；接口失效降级为日文原词）。
- 音频/曲绘全部自托管于 `public/music/`（12 个 mp3 + 曲绘；62 号曲绘为用户提供的真实图）。
  2026-09-29 把 12 个 mp3 开头约 9 秒的前导静音剪掉了（`_legacy/trim-music-silence.py`，mp3 帧边界
  `-c copy` 无损切）——文件内容 = 官方音源从 0 秒起，**歌词时间轴不用动**（LRC 本来就是官方完整版
  时间轴，来自 lrclib；剪掉静音后歌词反而对齐了，此前歌词一直提前约 9 秒）。剪完的文件残余前导静音为 0。
  起播淡入：MusicDock 里 WebAudio 增益节点把音量 0→1 渐升 1.5s（换曲/换音源/从头起播时触发；
  中段暂停后继续不淡；AudioContext 不可用时退回 `audio.volume` 斜坡）。第一句开唱前字幕留空不高亮。
- 命名规律：`music/long/vs_XXXX_01/vs_XXXX_01.mp3`（虚拟歌手版）、`.../se_XXXX_01/...`（SEKAI 版）；个别曲目为裸路径 `.../XXXX_01/XXXX_01.mp3`（如 62 号）。

## 5. 资源获取规范（重要）

**找素材先走 pjsk.moe 的资产浏览器（Asset Viewer）**：
`https://pjsk.moe/zh-cn/asset-viewer/?server=jp`（或 `server=cn`）
→ 按目录浏览（music / character / event…）+ 当前目录文件名搜索，返回真实资源路径，不要靠猜 URL 或抓包。

- 元数据接口：`metadata.exmeaning.com/cn/master/*.json`（musics / cards…）
- 翻译/歌词接口：`translation.exmeaning.com/files/translation/lyrics/music_<id>.json`
- 若资源站缺失某资产（曲绘/音频），自备本地占位或向用户要真实素材。

## 6. 已知事项与待办

- 演劇暂无 LRC：用中文行比例估算同步，属兜底体验。
- 中文歌词字幕运行时依赖 pjsk 翻译接口（仅文本，量小）；音乐本体完全本地。
- 仓库因音乐资源增大约 55MB（Cloudflare 免费托管不受影响）。
- 待办候选：首页原创雪夜 Hero 插画；友链页；按需把更多游戏/歌曲入站。

## 7. 部署

```sh
cd blog              # 在仓库根目录执行
npm run build        # 产物在 dist/（含 public 下所有资源）
npx wrangler deploy  # 或 wrangler pages deploy dist
```

wrangler.toml：`[[routes]] pattern = "blog.qmzhj.top" custom_domain = true`；`[assets] directory = "./dist"`、`not_found_handling = "404-page"`（404.html 由 `src/pages/404.astro` 生成）。

> `npm run build` 会触发 `postbuild`：`scripts/precompress-live2d.mjs` 把 `dist/live2d` 下的 `model.moc3` 预压成 `.br`（见第 8 节）。直接 `npx wrangler deploy` 而不 build，会部署上一次的 `dist/`——这一步不会自动补。

## 8. 资源传输与缓存策略

看板娘首屏曾经一次要拉 3465KB（纹理 2074 + 模型 1158 + JS 230）。2026-09-15 做了一轮**完全无损**的瘦身，降到 1756KB（−49%）：

| 资源 | 改动 | 之前 | 之后 |
|---|---|---|---|
| `texture_00.png` | → WebP lossless（`exact=True`，逐位相同） | 2074 KB | 1217 KB |
| `model.moc3` | 构建期 brotli q11 预压 | 1158 KB | 306 KB |
| JS（pixi / cubism / live2d） | 未改（CF 已自动压 zstd/br） | 230 KB | 230 KB |

**为什么 moc3 要自己压**：CF 的自动压缩按 Content-Type 判断，而 `.moc3` 没有 MIME（实测响应里 content-type 缺失），CF 会完全跳过它。构建期预压是唯一无损且可控的做法。

**为什么纹理用 `exact=True`**：默认的 WebP lossless 会清零 alpha=0 像素的 RGB（省 460KB），差异全在不可见区域；但 Live2D 的混合模式写在二进制 moc3 里，无法排除 multiply 这类"alpha=0 时 RGB 仍参与合成"的模式，所以选了逐位相同的 `exact=True`。

**缓存策略分两处，别搞混**（原因见 lessons-learned 第 27 条）：

| 路径 | 设在哪 | 值 | 理由 |
|---|---|---|---|
| `/_astro/*` | `public/_headers` | `immutable, max-age=31556952` | Astro 产物文件名带内容哈希 |
| `/fonts/*`、`/music/*`、`/cursors/*` | `public/_headers` | `max-age=604800` | 文件名不含哈希，给 7 天；换文件要意识到最长 7 天陈旧期 |
| `/live2d/*` | `src/worker.ts` | `max-age=86400` | 这些响应由 Worker 生成，`_headers` 对它们不生效 |

**改看板娘素材时注意**：`/live2d/*` 的文件名不含哈希，换了纹理/模型后老访客最长 1 天看到旧图。要立刻生效就同时改文件名（并同步 `model.model3.json` 的引用）。
