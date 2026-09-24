# `/about/` 文案上线交接

> 日期：2026-09-24
> 性质：页面改稿与生产部署

## 本轮目标与决定

将 `/about/` 从开发者简历式页面改成兴趣与真冬主题的个人页面。用户确认的开场是「音游玩家 · 真冬单推」和「马六 T84。最近在试着入坑《以撒》和《战地6》。」。T84 是 PJSK 真冬六箱国服排行第 84 名；用户要求公开文案只写圈内简称。

页面顺序改为档案卡、已上线的真冬水族箱卡、四项作品：联机游戏、语音 TTS 合成台、本地生图流 Agent、法杖盾斧 Mod。移除过期的「现在在做」、技术栈清单和重复的游戏入口。游戏、Mod 分别链接站内 `/projects/`、`/works/`；其余两项只展示用户已确认的事实。单推卡图、短句和动效保持原样。

## 验证与生产状态

- `npm run build` 构建 17 页；`npm run check` 为 0 errors、2 个既有 hints；`npm run lint` 和 `git diff --check` 通过。
- 本地浏览器看过桌面、手机的亮暗主题。390px 手机页面无横向溢出，四张作品卡纵向排列。
- `https://blog.qmzhj.top/about/` 已部署，Cloudflare Version ID `0ff9eb40-7e65-4f32-aa05-3086f0daebdb`；上一版为 `cc137257-4eb9-4f75-9146-82585fc415e9`。
- 生产浏览器核对：HTTP 200；新版身份行和简介出现、作品卡 4 张、旧状态/技术栏消失；昼夜图均成功加载，页面脚本无错误。

## 关键位置

- 文案数据：`blog/src/data/profile.ts`
- 页面结构与单推卡：`blog/src/pages/about.astro`
- 本轮设计与执行记录：`.planning/2026-09-24-about-copy/`
- 回滚：Cloudflare Workers `blog` 的版本历史，可退回上一 Version。

当前工作已完成，没有已知阻塞。
