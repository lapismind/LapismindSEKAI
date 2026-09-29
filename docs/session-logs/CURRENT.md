# 当前任务：blog 前端已改版待上线；niigo-party 2.5D 地图 + 编辑器已落地；事件调研暂停中

> 日期：2026-09-29
> 本轮工作在 Windows 机完成，已提交推送。

## 任务零：niigo-party 2.5D 地图 + 地块封装 + 地图编辑器（✅ 已完成，待用户定稿布局）

- 提交 `bbcc21a`（本仓）+ AI-game `4a74031`（底图 `niigo/art/04_scene/board_bg.jpeg`，经 sync-assets 引用）。
- 棋盘换成 Image 2.5 重绘底图；格子坐标来自 Blender 同相机导出（`niigo-party/src/game/maps/twin-cross-68.screen.json`）。
- 地块注册表 `src/game/tiles.js`（onLand/onEnter），布局 `maps/twin-cross-68.layout.json`，校验 `src/game/layout.js`。
- 地图编辑器：`npm run dev` → `/#editor`（仅 dev、仅本机可保存）。细节见 `niigo-party/docs/进度.md`「地图与地块」。
- 地砖不上色（重绘后底座逐格偏差，2D 色块对不齐，已放弃，见 `niigo-party/docs/lessons-learned.md`）。
- **下一步**：用户在编辑器里定稿布局 → Blender `build_board.py --pass tiles --layout <布局>` 重渲格子层 →
  Image 2.5 按遮罩重绘环境（素材包 `C:\Tool\Blender\projects\niigo-board\_out\repaint\`）→ `overlay_tiles.py` 叠回。
- ⚠️ `C:\Tool\Blender\projects\niigo-board\` **不在任何 git 仓库**，只在这台 Windows 机上；换机器前需拷贝或迁入仓库（待用户决定）。
- 验证：单测 31 项；Playwright 冒烟 `py -3.14 docs/agent/scripts/playwright-niigo-board-editor.py`（需先 `npx vite --port 5199`）。

## 任务一：blog 前端「编辑式改版」（✅ 已完成，待部署）

- 用户要求评判并升级博客前端，方向定为：去"圆角卡片平铺"，改用发丝线 + 编号的编辑式排版。
- 已改：global.css 本站令牌与基元（`.sec-head` / `.page-title` / 标签斜线化 / 状态点 / 按钮纯色）、
  Header、首页 Hero（左下排版 + 竖排落款 + 真 img srcset）、状态条、精选/预告/文章索引、
  博客索引（期号列表）、游戏 / Projects / about、文章页（左对齐标题 + 目录导轨 + 期号翻页）、
  6 个详情页同步、404 重排、页脚立绘上提、25時夜间状态（0—5 点）、日文明朝体子集、
  中文排版（autospace + 42em 行宽）。主按钮文案「进来坐坐」。
- 顺手修的线上老 bug：首页→游戏→首页黑屏（IntroOverlay window 级标记，lessons #74）、
  320px 头部溢出（lessons #73）。
- 门禁全绿：build / check / lint / test / ui_ux_regression_v2 6/6（本地）。
  视觉验收子代理当时不可用，主代理逐页目检；改前/改后截图在
  `docs/agent/scripts/out/before|after/`（脚本 `docs/agent/scripts/playwright-blog-visual-audit.py`）。
- 已部署（2026-09-29 第二次上线）：入场修复 + 25時夜间状态等一批已上线；随后又上线了
  音乐修复——12 个 mp3 剪掉开头约 9 秒前导静音（歌词轴本对官方完整版，剪后反而对齐，lessons #76）、
  起播 1.5s WebAudio 淡入、第一句开唱前字幕留空。
- 计划文件：`.planning/2026-09-29-blog-frontend-editorial/`；踩坑 lessons #71–76。

## 任务二：niigo-party 事件格与梗素材重调研（⏸️ 暂停中，未被本轮改动）

> 日期：2026-09-28
> 上一项交付：法杖盾斧 v1.2 双态法阵；Cloudflare Version ID `4452bc45-6aa9-48c5-9644-74c69896e397`，发布仓标签 `v1.2`。其余待验证项见 mod 仓 `HANDOFF.md` §26.4（当前环境未挂载该目录，尚未复核）。

- 状态与细节以 `.planning/2026-09-28-niigo-party-event-research/`（研究报告、发现与执行记录）为准。
- 方向已确认：格触发纯随机事件（不按格子固定绑定梗）；部分剧情地点可做固定地点格（如 25时常去的家庭餐厅），同一地点可关联多种效果，触发方式待调研后再定。
- 旧事件表 20 条过于集中 25时组合内部（仅 E10、E15 明确引入组外人物），该偏差已记入研究发现，作为重做覆盖基线。
- 时间截点 2026-09-28：日服最新活动已核实为 #218「Connect to SEKAI！」（2026-09-25 至 09-28，日本时间）；#177 日服/英语服发布时间相差一年；不要再把 #180 当跨服最新。
- 下一步：子代理继续核查 #218 故事章节正文/角色出场 → 审阅阶段报告的剧情出处、各服发布时间与社区热度证据 → 整理候选事件交用户过目 → 之后才改设计稿或实现。不要把社区观点当官方设定，不要实现旧 v0.1。
