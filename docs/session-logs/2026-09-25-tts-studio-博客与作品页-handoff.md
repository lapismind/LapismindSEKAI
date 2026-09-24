# tts-studio 博客文章与 /works/ 作品页交接

> 日期：2026-09-25
> 性质：内容 / 部署
> Git 提交：本轮 ship（新增文章 + 作品页）

## 本轮目标

把 `C:\Projects\tts-studio`（干员语音合成工作台）写成一篇博客文章，并在 `/works/` 挂一条简单作品展示。

## 执行摘要

- 新增博客文章 `blog/src/content/blog/tts-studio.md`：完整 devlog，从「给洛茜 mod 配音」的起因讲到抓 PRTS 数据、参考音频切短、中→日翻译与口癖 profile、两个项目合并、GUI 双进程重写。所有技术细节与数字取自 tts-studio 的 `AGENTS.md` / `README.md` / 两份 `docs/superpowers/specs/` / `docs/抓取与合成流程.md`。
- 自绘封面 `blog/src/assets/covers/tts-studio-workbench.png`（终末地工业风，2400×1200，PIL 生成，~349KB）；正文两张截图复用 tts-studio `docs/界面截图/` 的「主界面」「词表」。
- `/works/` 新增「干员语音合成工作台」：数据 `blog/src/data/projects.ts`，详情页 `blog/src/pages/works/tts-studio.astro`。按用户要求只做「图片 + 文案」，**不放源码仓库、不放模型下载、不写模型接口**。
- `/works/` 列表头由「源码与发布都在 GitHub」软化为「之后或许会发布到 GitHub」（页面内已有一个没有 GitHub 的作品）。

## 关键决策

- 作品徽章不用既有 `online` / `开发中` 两态，改用 `version: 'local workflow'` 显式标注"本地工具"（`version` 显示优先于 `status` 徽章；`status: 'online'` 仅用于徽章配色）。
- 作品页不引入模型接口说明——用户明确收窄为简单展示。
- 文章里「给纳塔打了洛茜的 mod」按用户原话保留，未扩写「纳塔」背景。

## 验证证据

- 本地门禁：`npm run build` ✅（19 page）、`npm run check` 0 errors、`npm run lint` ✅、`npm test` ✅。
- 生产（Cloudflare Version ID `ea651c83-b72b-4c8d-9a53-242182889d1e`）：
  - `/blog/tts-studio/` → 200；标题与正文关键字命中；3 张图 `naturalWidth` 1020 / 1180 / 1180；0 pageerror。
  - `/works/tts-studio/` → 200；2 张图正常；0 pageerror。
  - `/works/` → 200；卡片显示 `LOCAL WORKFLOW` 徽章与新 lead 文案。
  - 三张图 URL 直查均为 `200 image/webp`。

## 生产状态

- 站点：https://blog.qmzhj.top（Custom Domain）
- Version ID：`ea651c83-b72b-4c8d-9a53-242182889d1e`
- 回滚：如需回退，在 Cloudflare 控制台切到上一个部署版本

## 关键文件

- `blog/src/content/blog/tts-studio.md`
- `blog/src/assets/covers/tts-studio-workbench.png`
- `blog/src/assets/posts/tts-studio-gui.png`、`blog/src/assets/posts/tts-studio-glossary.png`
- `blog/src/pages/works/tts-studio.astro`
- `blog/src/data/projects.ts`、`blog/src/pages/works/index.astro`

## 待确认

- 文章中「纳塔」指向未与用户核实；时间线只有 `pubDate: Sep 25 2026`，起因段未写具体日期。
- 作品页截图直接 import 自 `assets/posts/`（与文章共用，避免重复文件）；若日后要分离，迁到 `assets/works/` 即可。

## 阻塞项

- 无。

## 下次可做之事

- 若要把 tts-studio 发布成仓库：`.gitignore` 需排除模型权重 / `_out/` / `.venv/`，README 补「外部模型与接口」一节；发布后作品页加 GitHub 按钮（一行）。
- 文章评论区、分享卡（OGP）可在发布后抽查。
