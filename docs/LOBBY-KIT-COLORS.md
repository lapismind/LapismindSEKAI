# 配色规范

> **这份文档已不再维护色值。** 设计语言的唯一真源是 [`packages/design-kit`](../packages/design-kit)，
> 色值、字体、圆角、阴影、层次规则都在那里，改设计语言请改 design-kit。
> 本文只说明"为什么"和"新项目怎么接"。

## 为什么收口到 design-kit

这套配色原本散在四处：博客一份 oklch 令牌、三款游戏各抄一份完全相同的 `--color-brand-*` hex、lobby-kit 组件里还硬编码了几个色值。结果是同一个 `#8888CC` 有四个定义，改一次要改四处，而且必然漏掉一处。

更麻烦的是**两边已经悄悄分叉了**：`docs/LOBBY-KIT-COLORS.md` 一直写着页面底应为 `#F2EBF7`（香芋浅紫），而博客实际用的是 `--page-bg: oklch(0.972 0.014 249)` = `#EFF7FF`（极浅冷调白）——因为博客的 `--hue-bg = 283 - 34` 从紫偏到了蓝。文档与实现不一致了很久，没人发现，因为没有任何地方会因此报错。

现在只有一个真源，且 `packages/design-kit/tests/tokens.test.mjs` 会校验 oklch 与 hex 两处定义色相一致。

## 新项目接入

见 [`packages/design-kit/README.md`](../packages/design-kit/README.md)：色值表、层次与字体规则、接入步骤都在那里，本文不重复，避免又变成第二份要同步的副本。

要点只有一条：**项目自己的 `global.css` 只留应用外壳**（`html/body/#app` 的高度、`overscroll-behavior`、整页排版尺度），设计令牌一律不重写。
