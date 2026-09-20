# 当前进行中（接力棒）

> 这个文件永远代表"当前进行中"的那件事，**收工覆盖写**，不追加。
> 一件事收口后：整理成 `docs/session-logs/YYYY-MM-DD-主题-handoff.md` 归档，再把这里改写成下一件事。
> 接手时先读本文件即可，不用猜哪个日期文件最新。流程见 `docs/agent/handoff.md`。
> 两机代号：公司机 = **司机**，家里机 = **家机**。

> 日期：2026-09-19
> 性质：**没有进行中的任务**（出包封面 + 详情页实机图均已上线）（Projects 板块已上线，见上轮 handoff）
> 上一轮 → [`2026-09-19-Projects板块-法杖盾斧-handoff.md`](./2026-09-19-Projects板块-法杖盾斧-handoff.md)

## 当前状态

**本轮（家机）**：出包魔法师封面 + 详情页 **全部完成、已上线**（blog 版本 `1fe8047b`）。
封面：v3 文生图（太淡）→ v4（龙 🐉 化，主诉求达成但有硬伤）→ v4.1 补丁（文生图五补丁全没落地）
→ **v4.2 图生图编辑（五条病灶一次全中）**。终版 1024×1024 方图接入时按实际显示尺寸做了
16:9 裁切（另两张封面 2:1/16:9，方图铺满整行会变 1100px 高巨块；手机 348 宽同理），
列表页与详情页 hero 共用 `blog/src/assets/covers/abracadawhat-cover.png`。
实机截图：本地 `wrangler dev`(8791) + 复用 `playwright-two-player-table.py` 双 context 开局，
截对局牌桌裁掉下方空白 → `blog/src/assets/abraca-table.png`，插入详情页「项目简介」。
门禁四绿；1440/390 截图人工复核；线上验证（封面资产 + 占位 div 消失 + hero + 实机图资产）全过。
全过程（五版提示词 + 自检清单 + 各版出图）在 `.planning/2026-09-17-游戏封面/`。

**经验**：① 文生图反复修不动的病灶（连续三版：牌背朝镜头、真冬表情），换图生图编辑一次全中——
基底图即真源，编辑词短（2k 字符）、只写病灶、开头结尾锁死改动范围。
② astro preview 是常驻守护进程，TaskStop 杀掉外壳后**它还活着并占着 3000**——再起会报
"already running"，用 `npx astro preview stop` 停（和接力棒里 workerd 残留同类，这次是 preview 自己）。

---

Projects 板块（上轮，已上线）：blog 新增 **Projects 板块**（`/works/`）并已部署：列表页 +
《怪物猎人 荒野》法杖盾斧 mod 详情页（`/works/runestaff/`）+ zip 直链下载，条目带 GitHub 地址。
本轮部署同时把司机机 9-17 的「三游戏 AI 封面改版」带上线：海龟汤/梭哈新封面已生效，
**出包魔法师列表位仍是占位字块**（它的封面还没做，属预期状态）。

| 站 | 状态 | 备注 |
|---|---|---|
| blog.qmzhj.top | `b209a105` | 本轮：Projects 板块 + 封面改版上线 |
| soup / showhand / abracadawhat | — | 本轮未动 |

验收：门禁四绿（build / check 0 errors / lint / test）；Playwright 11 项断言 +
1440/390/360/320 截图人工复核；生产 URL 内容断言与 zip 校验（字节数 + PK 魔数）PASS；
**用户已在线上自行验证**。家机工作区随本轮收尾提交。

## 这件事的要点（接手前先看，细节在 handoff 与 lessons）

- **页面新造的类名先 grep 全局样式**：`<style is:global>`（如 IntroOverlay 的 `.intro`）全站生效，
  Astro scoped 隔离挡不住同名类劫持（blog lessons 第 29 条，本轮布局塌过一次）。
- **验证脚本纪律第 4 条：站点开了 `scroll-behavior: smooth`，Playwright 滚动必须 `behavior: 'instant'`**
  否则 scrollTo 全是动画、到底之前就被拽回，`.reveal` 假不触发（blog lessons 第 30 条，本轮假 FAIL 三轮）。
- blog 本地预览端口是 **3000**（astro 配置固定）；家机装依赖要 `npm install-scripts approve esbuild`
  （allowScripts 已记入 package.json，新机器照做）。
- Projects 板块加新项目：只改 `src/data/projects.ts` 的 `works` 数组 + 补素材，页面自动长出来。

## 下一步最该做的两件

1. **三张封面的统一视觉复查只做了列表页**（本轮家机看了 `/projects/` 1440 + 390/320，
   三个**详情页**的大图版式还没按 820/390 复查——司机机 9-17 待办第 1 项的余量）。
2. **出包封面下一版**：按 `.planning/2026-09-17-游戏封面/` 归档 README 的方向收敛光效/减元素/硬线稿；
   随后给 `projects/abracadawhat.astro` 补 hero/实机图（遗留清单第 9 项）。

## 遗留清单（承接司机机 9-17 轮，均未做，按建议排序）

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

更早的候选（仍未做）：跨游戏战绩与成就看板（**用户已明确反对**）、
`playwright-two-player-table.py` 补成能跑完整局、`migrate-hex.mjs` 沉淀成正式工具、首页手机端减法。

## 环境与权限

- 两台机器 wrangler 均已登录；blog 部署 `cd blog && npx wrangler deploy`（游戏侧见 deploy.md）。
- **联机页面验证必须 `npx wrangler dev`**（`vite dev` / `vite preview` 没有 `/ws`、`/api` 代理）——游戏侧。
- **Playwright 验证四条纪律**：轮询到条件成立（别 sleep）；`data-testid` 定位（别按显示名）；
  不用 `networkidle` 判成败；**滚动触发型页面必须 instant 滚动**（见上）。
- 用 `urllib` / `curl` 手查线上资源**必须带浏览器 UA**（否则 Cloudflare 403）；
  Git Bash 的 curl 有 TLS 握手问题，直接用 Python urllib。
- workerd 子进程不随父进程退出，残留按 PID 杀；别按命令行批量杀（会匹配到自己）。
- 更多：根与 blog 各自的 `docs/lessons-learned.md`。

## 阻塞项

无。
