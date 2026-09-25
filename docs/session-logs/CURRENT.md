# 当前状态：法杖盾斧 v1.2（双态法阵）已出货

> 日期：2026-09-25
> 上一轮归档：[`2026-09-25-法杖盾斧-v1.1-出货-handoff.md`](./2026-09-25-法杖盾斧-v1.1-出货-handoff.md)
> v1.2 归档：**尚未单独写**（细节在 mod 仓 `HANDOFF.md` §26）

法杖盾斧又推了一版：**v1.2 法阵分双态**。剑盾形态举盾防御时浮现完整星钟法阵；切到斧形态，法阵内面化为两把新月刃（外圈与罗马数字环两态共用）。part 1 从单材质改成 `RuneClock` / `RuneShield` / `RuneAxe` 三个各自单材质的子网格，新 Lua `rune_dual_form.lua` 直接读 `get_Mode()` 切换，绕开 ArmorVariantManager 的状态混合问题。

线上 Cloudflare Version ID `4452bc45-6aa9-48c5-9644-74c69896e397`；作品页与发布 zip 均已在生产核对通过。发布仓标签 `v1.2`。

⚠️ **三条已知未验证**（原文见 mod 仓 `HANDOFF.md` §26.4，别当成已验证）：
蓝膜的两个 shader 参数（`UseParallaxEmit` / `UseWaveEmit`）是否真的生效；双月刃金色根部在动画中间帧的间隙；`get_Mode()` 的实际切换时点与斧面衔接。

## 下次可做

1. 博客文章《首谈法杖盾斧的开发历程》目前只写到 v1.1，**要不要补一段 v1.2**。
2. 有人反馈"装上后杖身是默认材质"→ 按 mod 仓 `HANDOFF.md` §19.5 改回两个 patch pak 重发。
3. 法阵的透明 / 流动感仍未落地（v1.2 试了 shader 参数，是否生效待确认）。
4. 收口时把 v1.2 那轮整理成 `2026-09-XX-法杖盾斧-v1.2-出货-handoff.md`。

## 接手须知

- 本机（家机）已给 LapismindSEKAI 配了 repo-local `http.proxy = http://127.0.0.1:7892`；**代理必须开着**，`github.com` 直连实测超时。
- mod 开发仓在 `C:\Tool\Blender\projects\rune-staff`，自带 git、**无远端**（纯本地）。
