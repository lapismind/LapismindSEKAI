# Projects 板块 + 法杖盾斧 mod 上线 交接

> 日期：2026-09-19
> 性质：功能 + 部署
> Git 提交：随本轮收尾提交入库；线上部署版本 `b209a105-dfe2-428b-a93d-c6bee10a4d6b`，部署内容与该提交一致

## 本轮目标

把 `C:\Projects\mhwilds-rune-staff-release`（《怪物猎人 荒野》充能斧外观 mod「法杖盾斧」）放到网站上：新增与「游戏板块」并列的 **Projects 板块**，条目带 GitHub 地址 https://github.com/lapismind/mhwilds-rune-staff-release 。

## 执行摘要

- 新板块 `/works/`：列表页（紧凑卡片）+ 详情页 `/works/runestaff/`。
- Header 导航加 **Projects**（≤480px 换短标签「作品」），Footer 快捷导航同步加链接。
- 数据在 `blog/src/data/projects.ts` 新增 `works` 数组；`Project` 接口扩展 `version?` 与 `links.download?`。
- mod 素材入库：`blog/src/assets/works/`（实机三图 + 竖版主视图）、`blog/public/downloads/RuneStaff-v1.0.zip`（1.5MB 直链下载）。
- 详情页内容忠实搬运项目 README：实机三图、竖版主视图、前置/安装/效果、排错表、附注（「理科魔女」皮肤署名与 bilibili 链接）、许可。
- 本轮部署同时把**司机机 9-17 的三游戏封面改版**带上线（那本就是它接力棒里的待办第 2 项）：海龟汤/梭哈新封面已生效，出包魔法师仍是占位字块。

## 关键决策

- **独立路由 `/works/`，不塞进 `/projects/`**：用户要的是与游戏板块并列的新板块；`/projects/` 及其详情页 URL 已上线，不动。
- **列表页用紧凑卡片，不做大图封面**：mod 没有横版封面（`preview_staff.jpg` 是 640×1760 竖图），硬凑全宽媒体位只会裁坏；将来有横版封面再升级成游戏列表那种大图版式。
- **竖版主视图在详情页与简介并排**（`min(300px, 70vw)`），不做全宽 hero。
- **导航英文 Projects 在窄屏换「作品」**：双 span + 媒体查询切换，保住 2026-09-17 修过的"360px 导航不换行"。
- **zip 放 `public/downloads/` 直链**：Workers 资产单文件上限 25MiB，1.5MB 无压力；`_headers` 未覆盖 `/downloads/*`，走默认 no-cache，zip 更新即时生效。

## 验证证据

- 门禁四绿：`npm run build` / `npm run check`（0 errors）/ `npm run lint` / `npm test`。
- Playwright（`docs/agent/scripts/playwright-verify-works.py`）：11 项断言（导航、卡片链接、下载按钮、GitHub 按钮、三张实机图、排错表、窄屏导航换标签、无横向溢出）+ 7 张截图（1440/390/360/320）人工复核；顺带确认司机机封面改版在 `/projects/` 桌面端渲染正常。
- 生产（urllib + 浏览器 UA）：`/works/`、`/works/runestaff/`、`/projects/` 内容断言全 PASS；zip Content-Length 1535646 + `PK` 魔数 PASS。
- **用户已在线上自行验证通过**。

## 生产状态

- blog.qmzhj.top：版本 `b209a105`，本轮上线 Projects 板块 + 封面改版。
- soup / showhand / abracadawhat：本轮未动。

## 关键文件

- `blog/src/pages/works/index.astro`、`blog/src/pages/works/runestaff.astro`
- `blog/src/data/projects.ts`（`works` 数据）
- `blog/src/components/Header.astro`（导航项 + 窄屏短标签）、`Footer.astro`
- `blog/src/assets/works/*`、`blog/public/downloads/RuneStaff-v1.0.zip`
- `docs/agent/scripts/playwright-verify-works.py`（验收脚本，可复用）

## 踩坑记录（细节在 blog/docs/lessons-learned.md 第 29/30 条）

- **`<style is:global>` 的 `.intro`（IntroOverlay 入场动画）全站生效**，页面里新写的 `.intro` 类被 `position: fixed` 劫持、布局塌掉——Astro 的 scoped 隔离挡不住全局同名类。页面新类名先 `grep -rn "is:global" src/` 排查，或带前缀（本页已改 `.rs-intro`）。
- **站点 `scroll-behavior: smooth` 让验证脚本的 scrollTo 全变动画**：连续调用互相打断、永远到不了底部，`.reveal` 不触发，假 FAIL 三轮。脚本必须 `behavior: 'instant'` + 轮询等 reveal——验证脚本纪律第 4 条。
- 家机新装依赖：npm 11 拦 esbuild 的 postinstall，`npm install-scripts approve esbuild`（allowScripts 已记录进 package.json）。

## 推荐技能

常规 blog 前端流程即可，无特殊技能需求。

## 环境与权限

- **blog 预览端口是 3000**（astro 配置固定），不是 astro 默认的 4321。
- 两台机器 wrangler 均已登录，部署 `cd blog && npx wrangler deploy`。

## 阻塞项

无。

## 下次可做之事

1. 三张封面的统一视觉复查**只做了列表页**（1440 + 390/320），三个详情页的大图版式还没按 820/390 复查（承接司机机 9-17 的待办第 1 项）。
2. 出包封面下一版（方向见 `.planning/2026-09-17-游戏封面/`），随后给 `projects/abracadawhat.astro` 补 hero/实机图（遗留清单第 9 项）。
3. Projects 板块以后加新项目：只改 `projects.ts` 的 `works` 数组 + 补素材。
