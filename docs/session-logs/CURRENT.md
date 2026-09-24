# 当前状态：tts-studio 博客文章与 /works/ 作品页已上线

> 日期：2026-09-25
> 本轮交接：[`2026-09-25-tts-studio-博客与作品页-handoff.md`](./2026-09-25-tts-studio-博客与作品页-handoff.md)

新增博客文章 `blog/src/content/blog/tts-studio.md`（干员语音合成工作台完整 devlog，含自绘封面与两张界面截图），并在 `/works/` 挂「干员语音合成工作台」（只做图片 + 文案，不放源码 / 模型入口）。Cloudflare Version ID 为 `ea651c83-b72b-4c8d-9a53-242182889d1e`，生产三页（`/blog/tts-studio/`、`/works/`、`/works/tts-studio/`）浏览器核对通过。

`/works/` 列表头已软化为「之后或许会发布到 GitHub」；作品徽章文案为 `local workflow`。tts-studio 项目本身仍非 git 仓库，本次未整理发布。

下次可做：若要给 tts-studio 建仓库并发布，先加 `.gitignore`（排除模型权重 / `_out/` / `.venv/`）与 README 的「外部模型与接口」一节，再把仓库链接补进作品页。
