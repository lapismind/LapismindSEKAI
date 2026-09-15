# qmzhj.top 博客 · 功能与实现记录

> 归档于 2026-08-22。记录站点当前的栏目结构、设计系统、交互功能与资源获取规范，供后续维护与续作参考。

## 0. 概览

- 域名：`blog.qmzhj.top`（Cloudflare Custom Domain）
- 技术栈：Astro 7（静态输出）+ Tailwind CSS v4 + Cloudflare Workers（纯静态 assets 托管）
- 定位：个人粉丝向二次元博客 —— "真冬主题的独立游戏作者小屋"（非官方，无直接商业用途）
- 版权声明：全站涉及的《世界计划 缤纷舞台！feat. 初音未来》角色、曲绘、歌曲版权归 SEGA / Colorful Palette 及相关创作者；素材最初整理自 pjsk.moe 粉丝资源站，已在页脚与播放器内注明。

## 1. 栏目与页面

| 路由 | 栏目 | 说明 |
|---|---|---|
| `/` | 首页 | 大横幅 Hero + 玩家档案 + 音乐电台入口 + 现在在做 + 精选游戏 + 最新博客 |
| `/projects/` | 游戏 | 个人游戏作品（海龟汤、Card Game），ACG "关卡选择" 语感 |
| `/blog/` | 博客 | 头条大卡 + 卡片网格 + 文章页（目录/阅读时长/进度条） |
| `/about/` | 关于 | 玩家档案卡 + 技术栈 + 单推角色卡（朝比奈真冬）+ 世界入口 |
| `/404` | 404 | "这条路还没铺好" 渐变大字号页 |

导航：首页 / 游戏 / 博客 / 关于。

## 2. 设计系统

- 主题色：**#8888CC（朝比奈真冬代表色）**，由 `--hue-accent: 283` 一个变量经 OKLCH 推导全站主色/渐变/光晕（`src/styles/global.css`）。
- 亮/暗双主题：右上角太阳/月亮切换，localStorage 记忆，首帧前同步避免闪烁。
- 字体：霞鹜文楷屏显（`public/fonts/` 自托管 97 片子集按需加载）+ Atkinson 拉丁 + 系统中文回退；等宽字体用于 eyebrow 类小标签。
- 视觉基调：玻璃卡片（blur + 半透明）、弱阴影大圆角、滚动显现动画、渐变淡出衔接。
- 自定义鼠标：`public/cursors/arrow.png`（默认）+ `pointer.png`（手型），带白描边适配暗色。
- 细雪飘落：全站固定 canvas（约 20–70 片，视口宽度自适应），`prefers-reduced-motion` 停用，后台页签暂停，不挡交互。

## 3. 首页构成（自上而下）

1. **Hero 大横幅**：真冬「交相辉映的笑容」特训前卡面（奏×真冬双人）铺满视口宽度（76vh），半透明导航悬浮其上，底部渐变融入页面底色；中央大字"谢谢你，找到了我。"，副行日文署名。文字双层阴影 + 入场错峰动画。
2. **玩家档案**：圆形头像（海龟汤 18 号头像）+ LAPISMIND + 在线点 + "独立开发者 · LV.1 成长中"。
3. **「♪ 今日箱曲：バグ」**：打开右下角电台并发默认曲。
4. **现在在做 + 站点统计**：玻璃卡（正在开发/最近在学/下一步 + 游戏数/上线数/文章数）。
5. **精选游戏**：海龟汤 + Card Game 卡片。
6. **最新博客**：文章列表。
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
- **首发默认曲 = バグ**（两版齐全、最有代表性），曲目列表仍按时间线排序。
- 字幕：LRC 时间轴内置（`src/data/music-player.json`，lrclib 来源）+ 运行时从 pjsk 歌词接口取中文对译，另有兜底（无 LRC 时按比例估算；接口失效降级为日文原词）。
- 音频/曲绘全部自托管于 `public/music/`（约 55MB，含 12 个 mp3 + 曲绘；62 号曲绘为用户提供的真实图）。
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
cd D:\LapismindSEKAI\blog
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

