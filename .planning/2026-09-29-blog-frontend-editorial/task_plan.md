# blog 前端改版：从「卡片平铺」到「编辑式排版」

> 2026-09-29 · 用户要求：评判前端审美水平并做一次升级（"大量圆角卡片平铺太公式"）。
> 改前截图：`docs/agent/scripts/out/before/`（脚本 `docs/agent/scripts/playwright-blog-visual-audit.py`）

## 诊断（改前）

1. 一切皆卡：状态面板、精选、预告、每一行文章、博客网格、Projects、about 的四格——全是
   同一配方（玻璃底 + 1px 边 + 26px 圆角 + 柔影 + 悬停上抬 3px），没有主次。
2. 每个板块同一套页眉公式：等宽 uppercase eyebrow + h2 + 渐变短下划线。
3. 渐变被用到处：logo 方块、logo 文字、主按钮、标题下划线、正文 h2 方块。
4. 技术栈药丸云：一张卡 7 颗 pill，信息量低、噪声高。
5. `--font-mono` 排中文 → 回落系统宋体（lessons #43 已记过，eyebrow 仍在犯）。
6. Hero：居中大字压在奏的脸上；按钮 + 幽灵按钮 + 玩家胶囊 + 箱曲胶囊四层居中堆叠。
7. Bug：暗色主题下 Hero 玩家胶囊的 "LAPISMIND" 白底白字不可见。

## 方向

用**线**组织结构而不是**盒子**：发丝线分栏、编号索引、左对齐的排版层级、图片小圆角不加框。
卡片只留给真正是"物件"的东西（单推卡、登录/资料页等交互面板不动）。

## 边界（不动）

- 看板娘位置与 `.l2d-*`；右下角 `--corner-*`；单推卡（oshi-card）整块；页脚 MMD 横幅。
- design-kit 令牌值不改（游戏共用），本站新令牌写在 global.css 的本站区。
- 打字机脚本依赖 `.hero h1` / `.hero .lead` 选择器；访客数依赖 `.now-visitors` / `#now-visitors` / `#week-visitors`；
  箱曲按钮依赖 `#md-open-chip`；精选锚点 `#featured`。
- 不提交、不部署（根 AGENTS.md 边界）。

## 步骤

- [x] 改前截图 + 诊断
- [x] global.css：本站令牌（媒体圆角 / 标签字体栈）、`.sec-head`、按钮 / tag / status-badge / prose 去卡片化
- [x] Header：去渐变字，导航改下划线态；压在 Hero 上时白字无灰带；320px 溢出（线上老问题）顺手修
- [x] 首页：Hero 左下排版 + 竖排落款；状态条；精选编辑式左右图文；预告条；文章索引列表
- [x] 博客索引：头条跨栏 + 期号行列表
- [x] 游戏 / Projects 列表页；about 的资料区与做过的东西；文章页目录与正文；6 个详情页的标题与截图样式同步
- [x] 门禁：build ✓ / check 0 errors ✓ / lint ✓ / test ✓ / ui_ux_regression_v2 6/6 ✓（本地）；改后截图 `docs/agent/scripts/out/after/`
- [ ] 视觉验收子代理当时不可用（账号连接失败），由主代理逐页目检；上线前建议再跑一次
- [x] 用户反馈：首页→游戏→首页黑屏（线上老 bug，IntroOverlay 的 window 级标记，见 lessons #74）已修；主按钮文案定为「进来坐坐」
- [x] 第二批（2026-09-29）：25時夜间状态（0—5 点，落款点亮 + 状态条"现在是 25:14"，时钟模拟验证）；中文排版
      （text-autospace + 正文 42em 行宽上限）；文章末尾期号翻页；日文明朝体子集（Shippori Mincho 7KB，仅首屏日文行）；
      404 编辑式重排；页脚立绘上提收掉大空档；Hero 改真 img（srcset + fetchpriority=high）
- [ ] 提交 / 部署：等用户确认
