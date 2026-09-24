# 复现与依据

## 生产页复现（2026-09-24）

路径：硬加载 `/about/` → 点主题按钮切到暗色 → 点水族箱有气泡 → 导航到 `/blog/` → 返回 `/about/` → 再点水族箱。

| 时点 | `html[data-theme]` | `localStorage.theme` | 页脚运行时间 | 气泡 |
|---|---|---|---|---|
| 初始 | light | 空 | 正常数字 | — |
| 切暗色后 | dark | dark | 正常数字 | 10 个 |
| 到博客 | 属性缺失 | dark | `--` 占位符 | — |
| 回关于 | 属性缺失 | dark | `--` 占位符 | 0 个 |

浏览器无 `pageerror`。首次探针在 `domcontentloaded` 后立即点击主题按钮，早于 `astro:page-load`，得到无效结果；改为等待页面完成初始化后，三项症状稳定复现。

## 源码与官方规则

- `BaseHead.astro` 的首帧主题脚本只执行一次，`ClientRouter` 切页后新 `html` 丢失 `data-theme` 和 `has-js`。
- `Footer.astro` 的内联 IIFE 只获取首次 DOM 的 `#site-runtime`，定时器继续更新旧节点；新页脚保留 `--`。
- `about.astro` 的普通打包脚本首次执行时直接给当前 `.oshi-card` 绑点击和水面监听；返回时新卡片没有监听。
- Astro 官方《View transitions》说明：打包脚本只执行一次；持续性的初始化应响应 `astro:page-load`，主题应在 `astro:after-swap` 中恢复，以免新页面闪烁。来源：https://docs.astro.build/en/guides/view-transitions/
